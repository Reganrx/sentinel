import fs from "fs/promises";

export type FileReadResult = {

  path: string;

  contents: string;

};

export async function readWorkspaceFile(
  filePath: string
): Promise<FileReadResult> {

  const contents =
    await fs.readFile(
      filePath,
      "utf8"
    );

  return {

    path: filePath,

    contents,

  };

}