import os from "node:os";

import {
  DEVICE_PROVIDER_PRIORITY,
} from "../config.js";

import {
  updateMemoryState,
} from "../deviceState.js";

import type {
  MemoryState,
} from "../deviceTypes.js";

import type {
  DeviceProvider,
} from "./DeviceProvider.js";

export class MemoryProvider
  implements DeviceProvider {

  readonly name =
    "memory";

  readonly priority =
    DEVICE_PROVIDER_PRIORITY.MEMORY;

  async refresh(): Promise<void> {

    const total =
      os.totalmem();

    const free =
      os.freemem();

    const used =
      total - free;

    const memory: MemoryState = {

      total,

      used,

      free,

    };

    updateMemoryState(
      memory
    );

  }

}