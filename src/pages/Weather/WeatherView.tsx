import "./WeatherView.css";

import { CloudSun, Radar, CalendarDays } from "lucide-react";
import { useState } from "react";

import useWorld from "../../hooks/useWorld";

import WeatherBackground from "../../components/weather/WeatherBackground";

import CurrentWeather from "./components/CurrentWeather";
import HourlyForecast from "./components/HourlyForecast";
import WeatherConditions from "./components/WeatherConditions";
import WeeklyForecast from "./components/WeeklyForecast";
import WeatherInsights from "./components/WeatherInsights";
import WeatherRadar from "./components/WeatherRadar";
import LoadingSkeleton from "../../components/LoadingSkeleton";

export default function WeatherView() {

  const [section, setSection] = useState<"today" | "weekly" | "radar">("today");

  const {

    world,

  } = useWorld();

  if (!world) {
    return <div className="weather-view"><LoadingSkeleton lines={4} /></div>;
  }

  return (

    <>

      <WeatherBackground

        condition={

          world.weather.current.condition

        }

      />

      <div className="weather-view">

        {section !== "radar" && <CurrentWeather />}

        <nav className="weather-tabs" aria-label="Weather sections">
          <button className={section === "today" ? "is-active" : ""} onClick={() => setSection("today")}><CloudSun size={17} /> Today</button>
          <button className={section === "weekly" ? "is-active" : ""} onClick={() => setSection("weekly")}><CalendarDays size={17} /> Weekly forecast</button>
          <button className={section === "radar" ? "is-active" : ""} onClick={() => setSection("radar")}><Radar size={17} /> Weather radar</button>
        </nav>

        {section === "today" && <div className="weather-today-layout"><HourlyForecast /><WeatherConditions /><WeatherInsights /></div>}
        {section === "weekly" && <WeeklyForecast />}
        {section === "radar" && <WeatherRadar />}

      </div>

    </>

  );

}
