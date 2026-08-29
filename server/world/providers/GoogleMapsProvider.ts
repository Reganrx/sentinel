import {
  DirectionsResult,
  GeoProvider,
  LocationInfo,
  NearbyPlace,
} from "./GeoProvider.js";
import { config } from "../../config/index.js";

export class GoogleMapsProvider implements GeoProvider {
  private readonly apiKey = config.google.mapsApiKey;

  async reverseGeocode(latitude: number, longitude: number): Promise<LocationInfo> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${this.apiKey}`
      );
      if (!response.ok) throw new Error("Google Geocoding failed.");

      const json = await response.json();
      const result = json.results?.[0];
      if (!result) throw new Error(json.error_message ?? "No location returned.");

      const address = result.address_components;
      const find = (type: string) => address.find((c: any) => c.types.includes(type))?.long_name;
      return {
        latitude,
        longitude,
        city: find("locality") ?? find("postal_town") ?? find("administrative_area_level_3") ?? find("administrative_area_level_2"),
        county: find("administrative_area_level_2"),
        country: find("country"),
        postcode: find("postal_code"),
      };
    } catch {
      // Coordinates still come only from the device. This merely names them
      // when the configured Google Geocoding service is unavailable.
      return this.reverseGeocodeOpenStreetMap(latitude, longitude);
    }
  }

  private async reverseGeocodeOpenStreetMap(latitude: number, longitude: number): Promise<LocationInfo> {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${latitude}&lon=${longitude}`,
      { headers: { "User-Agent": "Sentinel-OS/1.0 (desktop location service)" } }
    );
    if (!response.ok) throw new Error("Location name lookup failed.");

    const json = await response.json();
    const address = json.address ?? {};
    const city = address.city ?? address.town ?? address.village ?? address.municipality ?? address.county;
    if (!city || !address.country) throw new Error("No named location returned.");

    return { latitude, longitude, city, county: address.county, country: address.country, postcode: address.postcode };
  }

  async nearbyPlaces(): Promise<NearbyPlace[]> {
    throw new Error("Nearby Places not implemented.");
  }

  async search(query: string) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${this.apiKey}`
      );
      if (!response.ok) throw new Error("Google location search failed.");
      const json = await response.json();
      if (json.status !== "OK" || !Array.isArray(json.results)) throw new Error(json.error_message ?? "No locations found.");
      return json.results.slice(0, 5).map((result: any) => ({ name: result.formatted_address as string, latitude: result.geometry.location.lat as number, longitude: result.geometry.location.lng as number }));
    } catch {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`, { headers: { "User-Agent": "Sentinel-OS/1.0 (desktop navigation)" } });
      if (!response.ok) throw new Error("Location search is unavailable on this network.");
      const results = await response.json() as Array<{ display_name: string; lat: string; lon: string }>;
      return results.map(result => ({ name: result.display_name, latitude: Number(result.lat), longitude: Number(result.lon) }));
    }
  }

  async route(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) {
    const originValue = `${origin.latitude},${origin.longitude}`;
    const destinationValue = `${destination.latitude},${destination.longitude}`;
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originValue)}&destination=${encodeURIComponent(destinationValue)}&mode=driving&alternatives=true&departure_time=now&units=metric&key=${this.apiKey}`
    );
    if (!response.ok) throw new Error("Google directions request failed.");

    const json = await response.json();
    const leg = json.routes?.[0]?.legs?.[0];
    if (json.status !== "OK" || !leg) throw new Error(json.error_message ?? "No driving route found.");

    const cleanInstruction = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");
    return {
      routes: json.routes.slice(0, 3).map((item: any, index: number) => {
        const routeLeg = item.legs?.[0];
        return {
          id: `route-${index}`,
          distance: routeLeg.distance.text as string,
          duration: (routeLeg.duration_in_traffic?.text ?? routeLeg.duration.text) as string,
          normalDuration: routeLeg.duration.text as string,
          startAddress: routeLeg.start_address as string,
          endAddress: routeLeg.end_address as string,
          summary: item.summary as string,
          polyline: item.overview_polyline?.points as string,
          steps: routeLeg.steps.map((step: any) => ({ instruction: cleanInstruction(step.html_instructions), distance: step.distance.text as string, duration: step.duration.text as string })),
        };
      }),
    };
  }

  async discover(query: string, origin: { latitude: number; longitude: number }) {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.priceLevel,places.googleMapsUri",
      },
      body: JSON.stringify({
        textQuery: `${query} near me`,
        locationBias: { circle: { center: { latitude: origin.latitude, longitude: origin.longitude }, radius: 10000 } },
        rankPreference: "RELEVANCE",
        maxResultCount: 10,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error?.message ?? "Nearby place recommendations are currently unavailable.");
    }
    const json = await response.json() as { places?: any[] };
    const miles = (latitude: number, longitude: number) => {
      const rad = (value: number) => value * Math.PI / 180;
      const a = Math.sin(rad(latitude - origin.latitude) / 2) ** 2 + Math.cos(rad(origin.latitude)) * Math.cos(rad(latitude)) * Math.sin(rad(longitude - origin.longitude) / 2) ** 2;
      return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    return (json.places ?? []).map(place => ({
      name: place.displayName?.text ?? "Unnamed place",
      address: place.formattedAddress ?? "",
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
      category: place.primaryTypeDisplayName?.text ?? "Place",
      rating: place.rating,
      ratingCount: place.userRatingCount,
      openNow: place.currentOpeningHours?.openNow,
      priceLevel: place.priceLevel,
      googleMapsUri: place.googleMapsUri,
      distance: miles(place.location?.latitude, place.location?.longitude),
    })).filter(place => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
  }

  async directions(): Promise<DirectionsResult> {
    throw new Error("Directions not implemented.");
  }
}
