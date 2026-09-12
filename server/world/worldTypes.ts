import type {
  WeatherState,
} from "./providers/WeatherProvider.js";

export interface WorldLocation {

  latitude?: number;

  longitude?: number;

  city?: string;

  county?: string;

  country?: string;

  postcode?: string;

  timezone?: string;

}

export type WorldWeather = WeatherState;

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