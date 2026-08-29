export interface IPLocation {

  latitude: number;

  longitude: number;

  city: string;

  country: string;

}

export class IPLocationProvider {

  async getLocation(): Promise<IPLocation | null> {

    console.log("");
    console.log("==========================================");
    console.log("🌍 IP LOCATION TEST");
    console.log("==========================================");

    try {

      console.log(
        "➡️ Requesting location from ipapi.co..."
      );

      const response = await fetch(
        "https://ipapi.co/json/"
      );

      console.log(
        "HTTP Status:",
        response.status
      );

      console.log(
        "Response OK:",
        response.ok
      );

      const body =
        await response.text();

      if (!response.ok) {

        console.log(
          "❌ Request failed."
        );

        return null;

      }

      const json =
        JSON.parse(body);

      console.log("✅ Location response parsed safely.");

      return {

        latitude:
          json.latitude,

        longitude:
          json.longitude,

        city:
          json.city,

        country:
          json.country_name,

      };

    }

    catch (err) {

      console.log("");
      console.log(
        "❌ Exception thrown:"
      );

      console.error(err);

      console.log("");

      return null;

    }

    finally {

      console.log(
        "=========================================="
      );
      console.log("");

    }

  }

}
