import "./WeatherInsights.css";

import { CloudRain, SunMedium, Wind } from "lucide-react";

import DashboardCard from "../../../components/dashboard/DashboardCard";
import useWorld from "../../../hooks/useWorld";

export default function WeatherInsights() {
  const { world } = useWorld();
  if (!world) return null;

  const { current, hourly } = world.weather;
  const rainHour = hourly.find(hour => hour.chanceOfRain >= 45);
  const rainTime = rainHour ? new Date(rainHour.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  const insights = [
    rainTime ? { icon: CloudRain, title: "Rain window", text: `A ${rainHour?.chanceOfRain}% chance of rain begins around ${rainTime}.` } : { icon: CloudRain, title: "Dry outlook", text: "No significant rain is expected in the next 12 hours." },
    current.uv >= 6 ? { icon: SunMedium, title: "UV advisory", text: `UV is ${current.uv}; sunscreen is recommended if you are outside.` } : { icon: SunMedium, title: "UV level", text: `UV is currently ${current.uv}, within a lower exposure range.` },
    current.windSpeed >= 30 ? { icon: Wind, title: "Wind advisory", text: `Wind is ${Math.round(current.windSpeed)} km/h. Allow extra time for outdoor travel.` } : { icon: Wind, title: "Wind conditions", text: `Wind is ${Math.round(current.windSpeed)} km/h and should feel manageable.` },
  ];

  return <DashboardCard title="Sentinel weather intelligence" subtitle="A practical read of your local conditions" icon={SunMedium} className="weather-insights-card"><div className="weather-insights">{insights.map(({ icon: Icon, title, text }) => <div className="weather-insight" key={title}><Icon size={20} /><div><strong>{title}</strong><span>{text}</span></div></div>)}</div></DashboardCard>;
}
