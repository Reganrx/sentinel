import { WeatherProvider, WeatherState } from "./WeatherProvider.js";

import { config } from "../../config/index.js";

export class WeatherApiProvider implements WeatherProvider {
  private readonly apiKey = config.weather.apiKey;

  async getWeather(latitude: number, longitude: number): Promise<WeatherState> {
    const response = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${this.apiKey}&q=${latitude},${longitude}&days=7&aqi=yes&alerts=yes`,
    );

    if (!response.ok) {
      throw new Error("Weather API request failed.");
    }

    const json = await response.json();

    const weather = {
      current: {
        temperature: json.current.temp_c,

        feelsLike: json.current.feelslike_c,

        humidity: json.current.humidity,

        windSpeed: json.current.wind_kph,

        condition: json.current.condition.text,

        icon: json.current.condition.icon,

        uv: json.current.uv,

        visibility: json.current.vis_km,

        sunrise: json.forecast.forecastday[0].astro.sunrise,

        sunset: json.forecast.forecastday[0].astro.sunset,
      },

      hourly: json.forecast.forecastday
        .flatMap((day: any) => day.hour)
        .filter((hour: any) => hour.time_epoch > json.location.localtime_epoch)
        .slice(0, 12)
        .map((hour: any) => ({
          time: hour.time,

          temperature: hour.temp_c,

          condition: hour.condition.text,

          icon: hour.condition.icon,

          chanceOfRain: hour.chance_of_rain,
        })),

      daily: json.forecast.forecastday.map((day: any) => ({
        date: day.date,

        minTemp: day.day.mintemp_c,

        maxTemp: day.day.maxtemp_c,

        condition: day.day.condition.text,

        icon: day.day.condition.icon,

        chanceOfRain: day.day.daily_chance_of_rain,

        windSpeed: day.day.maxwind_kph,

        sunrise: day.astro.sunrise,

        sunset: day.astro.sunset,

        hours: day.hour.map((hour: any) => ({
          time: hour.time,
          temperature: hour.temp_c,
          condition: hour.condition.text,
          icon: hour.condition.icon,
          chanceOfRain: hour.chance_of_rain,
        })),
      })),
    } as WeatherState;

    // Cross-check WeatherAPI against an independent live feed. This prevents a
    // stale or geographically incorrect current response from disagreeing with
    // the otherwise-correct weekly forecast.
    try {
      const openMeteo = await this.getOpenMeteoWeather(latitude, longitude);
      if (openMeteo.daily.length >= 7) weather.daily = openMeteo.daily;
      const temperatureGap = Math.abs(
        weather.current.temperature - openMeteo.current.temperature,
      );
      const weatherApiSevere = /blizzard|snow|ice/i.test(
        weather.current.condition,
      );
      const openMeteoSevere = /snow|thunder/i.test(
        openMeteo.current.condition,
      );
      if (
        !Number.isFinite(weather.current.temperature) ||
        temperatureGap >= 6 ||
        (weatherApiSevere !== openMeteoSevere && temperatureGap >= 3)
      ) {
        weather.current = openMeteo.current;
        weather.hourly = openMeteo.hourly;
      }
    } catch {
      // WeatherAPI remains available if the independent check is unavailable.
    }
    return weather;
  }

  private async getOpenMeteoWeather(latitude: number, longitude: number): Promise<WeatherState> {
    const dailyFields = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset";
    const hourlyFields = "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,visibility,uv_index";
    const currentFields = "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,visibility,is_day";
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=${currentFields}&hourly=${hourlyFields}&daily=${dailyFields}&timezone=auto&forecast_days=7`);
    if (!response.ok) throw new Error("Seven-day forecast request failed.");
    const json = await response.json() as {
      current: Record<string, number | string>;
      hourly: Record<string, Array<number | string>>;
      daily: Record<string, Array<number | string>>;
    };
    const daily = json.daily;
    const hourly = json.hourly;
    const mapHour = (index: number) => {
      const code = Number(hourly.weather_code[index]);
      const description = this.describeWeatherCode(code);
      return {
        time: String(hourly.time[index]),
        temperature: Number(hourly.temperature_2m[index]),
        condition: description.condition,
        icon: `//cdn.weatherapi.com/weather/64x64/day/${description.icon}.png`,
        chanceOfRain: Number(hourly.precipitation_probability[index] ?? 0),
      };
    };
    const allHours = (hourly.time as string[]).map((_, index) => mapHour(index));
    const forecastDays = (daily.time as string[]).map((date, index) => {
      const code = Number(daily.weather_code[index]);
      const description = this.describeWeatherCode(code);
      return {
        date,
        minTemp: Number(daily.temperature_2m_min[index]),
        maxTemp: Number(daily.temperature_2m_max[index]),
        condition: description.condition,
        icon: `//cdn.weatherapi.com/weather/64x64/day/${description.icon}.png`,
        chanceOfRain: Number(daily.precipitation_probability_max[index] ?? 0),
        windSpeed: Number(daily.wind_speed_10m_max[index] ?? 0),
        sunrise: this.formatSunTime(String(daily.sunrise[index] ?? "")),
        sunset: this.formatSunTime(String(daily.sunset[index] ?? "")),
        hours: allHours.filter((hour) => hour.time.startsWith(date)),
      };
    });
    const currentCode = Number(json.current.weather_code);
    const currentDescription = this.describeWeatherCode(currentCode);
    const currentTime = String(json.current.time ?? "");
    const currentHourIndex = (hourly.time as string[]).findIndex(
      (time) => String(time).slice(0, 13) === currentTime.slice(0, 13),
    );
    const today = forecastDays[0];
    return {
      current: {
        temperature: Number(json.current.temperature_2m),
        feelsLike: Number(json.current.apparent_temperature),
        humidity: Number(json.current.relative_humidity_2m),
        windSpeed: Number(json.current.wind_speed_10m),
        condition: currentDescription.condition,
        icon: `//cdn.weatherapi.com/weather/64x64/${Number(json.current.is_day) ? "day" : "night"}/${currentDescription.icon}.png`,
        uv: Number(hourly.uv_index[currentHourIndex] ?? 0),
        visibility: Number(json.current.visibility ?? hourly.visibility[currentHourIndex] ?? 0) / 1000,
        sunrise: today?.sunrise ?? "--",
        sunset: today?.sunset ?? "--",
      },
      hourly: allHours
        .filter((hour) => new Date(hour.time).getTime() > Date.now())
        .slice(0, 12),
      daily: forecastDays,
    };
  }

  private formatSunTime(value: string) {
    const time = value.split("T")[1];
    if (!time) return "--";
    const [hour, minute] = time.split(":").map(Number);
    const suffix = hour >= 12 ? "PM" : "AM";
    return `${String(hour % 12 || 12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}`;
  }

  private describeWeatherCode(code: number) {
    if (code === 0) return { condition: "Sunny", icon: 113 };
    if (code <= 2) return { condition: "Partly cloudy", icon: 116 };
    if (code === 3) return { condition: "Cloudy", icon: 119 };
    if (code <= 48) return { condition: "Fog", icon: 248 };
    if (code <= 57) return { condition: "Drizzle", icon: 266 };
    if (code <= 67) return { condition: "Rain", icon: 296 };
    if (code <= 77) return { condition: "Snow", icon: 326 };
    if (code <= 82) return { condition: "Rain showers", icon: 353 };
    if (code <= 86) return { condition: "Snow showers", icon: 368 };
    return { condition: "Thunderstorms", icon: 389 };
  }
}
