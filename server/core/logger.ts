import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  DEBUG = "DEBUG",
}

const logDirectory = path.join(
  process.env.SENTINEL_DATA_DIR ?? path.join(process.env.APPDATA ?? process.cwd(), "Sentinel"),
  "logs",
);
const logFile = path.join(logDirectory, "sentinel-backend.log");

function safeData(data: unknown) {
  if (data === undefined) return undefined;
  try {
    return JSON.stringify(data, (key, value) =>
      /key|secret|token|password|authorization/i.test(key) ? "[REDACTED]" : value,
    );
  } catch {
    return "[unserializable data]";
  }
}

function persist(line: string) {
  try {
    mkdirSync(logDirectory, { recursive: true });
    appendFileSync(logFile, `${line}\n`, "utf8");
  } catch {
    // A logging failure must never interrupt Sentinel.
  }
}

export function log(level: LogLevel, source: string, message: string, data?: unknown) {
  const prefix = `[${new Date().toISOString()}] [${level}] [${source}]`;
  const serialised = safeData(data);
  persist(`${prefix} ${message}${serialised ? ` ${serialised}` : ""}`);
  if (data !== undefined) console.log(prefix, message, data);
  else console.log(prefix, message);
}

export function info(source: string, message: string, data?: unknown) {
  log(LogLevel.INFO, source, message, data);
}

export function warn(source: string, message: string, data?: unknown) {
  log(LogLevel.WARN, source, message, data);
}

export function error(source: string, message: string, data?: unknown) {
  log(LogLevel.ERROR, source, message, data);
}

export function debug(source: string, message: string, data?: unknown) {
  log(LogLevel.DEBUG, source, message, data);
}
