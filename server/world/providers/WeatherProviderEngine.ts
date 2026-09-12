import {
  WorldProvider,
} from "./WorldProvider.js";

import {
  refreshWeather,
} from "../weather.js";

export class WeatherProviderEngine
  implements WorldProvider {

  readonly name =
    "weather";

  readonly priority =
    20;

  async refresh() {

    await refreshWeather();

  }

}