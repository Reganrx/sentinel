import "./HourlyForecast.css";

import { Clock3 } from "lucide-react";

import DashboardCard from "../../../components/dashboard/DashboardCard";
import WeatherIcon from "../../../components/weather/WeatherIcon";

import useWorld from "../../../hooks/useWorld";

export default function HourlyForecast() {
  const {
    world,

    loading,
  } = useWorld();

  if (loading || !world) {
    return (
      <DashboardCard
        title="Hourly Forecast"

        subtitle="Loading..."

        icon={Clock3}
      >
        Loading forecast...
      </DashboardCard>
    );
  }

  const hours = world.weather.hourly.slice(0, 12);

  return (
    <DashboardCard
      title="Hourly Forecast"

      subtitle="Next 12 Hours"

      icon={Clock3}
    >
      <div className="forecast-list">
        {hours.map((hour) => (
          <ForecastRow
            key={hour.time}

            hour={hour}
          />
        ))}
      </div>
    </DashboardCard>
  );
}

interface ForecastRowProps {
  hour: {
    time: string;

    temperature: number;

    condition: string;

    icon: string;

    chanceOfRain: number;
  };
}

function ForecastRow({ hour }: ForecastRowProps) {
  const label = new Date(hour.time).toLocaleTimeString(
    [],

    {
      hour: "2-digit",

      minute: "2-digit",
    },
  );

  return (
    <div className="forecast-row">
      <div className="forecast-time">{label}</div>

      <WeatherIcon
        icon={hour.icon}

        condition={hour.condition}

        size={34}
      />

      <div className="forecast-temp">{Math.round(hour.temperature)}°</div>

      <div className="forecast-condition">{hour.condition}</div>

      <div className="forecast-rain">💧 {hour.chanceOfRain}%</div>
    </div>
  );
}
