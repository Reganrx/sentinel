import { useEffect, useState } from "react";
import { Activity, AudioLines, Cpu, Maximize2, Minimize2, MapPin, Power, Wifi } from "lucide-react";
import { useSentinel } from "../state/SentinelContext";
import { useWorldContext } from "../world/WorldContext";
import { getDeviceState } from "../services/device";
import { getLocationStatus, type LocationStatus } from "../services/location";
import "./SystemStatusBar.css";
import "./SystemStatusEnhanced.css";
import WakeWordButton from "./WakeWordButton";
import { WAKE_ENABLED_KEY } from "../services/wakeVoice";

export default function SystemStatusBar({ focusMode, onToggleFocus }: { focusMode: boolean; onToggleFocus: () => void }) {
  const { state } = useSentinel();
  const { world } = useWorldContext();
  const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  const [cpuHistory, setCpuHistory] = useState<number[]>(Array(18).fill(12));
  const [networkHistory, setNetworkHistory] = useState<number[]>(Array(18).fill(0));
  const [locationStatus, setLocationStatus] = useState<LocationStatus>(getLocationStatus);
  const [version, setVersion] = useState(() => localStorage.getItem("sentinel-display-version") ?? "");
  const [liveConversation, setLiveConversation] = useState<{ open: boolean; state: string }>({ open: false, state: "idle" });
  const [wakeEnabled, setWakeEnabled] = useState(() => localStorage.getItem(WAKE_ENABLED_KEY) === "true");
  useEffect(() => { const timer = window.setInterval(() => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { let active = true; const refresh = async () => { try { const device = await getDeviceState(); if (!active) return; setCpuHistory(previous => [...previous.slice(-17), Math.max(4, Math.min(100, device.cpu.usage))]); setNetworkHistory(previous => [...previous.slice(-17), device.network.connected ? 72 : 4]); } catch { /* Keep the chrome quiet if telemetry is unavailable. */ } }; void refresh(); const timer = window.setInterval(() => void refresh(), 5000); return () => { active = false; window.clearInterval(timer); }; }, []);
  useEffect(() => {
    const onLocationStatus = (event: Event) => setLocationStatus((event as CustomEvent<{ status: LocationStatus }>).detail.status);
    window.addEventListener("sentinel:location-status", onLocationStatus);
    return () => window.removeEventListener("sentinel:location-status", onLocationStatus);
  }, []);
  useEffect(() => {
    const refresh = () => setWakeEnabled(localStorage.getItem(WAKE_ENABLED_KEY) === "true");
    window.addEventListener("sentinel:wake-settings-change", refresh);
    return () => window.removeEventListener("sentinel:wake-settings-change", refresh);
  }, []);
  useEffect(() => {
    const updateLiveConversation = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean; state?: string }>).detail;
      setLiveConversation({ open: Boolean(detail?.open), state: detail?.state ?? "idle" });
    };
    window.addEventListener("sentinel:live-conversation-state", updateLiveConversation);
    return () => window.removeEventListener("sentinel:live-conversation-state", updateLiveConversation);
  }, []);
  useEffect(() => {
    let active = true;
    const onVersionUpdated = (event: Event) => {
      const nextVersion = (event as CustomEvent<{ version?: string }>).detail?.version;
      if (!nextVersion) return;
      localStorage.setItem("sentinel-display-version", nextVersion);
      setVersion(nextVersion);
    };
    window.addEventListener("sentinel:version-updated", onVersionUpdated);
    void window.sentinelDesktop?.updateStatus()
      .then(status => {
        if (!active) return;
        const publishedVersion = localStorage.getItem("sentinel-display-version");
        setVersion(status.edition === "personal" && publishedVersion ? publishedVersion : status.currentVersion);
      })
      .catch(() => { /* Version remains hidden if desktop metadata is unavailable. */ });
    return () => {
      active = false;
      window.removeEventListener("sentinel:version-updated", onVersionUpdated);
    };
  }, []);
  const location = world?.location.city ?? (locationStatus === "unavailable" ? "Location access needed" : locationStatus === "active" ? "Location confirmed" : "Location syncing");
  const weatherAlert = /storm|thunder|warning|heavy/i.test(world?.weather.current.condition ?? "");
  const shutdown = () => { if (window.confirm("Shut down Sentinel?")) void window.sentinelDesktop?.shutdown(); };
  const toggleVoiceControl = () => {
    if (liveConversation.open) { window.dispatchEvent(new Event("sentinel:live-conversation-toggle")); return; }
    const next = !wakeEnabled;
    localStorage.setItem(WAKE_ENABLED_KEY, String(next));
    setWakeEnabled(next);
    window.dispatchEvent(new Event("sentinel:wake-settings-change"));
  };
  const liveLabel = liveConversation.open ? `Show or minimise live conversation (${liveConversation.state})` : wakeEnabled ? "Turn off Hey Sentinel standby" : "Turn on Hey Sentinel standby";
  return <header className={`system-status-bar ${weatherAlert ? "system-status-bar--alert" : ""}`}><div className="system-status-core"><i className={`system-status-light system-status-light--${state}`} /><span>SENTINEL</span><strong>{state === "idle" ? "ONLINE" : state.toUpperCase()}</strong><button className="system-power-toggle" onClick={shutdown} title="Shut down Sentinel" aria-label="Shut down Sentinel"><Power size={13} /></button>{version && <span className="system-version" title={`Sentinel version ${version}`}>v{version}</span>}<button className={`system-live-talk ${liveConversation.open ? `is-active is-${liveConversation.state}` : wakeEnabled ? "is-active is-standby" : ""}`} onClick={toggleVoiceControl} title={liveLabel} aria-label={liveLabel} aria-pressed={liveConversation.open || wakeEnabled}><AudioLines size={14} /></button><WakeWordButton hidden />{state !== "idle" && <span className="system-waveform">{Array.from({ length: 11 }, (_, index) => <i key={index} />)}</span>}</div><div className="system-status-items"><span><MapPin size={14} />{location}</span><span><Wifi size={14} />{world?.device.network ?? "Connected"}</span><span className="system-metric"><Cpu size={14} /><Sparkline values={cpuHistory} /></span><span className="system-metric system-metric--network"><Wifi size={14} /><Sparkline values={networkHistory} /></span><span className="system-status-time"><Activity size={14} />{time}</span><button className="system-focus-toggle" onClick={onToggleFocus} title={focusMode ? "Exit focus mode" : "Enter focus mode"}>{focusMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button></div></header>;
}

function Sparkline({ values }: { values: number[] }) { return <span className="system-sparkline">{values.map((value, index) => <i key={index} style={{ height: `${Math.max(14, value)}%` }} />)}</span>; }
