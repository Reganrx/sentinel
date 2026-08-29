import { API_URL } from "./api";

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  approximate?: boolean;
}

let locationWatchId: number | null = null;
export type LocationStatus = "syncing" | "active" | "unavailable";
let locationStatus: LocationStatus = "syncing";

export function getLocationStatus() {
  return locationStatus;
}

function setLocationStatus(status: LocationStatus, message?: string) {
  locationStatus = status;
  window.dispatchEvent(
    new CustomEvent("sentinel:location-status", {
      detail: { status, message },
    }),
  );
}

export async function sendLocation(location: UserLocation) {
  const response = await fetch(`${API_URL}/world/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(location),
  });

  if (!response.ok)
    throw new Error(`Location update was rejected (${response.status}).`);
  localStorage.setItem("sentinel-last-location", JSON.stringify({ ...location, savedAt: Date.now() }));
  setLocationStatus("active");
  window.dispatchEvent(new Event("sentinel:location-updated"));
}

async function requestApproximateLocation(): Promise<UserLocation> {
  const response = await fetch(`${API_URL}/world/location/approximate`, { method: "POST" });
  const result = await response.json() as { location?: UserLocation; error?: string };
  if (!response.ok || !result.location) {
    throw new Error(result.error ?? "An approximate location is unavailable.");
  }
  return { ...result.location, approximate: true };
}

function getPosition(options: PositionOptions): Promise<UserLocation> {
  if (!navigator.geolocation)
    return Promise.reject(new Error("Geolocation is not supported."));

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      reject,
      options,
    );
  });
}

export async function requestLocation(): Promise<UserLocation> {
  try {
    return await getPosition({
      enableHighAccuracy: false,
      timeout: 7000,
      maximumAge: 60000,
    });
  } catch {
    return getPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 300000,
    });
  }
}

function isMeaningfullyMoreAccurate(
  next: UserLocation,
  current?: UserLocation,
) {
  return !current || next.accuracy < current.accuracy * 0.85;
}

/**
 * Keeps the server in sync as the device obtains a better GPS/Wi-Fi position
 * or moves. An IP address is deliberately never used as a substitute here.
 */
export function startLiveLocationTracking() {
  if (!navigator.geolocation || locationWatchId !== null) return;

  let bestLocation: UserLocation | undefined;
  locationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      if (isMeaningfullyMoreAccurate(location, bestLocation)) {
        bestLocation = location;
        void sendLocation(location);
      }
    },
    (error) => {
      setLocationStatus("unavailable", error.message);
    },
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
  );
}

export async function updateLocation() {
  setLocationStatus("syncing");
  try {
    const location = await requestLocation();
    await sendLocation(location);
    startLiveLocationTracking();
  } catch (liveError) {
    try {
      const approximate = await requestApproximateLocation();
      await sendLocation(approximate);
      return approximate;
    } catch {
      setLocationStatus(
        "unavailable",
        liveError instanceof Error ? liveError.message : "Location could not be determined.",
      );
      throw liveError;
    }
  }
}
