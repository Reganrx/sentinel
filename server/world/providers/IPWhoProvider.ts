export interface IPLocation {

  latitude: number;

  longitude: number;

  city: string;

  country: string;

}

export class IPWhoProvider {

  readonly name = "IPWho";

  async getLocation(): Promise<IPLocation | null> {

    try {

      const response = await fetch(
        "https://ipwho.is/"
      );

      if (!response.ok) {

        console.warn(
          `[${this.name}] HTTP ${response.status}`
        );

        return null;

      }

      const json = await response.json();

      if (!json.success) {

        console.warn(
          `[${this.name}] Request failed.`
        );

        return null;

      }

      return {

        latitude: json.latitude,

        longitude: json.longitude,

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