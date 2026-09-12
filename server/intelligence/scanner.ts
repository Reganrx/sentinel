import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export type ProjectLanguage =
  | "typescript"
  | "javascript"
  | "react"
  | "json"
  | "html"
  | "css"
  | "markdown"
  | "python"
  | "java"
  | "csharp"
  | "cpp"
  | "text"
  | "unknown";

export interface ProjectFile {

  path: string;

  name: string;

  extension: string;

  language: ProjectLanguage;

  size: number;

  modified: number;

  hash: string;

}

const IGNORED_DIRECTORIES = new Set([

  ".git",

  ".next",

  ".idea",

  ".vscode",

  "node_modules",

  "dist",

  "build",

  "coverage",

  "out",

  ".turbo",

]);

const LANGUAGE_MAP: Record<string, ProjectLanguage> = {

  ".ts": "typescript",

  ".tsx": "react",

  ".js": "javascript",

  ".jsx": "react",

  ".json": "json",

  ".css": "css",

  ".scss": "css",

  ".html": "html",

  ".md": "markdown",

  ".py": "python",

  ".java": "java",

  ".cs": "csharp",

  ".cpp": "cpp",

  ".txt": "text",

};

function getLanguage(
  extension: string
): ProjectLanguage {

  return (

    LANGUAGE_MAP[extension] ??

    "unknown"

  );

}

async function hashFile(
  file: string
): Promise<string> {

  const buffer =
    await fs.readFile(file);

  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");

}

async function walk(

  root: string,

  current: string,

  results: ProjectFile[]

): Promise<void> {

  const entries =
    await fs.readdir(current, {

      withFileTypes: true,

    });

  for (const entry of entries) {

    const fullPath =
      path.join(

        current,

        entry.name

      );

    if (entry.isDirectory()) {

      if (

        IGNORED_DIRECTORIES.has(

          entry.name

        )

      ) {

        continue;

      }

      await walk(

        root,

        fullPath,

        results

      );

      continue;

    }

    const stat =
      await fs.stat(fullPath);

    const extension =
      path.extname(entry.name);

    results.push({

      path:
        path.relative(
          root,
          fullPath
        ),

      name:
        entry.name,

      extension,

      language:
        getLanguage(
          extension
        ),

      size:
        stat.size,

      modified:
        stat.mtimeMs,

      hash:
        await hashFile(
          fullPath
        ),

    });

  }

}

export async function scanProject(

  workspaceRoot: string

): Promise<ProjectFile[]> {

  const files: ProjectFile[] = [];

  await walk(

    workspaceRoot,

    workspaceRoot,

    files

  );

  files.sort((a, b) =>

    a.path.localeCompare(
      b.path
    )

  );

  return files;

}