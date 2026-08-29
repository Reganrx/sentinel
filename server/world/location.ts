import { updateLocation } from "./worldState.js";

import { GoogleMapsProvider } from "./providers/GoogleMapsProvider.js";

import { info, error } from "../core/logger.js";

const google = new GoogleMapsProvider();

let latestCoordinates = {
  latitude: 0,

  longitude: 0,
};

export interface LocationUpdate {
  latitude: number;

  longitude: number;
}

export async function updateCurrentLocation(
  location: LocationUpdate,
): Promise<void> {
  latestCoordinates = location;

  updateLocation(location);

  await refreshLocation();
}

export async function refreshLocation(): Promise<void> {
  if (latestCoordinates.latitude === 0 && latestCoordinates.longitude === 0) {
    return;
  }

  try {
    const place = await google.reverseGeocode(
      latestCoordinates.latitude,

      latestCoordinates.longitude,
    );

    updateLocation(place);

    info(
      "Location",

      `${place.city}, ${place.country}`,
    );
  } catch (err) {
    error(
      "Location",

      "Reverse geocoding failed.",

      err,
    );
  }
}

export function getCurrentCoordinates() {
  return latestCoordinates;
}
