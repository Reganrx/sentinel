import {
  updateCurrentLocation,
} from "./location.js";

import {
  IPWhoProvider,
} from "./providers/IPWhoProvider.js";

import {
  IPAPIProvider,
} from "./providers/IPAPIProvider.js";

import {
  info,
  warn,
} from "../core/logger.js";

const providers = [

  new IPWhoProvider(),

  new IPAPIProvider(),

];

export async function refreshCurrentLocation() {

  for (const provider of providers) {

    info(
      "Location",
      `Trying ${provider.name}...`
    );

    try {

      const location =
        await provider.getLocation();

      if (!location) {

        continue;

      }

      await updateCurrentLocation({

        latitude:
          location.latitude,

        longitude:
          location.longitude,

      });

      info(

        "Location",

        `Using ${provider.name}`

      );

      info(

        "Location",

        `${location.city}, ${location.country}`

      );

      return location;

    }

    catch (err) {

      warn(

        "Location",

        `${provider.name} failed.`

      );

    }

  }

  warn(

    "Location",

    "No location provider succeeded."

  );

  return null;

}
