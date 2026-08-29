import fs from "node:fs/promises";
import path from "node:path";

type HueConfig = { bridgeIp: string; appKey: string };
type HueCloudConfig = {
  clientId: string;
  clientSecret: string;
  state?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};
type StoredConfig = { hue?: HueConfig; hueCloud?: HueCloudConfig };
const configPath = process.env.SENTINEL_DATA_DIR
  ? path.join(process.env.SENTINEL_DATA_DIR, "automation.json")
  : path.join(process.env.APPDATA ?? process.cwd(), "Sentinel", "automation.json");

function validBridgeIp(value: string) {
  const parts = value.trim().split(".");
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

async function stored(): Promise<StoredConfig> {
  try { return JSON.parse(await fs.readFile(configPath, "utf8")) as StoredConfig; }
  catch { return {}; }
}

export async function getHueConfig(): Promise<HueConfig | undefined> {
  if (process.env.HUE_BRIDGE_URL && process.env.HUE_APPLICATION_KEY) {
    return { bridgeIp: process.env.HUE_BRIDGE_URL.replace(/^https?:\/\//, "").replace(/\/$/, ""), appKey: process.env.HUE_APPLICATION_KEY };
  }
  return (await stored()).hue;
}

async function saveHueConfig(config: HueConfig) {
  const current = await stored();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify({ ...current, hue: config }, null, 2), "utf8");
}

async function saveHueCloudConfig(config: HueCloudConfig) {
  const current = await stored();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify({ ...current, hueCloud: config }, null, 2), "utf8");
}

async function getHueCloudConfig() { return (await stored()).hueCloud; }

const hueOauthOrigin = "https://api.meethue.com/v2/oauth2";
const hueRemoteApi = "https://api.meethue.com/route/api/0";

function relayConfig() {
  // Personal builds keep the relay URL optional because Sentinel's private
  // relay has a stable default. The shared secret remains mandatory.
  const url = (process.env.SENTINEL_RELAY_URL ?? "https://sentinel-relay.reganbelson.workers.dev").replace(/\/$/, "");
  const secret = process.env.SENTINEL_RELAY_SHARED_SECRET;
  if (!secret) throw new Error("Sentinel Relay credentials are required to complete Philips Hue cloud connection.");
  const installationId = process.env.SENTINEL_RELAY_INSTALLATION_ID?.trim();
  return { url, secret, installationId };
}

function relayHeaders(relay: ReturnType<typeof relayConfig>) {
  return {
    Authorization: `Bearer ${relay.secret}`,
    ...(relay.installationId
      ? { "X-Sentinel-Installation": relay.installationId }
      : {}),
  };
}

async function refreshHueCloudToken(config: HueCloudConfig) {
  if (!config.refreshToken) throw new Error("Reconnect Philips Hue to continue.");
  const response = await fetch(`${hueOauthOrigin}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: config.refreshToken }),
  });
  if (!response.ok) throw new Error("Philips Hue could not refresh the cloud connection. Reconnect your Hue account.");
  const token = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number };
  const next = { ...config, accessToken: token.access_token, refreshToken: token.refresh_token ?? config.refreshToken, expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000 };
  await saveHueCloudConfig(next);
  return next;
}

async function activeHueCloudConfig() {
  let config = await getHueCloudConfig();
  if (!config?.accessToken) return undefined;
  if ((config.expiresAt ?? 0) < Date.now() + 60_000) config = await refreshHueCloudToken(config);
  return config;
}

async function hueCloudFetch(endpoint: string, options?: RequestInit) {
  const config = await activeHueCloudConfig();
  if (!config) throw new Error("Philips Hue cloud connection is not complete.");
  const response = await fetch(`${hueRemoteApi}${endpoint}`, {
    ...options,
    headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) throw new Error("Philips Hue cloud request failed. Reconnect Hue if this persists.");
  return response.json();
}

export async function getHueCloudStatus() {
  const config = await getHueCloudConfig();
  const tokenUsable = Boolean(config?.accessToken && (config.expiresAt ?? 0) > Date.now() + 60_000);
  return { configured: Boolean(config?.clientId && config?.clientSecret), connected: tokenUsable, awaitingAuthorisation: Boolean(config?.state && !config?.accessToken) };
}

export async function configureHueCloud(clientId: string, clientSecret: string) {
  if (!clientId.trim() || !clientSecret.trim()) throw new Error("Enter both the Hue Client ID and Client Secret.");
  await saveHueCloudConfig({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
  return getHueCloudStatus();
}

export async function beginHueCloudAuthorisation() {
  const config = await getHueCloudConfig();
  if (!config?.clientId || !config.clientSecret) throw new Error("Save the Hue Client ID and Client Secret first.");
  const state = crypto.randomUUID();
  await saveHueCloudConfig({ ...config, state, accessToken: undefined, refreshToken: undefined, expiresAt: undefined });
  return { url: `${hueOauthOrigin}/authorize?${new URLSearchParams({ client_id: config.clientId, response_type: "code", state }).toString()}` };
}

export async function completeHueCloudAuthorisation() {
  const config = await getHueCloudConfig();
  if (!config?.state) throw new Error("Start Philips Hue authorisation first.");
  const relay = relayConfig();
  const response = await fetch(`${relay.url}/hue/poll?state=${encodeURIComponent(config.state)}`, {
    headers: relayHeaders(relay),
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("The Cloud Relay connection is no longer authorised. Reconnect Cloud Relay in Setup Centre, then start the Hue connection again.");
  }
  if (response.status === 404) {
    throw new Error("The deployed Cloud Relay does not contain the Philips Hue callback. Update the Worker, then try again.");
  }
  if (!response.ok) throw new Error("Sentinel could not retrieve the Hue approval from Cloud Relay. Try again shortly.");
  const data = await response.json() as { result?: { code?: string } };
  const code = data.result?.code;
  if (!code) throw new Error("Approval has not arrived yet. Complete Hue sign-in in your browser, then try again.");
  const tokenResponse = await fetch(`${hueOauthOrigin}/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code }),
  });
  if (!tokenResponse.ok) throw new Error("Hue rejected the authorisation code. Start the connection again.");
  const token = await tokenResponse.json() as { access_token: string; refresh_token: string; expires_in?: number };
  await saveHueCloudConfig({ ...config, state: undefined, accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000 });
  return getHueCloudStatus();
}

async function hueFetch(ip: string, endpoint: string, options?: RequestInit) {
  if (!validBridgeIp(ip)) throw new Error("Enter a valid local Hue Bridge IP address.");
  const response = await fetch(`http://${ip}${endpoint}`, options);
  if (!response.ok) throw new Error("The Hue Bridge did not respond.");
  return response.json();
}

export async function discoverHueBridges() {
  const response = await fetch("https://discovery.meethue.com/");
  if (!response.ok) throw new Error("Hue Bridge discovery is unavailable.");
  const bridges = await response.json() as Array<{ id?: string; internalipaddress?: string }>;
  return bridges.filter(bridge => bridge.internalipaddress && validBridgeIp(bridge.internalipaddress)).map(bridge => ({ id: bridge.id ?? "Hue Bridge", ip: bridge.internalipaddress! }));
}

export async function pairHueBridge(bridgeIp: string) {
  const result = await hueFetch(bridgeIp, "/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ devicetype: "sentinel#desktop" }) }) as Array<{ success?: { username?: string }; error?: { description?: string } }>;
  const appKey = result[0]?.success?.username;
  if (!appKey) throw new Error(result[0]?.error?.description ?? "Pairing failed. Press the button on the Hue Bridge, then try again.");
  await saveHueConfig({ bridgeIp, appKey });
  return { connected: true };
}

export type LightColour = { r: number; g: number; b: number };
export type HueLight = {
  id: string; name: string; on: boolean; brightness: number;
  supportsBrightness: boolean; supportsColour: boolean; supportsColourTemperature: boolean;
  colourTemperature?: number;
};

type HueApiLight = { name?: string; type?: string; state?: { on?: boolean; bri?: number; colormode?: string; xy?: [number, number]; ct?: number } };

function normaliseHueLight(id: string, light: HueApiLight): HueLight {
  const state = light.state ?? {};
  return {
    id, name: light.name ?? `Light ${id}`, on: Boolean(state.on),
    brightness: Math.round(((state.bri ?? 0) / 254) * 100),
    supportsBrightness: "bri" in state,
    supportsColour: "xy" in state || state.colormode === "xy" || /color/i.test(light.type ?? ""),
    supportsColourTemperature: "ct" in state || state.colormode === "ct" || /temperature/i.test(light.type ?? ""),
    colourTemperature: state.ct ? Math.round(1_000_000 / state.ct) : undefined,
  };
}

function rgbToXy({ r, g, b }: LightColour): [number, number] {
  const linear = (value: number) => { const n = Math.max(0, Math.min(255, value)) / 255; return n > .04045 ? Math.pow((n + .055) / 1.055, 2.4) : n / 12.92; };
  const red = linear(r), green = linear(g), blue = linear(b);
  const x = red * .664511 + green * .154324 + blue * .162028;
  const y = red * .283881 + green * .668433 + blue * .047685;
  const z = red * .000088 + green * .07231 + blue * .986039;
  const total = x + y + z;
  return total ? [Number((x / total).toFixed(4)), Number((y / total).toFixed(4))] : [.3227, .329];
}

export async function getHueLights(): Promise<HueLight[]> {
  const cloud = await activeHueCloudConfig();
  if (cloud) {
    const data = await hueCloudFetch("/lights") as Record<string, HueApiLight>;
    return Object.entries(data).map(([id, light]) => normaliseHueLight(id, light));
  }
  const config = await getHueConfig();
  if (!config) throw new Error("Philips Hue is not connected.");
  const data = await hueFetch(config.bridgeIp, `/api/${config.appKey}/lights`) as Record<string, HueApiLight>;
  return Object.entries(data).map(([id, light]) => normaliseHueLight(id, light));
}

export async function setHueLight(id: string, on: boolean) {
  return setHueLightControl(id, { on });
}

export async function setHueLightControl(id: string, control: { on?: boolean; brightness?: number; colour?: LightColour; colourTemperature?: number }) {
  const payload: Record<string, unknown> = {};
  if (typeof control.on === "boolean") payload.on = control.on;
  if (typeof control.brightness === "number") payload.bri = Math.round(Math.max(1, Math.min(100, control.brightness)) * 2.54);
  if (control.colour) payload.xy = rgbToXy(control.colour);
  if (typeof control.colourTemperature === "number") payload.ct = Math.round(1_000_000 / Math.max(2000, Math.min(6500, control.colourTemperature)));
  if (!Object.keys(payload).length) throw new Error("Choose a Hue light setting to change.");
  if (await activeHueCloudConfig()) {
    await hueCloudFetch(`/lights/${encodeURIComponent(id)}/state`, { method: "PUT", body: JSON.stringify(payload) });
    return { id, ...control };
  }
  const config = await getHueConfig();
  if (!config) throw new Error("Philips Hue is not connected.");
  await hueFetch(config.bridgeIp, `/api/${config.appKey}/lights/${encodeURIComponent(id)}/state`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return { id, ...control };
}
