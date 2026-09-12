import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
  scryptSync,
} from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type ModuleId = "hue" | "govee" | "alexa" | "ring" | string;
export type IntegrationModule = {
  id: ModuleId;
  name: string;
  description: string;
  category: "security" | "home" | "assistant" | "custom";
  installed: boolean;
  enabled: boolean;
  builtIn: boolean;
  auth: "api-key" | "oauth" | "local" | "token" | "relay";
  baseUrl?: string;
  healthPath?: string;
  apiKeyHeader?: string;
  credential?: string;
  apiKeyPrefix?: string;
  devicesPath?: string;
  devicesArrayPath?: string;
  deviceIdPath?: string;
  deviceNamePath?: string;
  commands?: IntegrationCommand[];
};
export type IntegrationCommand = {
  id: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH";
  path: string;
  bodyTemplate?: string;
  valueHint?: string;
};

const filePath = process.env.SENTINEL_DATA_DIR
  ? path.join(process.env.SENTINEL_DATA_DIR, "integration-modules.json")
  : path.join(
      process.env.APPDATA ?? process.cwd(),
      "Sentinel",
      "integration-modules.json",
    );
const defaults: IntegrationModule[] = [
  {
    id: "hue",
    name: "Philips Hue",
    description: "Lights, rooms, zones and scenes.",
    category: "home",
    installed: true,
    enabled: true,
    builtIn: true,
    auth: "local",
  },
  {
    id: "govee",
    name: "Govee",
    description: "Lighting and environmental devices.",
    category: "home",
    installed: true,
    enabled: true,
    builtIn: true,
    auth: "api-key",
  },
  {
    id: "alexa",
    name: "Amazon Alexa",
    description: "Voice commands through the Sentinel relay.",
    category: "assistant",
    installed: true,
    enabled: true,
    builtIn: true,
    auth: "relay",
  },
  {
    id: "ring",
    name: "Ring",
    description: "Doorbells, cameras and security events.",
    category: "security",
    installed: true,
    enabled: true,
    builtIn: true,
    auth: "token",
  },
];

function key() {
  return scryptSync(
    `${os.hostname()}|${os.userInfo().username}|sentinel-modules-v1`,
    "sentinel-personal",
    32,
  );
}
function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${data.toString("base64")}`;
}
function open(value?: string) {
  if (!value) return "";
  try {
    const [iv, tag, data] = value.split(".");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}
async function read(): Promise<IntegrationModule[]> {
  try {
    const saved = JSON.parse(
      await fs.readFile(filePath, "utf8"),
    ) as IntegrationModule[];
    return [
      ...defaults.map(
        (item) => saved.find((savedItem) => savedItem.id === item.id) ?? item,
      ),
      ...saved.filter((item) => !item.builtIn),
    ];
  } catch {
    return defaults;
  }
}
async function write(items: IntegrationModule[]) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(items, null, 2), "utf8");
}
export async function listModules() {
  return (await read()).map(({ credential, ...item }) => ({
    ...item,
    configured: Boolean(open(credential)),
  }));
}
export async function moduleIsAvailable(id: string) {
  const item = (await read()).find((module) => module.id === id);
  return Boolean(item?.installed && item.enabled);
}
export async function setModuleState(
  id: string,
  installed: boolean,
  enabled: boolean,
) {
  const items = await read();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) throw new Error("Integration module not found.");
  items[index] = { ...items[index], installed, enabled: installed && enabled };
  await write(items);
  return listModules();
}
export async function removeModule(id: string) {
  const items = await read();
  const item = items.find((module) => module.id === id);
  if (!item) throw new Error("Integration module not found.");
  if (item.builtIn) return setModuleState(id, false, false);
  await write(items.filter((module) => module.id !== id));
  return listModules();
}
export async function saveCustomModule(
  input: Partial<IntegrationModule> & { apiKey?: string },
) {
  if ((process.env.SENTINEL_EDITION ?? "personal") !== "personal")
    throw new Error(
      "The advanced Integration Builder is currently available only in Sentinel Personal.",
    );
  const name = String(input.name ?? "").trim();
  const baseUrl = String(input.baseUrl ?? "").trim();
  if (!name) throw new Error("A service name is required.");
  if (baseUrl && !/^https:\/\//i.test(baseUrl))
    throw new Error("The API address must use HTTPS.");
  const id = `custom-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
  const items = (await read()).filter((item) => item.id !== id);
  const commands = Array.isArray(input.commands)
    ? input.commands
        .filter((command) => command?.name && command?.path)
        .map((command) => ({
          id: String(command.id || command.name)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-"),
          name: String(command.name),
          method: (["GET", "POST", "PUT", "PATCH"].includes(command.method)
            ? command.method
            : "POST") as IntegrationCommand["method"],
          path: safeRelativePath(String(command.path)),
          bodyTemplate: command.bodyTemplate
            ? String(command.bodyTemplate)
            : undefined,
          valueHint: command.valueHint ? String(command.valueHint) : undefined,
        }))
    : [];
  items.push({
    id,
    name,
    description: String(input.description ?? "Custom API integration"),
    category: (["home", "security", "assistant", "custom"].includes(String(input.category))
      ? String(input.category)
      : "custom") as IntegrationModule["category"],
    installed: true,
    enabled: true,
    builtIn: false,
    auth: input.auth === "token" ? "token" : "api-key",
    baseUrl: baseUrl ? baseUrl.replace(/\/$/, "") : undefined,
    healthPath: safeRelativePath(String(input.healthPath ?? "/")),
    apiKeyHeader: String(input.apiKeyHeader ?? "Authorization"),
    apiKeyPrefix: String(input.apiKeyPrefix ?? ""),
    devicesPath: input.devicesPath
      ? safeRelativePath(String(input.devicesPath))
      : undefined,
    devicesArrayPath: String(input.devicesArrayPath ?? "data"),
    deviceIdPath: String(input.deviceIdPath ?? "id"),
    deviceNamePath: String(input.deviceNamePath ?? "name"),
    commands,
    credential: input.apiKey ? seal(input.apiKey.trim()) : undefined,
  });
  await write(items);
  return listModules();
}
function safeRelativePath(value: string) {
  const result = value.startsWith("/") ? value : `/${value}`;
  if (result.includes("://") || result.includes(".."))
    throw new Error("Integration paths must be safe relative API paths.");
  return result;
}
function headers(item: IntegrationModule) {
  const credential = open(item.credential);
  return credential
    ? {
        [item.apiKeyHeader || "Authorization"]:
          `${item.apiKeyPrefix || ""}${credential}`,
      }
    : {};
}
function pathValue(input: unknown, fieldPath?: string): any {
  return (fieldPath || "")
    .split(".")
    .filter(Boolean)
    .reduce((value: any, key) => value?.[key], input as any);
}
function moduleById(items: IntegrationModule[], id: string) {
  const item = items.find((module) => module.id === id);
  if (!item?.baseUrl || item.builtIn)
    throw new Error("Custom module not found.");
  return item;
}
async function providerJson(
  item: IntegrationModule,
  endpoint: string,
  init: RequestInit = {},
) {
  const response = await fetch(`${item.baseUrl}${safeRelativePath(endpoint)}`, {
    ...init,
    headers: { ...headers(item), ...(init.headers || {}) },
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {}
  if (!response.ok)
    throw new Error(
      `Provider returned ${response.status}${typeof body === "object" && body?.message ? `: ${body.message}` : ""}.`,
    );
  return { status: response.status, body };
}
export async function testCustomModule(id: string) {
  const item = moduleById(await read(), id);
  const result = await providerJson(item, item.healthPath || "/");
  return { connected: true, status: result.status };
}
async function loadCustomDevices(id: string) {
  const item = moduleById(await read(), id);
  if (!item.devicesPath)
    throw new Error("A device-list path has not been configured.");
  const { body } = await providerJson(item, item.devicesPath);
  const list = pathValue(body, item.devicesArrayPath);
  if (!Array.isArray(list))
    throw new Error(
      `Device array was not found at ${item.devicesArrayPath || "response root"}.`,
    );
  return list
    .slice(0, 100)
    .map((raw, index) => ({
      id: String(pathValue(raw, item.deviceIdPath) ?? index),
      name: String(
        pathValue(raw, item.deviceNamePath) ??
          pathValue(raw, item.deviceIdPath) ??
          `Device ${index + 1}`,
      ),
      raw,
    }));
}
export async function discoverCustomDevices(id: string) {
  return (await loadCustomDevices(id)).map(({ id, name }) => ({ id, name }));
}
function templateValue(
  token: string,
  device: any,
  value: unknown,
  requestId: string,
) {
  if (token === "value") return value;
  if (token === "requestId") return requestId;
  if (token.startsWith("device.")) return pathValue(device, token.slice(7));
  return "";
}
function renderTemplate(
  template: string,
  device: any,
  value: unknown,
  requestId: string,
) {
  const quoted = template.replace(/"\{\{([^}]+)\}\}"/g, (_match, token) =>
    JSON.stringify(templateValue(token.trim(), device, value, requestId)),
  );
  const rendered = quoted.replace(/\{\{([^}]+)\}\}/g, (_match, token) =>
    JSON.stringify(templateValue(token.trim(), device, value, requestId)),
  );
  try {
    return JSON.parse(rendered);
  } catch {
    throw new Error(
      "Command body is not valid JSON after placeholders are applied.",
    );
  }
}
function renderPath(
  template: string,
  device: any,
  value: unknown,
  requestId: string,
) {
  return safeRelativePath(
    template.replace(/\{\{([^}]+)\}\}/g, (_match, token) =>
      encodeURIComponent(
        String(templateValue(token.trim(), device, value, requestId) ?? ""),
      ),
    ),
  );
}
export async function executeCustomCommand(
  id: string,
  commandId: string,
  deviceId: string,
  value: unknown,
) {
  const item = moduleById(await read(), id);
  const command = item.commands?.find((entry) => entry.id === commandId);
  if (!command) throw new Error("Configured command not found.");
  const devices = await loadCustomDevices(id);
  const selected = devices.find((device) => device.id === deviceId);
  if (!selected)
    throw new Error(
      "Selected device is no longer available from the provider.",
    );
  const requestId = randomUUID();
  const body = command.bodyTemplate
    ? renderTemplate(command.bodyTemplate, selected.raw, value, requestId)
    : undefined;
  const result = await providerJson(
    item,
    renderPath(command.path, selected.raw, value, requestId),
    {
      method: command.method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  return { success: true, status: result.status };
}
