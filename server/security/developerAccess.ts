import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const SESSION_DURATION_MS = 1000 * 60 * 30;
const sessions = new Map<string, number>();

function validPassword(value: string): boolean {
  const storedHash = process.env.SENTINEL_DEVELOPER_PASSWORD_HASH;
  if (storedHash) {
    const [scheme, salt, encodedHash] = storedHash.split("$");
    if (scheme !== "scrypt" || !salt || !encodedHash) return false;
    const expected = Buffer.from(encodedHash, "hex");
    const received = crypto.scryptSync(value, salt, expected.length);
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  }

  // Personal can retain its private legacy password. Base has no shared
  // fallback and remains locked until its owner completes first-run setup.
  const configuredPassword = process.env.SENTINEL_DEVELOPER_PASSWORD
    ?? (process.env.SENTINEL_EDITION !== "base" ? "RoveR2003" : undefined);
  if (!configuredPassword) return false;
  const expected = Buffer.from(configuredPassword);
  const received = Buffer.from(value);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export function verifyDeveloperPassword(value: string) {
  return validPassword(value);
}

export function clearDeveloperSessions() {
  sessions.clear();
}

export function hashDeveloperPassword(value: string) {
  if (value.length < 10) throw new Error("Developer password must contain at least 10 characters.");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(value, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function active(token: string | undefined): boolean {
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function unlockDeveloperMode(value: string) {
  if (!validPassword(value)) throw new Error("Incorrect developer password.");
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  sessions.set(token, expiresAt);
  return { token, expiresAt };
}

export function lockDeveloperMode(token: string | undefined) {
  if (token) sessions.delete(token);
}

export function developerStatus(token: string | undefined) {
  return { unlocked: active(token) };
}

export function hasActiveDeveloperSession(): boolean {
  for (const token of sessions.keys()) {
    if (active(token)) return true;
  }
  return false;
}

export function requireDeveloperMode(req: Request, res: Response, next: NextFunction) {
  const token = req.header("x-sentinel-developer-token");
  if (!active(token)) {
    return res.status(403).json({ error: "Developer Mode is locked." });
  }
  next();
}
