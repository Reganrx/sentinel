import "./WeatherConditions.css";

import { Gauge } from "lucide-react";

import DashboardCard from "../../../components/dashboard/DashboardCard";

import useWorld from "../../../hooks/useWorld";

export default function WeatherConditions() {

  const {

    world,

    loading,

  } = useWorld();

  if (loading || !world) {

    return (

      <DashboardCard

        title="Conditions"

        subtitle="Loading..."

        icon={Gauge}

      >

        Loading...

      </DashboardCard>

    );

  }

  const {

    weather,

  } = world;

  const {

    current,

  } = weather;

  return (

    <DashboardCard

      title="Conditions"

      subtitle="Current measurements"

      icon={Gauge}

    >

      <div className="conditions-grid">

        <Condition label="Humidity" value={`${current.humidity ?? "--"}%`} />

        <Condition label="Wind" value={`${current.windSpeed ?? "--"} km/h`} />

        <Condition label="Visibility" value={`${current.visibility ?? "--"} km`} />

        <Condition label="UV Index" value={`${current.uv ?? "--"}`} />

        <Condition label="Sunrise" value={current.sunrise ?? "--"} />

        <Condition label="Sunset" value={current.sunset ?? "--"} />

      </div>

    </DashboardCard>

  );

}

interface ConditionProps {

  label: string;

  value: string;

}

function Condition({

  label,

  value,

}: ConditionProps) {

  return (

    <div className="condition-card">

      <span>{label}</span>

      <strong>{value}</strong>

    </div>

  );

}
