export interface WeatherCurrent {

  temperature: number;

  feelsLike: number;

  humidity: number;

  windSpeed: number;

  condition: string;

  icon: string;

  uv: number;

  visibility: number;

  sunrise: string;

  sunset: string;

}

export interface WeatherHour {

  time: string;

  temperature: number;

  condition: string;

  icon: string;

  chanceOfRain: number;

}

export interface WeatherDay {

  date: string;

  minTemp: number;

  maxTemp: number;

  condition: string;

  icon: string;

  chanceOfRain: number;

  windSpeed: number;

  sunrise: string;

  sunset: string;

  hours?: WeatherHour[];

}

export interface WeatherState {

  current: WeatherCurrent;

  hourly: WeatherHour[];

  daily: WeatherDay[];

}

export interface WeatherProvider {

  getWeather(

    latitude: number,

    longitude: number

  ): Promise<WeatherState>;

}
