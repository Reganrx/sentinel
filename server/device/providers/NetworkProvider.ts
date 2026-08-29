import os from "node:os";

import {
  DEVICE_PROVIDER_PRIORITY,
} from "../config.js";

import {
  updateNetworkState,
} from "../deviceState.js";

import type {
  NetworkState,
} from "../deviceTypes.js";

import type {
  DeviceProvider,
} from "./DeviceProvider.js";

export class NetworkProvider
  implements DeviceProvider {

  readonly name =
    "network";

  readonly priority =
    DEVICE_PROVIDER_PRIORITY.NETWORK;

  async refresh(): Promise<void> {

    const interfaces =
      os.networkInterfaces();

    let connected =
      false;

    let activeInterface =
      "";

    let localIP =
      "";

    for (const [name, entries] of Object.entries(interfaces)) {

      if (!entries) {

        continue;

      }

      for (const entry of entries) {

        if (

          entry.family === "IPv4" &&

          !entry.internal

        ) {

          connected = true;

          activeInterface = name;

          localIP = entry.address;

          break;

        }

      }

      if (connected) {

        break;

      }

    }

    const network: NetworkState = {

      connected,

      interface: activeInterface,

      localIP,

    };

    updateNetworkState(
      network
    );

  }

}