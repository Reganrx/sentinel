import "./WeeklyForecast.css";
import "./WeeklyForecastEnhancements.css";
import { CalendarDays, Droplets, Sunrise, Sunset, ThermometerSun, Wind, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import DashboardCard from "../../../components/dashboard/DashboardCard";
import WeatherIcon from "../../../components/weather/WeatherIcon";
import useWorld from "../../../hooks/useWorld";
import type { WeatherDay } from "../../../types/world";

function dayLabel(date: string, index: number) {
  if (index === 0) return "Today";
  return new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}

function ForecastCard({ day, index, selected, onSelect }: { day: WeatherDay; index: number; selected: boolean; onSelect: () => void }) {
  return <article className={`weekly-forecast-day ${index === 0 ? "is-today" : ""} ${selected ? "is-selected" : ""}`} role="button" tabIndex={0} aria-haspopup="dialog" onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); } }}>
    <header><div><span>{index === 0 ? "CURRENT DAY" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${day.date}T12:00:00`))}</span><strong>{dayLabel(day.date, index).split(",")[0]}</strong></div>{index === 0 && <b>Today</b>}</header>
    <div className="weekly-condition"><WeatherIcon icon={day.icon} condition={day.condition} size={52} /><span>{day.condition}</span></div>
    <div className="weekly-temperature"><strong>{Math.round(day.maxTemp)}°</strong><span>{Math.round(day.minTemp)}°</span></div>
    <div className="weekly-temp-range"><i style={{ left: `${Math.max(5, Math.min(65, 25 + day.minTemp))}%`, width: `${Math.max(18, Math.min(55, day.maxTemp - day.minTemp + 20))}%` }} /></div>
    <div className="weekly-details"><span><Droplets />{day.chanceOfRain ?? 0}% rain</span><span><Wind />{Math.round(day.windSpeed ?? 0)} km/h</span></div>
    <footer><span><Sunrise />{day.sunrise || "--"}</span><span><Sunset />{day.sunset || "--"}</span></footer>
  </article>;
}

function ForecastModal({ day, index, onClose }: { day: WeatherDay; index: number; onClose: () => void }) {
  return createPortal(<div className="weekly-modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="weekly-modal-card" role="dialog" aria-modal="true" aria-label={`${dayLabel(day.date, index)} forecast`} onPointerDown={(event) => event.stopPropagation()}>
      <button className="weekly-modal-close" onClick={onClose} aria-label="Close forecast"><X /></button>
      <div className="weekly-modal-summary"><small>SELECTED DAY</small><h2>{dayLabel(day.date, index)}</h2><WeatherIcon icon={day.icon} condition={day.condition} size={76} /><p>{day.condition}</p><div className="weekly-modal-temperature"><strong>{Math.round(day.maxTemp)}°</strong><span>{Math.round(day.minTemp)}°</span></div><div className="weekly-modal-metrics"><span><Droplets />{day.chanceOfRain ?? 0}% rain</span><span><Wind />{Math.round(day.windSpeed ?? 0)} km/h</span></div></div>
      <div className="weekly-modal-hours"><header><div><small>HOURLY OUTLOOK</small><h3>Temperature through the day</h3></div><span>{day.hours?.length ?? 0} hours</span></header>
        {day.hours?.length ? <div className="weekly-hourly-strip">{day.hours.map((hour) => <div key={hour.time}><time>{new Date(hour.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><WeatherIcon icon={hour.icon} condition={hour.condition} size={34} /><strong>{Math.round(hour.temperature)}°</strong><small>{hour.chanceOfRain}% rain</small></div>)}</div> : <p className="weekly-hourly-empty">Hourly detail is unavailable for this day from the current provider.</p>}
        <footer><span><Sunrise /> Sunrise {day.sunrise || "--"}</span><span><Sunset /> Sunset {day.sunset || "--"}</span></footer>
      </div>
    </section>
  </div>, document.body);
}

export default function WeeklyForecast() {
  const { world, loading } = useWorld();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedDate) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedDate(null); };
    document.addEventListener("keydown", close);
    document.body.classList.add("weekly-forecast-open");
    return () => {
      document.removeEventListener("keydown", close);
      document.body.classList.remove("weekly-forecast-open");
    };
  }, [selectedDate]);
  if (loading || !world) return <DashboardCard title="Weekly Forecast" subtitle="Loading…" icon={CalendarDays}>Loading forecast…</DashboardCard>;
  const days = world.weather.daily.slice(0, 7);
  if (!days.length) return <DashboardCard title="Weekly Forecast" subtitle="Seven-day outlook" icon={CalendarDays}>No daily forecast is available.</DashboardCard>;
  const selectedIndex = days.findIndex((day) => day.date === selectedDate);
  const selectedDay = selectedIndex >= 0 ? days[selectedIndex] : null;
  const warmest = days.reduce((best, day) => day.maxTemp > best.maxTemp ? day : best, days[0]);
  const wettest = days.reduce((best, day) => day.chanceOfRain > best.chanceOfRain ? day : best, days[0]);
  const averageHigh = Math.round(days.reduce((sum, day) => sum + day.maxTemp, 0) / days.length);
  return <DashboardCard title="Weekly Forecast" subtitle="Select a day for its hourly outlook" icon={CalendarDays} className="weekly-forecast-card">
    <div className="weekly-summary"><div><ThermometerSun /><span>Average high<strong>{averageHigh}°</strong></span></div><div><CalendarDays /><span>Warmest day<strong>{dayLabel(warmest.date, days.indexOf(warmest))} · {Math.round(warmest.maxTemp)}°</strong></span></div><div><Droplets /><span>Highest rain chance<strong>{dayLabel(wettest.date, days.indexOf(wettest))} · {wettest.chanceOfRain}%</strong></span></div></div>
    <div className="weekly-forecast-grid">{days.map((day, index) => <ForecastCard key={day.date} day={day} index={index} selected={selectedDate === day.date} onSelect={() => setSelectedDate(day.date)} />)}</div>
    {selectedDay && <ForecastModal day={selectedDay} index={selectedIndex} onClose={() => setSelectedDate(null)} />}
  </DashboardCard>;
}
