import "./HomeView.css";
import "./HomeViewLayoutFix.css";

import AppView from "../../components/layout/AppView";

import SentinelCore from "./components/SentinelCore/SentinelCore";

import HomeActions from "./components/HomeActions/HomeActions";
import { Activity, CloudSun, MapPin, Radio, ShieldCheck, Wifi, Zap } from "lucide-react";
import useWorld from "../../hooks/useWorld";

export default function HomeView({ onQuickChatHost }: { onQuickChatHost: (element: HTMLDivElement | null) => void }) {

  const { world, loading } = useWorld();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const nextHour = world?.weather.hourly?.[0];
  const location = world?.location.city || "Locating…";

  return (

    <AppView

      title="Home"

      showHeader={false}

      className="home-app-view"

    >

      <div className="home-view">

        <header className="home-welcome">
          <div><p>PERSONAL COMMAND CENTRE</p><h2>{greeting}</h2></div>
          <div className="home-context-strip">
            <span><MapPin size={14} />{world?.location.city || "Locating…"}</span>
            <span><CloudSun size={14} />{loading ? "Updating weather" : world ? `${Math.round(world.weather.current.temperature)}° · ${world.weather.current.condition}` : "Weather unavailable"}</span>
            <span><Wifi size={14} />{world?.device.network || "Checking network"}</span>
            <span className="home-context-ready"><ShieldCheck size={14} />Protected</span>
          </div>
        </header>

        <div className="home-core-stage">
          <i className="home-orbit home-orbit--one" /><i className="home-orbit home-orbit--two" />
          <div className="home-telemetry home-telemetry--left">
            <span className="home-telemetry-icon"><Activity size={15} /></span>
            <div><small>SYSTEM HEALTH</small><strong>All systems nominal</strong></div>
            <i className="home-live-dot" />
          </div>
          <div className="home-telemetry home-telemetry--right">
            <span className="home-telemetry-icon"><Radio size={15} /></span>
            <div><small>LOCAL ENVIRONMENT</small><strong>{loading ? "Synchronising" : `${location} · ${world?.device.network || "Online"}`}</strong></div>
            <i className="home-live-dot" />
          </div>
          <SentinelCore />
        </div>

        <div className="home-activity-ribbon">
          <span className="home-activity-title"><i /> LIVE BRIEFING</span>
          <span><b>Now</b> Sentinel is monitoring your connected services</span>
          <span><b>Weather</b> {nextHour ? `${nextHour.time} · ${Math.round(nextHour.temperature)}° · ${nextHour.condition}` : "Forecast synchronising"}</span>
          <span><b>Security</b> No immediate action required</span>
        </div>

        <div className="home-controls">
          <p className="home-monitoring-copy">Monitoring your world</p>
          <div className="home-core-readouts" aria-label="Live Sentinel readouts">
            <span><Zap size={13} /><b>CORE</b> Stable</span>
            <span><Wifi size={13} /><b>LINK</b> Active</span>
            <span><ShieldCheck size={13} /><b>SHIELD</b> Protected</span>
          </div>
          <div className="home-controls-label"><span>QUICK COMMAND</span><i /></div>
          <div id="sentinel-quick-chat-host" ref={onQuickChatHost} />
          <HomeActions world={world} loading={loading} />
        </div>

      </div>

    </AppView>

  );

}
