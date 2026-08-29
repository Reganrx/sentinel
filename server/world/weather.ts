import {
  updateWeather,
} from "./worldState.js";

import {
  getCurrentCoordinates,
} from "./location.js";

import {
  WeatherApiProvider,
} from "./providers/WeatherApiProvider.js";

import {
  info,
  error,
} from "../core/logger.js";

const provider =
  new WeatherApiProvider();

export async function refreshWeather(): Promise<void> {

  const location =
    getCurrentCoordinates();

  if (

    location.latitude === 0 ||

    location.longitude === 0

  ) {

    return;

  }

  try {

    const weather =
      await provider.getWeather(

        location.latitude,

        location.longitude

      );

    updateWeather(

      weather

    );

    info(

      "Weather",

      `${weather.current.temperature}° ${weather.current.condition}`

    );

  }

  catch (err) {

    error(

      "Weather",

      "Failed to refresh weather.",

      err

    );

  }

}