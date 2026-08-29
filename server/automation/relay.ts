import { getGoveeDevices, setGoveeDevice, setGoveeDeviceControl } from "./govee.js";
import { getHueLights, setHueLight, setHueLightControl } from "./hue.js";
import { pollCompanionCommand, companionDelivery } from "./companion.js";
import { approvedMobileCommand } from "./mobileCommandPolicy.js";

type RelayCommand = {
  id: string;
  source: "alexa" | "ring" | "companion" | "sentinel-ios";
  type: "hue.set" | "govee.set" | "sentinel.say" | "sentinel.command";
  payload: Record<string, unknown>;
  delivery?: { protocol: number; leaseToken: string };
};

type RelayStatus = {
  configured: boolean;
  connected: boolean;
  lastCheckedAt?: string;
  lastCommandAt?: string;
  lastError?: string;
};

const currentRelayUrl = () =>
  (
    process.env.SENTINEL_RELAY_URL ??
    "https://sentinel-relay.reganbelson.workers.dev"
  ).replace(/\/$/, "");
const currentRelaySecret = () => process.env.SENTINEL_RELAY_SHARED_SECRET ?? "";
const currentInstallationId = () =>
  process.env.SENTINEL_RELAY_INSTALLATION_ID ?? "";
const relayHeaders = () => ({
  Authorization: `Bearer ${currentRelaySecret()}`,
  ...(currentInstallationId()
    ? { "X-Sentinel-Installation": currentInstallationId() }
    : {}),
});
let status: RelayStatus = {
  configured: Boolean(currentRelayUrl() && currentRelaySecret()),
  connected: false,
};
let timer: NodeJS.Timeout | undefined;

export function getRelayStatus(): RelayStatus {
  return { ...status };
}

async function applyCommand(command: RelayCommand) {
  const approvedCommand = approvedMobileCommand(command);
  if (approvedCommand !== null) {
    await applySpokenAutomationCommand(approvedCommand);
    return;
  }
  switch (command.type) {
    case "hue.set":
      await setHueLight(
        String(command.payload.lightId),
        Boolean(command.payload.on),
      );
      return;
    case "govee.set":
      await setGoveeDevice(
        String(command.payload.deviceId),
        String(command.payload.model),
        Boolean(command.payload.on),
      );
      return;
    case "sentinel.say":
      // The desktop client will expose spoken/status announcements in a later Alexa step.
      console.log(
        `[Relay] Sentinel announcement: ${String(command.payload.message ?? "")}`,
      );
      return;
    case "sentinel.command":
      await applySpokenAutomationCommand(String(command.payload.command ?? ""));
      return;
  }
}

export async function applySpokenAutomationCommand(rawCommand: string) {
  const command = rawCommand.trim().toLocaleLowerCase("en-GB");
  const on = /\b(turn|switch)\s+on\b/.test(command);
  const off = /\b(turn|switch)\s+off\b/.test(command);
  const colours: Record<string, { r: number; g: number; b: number }> = { red: { r: 255, g: 0, b: 0 }, orange: { r: 255, g: 110, b: 0 }, yellow: { r: 255, g: 220, b: 0 }, green: { r: 0, g: 210, b: 90 }, blue: { r: 0, g: 100, b: 255 }, purple: { r: 145, g: 65, b: 255 }, pink: { r: 255, g: 70, b: 160 }, white: { r: 255, g: 255, b: 255 }, cyan: { r: 0, g: 220, b: 255 }, teal: { r: 0, g: 180, b: 170 } };
  const colourName = Object.keys(colours).find((name) => new RegExp(`\\b${name}\\b`).test(command));
  const brightnessMatch = command.match(/\b(\d{1,3})\s*(?:%|percent)\b/);
  const brightness = brightnessMatch ? Math.max(1, Math.min(100, Number(brightnessMatch[1]))) : undefined;
  const temperature = /\b(warm|cosy)\b/.test(command) ? 2700 : /\b(cool|daylight)\b/.test(command) ? 5500 : undefined;
  if (!on && !off && !colourName && brightness === undefined && temperature === undefined)
    throw new Error("Sentinel could not determine the requested smart-light setting.");

  const desiredState = on;
  const target = command
    .replace(/\b(turn|switch)\s+(on|off)\b/g, "")
    .replace(/\b(the|my|a|an)\b/g, "")
    .replace(/\b(lights?|devices?)\b/g, "")
    .replace(/\b(set|make|change|colour|color|brightness|temperature|to|at|percent|warm|cosy|cool|daylight|red|orange|yellow|green|blue|purple|pink|white|cyan|teal)\b/g, "")
    .replace(/\b\d{1,3}\s*%?\b/g, "")
    .trim();

  const [hueLights, goveeDevices] = await Promise.all([
    getHueLights().catch(() => []),
    getGoveeDevices().catch(() => []),
  ]);
  const allDevices = /^(all|everything|)$/i.test(target);

  const hueMatches = hueLights.filter(
    (light) =>
      allDevices ||
      light.name.toLocaleLowerCase("en-GB").includes(target) ||
      target.includes(light.name.toLocaleLowerCase("en-GB")),
  );
  const goveeMatches = goveeDevices.filter(
    (device) =>
      allDevices ||
      device.name.toLocaleLowerCase("en-GB").includes(target) ||
      target.includes(device.name.toLocaleLowerCase("en-GB")),
  );
  if (hueMatches.length + goveeMatches.length === 0)
    throw new Error(`No connected device matches “${rawCommand}”.`);

  const control = { ...(on || off ? { on: on && !off } : { on: true }), ...(colourName ? { colour: colours[colourName] } : {}), ...(brightness !== undefined ? { brightness } : {}), ...(temperature ? { colourTemperature: temperature } : {}) };
  const supportedHue = hueMatches.filter((light) => (!colourName || light.supportsColour) && (brightness === undefined || light.supportsBrightness) && (!temperature || light.supportsColourTemperature));
  const supportedGovee = goveeMatches.filter((device) => device.controllable && (!colourName || device.supportsColour) && (brightness === undefined || device.supportsBrightness) && (!temperature || device.supportsColourTemperature));
  if (!supportedHue.length && !supportedGovee.length) throw new Error("The matching device does not support that light setting.");
  await Promise.all([...supportedHue.map((light) => setHueLightControl(light.id, control)), ...supportedGovee.map((device) => setGoveeDeviceControl(device.id, device.model, control))]);
  console.log(
    `[Relay] ${desiredState ? "Turned on" : "Turned off"}: ${rawCommand}`,
  );
  return { on: on && !off, colour: colourName, brightness, colourTemperature: temperature, devices: [...supportedHue.map((light) => light.name), ...supportedGovee.map((device) => device.name)] };
}

let polling = false;
const pendingAcks = new Map<string, { channel: "relay" | "companion"; body: Record<string, unknown>; expiresAt: number }>();

async function delivery(channel: "relay" | "companion", endpoint: "start" | "ack", body: Record<string, unknown>) {
  if (channel === "companion") return companionDelivery(endpoint, body);
  const response = await fetch(`${currentRelayUrl()}/commands/${endpoint}`, { method: "POST", headers: { ...relayHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Relay delivery returned ${response.status}.`);
  return response.json() as Promise<{ started?: boolean; acknowledged?: boolean }>;
}

async function executeDelivery(channel: "relay" | "companion", command: RelayCommand) {
  const key = `${channel}:${command.id}`;
  if (pendingAcks.has(key)) return;
  // Compatibility with the old deployed Worker until the coordinated upgrade.
  if (!command.delivery) { await applyCommand(command); return; }
  if (command.delivery.protocol !== 2 || !command.delivery.leaseToken) throw new Error("Unsupported command delivery protocol.");
  const body = { commandId: command.id, leaseToken: command.delivery.leaseToken };
  const started = await delivery(channel, "start", body);
  if (!started.started) return;
  let outcome: "completed" | "failed" = "completed";
  try { await applyCommand(command); }
  catch { outcome = "failed"; }
  // Retry acknowledgement only, never repeat the smart-home action.
  pendingAcks.set(key, { channel, body: { ...body, outcome }, expiresAt: Date.now() + 86400000 });
  const result = await delivery(channel, "ack", { ...body, outcome });
  if (result.acknowledged) pendingAcks.delete(key);
  if (outcome === "failed") throw new Error("Desktop command failed or is not supported. No automatic execution retry was made.");
  status = { ...status, lastCommandAt: new Date().toISOString() };
}

async function pollRelay() {
  if (polling) return;
  const relayUrl = currentRelayUrl();
  const relaySecret = currentRelaySecret();
  status.configured = Boolean(relayUrl && relaySecret);
  if (!status.configured) return;
  polling = true;
  try {
    const errors: string[] = [];
    for (const [key, ack] of pendingAcks) {
      if (ack.expiresAt <= Date.now()) {
        pendingAcks.delete(key);
        errors.push("A command acknowledgement expired. Its result was not confirmed.");
        continue;
      }
      try { if ((await delivery(ack.channel, "ack", ack.body)).acknowledged) pendingAcks.delete(key); }
      catch { errors.push("A desktop command acknowledgement is pending."); }
    }
    await Promise.all([
      (async () => {
    const response = await fetch(`${relayUrl}/poll`, {
      method: "POST",
      headers: { ...relayHeaders(), "X-Sentinel-Delivery": "2" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Relay returned ${response.status}.`);

    const payload = (await response.json()) as {
      command?: RelayCommand | null;
    };
    if (payload.command) {
      await executeDelivery("relay", payload.command);
    }
      })().catch(error => errors.push(error instanceof Error ? error.message : "Relay polling failed.")),
      (async () => {
    const companionCommand = await pollCompanionCommand();
    if (companionCommand) {
      await executeDelivery("companion", companionCommand);
    }
      })().catch(error => errors.push(error instanceof Error ? error.message : "Companion polling failed.")),
    ]);
    status = { ...status, connected: errors.length === 0, lastCheckedAt: new Date().toISOString(), lastError: errors[0] };
  } catch (error) {
    status = {
      ...status,
      connected: false,
      lastCheckedAt: new Date().toISOString(),
      lastError:
        error instanceof Error ? error.message : "Relay request failed.",
    };
  } finally { polling = false; }
}

export function startRelayPolling() {
  status.configured = Boolean(currentRelayUrl() && currentRelaySecret());
  if (!status.configured || timer) return;
  void pollRelay();
  timer = setInterval(() => void pollRelay(), 3_000);
  timer.unref();
  console.log(`[Relay] Connected polling enabled for ${currentRelayUrl()}`);
}

export async function refreshRelayConnection() {
  status = {
    configured: Boolean(currentRelayUrl() && currentRelaySecret()),
    connected: false,
  };
  if (!status.configured)
    throw new Error("Enter the Alexa relay URL and shared secret.");
  await pollRelay();
  if (!status.connected)
    throw new Error(
      status.lastError || "The Alexa relay rejected the connection.",
    );
  startRelayPolling();
  return getRelayStatus();
}
