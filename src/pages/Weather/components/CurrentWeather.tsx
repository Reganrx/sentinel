import "./CurrentWeather.css";

import { CloudSun } from "lucide-react";

import DashboardCard from "../../../components/dashboard/DashboardCard";
import WeatherIcon from "../../../components/weather/WeatherIcon";

import useWorld from "../../../hooks/useWorld";

export default function CurrentWeather() {

  const {

    world,

    loading,

  } = useWorld();

  if (

    loading ||

    !world

  ) {

    return (

      <DashboardCard

        title="Current Weather"

        subtitle="Loading..."

        icon={CloudSun}

        className="wide"

      >

        Loading weather...

      </DashboardCard>

    );

  }

  const {

    location,

    weather,

    time,

  } = world;

  return (

    <DashboardCard

      title="Current Weather"

      subtitle={

        location.city ??

        "Unknown Location"

      }

      icon={CloudSun}

      className="wide"

    >

      <div className="current-weather">

        <div className="current-weather-main">

          <WeatherIcon

            icon={weather.current.icon}

            condition={weather.current.condition}

            size={80}

          />

          <div className="current-temperature">

            {Math.round(

              weather.current.temperature

            )}°

          </div>

          <div className="current-condition">

            {weather.current.condition}

          </div>

          <div className="current-range">

            Feels like{" "}

            {Math.round(

              weather.current.feelsLike

            )}°

          </div>

        </div>

        <div className="current-weather-side">

          <div>

            <strong>

              Humidity

            </strong>

            <span>

              {weather.current.humidity}%

            </span>

          </div>

          <div>

            <strong>

              Wind

            </strong>

            <span>

              {weather.current.windSpeed} km/h

            </span>

          </div>

          <div>

            <strong>

              Updated

            </strong>

            <span>

              {time.localTime}

            </span>

          </div>

        </div>

      </div>

    </DashboardCard>

  );

}