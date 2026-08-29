import fs from "fs/promises";
import path from "path";

export type WorkspaceFile = {

  name: string;

  path: string;

  extension: string;

  size: number;

};

export type Workspace = {

  root: string;

  files: WorkspaceFile[];

  indexedAt: Date;

};

let currentWorkspace: Workspace | null =
  null;

async function scanFolder(

  folder: string,

  files: WorkspaceFile[]

): Promise<void> {

  const entries =
    await fs.readdir(folder, {

      withFileTypes: true,

    });

  for (const entry of entries) {

    const fullPath =
      path.join(folder, entry.name);

    if (entry.isDirectory()) {

      if (

        entry.name === "node_modules" ||

        entry.name === ".git" ||

        entry.name === "dist" ||

        entry.name === "build"

      ) {

        continue;

      }

      await scanFolder(

        fullPath,

        files

      );

      continue;

    }

    const stats =
      await fs.stat(fullPath);

    files.push({

      name: entry.name,

      path: fullPath,

      extension:
        path.extname(entry.name),

      size: stats.size,

    });

  }

}

export async function openWorkspace(
  root: string
) {

  const files: WorkspaceFile[] =
    [];

  await scanFolder(
    root,
    files
  );

  currentWorkspace = {

    root,

    files,

    indexedAt:
      new Date(),

  };

  return currentWorkspace;

}

export function getWorkspace() {

  return currentWorkspace;

}

export function isWorkspaceOpen() {

  return currentWorkspace !== null;

}