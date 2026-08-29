import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const PORT = 3217;
const MAX_BYTES = 100 * 1024 * 1024;
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
