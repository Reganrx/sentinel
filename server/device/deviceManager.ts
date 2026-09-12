import {
  info,
  error,
} from "../core/logger.js";

import {
  clearDeviceProviders,
  getDeviceProviders,
  registerDeviceProvider,
} from "./providers/providerRegistry.js";

import {
  DEVICE_PROVIDERS,
} from "./providers/index.js";

let timer: NodeJS.Timeout | undefined;

const REFRESH_INTERVAL =
  1000 * 30;

export async function initialiseDevice(): Promise<void> {

  info(
    "Device",
    "Initialising."
  );

  clearDeviceProviders();

  for (

    const provider of

    DEVICE_PROVIDERS

  ) {

    registerDeviceProvider(
      provider
    );

  }

  await refreshDevice();

  timer = setInterval(

    refreshDevice,

    REFRESH_INTERVAL

  );

  info(
    "Device",
    "Device Engine Online."
  );

}

export async function refreshDevice(): Promise<void> {

  try {

    for (

      const provider of

      getDeviceProviders()

    ) {

      info(

        "Device",

        `Refreshing ${provider.name}`

      );

      await provider.refresh();

    }

    info(

      "Device",

      "Refresh complete."

    );

  }

  catch (err) {

    error(

      "Device",

      "Refresh failed.",

      err

    );

  }

}

export function shutdownDevice(): void {

  if (!timer) {

    return;

  }

  clearInterval(
    timer
  );

  timer = undefined;

  info(

    "Device",

    "Device Engine Offline."

  );

}