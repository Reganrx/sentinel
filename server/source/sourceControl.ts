import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(
  process.env.SENTINEL_SOURCE_ROOT ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
);

const BLOCKED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-electron",
  "release",
]);

const BLOCKED_FILES = new Set([
  ".env",
  ".env.local",
  ".env.production",
]);

const MAX_READ_SIZE = 250_000;
const MAX_PROPOSAL_SIZE = 500_000;

export type SourceFile = {
  path: string;
  size: number;
};

export type SourceMatch = {
  path: string;
  line: number;
  text: string;
};

export type SourceProposal = {
  id: string;
  path: string;
  previous: string | null;
  next: string;
  preview: string;
  createdAt: string;
};

const proposals = new Map<string, SourceProposal>();

function isWithinRoot(target: string): boolean {
  const relative = path.relative(PROJECT_ROOT, target);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveSourcePath(filePath: string): string {
  if (!filePath || path.isAbsolute(filePath)) {
    throw new Error("Use a relative project path.");
  }

  const target = path.resolve(PROJECT_ROOT, filePath);

  if (!isWithinRoot(target)) {
    throw new Error("That path is outside Sentinel's source project.");
  }

  const parts = path.relative(PROJECT_ROOT, target).split(path.sep);

  if (parts.some(part => BLOCKED_DIRECTORIES.has(part)) || BLOCKED_FILES.has(path.basename(target))) {
    throw new Error("That file is protected and cannot be accessed by Sentinel.");
  }

  return target;
}

function relativePath(target: string): string {
  return path.relative(PROJECT_ROOT, target).replaceAll(path.sep, "/");
}

async function walk(folder: string, files: SourceFile[]): Promise<void> {
  const entries = await fs.readdir(folder, { withFileTypes: true });

  for (const entry of entries) {
    if (BLOCKED_DIRECTORIES.has(entry.name) || BLOCKED_FILES.has(entry.name)) continue;

    const target = path.join(folder, entry.name);

    if (entry.isDirectory()) {
      await walk(target, files);
      continue;
    }

    if (!entry.isFile()) continue;

    const stats = await fs.stat(target);
    files.push({ path: relativePath(target), size: stats.size });
  }
}

function previewChange(previous: string | null, next: string): string {
  const before = previous?.split(/\r?\n/) ?? [];
  const after = next.split(/\r?\n/);
  const firstChanged = Math.max(0, after.findIndex((line, index) => line !== before[index]));
  const start = Math.max(0, firstChanged - 2);
  const end = Math.min(after.length, firstChanged + 10);

  return after
    .slice(start, end)
    .map((line, index) => `${String(start + index + 1).padStart(4, " ")} | ${line}`)
    .join("\n");
}

export function getSourceStatus() {
  return {
    root: PROJECT_ROOT,
    policy: "read/search allowed; all writes require a proposal and explicit approval",
  };
}

export async function listSourceFiles(): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  await walk(PROJECT_ROOT, files);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readSourceFile(filePath: string) {
  const target = resolveSourcePath(filePath);
  const stats = await fs.stat(target);

  if (stats.size > MAX_READ_SIZE) {
    throw new Error(`File is too large to read safely (${stats.size} bytes).`);
  }

  return {
    path: relativePath(target),
    content: await fs.readFile(target, "utf8"),
  };
}

export async function searchSource(query: string): Promise<SourceMatch[]> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const files = await listSourceFiles();
  const matches: SourceMatch[] = [];

  for (const file of files) {
    if (file.size > MAX_READ_SIZE || matches.length >= 100) continue;

    const content = await fs.readFile(path.join(PROJECT_ROOT, file.path), "utf8");
    content.split(/\r?\n/).forEach((line, index) => {
      if (matches.length < 100 && line.toLowerCase().includes(needle)) {
        matches.push({ path: file.path, line: index + 1, text: line.trim().slice(0, 300) });
      }
    });
  }

  return matches;
}

export async function proposeSourceWrite(filePath: string, content: string): Promise<SourceProposal> {
  if (content.length > MAX_PROPOSAL_SIZE) {
    throw new Error("Proposed file content is too large.");
  }

  const target = resolveSourcePath(filePath);
  let previous: string | null = null;

  try {
    previous = await fs.readFile(target, "utf8");
  } catch (error: unknown) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }

  const proposal: SourceProposal = {
    id: crypto.randomUUID(),
    path: relativePath(target),
    previous,
    next: content,
    preview: previewChange(previous, content),
    createdAt: new Date().toISOString(),
  };

  proposals.set(proposal.id, proposal);
  return proposal;
}

export function getSourceProposal(id: string): SourceProposal | undefined {
  return proposals.get(id);
}

export function rejectSourceProposal(id: string): boolean {
  return proposals.delete(id);
}

export async function approveSourceProposal(id: string): Promise<{ path: string }> {
  const proposal = proposals.get(id);
  if (!proposal) throw new Error("Source proposal not found or has expired.");

  const target = resolveSourcePath(proposal.path);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, proposal.next, "utf8");
  proposals.delete(id);

  return { path: proposal.path };
}
