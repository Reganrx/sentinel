import dgram from "node:dgram";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
export type AmazonDevice = {
  id: string;
  name: string;
  model: string;
  connection: "Alexa skill" | "Network" | "Bluetooth";
  address?: string;
  available: boolean;
  firstSeenAt?: string;
  lastSeenAt?: string;
  capabilities?: string[];
};
const amazonPattern = /\b(amazon|alexa|echo|fire tv|firetv|kindle)\b/i;
const clean = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

async function bluetoothDevices(): Promise<AmazonDevice[]> {
  if (process.platform !== "win32") return [];
  const script =
    "Get-PnpDevice -Class Bluetooth -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -match 'Amazon|Alexa|Echo|Fire TV|FireTV|Kindle' } | Select-Object FriendlyName,Status,InstanceId | ConvertTo-Json -Compress";
  try {
    const { stdout } = await run(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, timeout: 8_000 },
    );
    const parsed = stdout.trim() ? JSON.parse(stdout) : [];
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.filter(Boolean).map((row: any) => ({
      id: `bluetooth:${clean(row.InstanceId) || clean(row.FriendlyName)}`,
      name: clean(row.FriendlyName) || "Amazon device",
      model: "Amazon Bluetooth device",
      connection: "Bluetooth" as const,
      available: clean(row.Status).toLowerCase() === "ok",
    }));
  } catch {
    return [];
  }
}

function localDescriptionUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname;
    const local =
      /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\.|^169\.254\.|^fe80:/i.test(
        host,
      );
    return url.protocol === "http:" && local ? url : null;
  } catch {
    return null;
  }
}

async function describe(location: string): Promise<AmazonDevice | null> {
  const url = localDescriptionUrl(location);
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    if (!response.ok) return null;
    const xml = await response.text();
    const value = (tag: string) =>
      clean(xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"))?.[1]);
    const name = value("friendlyName"),
      manufacturer = value("manufacturer"),
      model = value("modelName");
    if (!amazonPattern.test(`${name} ${manufacturer} ${model}`)) return null;
    return {
      id: `network:${url.hostname}:${model || name}`,
      name: name || model || "Amazon device",
      model: model || manufacturer || "Amazon network device",
      connection: "Network",
      address: url.hostname,
      available: true,
    };
  } catch {
    return null;
  }
}

async function networkDevices(): Promise<AmazonDevice[]> {
  const locations = await new Promise<Set<string>>((resolve) => {
    const found = new Set<string>(),
      socket = dgram.createSocket("udp4");
    const finish = () => {
      try {
        socket.close();
      } catch {}
      resolve(found);
    };
    socket.on("message", (message) => {
      const location = message
        .toString()
        .match(/^location:\s*(.+)$/im)?.[1]
        ?.trim();
      if (location) found.add(location);
    });
    socket.on("error", finish);
    socket.bind(() => {
      const request = Buffer.from(
        'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n',
      );
      socket.send(request, 1900, "239.255.255.250");
      setTimeout(finish, 3_000).unref();
    });
  });
  return (await Promise.all([...locations].slice(0, 60).map(describe))).filter(
    (device): device is AmazonDevice => Boolean(device),
  );
}

const relayUrl = () =>
  (
    process.env.SENTINEL_RELAY_URL ??
    "https://sentinel-relay.reganbelson.workers.dev"
  ).replace(/\/$/, "");
const relaySecret = () => process.env.SENTINEL_RELAY_SHARED_SECRET ?? "";
const installationId = () => process.env.SENTINEL_RELAY_INSTALLATION_ID ?? "";
async function relay(endpoint: string, init: RequestInit = {}) {
  if (!relaySecret()) return null;
  const response = await fetch(`${relayUrl()}${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${relaySecret()}`,
      ...(installationId()
        ? { "X-Sentinel-Installation": installationId() }
        : {}),
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok)
    throw new Error(`Amazon device relay returned ${response.status}.`);
  return response.json() as Promise<any>;
}

async function cloudDevices(): Promise<AmazonDevice[]> {
  try {
    const result = await relay("/alexa/devices");
    return (result?.devices ?? []).map((device: any) => {
      const capabilities = Array.isArray(device.supportedInterfaces)
        ? device.supportedInterfaces.map(String)
        : [];
      const hasScreen = capabilities.some((item: string) =>
        /APL|Display|VideoApp/i.test(item),
      );
      const suffix = String(device.deviceId).slice(-6).toUpperCase();
      return {
        id: `alexa:${device.deviceId}`,
        name: clean(device.name) || `Echo device ${suffix}`,
        model: hasScreen
          ? "Echo with screen"
          : capabilities.includes("AudioPlayer")
            ? "Echo speaker"
            : "Amazon Alexa device",
        connection: "Alexa skill" as const,
        available:
          Boolean(device.lastSeenAt) &&
          Date.now() - new Date(device.lastSeenAt).getTime() < 10 * 60_000,
        firstSeenAt: clean(device.firstSeenAt),
        lastSeenAt: clean(device.lastSeenAt),
        capabilities,
      };
    });
  } catch {
    return [];
  }
}

export async function discoverAmazonDevices() {
  const combined = [
    ...(await cloudDevices()),
    ...(await bluetoothDevices()),
    ...(await networkDevices()),
  ];
  return [
    ...new Map(
      combined.map((device) => [
        `${device.name.toLowerCase()}|${device.address ?? device.connection}`,
        device,
      ]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

export async function renameAmazonDevice(id: string, name: string) {
  if (!id.startsWith("alexa:") || !name.trim())
    throw new Error("Select a cloud-registered Echo and enter a name.");
  await relay(`/alexa/devices/${encodeURIComponent(id.slice(6))}`, {
    method: "PATCH",
    body: JSON.stringify({ name: name.trim() }),
  });
  return { renamed: true };
}

export async function forgetAmazonDevice(id: string) {
  if (!id.startsWith("alexa:"))
    throw new Error("Only cloud-registered Alexa devices can be forgotten.");
  await relay(`/alexa/devices/${encodeURIComponent(id.slice(6))}`, {
    method: "DELETE",
  });
  return { forgotten: true };
}
