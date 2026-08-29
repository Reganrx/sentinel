import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { deleteLocalCompanionItem, listLocalCompanionItems, localCompanionInfo, readLocalCompanionItem, saveLocalCompanionItem, stopLocalCompanion } from "./companionLocal.js";

export type CompanionCommand = {
  id: string;
  source: "companion";
  type: "sentinel.command";
  payload: Record<string, unknown>;
  delivery?: { protocol: number; leaseToken: string };
};

type CompanionConfig = { accessKey: string; localToken: string; createdAt: string };
type AutomationConfig = { companion?: CompanionConfig };
export type CompanionStatus = {
  configured: boolean;
  online: boolean;
  lastHeartbeatAt?: string;
  lastError?: string;
  /** Returned only by explicit enable/pairing operations, never routine status. */
  link?: string;
  devices?: CompanionDevice[];
  serviceAccess?: CompanionServiceAccess[];
  activeDeviceCount?: number;
  lastDeviceSeenAt?: string;
  activityState?: "active" | "recently-seen" | "offline" | "unpaired";
};

export type CompanionServiceAccess = {
  id: "chat" | "navigation" | "weather" | "aviation" | "aircraft";
  label: string;
  configured: boolean;
  accessMode: "desktop-proxy";
};
export type MobileServiceId = "chat" | "navigation" | "weather" | "aviation" | "aircraft";
export type MobileAccessStatus = {
  configured: boolean;
  permissionVersion: number;
  availableServices: MobileServiceId[];
  provisionedServices: MobileServiceId[];
  updatedAt?: string;
};

export type CompanionDevice = {
  id: string;
  name: string;
  platform: string;
  pairedAt: string;
  lastSeenAt?: string;
};

export type CompanionItem = {
  id: string;
  kind: "text" | "file";
  name?: string;
  text?: string;
  mimeType?: string;
  size?: number;
  createdAt: string;
  sourceName?: string;
};

const relayUrl = () =>
  (
    process.env.SENTINEL_RELAY_URL ??
    "https://sentinel-relay.reganbelson.workers.dev"
  ).replace(/\/$/, "");
const relaySecret = () => process.env.SENTINEL_RELAY_SHARED_SECRET ?? "";
const installationId = () => process.env.SENTINEL_RELAY_INSTALLATION_ID ?? "";
let useInstallationAuth = Boolean(installationId());
const configPath = process.env.SENTINEL_DATA_DIR
  ? path.join(process.env.SENTINEL_DATA_DIR, "automation.json")
  : path.join(
      process.env.APPDATA ?? process.cwd(),
      "Sentinel",
      "automation.json",
    );
let timer: NodeJS.Timeout | undefined;
let status: CompanionStatus = { configured: false, online: false };

function companionServiceAccess(): CompanionServiceAccess[] {
  return [
    { id: "chat", label: "Sentinel Chat", configured: Boolean(process.env.OPENAI_API_KEY), accessMode: "desktop-proxy" },
    { id: "navigation", label: "Navigation", configured: Boolean(process.env.GOOGLE_MAPS_API_KEY), accessMode: "desktop-proxy" },
    { id: "weather", label: "Weather", configured: Boolean(process.env.WEATHER_API_KEY), accessMode: "desktop-proxy" },
    { id: "aviation", label: "Flight status", configured: Boolean(process.env.AVIATIONSTACK_API_KEY ?? process.env.FLYSTACK_API_KEY), accessMode: "desktop-proxy" },
    { id: "aircraft", label: "Live aircraft", configured: Boolean(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET), accessMode: "desktop-proxy" },
  ];
}

class RelayRequestError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = "RelayRequestError";
  }
}

async function readConfig(): Promise<AutomationConfig> {
  try {
    return JSON.parse(
      await fs.readFile(configPath, "utf8"),
    ) as AutomationConfig;
  } catch {
    return {};
  }
}

async function writeConfig(config: AutomationConfig) {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
}

function linkFor(accessKey: string) {
  return `${relayUrl()}/companion?key=${encodeURIComponent(accessKey)}${useInstallationAuth && installationId() ? `&installation=${encodeURIComponent(installationId())}` : ""}`;
}

async function request(endpoint: string, init: RequestInit = {}, timeoutMs = 8_000) {
  if (!relaySecret()) throw new Error("Sentinel Relay is not configured.");
  const performRequest = (includeInstallation: boolean) => fetch(`${relayUrl()}${endpoint}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${relaySecret()}`,
        ...(includeInstallation && installationId() ? { "X-Sentinel-Installation": installationId() } : {}),
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  const attemptedInstallationAuth = useInstallationAuth && Boolean(installationId());
  let response = await performRequest(attemptedInstallationAuth);
  if (response.status === 401 && attemptedInstallationAuth) {
    response = await performRequest(false);
    if (response.ok) useInstallationAuth = false;
  }
  if (!response.ok) {
    if (response.status === 401) throw new Error("Sentinel Relay rejected the saved credentials. Re-save the matching relay secret in Setup Centre, then restart Sentinel.");
    throw new RelayRequestError(`Sentinel Relay returned ${response.status}.`, response.status);
  }
  return response;
}

async function relayJson<T>(endpoint: string, init: RequestInit = {}, timeoutMs?: number) {
  const response = await request(endpoint, init, timeoutMs);
  return (await response.json()) as T;
}

export async function getCompanionStatus(): Promise<CompanionStatus> {
  const config = await readConfig();
  let devices: CompanionDevice[] = [];
  let relayError: string | undefined;
  let relayReachable = false;
  if (config.companion) {
    try {
      const result = await relayJson<{ devices?: CompanionDevice[] }>(
        "/companion/devices",
      );
      devices = result.devices ?? [];
      relayReachable = true;
    } catch (error) {
      relayError = error instanceof Error ? error.message : "Sentinel Relay is unavailable.";
    }
  }
  const heartbeatFresh = Boolean(
    status.lastHeartbeatAt &&
    Date.now() - new Date(status.lastHeartbeatAt).getTime() < 30_000,
  );
  const activeDeviceCount = devices.filter((device) =>
    Boolean(device.lastSeenAt) && Date.now() - new Date(device.lastSeenAt!).getTime() < 60_000,
  ).length;
  const lastDeviceSeenAt = devices
    .map((device) => device.lastSeenAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const lastSeenAge = lastDeviceSeenAt ? Date.now() - Date.parse(lastDeviceSeenAt) : Number.POSITIVE_INFINITY;
  const activityState = !devices.length
    ? "unpaired"
    : activeDeviceCount > 0
      ? "active"
      : lastSeenAge < 24 * 60 * 60_000
        ? "recently-seen"
        : "offline";
  const safeStatus = { ...status };
  delete safeStatus.link;
  return {
    ...safeStatus,
    configured: Boolean(config.companion),
    online: Boolean(config.companion) && relayReachable && heartbeatFresh,
    lastError: relayError ?? (!heartbeatFresh && config.companion ? "Companion heartbeat is stale. Sentinel will retry automatically." : undefined),
    devices,
    activeDeviceCount,
    lastDeviceSeenAt,
    activityState,
    serviceAccess: companionServiceAccess(),
  };
}

export function getCompanionServiceAccess() {
  return { mode: "desktop-proxy" as const, sharesApiKeys: false, services: companionServiceAccess() };
}

function mobileCredentials(services: MobileServiceId[]) {
  const all: Record<MobileServiceId, Record<string, string>> = {
    chat: { apiKey: process.env.OPENAI_API_KEY ?? "" },
    navigation: { apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "" },
    weather: { apiKey: process.env.WEATHER_API_KEY ?? "" },
    aviation: { apiKey: process.env.AVIATIONSTACK_API_KEY ?? process.env.FLYSTACK_API_KEY ?? "" },
    aircraft: { clientId: process.env.OPENSKY_CLIENT_ID ?? "", clientSecret: process.env.OPENSKY_CLIENT_SECRET ?? "" },
  };
  return Object.fromEntries(services.map((id) => [id, all[id]]));
}

export async function getMobileAccessStatus(): Promise<MobileAccessStatus> {
  const availableServices = companionServiceAccess().filter((item) => item.configured).map((item) => item.id);
  try {
    const result = await relayJson<Partial<MobileAccessStatus>>("/companion/mobile-access/status");
    return {
      configured: Boolean(result.configured),
      permissionVersion: Number(result.permissionVersion || 1),
      availableServices,
      provisionedServices: (result.provisionedServices ?? []).filter((id): id is MobileServiceId => availableServices.includes(id as MobileServiceId)),
      updatedAt: result.updatedAt,
    };
  } catch {
    return { configured: false, permissionVersion: 1, availableServices, provisionedServices: [] };
  }
}

export async function provisionMobileAccess(requested: MobileServiceId[]) {
  const available = new Set(companionServiceAccess().filter((item) => item.configured).map((item) => item.id));
  const services = [...new Set(requested)].filter((id): id is MobileServiceId => available.has(id));
  if (!services.length) throw new Error("Choose at least one configured cloud service.");
  return relayJson<MobileAccessStatus>("/companion/mobile-access/provision", {
    method: "POST",
    body: JSON.stringify({ permissionVersion: 1, services, credentials: mobileCredentials(services) }),
  });
}

export async function revokeMobileAccess() {
  return relayJson<MobileAccessStatus>("/companion/mobile-access/revoke", { method: "POST" });
}

export async function createCompanionPairingCode() {
  let config = await readConfig();
  if (!config.companion) await enableCompanion();
  config = await readConfig();
  if (config.companion && !config.companion.localToken) {
    config.companion.localToken = randomBytes(32).toString("base64url");
    await writeConfig(config);
  }
  const refreshed = await readConfig();
  const local = refreshed.companion ? localCompanionInfo(refreshed.companion.localToken) : undefined;
  return relayJson<{ code: string; expiresAt: string }>("/companion/pairing-code", {
    method: "POST",
    body: JSON.stringify({ local }),
  });
}

export async function revokeCompanionDevice(deviceId: string) {
  if (!deviceId) throw new Error("Choose a paired device to revoke.");
  return relayJson(`/companion/devices/${encodeURIComponent(deviceId)}`, {
    method: "DELETE",
  });
}

export async function sendCompanionItem(input: {
  kind: "text" | "file";
  text?: string;
  name?: string;
  mimeType?: string;
  data?: string;
  targetDeviceId?: string;
}) {
  if (input.kind === "text" && !input.text?.trim())
    throw new Error("Enter some text to send.");
  if (input.kind === "file" && (!input.data || !input.name))
    throw new Error("Choose a file to send.");
  const bytes = input.data ? Buffer.byteLength(input.data, "base64") : Buffer.byteLength(input.text ?? "");
  if (bytes > 100 * 1024 * 1024)
    throw new Error("Files are limited to 100 MB.");
  const id = randomUUID();
  await saveLocalCompanionItem({ ...input, id, sourceName: "Sentinel Desktop" });
  if (bytes <= 65 * 1024 * 1024) {
    try {
      await relayJson("/companion/items", { method: "POST", body: JSON.stringify({ ...input, id }) }, 120_000);
      return { queued: true, id, transport: "wifi+cloud", cloudBackup: true };
    } catch { return { queued: true, id, transport: "wifi", cloudBackup: false }; }
  }
  return { queued: true, id, transport: "wifi", cloudBackup: false };
}

export async function listCompanionItems() {
  const local = await listLocalCompanionItems() as CompanionItem[];
  try { const cloud = await relayJson<{ items: CompanionItem[] }>("/companion/items"); return { items: [...new Map([...local, ...cloud.items].map((item) => [item.id, item])).values()] }; }
  catch { return { items: local }; }
}

export async function downloadCompanionItem(itemId: string) {
  const local = await readLocalCompanionItem(itemId); if (local) return local as CompanionItem & { data?: string };
  return relayJson<CompanionItem & { data?: string }>(
    `/companion/items/${encodeURIComponent(itemId)}`,
  );
}

export async function deleteCompanionItem(itemId: string) {
  await deleteLocalCompanionItem(itemId);
  try { await relayJson(`/companion/items/${encodeURIComponent(itemId)}`, { method: "DELETE" }); } catch { /* local deletion still succeeds offline */ }
  return { deleted: true };
}

export async function enableCompanion() {
  const config = await readConfig();
  const companion = config.companion ?? {
    accessKey: randomBytes(32).toString("base64url"),
    localToken: randomBytes(32).toString("base64url"),
    createdAt: new Date().toISOString(),
  };
  companion.localToken ||= randomBytes(32).toString("base64url");
  await writeConfig({ ...config, companion });
  localCompanionInfo(companion.localToken);
  try {
    await registerCompanion(companion);
    await heartbeatCompanion();
  } catch (error) {
    status = {
      configured: true,
      online: false,
      lastError:
        error instanceof Error
          ? `Companion is enabled locally and will retry the relay automatically: ${error.message}`
          : "Companion is enabled locally and is waiting for the relay.",
      link: linkFor(companion.accessKey),
    };
  }
  return getCompanionStatus();
}

async function registerCompanion(companion: CompanionConfig) {
  const local = localCompanionInfo(companion.localToken);
  await request("/companion/register", {
    method: "POST",
    body: JSON.stringify({
      accessKey: companion.accessKey,
      name: "Sentinel Personal",
      serviceAccess: companionServiceAccess(),
      sharesApiKeys: false,
      local,
    }),
  });
}

export async function disableCompanion() {
  const config = await readConfig();
  let revokeError: string | undefined;
  if (config.companion) {
    try {
      await request("/companion/revoke", { method: "POST" });
    } catch (error) {
      revokeError =
        error instanceof Error
          ? error.message
          : "The relay could not confirm revocation.";
    }
  }
  delete config.companion;
  stopLocalCompanion();
  await writeConfig(config);
  status = {
    configured: false,
    online: false,
    ...(revokeError
      ? {
          lastError: `Companion disabled on this device. Cloud revocation was not confirmed: ${revokeError}`,
        }
      : {}),
  };
  return status;
}

export async function heartbeatCompanion() {
  const config = await readConfig();
  if (!config.companion) return;
  if (!config.companion.localToken) {
    config.companion.localToken = randomBytes(32).toString("base64url");
    await writeConfig(config);
  }
  const local = localCompanionInfo(config.companion.localToken);
  try {
    const heartbeat = () => request("/companion/heartbeat", {
        method: "POST",
        body: JSON.stringify({
          online: true,
          checkedAt: new Date().toISOString(),
          name: "Sentinel Personal",
          serviceAccess: companionServiceAccess(),
          sharesApiKeys: false,
          local,
        }),
      });
    try {
      await heartbeat();
    } catch (error) {
      if (error instanceof RelayRequestError && (error.statusCode === 404 || error.statusCode === 409)) {
        await registerCompanion(config.companion);
        await heartbeat();
      } else throw error;
    }
    status = {
      configured: true,
      online: true,
      lastHeartbeatAt: new Date().toISOString(),
      link: linkFor(config.companion.accessKey),
    };
  } catch (error) {
    status = {
      configured: true,
      online: false,
      lastError:
        error instanceof Error ? error.message : "Companion heartbeat failed.",
      link: linkFor(config.companion.accessKey),
    };
  }
}

export async function pollCompanionCommand(): Promise<CompanionCommand | null> {
  const config = await readConfig();
  if (!config.companion) return null;
  const response = await request("/companion/poll", { method: "POST", headers: { "X-Sentinel-Delivery": "2" } });
  const payload = (await response.json()) as {
    command?: CompanionCommand | null;
  };
  return payload.command ?? null;
}

export async function companionDelivery(endpoint: "start" | "ack", body: Record<string, unknown>) {
  const response = await request(`/companion/commands/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return response.json() as Promise<{ started?: boolean; acknowledged?: boolean }>;
}

export function startCompanionHeartbeat() {
  if (timer) return;
  void heartbeatCompanion();
  timer = setInterval(() => void heartbeatCompanion(), 10_000);
  timer.unref();
}
