import fs from "node:fs/promises";
import path from "node:path";

type GoveeConfig = { apiKey: string };
type StoredConfig = { govee?: GoveeConfig };
const configPath = process.env.SENTINEL_DATA_DIR
  ? path.join(process.env.SENTINEL_DATA_DIR, "automation.json")
  : path.join(process.env.APPDATA ?? process.cwd(), "Sentinel", "automation.json");

async function stored(): Promise<StoredConfig> {
  try { return JSON.parse(await fs.readFile(configPath, "utf8")) as StoredConfig; }
  catch { return {}; }
}

async function saveGoveeConfig(config: GoveeConfig) {
  const current = await stored();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify({ ...current, govee: config }, null, 2), "utf8");
}

export async function getGoveeConfig(): Promise<GoveeConfig | undefined> {
  if (process.env.GOVEE_API_KEY) return { apiKey: process.env.GOVEE_API_KEY };
  return (await stored()).govee;
}

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function goveeFetch(endpoint: string, options: RequestInit = {}, attempt = 0): Promise<{ data?: unknown }> {
  const config = await getGoveeConfig();
  if (!config) throw new Error("Govee is not connected.");
  const response = await fetch(`https://developer-api.govee.com/v1${endpoint}`, {
    ...options,
    headers: { "Govee-API-Key": config.apiKey, "Content-Type": "application/json", ...options.headers },
  });
  if (response.status === 401) throw new Error("That Govee API key is not valid.");
  if (response.status === 429) {
    if (attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 8000) : 1000 * 2 ** attempt;
      await wait(delay);
      return goveeFetch(endpoint, options, attempt + 1);
    }
    throw new Error("Govee is busy. Sentinel paused and retried safely, but the provider still asked us to wait. Try the routine again in a minute.");
  }
  if (!response.ok) throw new Error("Govee could not complete that request.");
  return response.json() as Promise<{ data?: unknown }>;
}

export type GoveeDevice = { id: string; model: string; name: string; controllable: boolean; supportsBrightness: boolean; supportsColour: boolean; supportsColourTemperature: boolean };

export async function getGoveeDevices(): Promise<GoveeDevice[]> {
  const payload = await goveeFetch("/devices");
  const devices = (payload.data as { devices?: Array<{ device?: string; model?: string; deviceName?: string; controllable?: boolean; supportCmds?: string[] }> } | undefined)?.devices ?? [];
  return devices.filter(device => device.device && device.model).map(device => ({
    id: device.device!, model: device.model!, name: device.deviceName ?? device.model!, controllable: device.controllable !== false,
    supportsBrightness: device.supportCmds?.includes("brightness") ?? false,
    supportsColour: device.supportCmds?.includes("color") ?? false,
    supportsColourTemperature: device.supportCmds?.includes("colorTem") ?? false,
  }));
}

export async function connectGovee(apiKey: string) {
  if (apiKey.trim().length < 10) throw new Error("Enter a valid Govee API key.");
  await saveGoveeConfig({ apiKey: apiKey.trim() });
  try { return { connected: true, devices: await getGoveeDevices() }; }
  catch (error) { await saveGoveeConfig({ apiKey: "" }); throw error; }
}

export async function setGoveeDevice(id: string, model: string, on: boolean) {
  return setGoveeDeviceControl(id, model, { on });
}

export async function setGoveeDeviceControl(id: string, model: string, control: { on?: boolean; brightness?: number; colour?: { r: number; g: number; b: number }; colourTemperature?: number }) {
  const commands: Array<{ name: string; value: unknown }> = [];
  if (typeof control.on === "boolean") commands.push({ name: "turn", value: control.on ? "on" : "off" });
  if (typeof control.brightness === "number") commands.push({ name: "brightness", value: Math.round(Math.max(1, Math.min(100, control.brightness))) });
  if (control.colour) commands.push({ name: "color", value: { r: Math.round(control.colour.r), g: Math.round(control.colour.g), b: Math.round(control.colour.b) } });
  if (typeof control.colourTemperature === "number") commands.push({ name: "colorTem", value: Math.round(Math.max(2000, Math.min(9000, control.colourTemperature))) });
  if (!commands.length) throw new Error("Choose a Govee device setting to change.");
  for (const cmd of commands) await goveeFetch("/devices/control", { method: "PUT", body: JSON.stringify({ device: id, model, cmd }) });
  return { id, ...control };
}
