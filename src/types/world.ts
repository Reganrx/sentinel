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

export interface WorldWeather {

  current: WeatherCurrent;

  hourly: WeatherHour[];

  daily: WeatherDay[];

}

export interface WorldLocation {

  latitude?: number;

  longitude?: number;

  city?: string;

  county?: string;

  country?: string;

  postcode?: string;

  timezone?: string;

}

export interface WorldTime {

  localTime: string;

  utcTime: string;

  timezone: string;

}

export interface WorldDevice {

  battery?: number;

  charging?: boolean;

  network?: string;

  platform?: string;

}

export interface WorldState {

  location: WorldLocation;

  weather: WorldWeather;

  time: WorldTime;

  device: WorldDevice;

}
