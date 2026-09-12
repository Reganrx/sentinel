import fs from "fs/promises";

export async function readFileContents(
  file: string
) {

  return await fs.readFile(
    file,
    "utf8"
  );

}