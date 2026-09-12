import type {
  WorldState,
  WorldLocation,
  WorldWeather,
  WorldTime,
  WorldDevice,
} from "./worldTypes.js";

const world: WorldState = {

  location: {},

  weather: {

    current: {

      temperature: 0,

      feelsLike: 0,

      humidity: 0,

      windSpeed: 0,

      condition: "",

      icon: "",

      uv: 0,

      visibility: 0,

      sunrise: "",

      sunset: "",

    },

    hourly: [],

    daily: [],

  },

  time: {

    localTime: "",

    utcTime: "",

    timezone: "UTC",

  },

  device: {},

};

export function getWorldState(): WorldState {

  return world;

}

export function setWorldState(

  state: Partial<WorldState>

): void {

  Object.assign(

    world,

    state

  );

}

export function updateLocation(

  location: Partial<WorldLocation>

): void {

  Object.assign(

    world.location,

    location

  );

}

export function updateWeather(

  weather: Partial<WorldWeather>

): void {

  Object.assign(

    world.weather,

    weather

  );

}

export function updateTime(

  time: Partial<WorldTime>

): void {

  Object.assign(

    world.time,

    time

  );

}

export function updateDevice(

  device: Partial<WorldDevice>

): void {

  Object.assign(

    world.device,

    device

  );

}

export function clearWorldState(): void {

  world.location = {};

  world.weather = {

    current: {

      temperature: 0,

      feelsLike: 0,

      humidity: 0,

      windSpeed: 0,

      condition: "",

      icon: "",

      uv: 0,

      visibility: 0,

      sunrise: "",

      sunset: "",

    },

    hourly: [],

    daily: [],

  };

  world.device = {};

  world.time = {

    localTime: "",

    utcTime: "",

    timezone: "UTC",

  };

}