import { useNavigation } from "../navigation/NavigationContext";
import { useSentinel } from "../state/SentinelContext";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import "./AppBackground.css";
import "./AppBackgroundAmbient.css";
import "./ThemeEnvironment.css";

export default function AppBackground() {
  const { state } = useSentinel();
  const { view } = useNavigation();
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => { const timer = window.setInterval(() => setHour(new Date().getHours()), 60000); return () => window.clearInterval(timer); }, []);
  const timeOfDay = hour < 6 ? "night" : hour < 10 ? "dawn" : hour < 17 ? "day" : hour < 21 ? "dusk" : "night";
  return <div className={`sentinel-environment state-${state} view-${view} ambience-${timeOfDay}`} aria-hidden="true">
    <div className="sentinel-environment-glow" />
    <div className="sentinel-environment-grid" />
    <div className="sentinel-environment-scan" />
    <div className="sentinel-environment-orbit sentinel-environment-orbit--one" />
    <div className="sentinel-environment-orbit sentinel-environment-orbit--two" />
    <div className="sentinel-environment-particles">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--star": index } as CSSProperties} />)}</div>
  </div>;
}
