import { app, BrowserWindow, dialog, ipcMain, safeStorage, session, shell } from "electron";

import path from "path";
import { ChildProcess, spawn } from "child_process";
import {
  copyFileSync,
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { fileURLToPath } from "url";
import {
  createHash,
  createSign,
  createVerify,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
} from "crypto";
import { hostname } from "os";
import AdmZip from "adm-zip";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
const backendApiToken = randomBytes(32).toString("base64url");

// Packaged Windows apps do not always retain a valid stdout/stderr pipe. A
// harmless console message must never terminate Sentinel with EPIPE after the
// launching terminal or updater closes its end of the stream.
process.stdout?.on("error", () => undefined);
process.stderr?.on("error", () => undefined);

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

function redactRuntimeDetail(value: unknown, key = ""): unknown {
  if (/key|secret|token|password|authorization/i.test(key)) return "[redacted]";
  if (Array.isArray(value)) return value.map((item) => redactRuntimeDetail(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([entryKey, entryValue]) => [entryKey, redactRuntimeDetail(entryValue, entryKey)]),
    );
  }
  return value;
}

function writeRuntimeLog(level: "info" | "error", message: string, detail?: unknown) {
  try {
    const directory = path.join(app.getPath("userData"), "logs");
    mkdirSync(directory, { recursive: true });
    const suffix = detail === undefined
      ? ""
      : ` ${detail instanceof Error ? detail.message : JSON.stringify(redactRuntimeDetail(detail))}`;
    appendFileSync(path.join(directory, "sentinel-runtime.log"), `${new Date().toISOString()} [${level}] ${message}${suffix}\n`, "utf8");
  } catch {
    // Logging must never prevent Sentinel from starting.
  }
}

const personalConfigDirectory = () =>
  path.join(app.getPath("userData"), "config");
const personalEnvFile = () => path.join(personalConfigDirectory(), ".env");
const isBaseEdition = () =>
  app.isPackaged &&
  existsSync(path.join(process.resourcesPath, "sentinel-base.json"));
const backendPort = () => (isBaseEdition() ? 3002 : 3001);
const backendUrl = () => `http://127.0.0.1:${backendPort()}`;
const sentinelSourceRoot = () => {
  const configuredRoot = process.env.SENTINEL_SOURCE_ROOT;
  if (
    configuredRoot &&
    existsSync(path.join(configuredRoot, "package.json")) &&
    existsSync(path.join(configuredRoot, "src"))
  )
    return configuredRoot;

  const siblingSourceRoot = path.join(
    path.dirname(path.dirname(process.execPath)),
    "jarvis-os",
  );
  if (
    existsSync(path.join(siblingSourceRoot, "package.json")) &&
    existsSync(path.join(siblingSourceRoot, "src"))
  )
    return siblingSourceRoot;

  if (
    existsSync(path.join(process.cwd(), "package.json")) &&
    existsSync(path.join(process.cwd(), "src"))
  )
    return process.cwd();

  return null;
};
const mediaVirtualKeys = {
  previous: 0xb1,
  next: 0xb0,
  playPause: 0xb3,
  stop: 0xb2,
  mute: 0xad,
  volumeDown: 0xae,
  volumeUp: 0xaf,
} as const;

function sendWindowsMediaKey(command: keyof typeof mediaVirtualKeys) {
  if (process.platform !== "win32")
    throw new Error(
      "System media controls are currently supported on Windows only.",
    );

  if (command === "volumeDown" || command === "volumeUp") {
    const volumeInteropSource = `
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
internal class MMDeviceEnumerator {}

internal enum EDataFlow { eRender, eCapture, eAll }
internal enum ERole { eConsole, eMultimedia, eCommunications }

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDeviceEnumerator {
  int EnumAudioEndpoints();
  [PreserveSig] int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice device);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDevice {
  [PreserveSig] int Activate(ref Guid iid, int classContext, IntPtr activationParams,
    [MarshalAs(UnmanagedType.IUnknown)] out object endpoint);
}

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioEndpointVolume {
  int RegisterControlChangeNotify(IntPtr notify);
  int UnregisterControlChangeNotify(IntPtr notify);
  int GetChannelCount(out uint channelCount);
  int SetMasterVolumeLevel(float levelDb, Guid eventContext);
  int SetMasterVolumeLevelScalar(float level, Guid eventContext);
  int GetMasterVolumeLevel(out float levelDb);
  int GetMasterVolumeLevelScalar(out float level);
}

public static class SentinelVolume {
  public static void Adjust(float delta) {
    var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
    IMMDevice device;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out device));

    Guid endpointVolumeId = typeof(IAudioEndpointVolume).GUID;
    object endpointObject;
    Marshal.ThrowExceptionForHR(device.Activate(ref endpointVolumeId, 23, IntPtr.Zero, out endpointObject));
    var endpoint = (IAudioEndpointVolume)endpointObject;

    float current;
    Marshal.ThrowExceptionForHR(endpoint.GetMasterVolumeLevelScalar(out current));
    float target = Math.Max(0f, Math.Min(1f, current + delta));
    Marshal.ThrowExceptionForHR(endpoint.SetMasterVolumeLevelScalar(target, Guid.Empty));
  }
}`;
    const escapedSource = volumeInteropSource.replace(/'/g, "''");
    const delta = command === "volumeUp" ? "0.05" : "-0.05";
    const script = `Add-Type -TypeDefinition '${escapedSource}';[SentinelVolume]::Adjust(${delta})`;
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle",
        "Hidden",
        "-Command",
        script,
      ],
      { windowsHide: true, stdio: "ignore" },
    );
    child.unref();
    return { sent: true, command, stepPercent: 5 };
  }

  const key = mediaVirtualKeys[command];
  const script = `$signature='[DllImport("user32.dll")]public static extern void keybd_event(byte bVk,byte bScan,uint dwFlags,UIntPtr dwExtraInfo);';Add-Type -MemberDefinition $signature -Name NativeMedia -Namespace Sentinel;[Sentinel.NativeMedia]::keybd_event(${key},0,0,[UIntPtr]::Zero);[Sentinel.NativeMedia]::keybd_event(${key},0,2,[UIntPtr]::Zero)`;
  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-WindowStyle",
      "Hidden",
      "-Command",
      script,
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  child.unref();
  return { sent: true, command };
}

const virtualDJCandidates = () => [
  path.join(process.env.ProgramFiles ?? "C:\\Program Files", "VirtualDJ", "virtualdj.exe"),
  path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "VirtualDJ", "virtualdj.exe"),
  path.join(process.env.LOCALAPPDATA ?? "", "VirtualDJ", "virtualdj.exe"),
].filter(Boolean);

function virtualDJPath() {
  return virtualDJCandidates().find((candidate) => existsSync(candidate)) ?? null;
}

function virtualDJRunning() {
  return new Promise<boolean>((resolve) => {
    if (process.platform !== "win32") return resolve(false);
    const check = spawn("tasklist.exe", ["/FI", "IMAGENAME eq virtualdj.exe", "/FO", "CSV", "/NH"], { windowsHide: true });
    let output = "";
    check.stdout?.on("data", (chunk) => { output += String(chunk); });
    check.once("error", () => resolve(false));
    check.once("close", () => resolve(/virtualdj\.exe/i.test(output)));
  });
}

async function virtualDJStatus() {
  const executable = virtualDJPath();
  const bridgeStatus = await virtualDJBridgeStatus();
  return {
    installed: Boolean(executable),
    running: await virtualDJRunning(),
    executable,
    tidalConfigured: existsSync(path.join(app.getPath("documents"), "VirtualDJ")),
    bridge: bridgeStatus.connected ? "connected" as const : "not-connected" as const,
    bridgeConfigured: bridgeStatus.configured,
    bridgePort: bridgeStatus.port,
    bridgeError: bridgeStatus.error,
    decks: bridgeStatus.decks,
  };
}

type VirtualDJBridgeConfig = { port: number; encryptedToken?: string };
const virtualDJBridgeFile = () => path.join(personalConfigDirectory(), "virtualdj-bridge.json");

function readVirtualDJBridgeConfig(): VirtualDJBridgeConfig | null {
  if (!existsSync(virtualDJBridgeFile())) return null;
  try { return JSON.parse(readFileSync(virtualDJBridgeFile(), "utf8")) as VirtualDJBridgeConfig; }
  catch { return null; }
}

function virtualDJBridgeToken(config: VirtualDJBridgeConfig) {
  if (!config.encryptedToken) return "";
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows credential encryption is unavailable.");
  return safeStorage.decryptString(Buffer.from(config.encryptedToken, "base64"));
}

async function virtualDJRequest(mode: "query" | "execute", script: string) {
  const config = readVirtualDJBridgeConfig();
  if (!config) throw new Error("VirtualDJ Network Control is not configured in Sentinel.");
  const token = virtualDJBridgeToken(config);
  const response = await fetch(`http://127.0.0.1:${config.port}/${mode}?script=${encodeURIComponent(script)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal: AbortSignal.timeout(2200),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(response.status === 401 ? "VirtualDJ rejected the bridge password." : `VirtualDJ Network Control returned ${response.status}.`);
  return text.trim();
}

async function virtualDJBridgeStatus() {
  const config = readVirtualDJBridgeConfig();
  if (!config) return { configured: false, connected: false, port: 8080, decks: [] as Array<Record<string, string>>, error: "Install and configure VirtualDJ Network Control." };
  try {
    const [deckValues, crossfader] = await Promise.all([
      Promise.all([1, 2].map(async (deck) => {
      const [title, artist, bpm, key, playing, elapsed, duration] = await Promise.all([
        virtualDJRequest("query", `deck ${deck} get_title`),
        virtualDJRequest("query", `deck ${deck} get_artist`),
        virtualDJRequest("query", `deck ${deck} get_bpm`),
        virtualDJRequest("query", `deck ${deck} get_key`),
        virtualDJRequest("query", `deck ${deck} play`),
        virtualDJRequest("query", `deck ${deck} get_time_ms`),
        virtualDJRequest("query", `deck ${deck} get_songlength`),
      ]);
      const safeValue = (value: string, fallback = "") => /^error[:-]?\d+$/i.test(value.trim()) ? fallback : value;
      return {
        deck: String(deck),
        title: safeValue(title, "Ready for a track"),
        artist: safeValue(artist),
        bpm: safeValue(bpm),
        key: safeValue(key),
        playing: /^(yes|true|on|1)$/i.test(playing) ? "yes" : "no",
        elapsed: safeValue(elapsed, "0"),
        duration: safeValue(duration, "0"),
      };
    })),
      virtualDJRequest("query", "crossfader"),
    ]);
    return { configured: true, connected: true, port: config.port, decks: deckValues, crossfader, sampledAt: new Date().toISOString(), error: "" };
  } catch (error) {
    return { configured: true, connected: false, port: config.port, decks: [] as Array<Record<string, string>>, error: error instanceof Error ? error.message : "VirtualDJ bridge is unavailable." };
  }
}

const virtualDJCommands: Record<string, string> = {
  playPause: "play_pause",
  automix: "automix",
  mixNext: "mix_next",
  skip: "automix_skip",
  mixNow: "mix_now",
  stop: "stop",
  sync: "sync",
  loop4: "loop 4",
  echo: "padfx 'echo' 40% 1bt",
  filter: "filter_activate",
  prepareShow: "browser_window 'automix'",
  startShow: "automix on",
  pauseShow: "automix off & pause",
  cueNext: "mix_next",
  transitionFx: "padfx 'echo' 40% 1bt & mix_next",
  energyBoost: "padfx 'echo' 55% 0.5bt & mix_now",
  endShow: "automix off & deck 1 stop & deck 2 stop",
};

function windowsAudioDevices() {
  return new Promise<{
    available: boolean;
    devices: Array<{ name: string; status: string }>;
  }>((resolve) => {
    if (process.platform !== "win32")
      return resolve({ available: false, devices: [] });
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_SoundDevice | Select-Object Name,Status | ConvertTo-Json -Compress",
      ],
      { windowsHide: true },
    );
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.once("close", () => {
      try {
        const parsed = JSON.parse(output || "[]");
        const list = Array.isArray(parsed) ? parsed : [parsed];
        resolve({
          available: true,
          devices: list.filter(Boolean).map((item) => ({
            name: String(item.Name ?? "Audio device"),
            status: String(item.Status ?? "Unknown"),
          })),
        });
      } catch {
        resolve({ available: true, devices: [] });
      }
    });
    child.once("error", () => resolve({ available: false, devices: [] }));
  });
}

function codexExecutable() {
  const candidates = [
    path.join(process.resourcesPath, "codex", "aarch64-pc-windows-msvc", "bin", "codex.exe"),
    path.join(process.cwd(), "node_modules", "@openai", "codex-win32-arm64", "vendor", "aarch64-pc-windows-msvc", "bin", "codex.exe"),
    path.join(process.cwd(), "node_modules", "@openai", "codex-win32-x64", "vendor", "x86_64-pc-windows-msvc", "bin", "codex.exe"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? "codex";
}

function runCodexDeveloperChat(prompt: string, sourceRoot: string) {
  return new Promise<{ reply: string }>((resolve, reject) => {
    const instruction = [
      "You are Codex Developer inside Sentinel Personal, working against the live source workspace supplied as your current directory.",
      "Inspect the relevant source files before answering every code, implementation, behaviour, regression or capability question. Use read-only searches and diagnostics freely; never claim that no workspace is loaded.",
      "Work in read-only mode. Do not edit files, run destructive commands, install software, expose secrets, or claim a proposed change has been applied.",
      "Lead with the useful outcome. Cite the relative files you inspected, explain the actual implementation in plain British English, and give a concrete proposed fix when appropriate.",
      "If the request is ambiguous, make the safest reasonable interpretation from the source rather than returning a generic limitation statement.",
      "You cannot reveal private chain-of-thought or hidden model reasoning. Do not dwell on that limitation: offer a concise rationale, evidence from visible source, and the next useful developer action instead.",
      "Any source change requires a separately approved developer action. Clearly distinguish inspection, recommendation and applied state.",
      "User request:",
      prompt,
    ].join("\n\n");
    const child = spawn(codexExecutable(), [
      "exec",
      "--json",
      "--sandbox", "read-only",
      "--skip-git-repo-check",
      "-C", sourceRoot,
      instruction,
    ], { cwd: sourceRoot, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Codex took too long to respond."));
    }, 1000 * 60 * 5);
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(stderr.trim() || "Codex could not start. Open Codex once and confirm you are signed in."));
      const messages: string[] = [];
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line) as { type?: string; item?: { type?: string; text?: string }; message?: string };
          if (event.item?.type === "agent_message" && event.item.text) messages.push(event.item.text);
          else if (event.type === "message" && event.message) messages.push(event.message);
        } catch { /* Codex JSONL may include non-result diagnostics. */ }
      }
      const reply = messages[messages.length - 1]?.trim();
      if (!reply) return reject(new Error("Codex finished without returning a response."));
      resolve({ reply });
    });
  });
}

// electron-builder's product name does not reliably determine userData when
// both editions are installed from the same source package. Pin Base before
// any configuration path is read so it can never fall back to jarvis-os or
// Sentinel Personal data.
if (isBaseEdition() && process.env.APPDATA) {
  app.setPath("userData", path.join(process.env.APPDATA, "Sentinel Base"));
}
const updateDirectory = () => path.join(app.getPath("userData"), "updates");
const packageDirectory = () => path.join(updateDirectory(), "packages");
const signingPrivateKey = () =>
  path.join(updateDirectory(), "personal-update-private.pem");
const signingPublicKey = () =>
  path.join(updateDirectory(), "personal-update-public.pem");
const approvedPublicKey = () =>
  path.join(updateDirectory(), "approved-update-public.pem");
const pendingUpdateFile = () =>
  path.join(updateDirectory(), "pending-update.json");
const updateHistoryFile = () =>
  path.join(updateDirectory(), "update-history.json");
const publisherConfigFile = () => path.join(updateDirectory(), "publisher.json");
const xcodeCloudConfigFile = () => path.join(updateDirectory(), "xcode-cloud.json");
const updatePreferencesFile = () => path.join(updateDirectory(), "preferences.json");
const managedUpdateEndpoint = () =>
  (process.env.SENTINEL_UPDATE_ENDPOINT || "https://sentinel-relay.reganbelson.workers.dev")
    .trim()
    .replace(/\/$/, "");

type UpdateManifest = {
  format: "sentinel-update/v1";
  version: string;
  createdAt: string;
  installer: string;
  sha256: string;
  releaseType?: "module" | "maintenance" | "full";
  modules?: string[];
  notes?: string;
  installationPolicy?: "optional" | "required";
  target?: "desktop" | "ios" | "both";
  audience?: "test" | "all";
  testInstallationId?: string;
  mobileContent?: {
    protocolVersion: number;
    modules: string[];
    companionTransport: "cloudflare";
    serviceAccessMode: "independent-cloud";
    sharesApiKeys: false;
    maxCloudFileBytes: number;
  };
};

type ReleaseModule = {
  id: string;
  label: string;
  description: string;
  group: "Core" | "Pages" | "Integrations";
  dependencies: string[];
  risk: "low" | "medium" | "high";
  detected?: boolean;
  newlyDetected?: boolean;
  personalOnly?: boolean;
};

const RELEASE_MODULES: ReleaseModule[] = [
  { id: "core", label: "Sentinel Core", description: "Shared interface, navigation, settings and Base runtime.", group: "Core", dependencies: [], risk: "high" },
  { id: "experience", label: "Experience & Appearance", description: "Colour themes, full-interface palette, status-bar version, sound, motion and startup preferences.", group: "Core", dependencies: ["core"], risk: "low" },
  { id: "user-guide", label: "User guide", description: "Base setup instructions and feature guidance shown from Settings.", group: "Core", dependencies: ["core"], risk: "low" },
  { id: "chat", label: "Chat & voice", description: "Chat, quick command and voice transcription.", group: "Pages", dependencies: ["core"], risk: "medium" },
  { id: "device-scanner", label: "Device Scanner", description: "Network, Bluetooth and trusted-device discovery.", group: "Pages", dependencies: ["core"], risk: "medium" },
  { id: "media", label: "Audio Control", description: "Playback controls, audio sources and Sentinel AI DJ.", group: "Pages", dependencies: ["core"], risk: "low" },
  { id: "navigation", label: "Navigation", description: "Maps, location, routes and places.", group: "Pages", dependencies: ["core"], risk: "medium" },
  { id: "notifications", label: "Notifications", description: "Notification centre, filtering and activity.", group: "Pages", dependencies: ["core"], risk: "low" },
  { id: "security", label: "Security Control", description: "Security dashboard, cameras and smart-home control.", group: "Pages", dependencies: ["core", "integrations"], risk: "high" },
  { id: "system", label: "System Vitals", description: "Hardware monitoring and diagnostics.", group: "Pages", dependencies: ["core"], risk: "medium" },
  { id: "travel", label: "Travel", description: "Trips, readiness, destinations and flight tracking.", group: "Pages", dependencies: ["core"], risk: "low" },
  { id: "weather", label: "Weather", description: "Current, hourly, weekly and radar views.", group: "Pages", dependencies: ["core"], risk: "low" },
  { id: "integrations", label: "Base integrations", description: "Base-safe provider modules and connection framework.", group: "Integrations", dependencies: ["core"], risk: "high" },
  { id: "setup", label: "Base setup", description: "First-run setup, API keys and user integration builder.", group: "Integrations", dependencies: ["core", "integrations"], risk: "high" },
  { id: "companion-sync", label: "Mobile Services & Sync", description: "Base-safe pairing, service permissions, reliability diagnostics, live Talk contracts, trusted devices, clipboard sharing and secure file handoff.", group: "Integrations", dependencies: ["core", "setup"], risk: "high" },
];

const releaseCatalogAuditFile = () =>
  path.join(updateDirectory(), "release-catalog-audit.json");
let cachedReleaseModuleCatalog: ReleaseModule[] | null = null;

function releaseModuleCatalog() {
  if (cachedReleaseModuleCatalog) return cachedReleaseModuleCatalog;
  const sourceRoot = sentinelSourceRoot();
  const discovered: ReleaseModule[] = [];
  const knownIds = new Set(RELEASE_MODULES.map((item) => item.id));
  const pageAliases: Record<string, string> = {
    automation: "security",
    chat: "chat",
    devicescanner: "device-scanner",
    media: "media",
    navigation: "navigation",
    notifications: "notifications",
    system: "system",
    travel: "travel",
    weather: "weather",
  };
  const slug = (value: string) =>
    value
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  const addDirectory = (directory: string, kind: "page" | "module") => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const normalised = entry.name.toLowerCase();
      if (kind === "page" && ["home", "settings"].includes(normalised))
        continue;
      const id =
        kind === "page"
          ? pageAliases[normalised] ?? `page-${slug(entry.name)}`
          : `module-${slug(entry.name)}`;
      if (knownIds.has(id) || discovered.some((item) => item.id === id))
        continue;
      discovered.push({
        id,
        label: entry.name.replace(/([a-z0-9])([A-Z])/g, "$1 $2"),
        description: normalised === "design"
          ? "Automatically detected Personal-only foam insert and 3D-print design workspace."
          : `Automatically detected ${kind} source. Include it when publishing the next Base update.`,
        group: kind === "page" ? "Pages" : "Integrations",
        dependencies: [kind === "page" ? "core" : "integrations"],
        risk: "medium",
        detected: true,
        personalOnly: kind === "page" && normalised === "design",
      });
    }
  };
  if (sourceRoot) {
    addDirectory(path.join(sourceRoot, "src", "pages"), "page");
    addDirectory(path.join(sourceRoot, "src", "modules"), "module");
    addDirectory(path.join(sourceRoot, "backend", "modules"), "module");
  }

  let previouslySeen: string[] = [];
  try {
    if (existsSync(releaseCatalogAuditFile()))
      previouslySeen = JSON.parse(
        readFileSync(releaseCatalogAuditFile(), "utf8"),
      ) as string[];
  } catch {
    previouslySeen = [];
  }
  const currentDetected = discovered.map((item) => item.id);
  const modules = [
    ...RELEASE_MODULES,
    ...discovered.map((item) => ({
      ...item,
      newlyDetected: !previouslySeen.includes(item.id),
    })),
  ];
  ensureUpdateDirectory();
  writeFileSync(
    releaseCatalogAuditFile(),
    JSON.stringify(currentDetected, null, 2),
    "utf8",
  );
  cachedReleaseModuleCatalog = modules;
  return modules;
}

type ReleasePlan = {
  releaseType?: "module" | "maintenance" | "full";
  modules?: string[];
  notes?: string;
  installationPolicy?: "optional" | "required";
  target?: "desktop" | "ios" | "both";
  audience?: "test" | "all";
  testInstallationId?: string;
};

function validateReleasePlan(input: unknown): Required<ReleasePlan> {
  const plan = (input && typeof input === "object" ? input : {}) as ReleasePlan;
  const releaseType = plan.releaseType ?? "full";
  if (!["module", "maintenance", "full"].includes(releaseType))
    throw new Error("Unknown release type.");
  const catalog = releaseModuleCatalog();
  const allowed = new Map(catalog.filter(item => !item.personalOnly).map(item => [item.id, item]));
  const requested = releaseType === "full"
    ? catalog.filter(item => !item.personalOnly).map(item => item.id)
    : [...new Set(plan.modules ?? [])];
  if (!requested.length) throw new Error("Select at least one Base module.");
  if (requested.some(id => !allowed.has(id)))
    throw new Error("The release includes an unknown or Personal-only module.");
  const resolved = new Set<string>();
  const include = (id: string) => {
    if (resolved.has(id)) return;
    const item = allowed.get(id);
    if (!item) throw new Error(`Blocked release dependency: ${id}.`);
    item.dependencies.forEach(include);
    resolved.add(id);
  };
  requested.forEach(include);
  const notes = String(plan.notes ?? "").trim().slice(0, 4000);
  const installationPolicy = plan.installationPolicy ?? "optional";
  if (!["optional", "required"].includes(installationPolicy))
    throw new Error("Unknown installation policy.");
  const target = plan.target ?? "desktop";
  if (!["desktop", "ios", "both"].includes(target)) throw new Error("Unknown release target.");
  const audience = plan.audience ?? "all";
  if (!["test", "all"].includes(audience)) throw new Error("Unknown release audience.");
  const testInstallationId = String(plan.testInstallationId ?? "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 128);
  if (audience === "test" && testInstallationId.length < 8) throw new Error("Choose a valid registered test installation.");
  return { releaseType, modules: [...resolved], notes, installationPolicy, target, audience, testInstallationId };
}

type PendingUpdate = UpdateManifest & { packagePath: string };

type UpdatePreferences = {
  deferredVersion?: string;
  declinedVersion?: string;
};

function ensureUpdateDirectory() {
  mkdirSync(updateDirectory(), { recursive: true });
  mkdirSync(packageDirectory(), { recursive: true });
}

function readUpdatePreferences(): UpdatePreferences {
  try {
    return existsSync(updatePreferencesFile())
      ? (JSON.parse(readFileSync(updatePreferencesFile(), "utf8")) as UpdatePreferences)
      : {};
  } catch {
    return {};
  }
}

function writeUpdatePreferences(value: UpdatePreferences) {
  ensureUpdateDirectory();
  writeFileSync(updatePreferencesFile(), JSON.stringify(value, null, 2), "utf8");
}

function compareVersions(left: string, right: string) {
  const parts = (value: string) => value.split(/[.-]/).slice(0, 4).map(item => Number.parseInt(item, 10) || 0);
  const a = parts(left);
  const b = parts(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) > (b[index] ?? 0) ? 1 : -1;
  }
  return 0;
}

function bootstrapBaseUpdateAuthority() {
  if (!isBaseEdition() || existsSync(approvedPublicKey())) return;
  const bundledAuthority = path.join(process.resourcesPath, "sentinel-update-public.pem");
  if (!existsSync(bundledAuthority)) return;
  const value = readFileSync(bundledAuthority, "utf8");
  if (!value.includes("BEGIN PUBLIC KEY")) return;
  ensureUpdateDirectory();
  copyFileSync(bundledAuthority, approvedPublicKey());
}

async function latestCloudRelease() {
  const response = await fetch(`${managedUpdateEndpoint()}/v1/releases/latest?platform=desktop&installationId=${encodeURIComponent(baseInstallationIdentity())}`, {
    headers: { Accept: "application/json", "X-Sentinel-Registration": baseRegistrationSecret() },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`The update service returned ${response.status}.`);
  const release = (await response.json()) as UpdateManifest & { packageUrl?: string; available?: boolean; publishedAt?: string };
  if (!release.available || release.format !== "sentinel-update/v1" || !release.version)
    return null;
  return release;
}

function baseInstallationIdentity() {
  const identityFile = path.join(app.getPath("userData"), "base-installation-id.txt");
  if (existsSync(identityFile)) return readFileSync(identityFile, "utf8").trim();
  const identity = randomUUID();
  writeFileSync(identityFile, identity, "utf8");
  return identity;
}

function baseRegistrationSecret() {
  const secretFile = path.join(app.getPath("userData"), "base-registration-secret.json");
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows credential encryption is unavailable for secure update registration.");
  if (existsSync(secretFile)) {
    const saved = JSON.parse(readFileSync(secretFile, "utf8")) as { encryptedSecret?: string };
    if (saved.encryptedSecret) return safeStorage.decryptString(Buffer.from(saved.encryptedSecret, "base64"));
  }
  const secret = `${randomUUID()}${randomUUID()}`;
  writeFileSync(secretFile, JSON.stringify({ encryptedSecret: safeStorage.encryptString(secret).toString("base64") }), "utf8");
  return secret;
}

async function registerBaseInstallation() {
  if (!isBaseEdition()) return;
  try {
    await fetch(`${managedUpdateEndpoint()}/v1/installations/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-Sentinel-Registration": baseRegistrationSecret() },
      body: JSON.stringify({
        installationId: baseInstallationIdentity(),
        platform: "windows",
        edition: "base",
        appVersion: app.getVersion(),
        contentVersion: app.getVersion(),
        updateChannel: "stable",
        deviceName: hostname(),
      }),
    });
  } catch (error) {
    console.warn("Base installation registration deferred:", error);
  }
}

type PublisherConfig = { endpoint: string; encryptedToken: string };
type XcodeCloudConfig = { issuerId: string; keyId: string; workflowId: string; encryptedPrivateKey: string };

function readPublisherConfig(): PublisherConfig | null {
  if (!existsSync(publisherConfigFile())) return null;
  try {
    return JSON.parse(readFileSync(publisherConfigFile(), "utf8")) as PublisherConfig;
  } catch {
    return null;
  }
}

function publisherToken(config: PublisherConfig) {
  if (!safeStorage.isEncryptionAvailable())
    throw new Error("Windows credential encryption is unavailable.");
  return safeStorage.decryptString(Buffer.from(config.encryptedToken, "base64"));
}

function readXcodeCloudConfig(): XcodeCloudConfig | null {
  if (!existsSync(xcodeCloudConfigFile())) return null;
  try { return JSON.parse(readFileSync(xcodeCloudConfigFile(), "utf8")) as XcodeCloudConfig; }
  catch { return null; }
}

function xcodeCloudPrivateKey(config: XcodeCloudConfig) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows credential encryption is unavailable.");
  return safeStorage.decryptString(Buffer.from(config.encryptedPrivateKey, "base64"));
}

function base64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function appStoreConnectToken(config: XcodeCloudConfig) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: config.keyId, typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ iss: config.issuerId, iat: now, exp: now + 10 * 60, aud: "appstoreconnect-v1" }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign({ key: xcodeCloudPrivateKey(config), dsaEncoding: "ieee-p1363" });
  return `${unsigned}.${base64Url(signature)}`;
}

async function appStoreConnectRequest(config: XcodeCloudConfig, pathname: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.appstoreconnect.apple.com${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${appStoreConnectToken(config)}`, Accept: "application/json", ...(init.headers || {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const detail = body?.errors?.[0]?.detail || body?.errors?.[0]?.title || `App Store Connect returned ${response.status}.`;
    throw new Error(String(detail).slice(0, 300));
  }
  return body;
}

function validatePublisherEndpoint(value: unknown) {
  if (typeof value !== "string") throw new Error("Enter the update service address.");
  const endpoint = value.trim().replace(/\/$/, "");
  const parsed = new URL(endpoint);
  if (parsed.protocol !== "https:") throw new Error("The update service must use HTTPS.");
  return endpoint;
}

function stableManifest(manifest: UpdateManifest) {
  return JSON.stringify({
    format: manifest.format,
    version: manifest.version,
    createdAt: manifest.createdAt,
    installer: manifest.installer,
    sha256: manifest.sha256,
    releaseType: manifest.releaseType,
    modules: manifest.modules,
    notes: manifest.notes,
    installationPolicy: manifest.installationPolicy,
    target: manifest.target ?? "desktop",
  });
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function findNewestBaseInstaller(sourceRoot: string) {
  const releaseRoot = path.join(sourceRoot, "release");
  if (!existsSync(releaseRoot)) return null;
  const installers: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (/^Sentinel Base-Windows-.*-Setup\.exe$/i.test(entry.name))
        installers.push(fullPath);
    }
  };
  visit(releaseRoot);
  return (
    installers.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] ??
    null
  );
}

function runBaseBuild(sourceRoot: string, releaseVersion: string) {
  if (!existsSync(signingPublicKey()))
    throw new Error("Create the Personal signing key before building Base.");
  const bundledAuthority = path.join(sourceRoot, "build", "sentinel-update-public.pem");
  mkdirSync(path.dirname(bundledAuthority), { recursive: true });
  copyFileSync(signingPublicKey(), bundledAuthority);
  return new Promise<void>((resolve, reject) => {
    const executable =
      process.platform === "win32"
        ? process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe"
        : "npm";
    const args =
      process.platform === "win32"
        ? ["/d", "/s", "/c", `npm run build:base -- --config.extraMetadata.version=${releaseVersion}`]
        : ["run", "build:base", "--", `--config.extraMetadata.version=${releaseVersion}`];
    const child = spawn(executable, args, {
      cwd: sourceRoot,
      env: { ...process.env },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout?.on("data", (data) => (output += String(data)));
    child.stderr?.on("data", (data) => (output += String(data)));
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Base build failed. ${output.slice(-1200)}`));
    });
  });
}

function createSignedUpdate(
  installerPath: string,
  version: string,
  targetPath: string,
  releasePlan?: ReleasePlan,
) {
  const installer = path.basename(installerPath);
  const plan = validateReleasePlan(releasePlan);
  const manifest: UpdateManifest = {
    format: "sentinel-update/v1",
    version,
    createdAt: new Date().toISOString(),
    installer,
    sha256: sha256(readFileSync(installerPath)),
    releaseType: plan.releaseType,
    modules: plan.modules,
    notes: plan.notes,
    installationPolicy: plan.installationPolicy,
    target: plan.target,
    audience: plan.audience,
    testInstallationId: plan.testInstallationId || undefined,
    mobileContent: plan.target === "ios" || plan.target === "both" ? {
      protocolVersion: 2,
      modules: plan.modules,
      companionTransport: "cloudflare",
      serviceAccessMode: "independent-cloud",
      sharesApiKeys: false,
      maxCloudFileBytes: 65 * 1024 * 1024,
    } : undefined,
  };
  const signer = createSign("SHA256");
  signer.update(stableManifest(manifest));
  signer.end();
  const signature = signer.sign(readFileSync(signingPrivateKey()));
  const archive = new AdmZip();
  archive.addLocalFile(installerPath);
  archive.addFile(
    "manifest.json",
    Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
  );
  archive.addFile("signature.sig", signature);
  archive.writeZip(targetPath);
  return manifest;
}

async function developerSessionIsActive(developerToken: unknown) {
  if (typeof developerToken !== "string" || !developerToken) return false;
  try {
    const response = await fetch(`${backendUrl()}/developer/status`, {
      headers: {
        "x-sentinel-developer-token": developerToken,
        "x-sentinel-local-token": backendApiToken,
      },
    });
    const status = (await response.json()) as { unlocked?: boolean };
    return response.ok && status.unlocked === true;
  } catch {
    return false;
  }
}

function readPendingUpdate(): PendingUpdate | null {
  if (!existsSync(pendingUpdateFile())) return null;
  try {
    return JSON.parse(
      readFileSync(pendingUpdateFile(), "utf8"),
    ) as PendingUpdate;
  } catch {
    return null;
  }
}

function verifyUpdatePackage(packagePath: string): UpdateManifest {
  if (!existsSync(approvedPublicKey()))
    throw new Error(
      "No update authority has been approved. Unlock Developer Mode and import the Personal public key first.",
    );
  const archive = new AdmZip(packagePath);
  const manifestEntry = archive.getEntry("manifest.json");
  const signatureEntry = archive.getEntry("signature.sig");
  if (!manifestEntry || !signatureEntry)
    throw new Error("This is not a valid Sentinel update package.");
  const manifest = JSON.parse(
    manifestEntry.getData().toString("utf8"),
  ) as UpdateManifest;
  if (
    manifest.format !== "sentinel-update/v1" ||
    !manifest.version ||
    !manifest.installer ||
    !manifest.sha256
  ) {
    throw new Error("The update manifest is incomplete.");
  }
  if (manifest.modules || manifest.releaseType) {
    const checked = validateReleasePlan(manifest);
    if (JSON.stringify(checked.modules) !== JSON.stringify(manifest.modules))
      throw new Error("The update scope is incomplete or has unresolved dependencies.");
  }
  if (path.basename(manifest.installer) !== manifest.installer)
    throw new Error("The update package contains an unsafe installer name.");
  const installerEntry = archive.getEntry(manifest.installer);
  if (!installerEntry) throw new Error("The update installer is missing.");
  if (sha256(installerEntry.getData()) !== manifest.sha256)
    throw new Error("The update installer checksum does not match.");
  const verifier = createVerify("SHA256");
  verifier.update(stableManifest(manifest));
  verifier.end();
  if (
    !verifier.verify(
      readFileSync(approvedPublicKey()),
      signatureEntry.getData(),
    )
  )
    throw new Error(
      "The update package was not signed by your approved Personal build.",
    );
  return manifest;
}

function verifyPersonalUpdatePackage(packagePath: string): UpdateManifest {
  if (!existsSync(signingPublicKey())) throw new Error("Create the Personal signing key first.");
  const archive = new AdmZip(packagePath);
  const manifestEntry = archive.getEntry("manifest.json");
  const signatureEntry = archive.getEntry("signature.sig");
  if (!manifestEntry || !signatureEntry) throw new Error("The update package is incomplete.");
  const manifest = JSON.parse(manifestEntry.getData().toString("utf8")) as UpdateManifest;
  const installerEntry = archive.getEntry(manifest.installer);
  if (!installerEntry || sha256(installerEntry.getData()) !== manifest.sha256)
    throw new Error("The update package failed its integrity check.");
  const verifier = createVerify("SHA256");
  verifier.update(stableManifest(manifest));
  verifier.end();
  if (!verifier.verify(readFileSync(signingPublicKey()), signatureEntry.getData()))
    throw new Error("The update was not signed by this Sentinel Personal authority.");
  validateReleasePlan(manifest);
  return manifest;
}

async function importPersonalConfiguration() {
  if (!app.isPackaged || isBaseEdition() || existsSync(personalEnvFile()))
    return;

  const choice = await dialog.showMessageBox({
    type: "info",
    title: "Import Sentinel configuration",
    message: "Import your existing Sentinel configuration",
    detail:
      "Select the existing server/.env file once. Sentinel will copy it into this app's private data folder so your keys are not included in the installer.",
    buttons: ["Select configuration file", "Set up later"],
    defaultId: 0,
    cancelId: 1,
  });

  if (choice.response !== 0) return;

  const selection = await dialog.showOpenDialog({
    title: "Select Sentinel server .env file",
    properties: ["openFile"],
    filters: [
      { name: "Environment files", extensions: ["env"] },
      { name: "All files", extensions: ["*"] },
    ],
  });

  if (selection.canceled || !selection.filePaths[0]) return;
  mkdirSync(personalConfigDirectory(), { recursive: true });
  copyFileSync(selection.filePaths[0], personalEnvFile());
}

function startPackagedBackend() {
  if (!app.isPackaged || backendProcess) return;

  const serverRoot = path.join(process.resourcesPath, "server");
  const serverEntry = path.join(serverRoot, "dist", "index.js");
  const siblingSourceRoot = path.join(
    path.dirname(path.dirname(process.execPath)),
    "jarvis-os",
  );
  const developerSourceRoot =
    existsSync(path.join(siblingSourceRoot, "package.json")) &&
    existsSync(path.join(siblingSourceRoot, "src"))
      ? siblingSourceRoot
      : serverRoot;

  if (!existsSync(serverEntry)) {
    console.error(
      "Sentinel backend files were not found in the installed application.",
    );
    return;
  }

  mkdirSync(personalConfigDirectory(), { recursive: true });
  // Electron's embedded Node can be a different CPU architecture to the
  // system Node runtime on Windows-on-ARM. Prefer the installed Node runtime
  // when available so TSX and its native esbuild dependency always match.
  const systemNode =
    process.platform === "win32"
      ? path.join(
          process.env.ProgramW6432 ?? process.env.ProgramFiles ?? "",
          "nodejs",
          "node.exe",
        )
      : "";
  const backendRuntime =
    systemNode && existsSync(systemNode) ? systemNode : process.execPath;
  const backendEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(backendPort()),
    SENTINEL_SOURCE_ROOT: developerSourceRoot,
    SENTINEL_EDITION: isBaseEdition() ? "base" : "personal",
    SENTINEL_LOCAL_API_TOKEN: backendApiToken,
  };
  if (isBaseEdition()) backendEnv.SENTINEL_DATA_DIR = personalConfigDirectory();
  if (backendRuntime === process.execPath)
    backendEnv.ELECTRON_RUN_AS_NODE = "1";

  backendProcess = spawn(backendRuntime, [serverEntry], {
    cwd: personalConfigDirectory(),
    env: backendEnv,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const backendLogDirectory = path.join(personalConfigDirectory(), "logs");
  mkdirSync(backendLogDirectory, { recursive: true });
  const backendLog = path.join(backendLogDirectory, "backend-process.log");
  backendProcess.stdout?.on("data", (chunk) => appendFileSync(backendLog, chunk));
  backendProcess.stderr?.on("data", (chunk) => appendFileSync(backendLog, chunk));

  backendProcess.once("exit", (code) => {
    console.error(`Sentinel backend exited with code ${code ?? "unknown"}.`);
    backendProcess = null;
  });
}

async function waitForBackend(timeoutMs = 30000) {
  if (!app.isPackaged) return;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${backendUrl()}/`, {
        headers: { "x-sentinel-local-token": backendApiToken },
      });
      if (response.ok) return;
    } catch {
      // The packaged TypeScript server takes a few seconds to initialise.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  console.error(
    "Sentinel backend did not become ready before the startup timeout.",
  );
}

// Electron's navigator.geolocation uses Google's Geolocation API from the
// main process. The server already keeps the project's Maps key in server/.env,
// but Electron does not load that file automatically while developing.
function configureGeolocationKey() {
  if (process.env.GOOGLE_API_KEY) return;

  const envFile = app.isPackaged
    ? // app.getPath("userData") is not available early enough for Chromium's
      // startup switches, so derive the standard Windows user-data location.
      path.join(
        process.env.APPDATA ?? "",
        isBaseEdition() ? "Sentinel Base" : "Sentinel Personal",
        "config",
        ".env",
      )
    : path.resolve(process.cwd(), "server", ".env");
  if (!existsSync(envFile)) return;

  const entry = readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .find((line) => line.startsWith("GOOGLE_MAPS_API_KEY="));
  const key = entry?.slice("GOOGLE_MAPS_API_KEY=".length).trim();
  if (key) {
    process.env.GOOGLE_API_KEY = key;
    // Ensure Chromium's network location provider receives the key as well.
    app.commandLine.appendSwitch("google-api-key", key);
  }
}

async function loadSentinelRenderer() {
  if (!mainWindow) return;
  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

async function createWindow(showBootSurface = false) {
  mainWindow = new BrowserWindow({
    width: 1400,

    height: 900,

    // Prevent the native white window flash before React paints Sentinel's
    // startup scene.
    backgroundColor: "#061324",

    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),

      contextIsolation: true,

      nodeIntegration: false,
    },
  });

  if (showBootSurface) {
    const bootHtml = `<!doctype html><meta charset="utf-8"><title>Sentinel</title><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:radial-gradient(circle at 50% 45%,#0a3552,#071326 36%,#030914 100%);font-family:Segoe UI,sans-serif;color:#dffbff}.boot{height:100%;display:grid;place-items:center}.core{position:relative;width:170px;aspect-ratio:1;border:1px solid rgba(100,224,255,.4);border-radius:50%;box-shadow:inset 0 0 45px rgba(50,190,255,.2),0 0 40px rgba(50,190,255,.2);animation:r 1.1s linear infinite}.core:before,.core:after{content:'';position:absolute;border:1px dashed rgba(125,230,255,.34);border-radius:50%}.core:before{inset:18px}.core:after{inset:48px}.dot{position:absolute;top:6px;left:80px;width:11px;height:11px;border-radius:50%;background:#eaffff;box-shadow:0 0 18px 6px #43d8ff}.copy{position:absolute;top:calc(50% + 120px);left:0;right:0;text-align:center}.copy span{display:block;color:#70dffa;font-size:11px;font-weight:800;letter-spacing:.24em}.copy strong{display:block;margin-top:11px;color:white;font-size:18px;letter-spacing:.16em;text-shadow:0 0 20px rgba(97,224,255,.65)}@keyframes r{to{transform:rotate(360deg)}}</style><div class="boot"><div class="core"><i class="dot"></i></div><div class="copy"><span>SENTINEL OS · BOOT PROTOCOL</span><strong>INITIALISING CORE SERVICES</strong></div></div>`;
    void bootHtml;
    await mainWindow.loadFile(path.join(__dirname, "../dist/boot.html"));
  } else {
    await loadSentinelRenderer();
  }

  mainWindow.webContents.on(
    "did-finish-load",

    () => {
      writeRuntimeLog("info", "Renderer loaded");
    },
  );

  mainWindow.webContents.on(
    "did-fail-load",

    (_event, errorCode, errorDescription) => {
      console.error(
        "❌ Failed to load renderer:",

        errorCode,

        errorDescription,
      );
      writeRuntimeLog("error", "Renderer failed to load", { errorCode, errorDescription });
    },
  );

  mainWindow.webContents.on(
    "render-process-gone",

    (_event, details) => {
      console.error(
        "❌ Renderer crashed:",

        details,
      );
      writeRuntimeLog("error", "Renderer process ended", details);
    },
  );
}

// Chromium reads this switch during startup, before `whenReady` fires.
configureGeolocationKey();
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        `http://127.0.0.1:${backendPort()}/*`,
        `http://localhost:${backendPort()}/*`,
      ],
    },
    (details, callback) => {
      details.requestHeaders["X-Sentinel-Local-Token"] = backendApiToken;
      callback({ requestHeaders: details.requestHeaders });
    },
  );
  writeRuntimeLog("info", "Sentinel starting", { version: app.getVersion(), edition: isBaseEdition() ? "base" : "personal" });
  await importPersonalConfiguration();
  bootstrapBaseUpdateAuthority();
  await registerBaseInstallation();
  if (!isBaseEdition()) releaseModuleCatalog();
  await createWindow(true);
  startPackagedBackend();
  await waitForBackend();

  ipcMain.handle("sentinel:shutdown", () => {
    setTimeout(() => app.quit(), 0);
    return { closing: true };
  });

  ipcMain.handle("sentinel:restart", () => {
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 100);
    return { restarting: true };
  });

  ipcMain.handle("sentinel:media-status", () => windowsAudioDevices());
  ipcMain.handle("sentinel:media-command", (_event, command: unknown) => {
    if (typeof command !== "string" || !(command in mediaVirtualKeys))
      throw new Error("Unknown media command.");
    return sendWindowsMediaKey(command as keyof typeof mediaVirtualKeys);
  });
  ipcMain.handle("sentinel:media-open", async (_event, service: unknown) => {
    const destinations: Record<string, string> = {
      spotify: "https://open.spotify.com/",
      youtube: "https://music.youtube.com/",
      bbc: "https://www.bbc.co.uk/sounds",
    };
    if (typeof service !== "string" || service.length > 2048)
      throw new Error("Unknown media service.");
    const destination = destinations[service] ?? service;
    let parsed: URL;
    try {
      parsed = new URL(destination);
    } catch {
      throw new Error("Enter a valid media service website.");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
      throw new Error("Only web links can be opened.");
    await shell.openExternal(parsed.toString());
    return { opened: true };
  });
  ipcMain.handle("sentinel:virtualdj-status", () => virtualDJStatus());
  ipcMain.handle("sentinel:virtualdj-bridge-configure", async (_event, portInput: unknown, tokenInput: unknown) => {
    const port = Number(portInput);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Choose a local bridge port between 1024 and 65535.");
    if (typeof tokenInput !== "string" || tokenInput.length > 256) throw new Error("Enter a valid bridge password.");
    if (tokenInput && !safeStorage.isEncryptionAvailable()) throw new Error("Windows credential encryption is unavailable.");
    mkdirSync(personalConfigDirectory(), { recursive: true });
    const previous = readVirtualDJBridgeConfig();
    const config: VirtualDJBridgeConfig = {
      port,
      encryptedToken: tokenInput ? safeStorage.encryptString(tokenInput).toString("base64") : previous?.encryptedToken,
    };
    writeFileSync(virtualDJBridgeFile(), JSON.stringify(config, null, 2), "utf8");
    const status = await virtualDJBridgeStatus();
    return { saved: true, ...status };
  });
  ipcMain.handle("sentinel:virtualdj-command", async (_event, commandInput: unknown, deckInput: unknown) => {
    if (typeof commandInput !== "string" || !virtualDJCommands[commandInput]) throw new Error("That VirtualDJ command is not approved.");
    const deck = Number(deckInput);
    if (![0, 1, 2].includes(deck)) throw new Error("Choose deck 1, deck 2 or the active deck.");
    const script = commandInput === "stop" && deck === 0
      ? "deck 1 stop & deck 2 stop"
      : `${deck ? `deck ${deck} ` : ""}${virtualDJCommands[commandInput]}`;
    const result = await virtualDJRequest("execute", script);
    return { sent: true, response: result };
  });
  ipcMain.handle("sentinel:virtualdj-launch", async () => {
    const executable = virtualDJPath();
    if (!executable) {
      await shell.openExternal("https://www.virtualdj.com/download/");
      return { launched: false, downloadOpened: true };
    }
    if (await virtualDJRunning()) {
      const focusScript = "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate('VirtualDJ') | Out-Null";
      const focus = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", focusScript], { windowsHide: true, stdio: "ignore" });
      focus.unref();
      return { launched: false, downloadOpened: false, focused: true };
    }
    const error = await shell.openPath(executable);
    if (error) throw new Error(error);
    return { launched: true, downloadOpened: false, focused: false };
  });

  // Chromium asks this before using Windows' location service.  Keeping this
  // explicit avoids an IP-based city estimate being mistaken for live GPS.
  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) =>
      permission === "geolocation" || permission === "media",
  );

  session.defaultSession.setPermissionRequestHandler(
    (
      _webContents,

      permission,

      callback,
    ) => {
      console.log("Permission requested:", permission);

      if (permission === "geolocation" || permission === "media") {
        console.log("📍 Granting geolocation permission.");

        callback(true);

        return;
      }

      callback(false);
    },
  );

  ipcMain.handle(
    "sentinel:open-developer-tools",
    async (_event, developerToken: unknown) => {
      if (typeof developerToken !== "string" || !developerToken)
        return { opened: false, error: "Developer Mode is locked." };
      try {
        const response = await fetch(`${backendUrl()}/developer/status`, {
          headers: {
            "x-sentinel-developer-token": developerToken,
            "x-sentinel-local-token": backendApiToken,
          },
        });
        const status = (await response.json()) as { unlocked?: boolean };
        if (!response.ok || !status.unlocked)
          return {
            opened: false,
            error: "Developer Mode is locked or has expired.",
          };
        mainWindow?.webContents.openDevTools({ mode: "detach" });
        return { opened: true };
      } catch {
        return {
          opened: false,
          error: "Sentinel's local server is unavailable.",
        };
      }
    },
  );

  ipcMain.handle(
    "sentinel:open-source-in-vscode",
    async (_event, developerToken: unknown) => {
      if (isBaseEdition())
        return { opened: false, error: "Source access is Personal-only." };
      if (!(await developerSessionIsActive(developerToken)))
        return {
          opened: false,
          error: "Developer Mode is locked or has expired.",
        };

      const sourceRoot = sentinelSourceRoot();
      if (!sourceRoot)
        return {
          opened: false,
          error: "Sentinel could not locate its editable source workspace.",
        };

      try {
        const sourceUri = `vscode://file/${sourceRoot.replace(/\\/g, "/")}`;
        await shell.openExternal(sourceUri);
        return { opened: true, sourceRoot };
      } catch {
        return {
          opened: false,
          error: "Visual Studio Code could not be opened on this computer.",
        };
      }
    },
  );

  ipcMain.handle("sentinel:codex-status", async (_event, developerToken: unknown) => {
    if (isBaseEdition()) return { available: false, authenticated: false, error: "Codex Developer Chat is Personal-only." };
    if (!(await developerSessionIsActive(developerToken))) return { available: false, authenticated: false, error: "Unlock Developer Mode first." };
    return new Promise((resolve) => {
      const child = spawn(codexExecutable(), ["--version"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let output = "";
      child.stdout?.on("data", (chunk) => { output += String(chunk); });
      child.on("error", () => resolve({ available: false, authenticated: false, error: "Codex is not installed on this computer." }));
      child.on("close", (code) => resolve(code === 0
        ? { available: true, authenticated: true, version: output.trim() }
        : { available: false, authenticated: false, error: "Open Codex and sign in before using Developer Chat." }));
    });
  });

  ipcMain.handle("sentinel:codex-chat", async (_event, developerToken: unknown, prompt: unknown) => {
    if (isBaseEdition()) throw new Error("Codex Developer Chat is Personal-only.");
    if (!(await developerSessionIsActive(developerToken))) throw new Error("Developer Mode is locked or has expired.");
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 60_000) throw new Error("Enter a valid developer request.");
    const sourceRoot = sentinelSourceRoot();
    if (!sourceRoot) throw new Error("Sentinel could not locate its live source workspace.");
    return runCodexDeveloperChat(prompt.trim(), sourceRoot);
  });

  ipcMain.handle("sentinel:update-status", () => ({
    currentVersion: app.getVersion(),
    edition: isBaseEdition() ? "base" : "personal",
    signingKeyReady: existsSync(signingPrivateKey()),
    authorityApproved: existsSync(approvedPublicKey()),
    pending: readPendingUpdate(),
    canRollback: (() => {
      try {
        return (
          existsSync(updateHistoryFile()) &&
          (JSON.parse(readFileSync(updateHistoryFile(), "utf8")) as unknown[])
            .length > 0
        );
      } catch {
        return false;
      }
    })(),
    publisherConfigured: Boolean(readPublisherConfig()),
  }));

  ipcMain.handle("sentinel:update-check", async (_event, manual = false) => {
    if (!isBaseEdition()) return { available: false, currentVersion: app.getVersion() };
    bootstrapBaseUpdateAuthority();
    const release = await latestCloudRelease();
    if (!release || compareVersions(release.version, app.getVersion()) <= 0)
      return { available: false, currentVersion: app.getVersion() };
    const preferences = readUpdatePreferences();
    const declined = release.installationPolicy !== "required" && preferences.declinedVersion === release.version;
    const deferred = preferences.deferredVersion === release.version;
    return {
      available: true,
      currentVersion: app.getVersion(),
      release,
      declined,
      deferred,
      suppressed: !manual && declined,
    };
  });

  ipcMain.handle("sentinel:update-download", async (_event, versionInput: unknown) => {
    if (!isBaseEdition()) throw new Error("Cloud updates are available only in Sentinel Base.");
    if (typeof versionInput !== "string" || !/^\d+(\.\d+){1,3}([-.][A-Za-z0-9.]+)?$/.test(versionInput))
      throw new Error("The release version is invalid.");
    bootstrapBaseUpdateAuthority();
    if (!existsSync(approvedPublicKey())) throw new Error("The Base update authority is missing.");
    const response = await fetch(`${managedUpdateEndpoint()}/v1/releases/${encodeURIComponent(versionInput)}/package?platform=desktop&installationId=${encodeURIComponent(baseInstallationIdentity())}`, { headers: { "X-Sentinel-Registration": baseRegistrationSecret() } });
    if (!response.ok) throw new Error(`The update download failed (${response.status}).`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error("The downloaded update was empty.");
    ensureUpdateDirectory();
    const packagePath = path.join(packageDirectory(), `Sentinel-Base-${versionInput}.sentinel-update`);
    writeFileSync(packagePath, bytes);
    let manifest: UpdateManifest;
    try {
      manifest = verifyUpdatePackage(packagePath);
    } catch (error) {
      try { rmSync(packagePath, { force: true }); } catch { /* best effort */ }
      throw error;
    }
    if (manifest.version !== versionInput) {
      rmSync(packagePath, { force: true });
      throw new Error("The downloaded package version did not match the release.");
    }
    const pending: PendingUpdate = { ...manifest, packagePath };
    writeFileSync(pendingUpdateFile(), JSON.stringify(pending), "utf8");
    return { downloaded: true, version: manifest.version };
  });

  ipcMain.handle("sentinel:update-defer", (_event, versionInput: unknown) => {
    if (!isBaseEdition() || typeof versionInput !== "string") throw new Error("Invalid update preference.");
    const preferences = readUpdatePreferences();
    writeUpdatePreferences({ ...preferences, deferredVersion: versionInput });
    return { deferred: true };
  });

  ipcMain.handle("sentinel:update-decline", async (_event, versionInput: unknown) => {
    if (!isBaseEdition() || typeof versionInput !== "string") throw new Error("Invalid update preference.");
    const release = await latestCloudRelease();
    if (!release || release.version !== versionInput) throw new Error("That release is no longer current.");
    if (release.installationPolicy === "required") throw new Error("Required updates can be installed now or later, but not declined.");
    const preferences = readUpdatePreferences();
    writeUpdatePreferences({ ...preferences, declinedVersion: versionInput });
    return { declined: true };
  });

  ipcMain.handle("sentinel:update-release-catalog", () => {
    if (isBaseEdition()) throw new Error("Release Studio is available only in Sentinel Personal.");
    return {
      modules: releaseModuleCatalog(),
      blocked: [
        "Personal Base-code generator",
        "Personal relay administration",
        "Personal update signing authority",
        "Personal developer administration",
      ],
    };
  });

  ipcMain.handle("sentinel:xcode-cloud-configure", async (_event, developerToken: unknown, issuerInput: unknown, keyInput: unknown, workflowInput: unknown) => {
    if (!(await developerSessionIsActive(developerToken))) throw new Error("Developer Mode is locked.");
    if (isBaseEdition()) throw new Error("Xcode Cloud control is available only in Sentinel Personal.");
    const issuerId = String(issuerInput || "").trim();
    const keyId = String(keyInput || "").trim().toUpperCase();
    const workflowId = String(workflowInput || "").trim();
    if (!/^[A-Za-z0-9-]{8,80}$/.test(issuerId)) throw new Error("Enter the App Store Connect Issuer ID.");
    if (!/^[A-Z0-9]{8,20}$/.test(keyId)) throw new Error("Enter the App Store Connect Key ID.");
    if (!/^[A-Za-z0-9-]{8,100}$/.test(workflowId)) throw new Error("Enter the Xcode Cloud workflow ID.");
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows credential encryption is unavailable.");
    const selection = await dialog.showOpenDialog({ title: "Select the App Store Connect API private key", properties: ["openFile"], filters: [{ name: "App Store Connect private key", extensions: ["p8"] }] });
    if (selection.canceled || !selection.filePaths[0]) return { configured: false, cancelled: true };
    const privateKey = readFileSync(selection.filePaths[0], "utf8").trim();
    if (!privateKey.includes("BEGIN PRIVATE KEY")) throw new Error("The selected file is not a valid App Store Connect .p8 private key.");
    ensureUpdateDirectory();
    const config: XcodeCloudConfig = { issuerId, keyId, workflowId, encryptedPrivateKey: safeStorage.encryptString(privateKey).toString("base64") };
    await appStoreConnectRequest(config, `/v1/ciWorkflows/${encodeURIComponent(workflowId)}`);
    writeFileSync(xcodeCloudConfigFile(), JSON.stringify(config, null, 2), "utf8");
    return { configured: true, connected: true, workflowId };
  });

  ipcMain.handle("sentinel:xcode-cloud-status", async (_event, developerToken: unknown) => {
    if (!(await developerSessionIsActive(developerToken))) throw new Error("Developer Mode is locked.");
    if (isBaseEdition()) throw new Error("Xcode Cloud control is available only in Sentinel Personal.");
    const config = readXcodeCloudConfig();
    if (!config) return { configured: false, connected: false };
    try {
      const [workflow, runs] = await Promise.all([
        appStoreConnectRequest(config, `/v1/ciWorkflows/${encodeURIComponent(config.workflowId)}`),
        appStoreConnectRequest(config, `/v1/ciWorkflows/${encodeURIComponent(config.workflowId)}/buildRuns?limit=1&sort=-createdDate`),
      ]);
      const run = runs?.data?.[0];
      return { configured: true, connected: true, workflowId: config.workflowId, workflowName: workflow?.data?.attributes?.name || "Sentinel iOS", latestRun: run ? { id: run.id, ...run.attributes } : null };
    } catch (error) {
      return { configured: true, connected: false, workflowId: config.workflowId, error: error instanceof Error ? error.message : "Unable to reach Xcode Cloud." };
    }
  });

  ipcMain.handle("sentinel:xcode-cloud-start", async (_event, developerToken: unknown) => {
    if (!(await developerSessionIsActive(developerToken))) throw new Error("Developer Mode is locked.");
    if (isBaseEdition()) throw new Error("Xcode Cloud control is available only in Sentinel Personal.");
    const config = readXcodeCloudConfig();
    if (!config) throw new Error("Connect Xcode Cloud first.");
    const result = await appStoreConnectRequest(config, "/v1/ciBuildRuns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { type: "ciBuildRuns", attributes: {}, relationships: { workflow: { data: { type: "ciWorkflows", id: config.workflowId } } } } }),
    });
    return { started: true, runId: result?.data?.id, createdDate: result?.data?.attributes?.createdDate || new Date().toISOString() };
  });

  ipcMain.handle("sentinel:update-configure-publisher", async (_event, developerToken: unknown, endpointInput: unknown, tokenInput: unknown) => {
    if (!(await developerSessionIsActive(developerToken))) throw new Error("Developer Mode is locked.");
    if (isBaseEdition()) throw new Error("Release publishing is available only in Sentinel Personal.");
    const endpoint = validatePublisherEndpoint(endpointInput);
    if (typeof tokenInput !== "string" || tokenInput.trim().length < 20)
      throw new Error("Enter a valid publishing token.");
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows credential encryption is unavailable.");
    const statusResponse = await fetch(`${endpoint}/v1/releases/publisher-status`, {
      headers: { Authorization: `Bearer ${tokenInput.trim()}`, Accept: "application/json" },
    });
    const statusBody = await statusResponse.text();
    if (!statusResponse.ok)
      throw new Error(`The private update service rejected these details (${statusResponse.status}). ${statusBody.slice(0, 200)}`);
    const serviceStatus = JSON.parse(statusBody) as { authorised?: boolean; releaseBucketReady?: boolean; metadataStoreReady?: boolean };
    if (!serviceStatus.authorised || !serviceStatus.releaseBucketReady || !serviceStatus.metadataStoreReady)
      throw new Error("The update service is reachable, but its release bucket or metadata store is not ready.");
    ensureUpdateDirectory();
    const config: PublisherConfig = {
      endpoint,
      encryptedToken: safeStorage.encryptString(tokenInput.trim()).toString("base64"),
    };
    writeFileSync(publisherConfigFile(), JSON.stringify(config, null, 2), "utf8");
    return { configured: true, endpoint };
  });

  ipcMain.handle("sentinel:update-publisher-status", async (_event, developerToken: unknown) => {
    if (!(await developerSessionIsActive(developerToken))) throw new Error("Developer Mode is locked.");
    if (isBaseEdition()) throw new Error("Release publishing is available only in Sentinel Personal.");
    const config = readPublisherConfig();
    if (!config) return { configured: false, connected: false };
    const response = await fetch(`${config.endpoint}/v1/releases/publisher-status`, {
      headers: { Authorization: `Bearer ${publisherToken(config)}`, Accept: "application/json" },
    });
    const service = await response.json().catch(() => ({})) as { authorised?: boolean; releaseBucketReady?: boolean; metadataStoreReady?: boolean };
    if (!response.ok) return { configured: true, connected: false, endpoint: config.endpoint, error: `Publisher returned ${response.status}.` };
    const latestResponse = await fetch(`${config.endpoint}/v1/releases/latest?platform=desktop`, { headers: { Accept: "application/json" } });
    const latest = latestResponse.ok ? await latestResponse.json() as { version?: string; publishedAt?: string } : null;
    const installationsResponse = await fetch(`${config.endpoint}/v1/installations`, {
      headers: { Authorization: `Bearer ${publisherToken(config)}`, Accept: "application/json" },
    });
    const installationsBody = installationsResponse.ok
      ? await installationsResponse.json() as { installations?: Array<{ installationId: string; platform: "windows" | "ios"; deviceName: string; appVersion: string; contentVersion: string; lastSeenAt: string }> }
      : null;
    return {
      configured: true,
      connected: Boolean(service.authorised && service.releaseBucketReady && service.metadataStoreReady),
      endpoint: config.endpoint,
      latestVersion: latest?.version,
      publishedAt: latest?.publishedAt,
      installations: installationsBody?.installations ?? [],
    };
  });

  ipcMain.handle("sentinel:update-publish", async (_event, developerToken: unknown, packagePathInput: unknown) => {
    if (!(await developerSessionIsActive(developerToken))) throw new Error("Developer Mode is locked.");
    if (isBaseEdition()) throw new Error("Release publishing is available only in Sentinel Personal.");
    if (typeof packagePathInput !== "string" || !existsSync(packagePathInput))
      throw new Error("Build a signed update package before publishing.");
    const config = readPublisherConfig();
    if (!config) throw new Error("Configure the private update service first.");
    const manifest = verifyPersonalUpdatePackage(packagePathInput);
    const packageBuffer = readFileSync(packagePathInput);
    const token = publisherToken(config);
    if (packageBuffer.length > 90 * 1024 * 1024) {
      const initResponse = await fetch(`${config.endpoint}/v1/releases/multipart/init`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ manifest, filename: path.basename(packagePathInput) }),
      });
      const initBody = await initResponse.text();
      if (!initResponse.ok)
        throw new Error(`Multipart publishing could not start (${initResponse.status}). ${initBody.slice(0, 300)} Update the Sentinel Cloudflare Worker to the latest code.`);
      const init = JSON.parse(initBody) as { uploadId: string; objectKey: string };
      const parts: Array<{ partNumber: number; etag: string }> = [];
      const chunkSize = 8 * 1024 * 1024;
      for (let offset = 0, partNumber = 1; offset < packageBuffer.length; offset += chunkSize, partNumber += 1) {
        const chunk = packageBuffer.subarray(offset, Math.min(offset + chunkSize, packageBuffer.length));
        const partResponse = await fetch(
          `${config.endpoint}/v1/releases/multipart/part?uploadId=${encodeURIComponent(init.uploadId)}&objectKey=${encodeURIComponent(init.objectKey)}&partNumber=${partNumber}`,
          { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" }, body: chunk },
        );
        const partBody = await partResponse.text();
        if (!partResponse.ok)
          throw new Error(`Publishing part ${partNumber} failed (${partResponse.status}). ${partBody.slice(0, 300)}`);
        parts.push(JSON.parse(partBody) as { partNumber: number; etag: string });
      }
      const completeResponse = await fetch(`${config.endpoint}/v1/releases/multipart/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: init.uploadId, objectKey: init.objectKey, manifest, parts }),
      });
      const completeBody = await completeResponse.text();
      if (!completeResponse.ok)
        throw new Error(`Publishing could not be completed (${completeResponse.status}). ${completeBody.slice(0, 300)}`);
      return { published: true, version: manifest.version, installationPolicy: manifest.installationPolicy ?? "optional" };
    }
    const form = new FormData();
    form.append("manifest", JSON.stringify(manifest));
    form.append("package", new Blob([packageBuffer], { type: "application/octet-stream" }), path.basename(packagePathInput));
    const response = await fetch(`${config.endpoint}/v1/releases`, {
      method: "POST",
      headers: { Authorization: `Bearer ${publisherToken(config)}` },
      body: form,
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Publishing failed (${response.status}). ${body.slice(0, 300)}`);
    return { published: true, version: manifest.version, installationPolicy: manifest.installationPolicy ?? "optional" };
  });

  ipcMain.handle(
    "sentinel:update-create-key",
    async (_event, developerToken: unknown) => {
      if (!(await developerSessionIsActive(developerToken)))
        throw new Error("Developer Mode is locked.");
      if (isBaseEdition())
        throw new Error(
          "Only Sentinel Personal can create an update signing key.",
        );
      ensureUpdateDirectory();
      if (!existsSync(signingPrivateKey())) {
        const keys = generateKeyPairSync("rsa", {
          modulusLength: 3072,
          publicKeyEncoding: { type: "spki", format: "pem" },
          privateKeyEncoding: { type: "pkcs8", format: "pem" },
        });
        writeFileSync(signingPrivateKey(), keys.privateKey, "utf8");
        writeFileSync(signingPublicKey(), keys.publicKey, "utf8");
      }
      return { ready: true };
    },
  );

  ipcMain.handle(
    "sentinel:update-export-public-key",
    async (_event, developerToken: unknown) => {
      if (!(await developerSessionIsActive(developerToken)))
        throw new Error("Developer Mode is locked.");
      if (isBaseEdition())
        throw new Error("Update signing authority is available only in Sentinel Personal.");
      if (!existsSync(signingPublicKey()))
        throw new Error("Create the Personal signing key first.");
      const target = await dialog.showSaveDialog({
        title: "Export Sentinel update public key",
        defaultPath: "sentinel-update-public.pem",
        filters: [{ name: "Public key", extensions: ["pem"] }],
      });
      if (target.canceled || !target.filePath) return { cancelled: true };
      copyFileSync(signingPublicKey(), target.filePath);
      return { path: target.filePath };
    },
  );

  ipcMain.handle(
    "sentinel:update-create-package",
    async (_event, developerToken: unknown, version: unknown, releasePlan: unknown) => {
      if (!(await developerSessionIsActive(developerToken)))
        throw new Error("Developer Mode is locked.");
      if (isBaseEdition())
        throw new Error("Only Sentinel Personal can create update packages.");
      if (
        typeof version !== "string" ||
        !/^\d+(\.\d+){1,3}([-.][A-Za-z0-9.]+)?$/.test(version.trim())
      )
        throw new Error("Use a version such as 1.1.0.");
      if (!existsSync(signingPrivateKey()))
        throw new Error("Create the Personal signing key first.");
      const selection = await dialog.showOpenDialog({
        title: "Select a Sentinel Base installer",
        properties: ["openFile"],
        filters: [{ name: "Windows installer", extensions: ["exe"] }],
      });
      if (selection.canceled || !selection.filePaths[0])
        return { cancelled: true };
      const installerPath = selection.filePaths[0];
      const plan = validateReleasePlan(releasePlan);
      const installer = path.basename(installerPath);
      const manifest: UpdateManifest = {
        format: "sentinel-update/v1",
        version: version.trim(),
        createdAt: new Date().toISOString(),
        installer,
        sha256: sha256(readFileSync(installerPath)),
        releaseType: plan.releaseType,
        modules: plan.modules,
        notes: plan.notes,
        installationPolicy: plan.installationPolicy,
        target: plan.target,
      };
      const signer = createSign("SHA256");
      signer.update(stableManifest(manifest));
      signer.end();
      const signature = signer.sign(readFileSync(signingPrivateKey()));
      const target = await dialog.showSaveDialog({
        title: "Create signed Sentinel update",
        defaultPath: `Sentinel-Base-${manifest.version}.sentinel-update`,
        filters: [{ name: "Sentinel update", extensions: ["sentinel-update"] }],
      });
      if (target.canceled || !target.filePath) return { cancelled: true };
      const archive = new AdmZip();
      archive.addLocalFile(installerPath);
      archive.addFile(
        "manifest.json",
        Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
      );
      archive.addFile("signature.sig", signature);
      archive.writeZip(target.filePath);
      return { path: target.filePath, version: manifest.version };
    },
  );

  ipcMain.handle(
    "sentinel:update-build-package",
    async (_event, developerToken: unknown, version: unknown, releasePlan: unknown) => {
      if (!(await developerSessionIsActive(developerToken)))
        throw new Error("Developer Mode is locked.");
      if (isBaseEdition())
        throw new Error("Only Sentinel Personal can build release updates.");
      if (
        typeof version !== "string" ||
        !/^\d+(\.\d+){1,3}([-.][A-Za-z0-9.]+)?$/.test(version.trim())
      )
        throw new Error("Use a version such as 1.1.0.");
      if (!existsSync(signingPrivateKey()))
        throw new Error("Create the Personal signing key first.");
      const plan = validateReleasePlan(releasePlan);
      const sourceRoot = sentinelSourceRoot();
      if (!sourceRoot) {
        throw new Error(
          "Sentinel could not locate the Personal source project automatically. Set SENTINEL_SOURCE_ROOT to the project folder and restart Sentinel.",
        );
      }
      if (
        !existsSync(path.join(sourceRoot, "package.json")) ||
        !existsSync(path.join(sourceRoot, "electron-builder.base.json5"))
      )
        throw new Error(
          "That folder is not a complete Sentinel source project.",
        );
      const packageJson = JSON.parse(
        readFileSync(path.join(sourceRoot, "package.json"), "utf8"),
      ) as { scripts?: Record<string, string> };
      if (!packageJson.scripts?.["build:base"])
        throw new Error("This Sentinel source does not define a Base build.");
      const startedAt = Date.now();
      await runBaseBuild(sourceRoot, version.trim());
      const installerPath = findNewestBaseInstaller(sourceRoot);
      if (!installerPath || statSync(installerPath).mtimeMs < startedAt - 2_000)
        throw new Error(
          "The build completed but no new Sentinel Base installer was found.",
        );
      ensureUpdateDirectory();
      const targetPath = path.join(
        packageDirectory(),
        `Sentinel-Base-${version.trim()}.sentinel-update`,
      );
      const manifest = createSignedUpdate(
        installerPath,
        version.trim(),
        targetPath,
        plan,
      );
      const verified = new AdmZip(targetPath);
      if (
        !verified.getEntry("manifest.json") ||
        !verified.getEntry("signature.sig")
      )
        throw new Error(
          "The package was created but failed its final integrity check.",
        );
      return {
        path: targetPath,
        version: manifest.version,
        installerPath,
        modules: manifest.modules,
        releaseType: manifest.releaseType,
      };
    },
  );

  ipcMain.handle(
    "sentinel:update-import-authority",
    async (_event, developerToken: unknown) => {
      if (!(await developerSessionIsActive(developerToken)))
        throw new Error("Developer Mode is locked.");
      if (!isBaseEdition())
        throw new Error("Update authority is configured in Sentinel Base.");
      const selection = await dialog.showOpenDialog({
        title: "Approve Sentinel Personal update authority",
        properties: ["openFile"],
        filters: [{ name: "Public key", extensions: ["pem"] }],
      });
      if (selection.canceled || !selection.filePaths[0])
        return { cancelled: true };
      const value = readFileSync(selection.filePaths[0], "utf8");
      if (!value.includes("BEGIN PUBLIC KEY"))
        throw new Error("That file is not a valid public key.");
      ensureUpdateDirectory();
      writeFileSync(approvedPublicKey(), value, "utf8");
      return { approved: true };
    },
  );

  ipcMain.handle("sentinel:update-select-package", async () => {
    if (!isBaseEdition())
      throw new Error(
        "Update installation is available only in Sentinel Base.",
      );
    const selection = await dialog.showOpenDialog({
      title: "Select signed Sentinel update",
      properties: ["openFile"],
      filters: [{ name: "Sentinel update", extensions: ["sentinel-update"] }],
    });
    if (selection.canceled || !selection.filePaths[0])
      return { cancelled: true };
    const manifest = verifyUpdatePackage(selection.filePaths[0]);
    ensureUpdateDirectory();
    const packagePath = path.join(
      packageDirectory(),
      `Sentinel-Base-${manifest.version}.sentinel-update`,
    );
    copyFileSync(selection.filePaths[0], packagePath);
    const pending: PendingUpdate = { ...manifest, packagePath };
    writeFileSync(pendingUpdateFile(), JSON.stringify(pending), "utf8");
    return { version: manifest.version };
  });

  ipcMain.handle(
    "sentinel:update-install",
    async (_event, developerToken: unknown, usePrevious = false) => {
      if (!isBaseEdition())
        throw new Error(
          "Update installation is available only in Sentinel Base.",
        );
      if (!(await developerSessionIsActive(developerToken)))
        throw new Error("Enter the local developer password before installing this update.");
      const pending = readPendingUpdate();
      if (!pending) throw new Error("Select a verified update package first.");
      const currentHistory = existsSync(updateHistoryFile())
        ? (JSON.parse(
            readFileSync(updateHistoryFile(), "utf8"),
          ) as PendingUpdate[])
        : [];
      const packageToInstall = usePrevious
        ? currentHistory[currentHistory.length - 1]
        : pending;
      if (!packageToInstall)
        throw new Error(
          "No previous verified update is available for rollback.",
        );
      const manifest = verifyUpdatePackage(packageToInstall.packagePath);
      const archive = new AdmZip(packageToInstall.packagePath);
      const installer = archive.getEntry(manifest.installer);
      if (!installer) throw new Error("The verified installer is missing.");
      const stagingDirectory = path.join(
        updateDirectory(),
        "staging",
        `${manifest.version}-${Date.now()}`,
      );
      mkdirSync(stagingDirectory, { recursive: true });
      const installerPath = path.join(stagingDirectory, manifest.installer);
      writeFileSync(installerPath, installer.getData());
      if (!usePrevious)
        writeFileSync(
          updateHistoryFile(),
          JSON.stringify([...currentHistory, pending]),
          "utf8",
        );
      const process = spawn(installerPath, [], {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });
      process.unref();
      setTimeout(() => app.quit(), 400);
      return { installing: true, version: manifest.version };
    },
  );

  await loadSentinelRenderer();
});

app.on(
  "window-all-closed",

  () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  },
);

app.on(
  "activate",

  async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  },
);

app.on("before-quit", () => {
  backendProcess?.kill();
  backendProcess = null;
});
