import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { scanDevices } from "../device/deviceScanner.js";
import { hasActiveDeveloperSession } from "../security/developerAccess.js";

const PORT = 3217;
const MAX_BYTES = 100 * 1024 * 1024;
const MAX_CHAT_BYTES = 256 * 1024;
const mediaKeys: Record<string, number> = { previous: 0xb1, next: 0xb0, playPause: 0xb3, stop: 0xb2, mute: 0xad, volumeDown: 0xae, volumeUp: 0xaf };
let server: ReturnType<typeof createServer> | undefined;
let currentToken = "";
const store = path.join(process.env.SENTINEL_DATA_DIR ?? path.join(process.env.APPDATA ?? process.cwd(), "Sentinel"), "companion-items");

export type LocalCompanionItem = Record<string, unknown> & { id: string; createdAt: string };

export async function saveLocalCompanionItem(input: Record<string, unknown>) {
  await fs.mkdir(store, { recursive: true });
  const data = typeof input.data === "string" ? input.data : "";
  const text = typeof input.text === "string" ? input.text : "";
  const bytes = data ? Buffer.byteLength(data, "base64") : Buffer.byteLength(text);
  if (bytes > MAX_BYTES) throw new Error("Files are limited to 100 MB over Wi-Fi.");
  const id = typeof input.id === "string" && /^[a-zA-Z0-9-]+$/.test(input.id) ? input.id : randomUUID();
  const createdAt = typeof input.createdAt === "string" ? input.createdAt : new Date().toISOString();
  const size = typeof input.size === "number" ? input.size : bytes;
  const item: LocalCompanionItem = { ...input, id, size, createdAt, transport: "wifi" };
  await fs.writeFile(path.join(store, `${id}.json`), JSON.stringify(item), "utf8");
  return item;
}

export async function listLocalCompanionItems() {
  await fs.mkdir(store, { recursive: true });
  const names = await fs.readdir(store).catch(() => []); const items: Record<string, unknown>[] = [];
  for (const name of names.filter((x) => x.endsWith(".json"))) {
    const item = JSON.parse(await fs.readFile(path.join(store, name), "utf8"));
    const summary = { ...item };
    delete summary.data;
    items.push(summary);
  }
  return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function readLocalCompanionItem(id: string) {
  try { return JSON.parse(await fs.readFile(path.join(store, `${id}.json`), "utf8")); } catch { return undefined; }
}

export async function deleteLocalCompanionItem(id: string) { await fs.unlink(path.join(store, `${id}.json`)).catch(() => undefined); }

function privateAddress() {
  for (const entries of Object.values(networkInterfaces())) for (const entry of entries ?? []) {
    if (entry.family !== "IPv4" || entry.internal) continue;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address)) return entry.address;
  }
}

function reply(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET,POST,DELETE,OPTIONS" });
  res.end(JSON.stringify(value));
}

async function body(req: IncomingMessage) {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { const value = Buffer.from(chunk); size += value.length; if (size > MAX_BYTES * 1.4) throw new Error("File exceeds 100 MB."); chunks.push(value); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") return reply(res, 204, {});
  if (req.headers.authorization !== `Bearer ${currentToken}`) return reply(res, 401, { error: "This device is not paired." });
  const url = new URL(req.url ?? "/", "http://sentinel.local");
  if (url.pathname === "/health") return reply(res, 200, { online: true, transport: "wifi", maxFileBytes: MAX_BYTES });
  if (url.pathname === "/status" && req.method === "GET") return reply(res, 200, { online: true, transport: "wifi" });
  if (url.pathname === "/devices/scan" && req.method === "GET") {
    if (!hasActiveDeveloperSession()) return reply(res, 403, { error: "Unlock Developer Mode in Sentinel Personal to run Device Scanner." });
    return reply(res, 200, await scanDevices());
  }
  const missionReads: Record<string, string> = {
    "/mission/integrations": "/automation/integrations",
    "/mission/govee": "/automation/govee/devices",
    "/mission/ring/devices": "/automation/ring/devices",
    "/mission/ring/events": "/automation/ring/events",
  };
  if (req.method === "GET" && Object.hasOwn(missionReads, url.pathname)) {
    const upstream = await fetch(`http://127.0.0.1:${Number(process.env.PORT) || 3001}${missionReads[url.pathname]}`, { signal: AbortSignal.timeout(20_000) });
    return reply(res, upstream.status, await upstream.json());
  }
  const cameraMatch = url.pathname.match(/^\/mission\/ring\/devices\/([^/]+)\/snapshot$/);
  if (cameraMatch && req.method === "GET") {
    const id = decodeURIComponent(cameraMatch[1]);
    if (!id || id.length > 120 || /[\r\n/]/.test(id)) return reply(res, 400, { error: "Invalid camera identifier." });
    const upstream = await fetch(`http://127.0.0.1:${Number(process.env.PORT) || 3001}/automation/ring/devices/${encodeURIComponent(id)}/snapshot`, { signal: AbortSignal.timeout(20_000) });
    if (upstream.status === 204) return reply(res, 200, { available: false });
    if (!upstream.ok) return reply(res, upstream.status, { error: "Camera preview is unavailable." });
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length > 5 * 1024 * 1024) return reply(res, 413, { error: "Camera preview is too large." });
    return reply(res, 200, { available: true, mimeType: "image/jpeg", data: bytes.toString("base64") });
  }
  const goveeMatch = url.pathname.match(/^\/home\/govee\/([^/]+)\/control$/);
  if (goveeMatch && req.method === "POST") {
    const id = decodeURIComponent(goveeMatch[1]);
    if (!id || id.length > 120 || /[\r\n/]/.test(id)) return reply(res, 400, { error: "Invalid device identifier." });
    const request = await body(req);
    const control: Record<string, unknown> = {};
    if (typeof request?.on === "boolean") control.on = request.on;
    if (Number.isInteger(request?.brightness) && request.brightness >= 1 && request.brightness <= 100) control.brightness = request.brightness;
    const colour = request?.colour;
    if (colour && [colour.r, colour.g, colour.b].every((value) => Number.isInteger(value) && value >= 0 && value <= 255)) control.colour = { r: colour.r, g: colour.g, b: colour.b };
    if (!Object.keys(control).length) return reply(res, 400, { error: "Choose a valid power, brightness or colour change." });
    const base = `http://127.0.0.1:${Number(process.env.PORT) || 3001}`;
    const devicesResponse = await fetch(`${base}/automation/govee/devices`, { signal: AbortSignal.timeout(20_000) });
    if (!devicesResponse.ok) return reply(res, devicesResponse.status, await devicesResponse.json());
    const devices = await devicesResponse.json() as Array<{ id: string; model: string; controllable: boolean; supportsBrightness: boolean; supportsColour: boolean }>;
    const device = devices.find((item) => item.id === id);
    if (!device?.controllable) return reply(res, 404, { error: "This connected device cannot be controlled." });
    if (control.brightness !== undefined && !device.supportsBrightness || control.colour !== undefined && !device.supportsColour) return reply(res, 400, { error: "This device does not support that control." });
    const upstream = await fetch(`${base}/automation/govee/devices/${encodeURIComponent(id)}/control`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: device.model, ...control }), signal: AbortSignal.timeout(30_000) });
    return reply(res, upstream.status, await upstream.json());
  }
  if (url.pathname === "/chat" && req.method === "POST") {
    const request = await body(req);
    const message = typeof request?.message === "string" ? request.message.trim() : "";
    if (!message || Buffer.byteLength(message) > MAX_CHAT_BYTES) return reply(res, 400, { error: "A chat message is required (maximum 256 KB)." });
    const history = Array.isArray(request.history) ? request.history.filter((entry: unknown) => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Record<string, unknown>;
      return (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && item.content.length <= MAX_CHAT_BYTES;
    }).slice(-30) : [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const upstream = await fetch(`http://127.0.0.1:${Number(process.env.PORT) || 3001}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, history }),
        signal: controller.signal,
      });
      const result = await upstream.json();
      return reply(res, upstream.status, result);
    } finally { clearTimeout(timeout); }
  }
  if (url.pathname === "/concierge/plan" && req.method === "POST") {
    const request = await body(req);
    const planRequest = typeof request?.request === "string" ? request.request.trim() : "";
    if (!planRequest || Buffer.byteLength(planRequest) > 4000) return reply(res, 400, { error: "Describe the order in 4,000 characters or fewer." });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const upstream = await fetch(`http://127.0.0.1:${Number(process.env.PORT) || 3001}/concierge/plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request: planRequest, people: request.people, allergies: request.allergies, budget: request.budget }),
        signal: controller.signal,
      });
      return reply(res, upstream.status, await upstream.json());
    } finally { clearTimeout(timeout); }
  }
  if (url.pathname === "/home/lights" && req.method === "GET") {
    const upstream = await fetch(`http://127.0.0.1:${Number(process.env.PORT) || 3001}/automation/hue/lights`, { signal: AbortSignal.timeout(10_000) });
    return reply(res, upstream.status, await upstream.json());
  }
  const lightMatch = url.pathname.match(/^\/home\/lights\/([^/]+)$/);
  if (lightMatch && req.method === "POST") {
    const request = await body(req);
    if (typeof request?.on !== "boolean") return reply(res, 400, { error: "Choose on or off for this light." });
    const id = decodeURIComponent(lightMatch[1]);
    if (!id || id.length > 120 || /[\r\n/]/.test(id)) return reply(res, 400, { error: "Invalid light identifier." });
    const upstream = await fetch(`http://127.0.0.1:${Number(process.env.PORT) || 3001}/automation/hue/lights/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ on: request.on }),
      signal: AbortSignal.timeout(15_000),
    });
    return reply(res, upstream.status, await upstream.json());
  }
  const brightnessMatch = url.pathname.match(/^\/home\/lights\/([^/]+)\/brightness$/);
  if (brightnessMatch && req.method === "POST") {
    const request = await body(req);
    if (!Number.isInteger(request?.brightness) || request.brightness < 1 || request.brightness > 100) return reply(res, 400, { error: "Choose brightness from 1 to 100 percent." });
    const id = decodeURIComponent(brightnessMatch[1]);
    if (!id || id.length > 120 || /[\r\n/]/.test(id)) return reply(res, 400, { error: "Invalid light identifier." });
    const upstream = await fetch(`http://127.0.0.1:${Number(process.env.PORT) || 3001}/automation/hue/lights/${encodeURIComponent(id)}/control`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brightness: request.brightness }), signal: AbortSignal.timeout(15_000),
    });
    return reply(res, upstream.status, await upstream.json());
  }
  const colourMatch = url.pathname.match(/^\/home\/lights\/([^/]+)\/colour$/);
  if (colourMatch && req.method === "POST") {
    const request = await body(req);
    const colour = request?.colour;
    if (!colour || ![colour.r, colour.g, colour.b].every((value) => Number.isInteger(value) && value >= 0 && value <= 255)) return reply(res, 400, { error: "Choose a valid RGB colour." });
    const id = decodeURIComponent(colourMatch[1]);
    if (!id || id.length > 120 || /[\r\n/]/.test(id)) return reply(res, 400, { error: "Invalid light identifier." });
    const upstream = await fetch(`http://127.0.0.1:${Number(process.env.PORT) || 3001}/automation/hue/lights/${encodeURIComponent(id)}/control`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ colour: { r: colour.r, g: colour.g, b: colour.b } }), signal: AbortSignal.timeout(15_000),
    });
    return reply(res, upstream.status, await upstream.json());
  }
  if (url.pathname === "/media/command" && req.method === "POST") {
    if (process.platform !== "win32") return reply(res, 501, { error: "Desktop media control requires Windows." });
    const request = await body(req);
    const command = typeof request?.command === "string" ? request.command : "";
    const key = Object.hasOwn(mediaKeys, command) ? mediaKeys[command] : undefined;
    if (key === undefined) return reply(res, 400, { error: "Unsupported media command." });
    const signature = '[DllImport("user32.dll")]public static extern void keybd_event(byte bVk,byte bScan,uint dwFlags,UIntPtr dwExtraInfo);';
    const script = `$signature='${signature}';Add-Type -MemberDefinition $signature -Name NativeMedia -Namespace Sentinel;[Sentinel.NativeMedia]::keybd_event(${key},0,0,[UIntPtr]::Zero);[Sentinel.NativeMedia]::keybd_event(${key},0,2,[UIntPtr]::Zero)`;
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", script], { windowsHide: true, stdio: "ignore" });
    return await new Promise<void>((resolve) => {
      let settled = false;
      const finish = (status: number, value: unknown) => { if (settled) return; settled = true; clearTimeout(timer); reply(res, status, value); resolve(); };
      const timer = setTimeout(() => { child.kill(); finish(504, { error: "Windows media control timed out." }); }, 15_000);
      child.once("error", () => finish(502, { error: "Windows media control could not start." }));
      child.once("exit", (code) => finish(code === 0 ? 200 : 502, code === 0 ? { sent: true, command } : { error: "Windows media control failed." }));
    });
  }
  await fs.mkdir(store, { recursive: true });
  if (url.pathname === "/items" && req.method === "GET") {
    return reply(res, 200, { items: await listLocalCompanionItems() });
  }
  if (url.pathname === "/items" && req.method === "POST") {
    const item = await saveLocalCompanionItem(await body(req)); return reply(res, 200, { queued: true, id: item.id, transport: "wifi" });
  }
  const match = url.pathname.match(/^\/items\/([^/]+)$/); if (!match) return reply(res, 404, { error: "Not found." });
  if (req.method === "GET") { const item = await readLocalCompanionItem(decodeURIComponent(match[1])); return item ? reply(res, 200, item) : reply(res, 404, { error: "Shared item not found." }); }
  if (req.method === "DELETE") { await deleteLocalCompanionItem(decodeURIComponent(match[1])); return reply(res, 200, { deleted: true }); }
  return reply(res, 405, { error: "Method not allowed." });
}

export function localCompanionInfo(token: string) {
  currentToken = token; const address = privateAddress();
  if (!server) { server = createServer((req, res) => void handler(req, res).catch((error) => reply(res, 500, { error: error instanceof Error ? error.message : "Local transfer failed." }))); server.listen(PORT, "0.0.0.0"); }
  return address ? { endpoint: `http://${address}:${PORT}`, token, maxFileBytes: MAX_BYTES } : undefined;
}

export function stopLocalCompanion() { server?.close(); server = undefined; currentToken = ""; }
