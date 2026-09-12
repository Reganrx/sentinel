import type {
  IPLocation,
} from "./IPWhoProvider.js";

export class IPAPIProvider {

  readonly name = "IP-API";

  async getLocation(): Promise<IPLocation | null> {

    try {

      const response = await fetch(
        "http://ip-api.com/json/"
      );

      if (!response.ok) {

        console.warn(
          `[${this.name}] HTTP ${response.status}`
        );

        return null;

      }

      const json = await response.json();

      if (
        json.status !== "success"
      ) {

        console.warn(
          `[${this.name}] Request failed.`
        );

        return null;

      }

      return {

        latitude: json.lat,

        longitude: json.lon,

        city: json.city,

        country: json.country,

      };

    }

    catch (err) {

      console.warn(
        `[${this.name}]`,
        err
      );

      return null;

    }

  }

}