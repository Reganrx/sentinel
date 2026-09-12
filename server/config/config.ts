import dotenv from "dotenv";

dotenv.config();

export const config = {

  openAI: {

    get apiKey() {
      return process.env.OPENAI_API_KEY ?? "";
    },

  },

  google: {

    get mapsApiKey() {
      return process.env.GOOGLE_MAPS_API_KEY ?? "";
    },

  },

  weather: {

    apiKey:
      process.env
        .WEATHER_API_KEY ?? "",

  },

};
