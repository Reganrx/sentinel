import {
  execFile,
} from "node:child_process";

import {
  promisify,
} from "node:util";

const exec =
  promisify(execFile);

export async function runPowerShell<T>(
  command: string
): Promise<T> {

  const {

    stdout,

  } = await exec(

    "powershell",

    [

      "-NoProfile",

      "-Command",

      command,

    ]

  );

  return JSON.parse(
    stdout
  ) as T;

}