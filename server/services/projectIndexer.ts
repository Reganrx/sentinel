import fs from "fs/promises";
import path from "path";

export type ProjectFile = {

  name: string;

  path: string;

  extension: string;

};

async function walk(
  directory: string,
  files: ProjectFile[]
) {

  const entries =
    await fs.readdir(directory, {
      withFileTypes: true,
    });

  for (const entry of entries) {

    const fullPath =
      path.join(directory, entry.name);

    if (entry.isDirectory()) {

      if (

        entry.name === "node_modules" ||

        entry.name === ".git" ||

        entry.name === "dist"

      ) {

        continue;

      }

      await walk(fullPath, files);

    } else {

      files.push({

        name: entry.name,

        path: fullPath,

        extension:
          path.extname(entry.name),

      });

    }

  }

}

export async function indexProject(
  root: string
) {

  const files: ProjectFile[] = [];

  await walk(root, files);

  return files;

}