import {
  updateTime,
  getWorldState,
} from "./worldState.js";

import {
  WorldState,
} from "./worldTypes.js";

import {
  info,
  error,
} from "../core/logger.js";

import {
  registerWorldProvider,
  getWorldProviders,
} from "./providers/providerRegistry.js";

import {
  WorldLocationProvider,
} from "./providers/WorldLocationProvider.js";

import {
  WeatherProviderEngine,
} from "./providers/WeatherProviderEngine.js";


let timer: NodeJS.Timeout | undefined;

const REFRESH_INTERVAL =
  1000 * 60 * 5;

export async function initialiseWorld() {

  info(
    "World",
    "Initialising."
  );

  // Location is supplied by the Sentinel desktop client.  Do not seed the
  // world with an IP lookup: it is only city-level and can be wrong by miles.

  registerWorldProvider(
    new WorldLocationProvider()
  );

  registerWorldProvider(
    new WeatherProviderEngine()
  );

  await refreshWorld();

  timer = setInterval(
    refreshWorld,
    REFRESH_INTERVAL
  );

}

export function shutdownWorld() {

  if (!timer) {
    return;
  }

  clearInterval(timer);

  timer = undefined;

}

export async function refreshWorld() {

  try {

    updateTime({

      localTime:
        new Date().toLocaleString(),

      utcTime:
        new Date().toUTCString(),

      timezone:
        Intl.DateTimeFormat()
          .resolvedOptions()
          .timeZone,

    });

    for (const provider of getWorldProviders()) {

      info(
        "World",
        `Refreshing ${provider.name}`
      );

      await provider.refresh();

    }

    info(
      "World",
      "Refresh complete."
    );

  }

  catch (err) {

    error(
      "World",
      "Refresh failed.",
      err
    );

  }

}

export function getCurrentWorld(): WorldState {

  return getWorldState();

}
