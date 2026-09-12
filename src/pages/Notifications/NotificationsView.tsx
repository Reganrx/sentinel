import { useEffect, useMemo, useState } from "react";
import { Activity, BellRing, Camera, CheckCheck, CircleAlert, RefreshCw, Server, ShieldCheck, WifiOff } from "lucide-react";
import { getAutomationIntegrations, getRingDevices, getRingEvents, type RingEvent } from "../../services/automation";
import "./NotificationsView.css";
import { API_URL } from "../../services/api";

type DiagnosticCheck = { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string; action?: string };
type DiagnosticResult = { checks: DiagnosticCheck[] };
type Notice = { id: string; category: "security" | "system" | "service"; level: "critical" | "warning" | "info"; title: string; detail: string; time: string; source: string };
type Filter = "all" | Notice["category"] | "unread";
const readKey = "sentinel-read-notifications";

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function NotificationsView() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [read, setRead] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem(readKey) ?? "[]") as string[]));
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true); setError("");
    try {
      const [integrations, diagnostics] = await Promise.all([
        getAutomationIntegrations(),
        fetch(`${API_URL}/system/diagnostics`).then(response => response.ok ? response.json() as Promise<DiagnosticResult> : Promise.reject()),
      ]);
      const ringConnected = integrations.some(item => item.id === "ring" && item.connected);
      const [events, devices] = ringConnected ? await Promise.all([getRingEvents(), getRingDevices()]) : [[], []];
      const security: Notice[] = (events as RingEvent[]).map(event => ({
        id: `ring-${event.id}`, category: "security", level: event.kind === "doorbell" ? "warning" : "info",
        title: event.kind === "doorbell" ? "Doorbell pressed" : event.kind === "motion" ? "Motion detected" : "Security activity",
        detail: `${event.deviceName || "Ring device"} recorded ${event.kind} activity.`, time: event.occurredAt, source: "Ring",
      }));
      const offline = devices.filter(device => !device.online).map(device => ({
        id: `ring-offline-${device.id}`, category: "service" as const, level: "warning" as const, title: `${device.name} is offline`,
        detail: "The device could not be reached during the latest refresh.", time: new Date().toISOString(), source: "Device health",
      }));
      const system = diagnostics.checks.filter(check => check.status !== "pass").map(check => ({
        id: `diagnostic-${check.id}-${check.status}`, category: "system" as const, level: check.status === "fail" ? "critical" as const : "warning" as const,
        title: check.label, detail: check.action ? `${check.detail} ${check.action}` : check.detail, time: new Date().toISOString(), source: "Self-diagnosis",
      }));
      const service: Notice[] = ringConnected ? [] : [{ id: "ring-disconnected", category: "service", level: "info", title: "Ring monitoring is not connected", detail: "Connect Ring in Mission Control → Security to receive camera and doorbell activity here.", time: new Date().toISOString(), source: "Integrations" }];
      setNotices([...system, ...offline, ...security, ...service].sort((a, b) => +new Date(b.time) - +new Date(a.time)));
    } catch { setError("Sentinel could not refresh the notification centre. Local services may still be starting."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 60000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { localStorage.setItem(readKey, JSON.stringify([...read])); }, [read]);
  const unread = notices.filter(item => !read.has(item.id)).length;
  const visible = useMemo(() => notices.filter(item => filter === "all" || (filter === "unread" ? !read.has(item.id) : item.category === filter)), [notices, filter, read]);
  const markRead = (id: string) => setRead(current => new Set(current).add(id));

  return <div className="notifications-view">
    <header className="notifications-heading"><div><p>ATTENTION CENTRE</p><h1>Notifications</h1><span>Security activity, service health and important system changes in one place.</span></div><button onClick={() => void refresh()} disabled={loading}><RefreshCw className={loading ? "notifications-spin" : ""} size={17} /> Refresh</button></header>
    <section className="notifications-overview">
      <article><BellRing /><div><span>Unread</span><strong>{unread}</strong></div></article>
      <article><ShieldCheck /><div><span>Security events</span><strong>{notices.filter(item => item.category === "security").length}</strong></div></article>
      <article className={notices.some(item => item.level === "critical") ? "has-attention" : ""}><Activity /><div><span>System state</span><strong>{notices.some(item => item.level === "critical") ? "Attention" : "Ready"}</strong></div></article>
      <button onClick={() => setRead(new Set(notices.map(item => item.id)))} disabled={!unread}><CheckCheck size={17} /> Mark all read</button>
    </section>
    <div className="notifications-layout"><aside><strong>FILTER VIEW</strong>{(["all", "unread", "security", "system", "service"] as Filter[]).map(item => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "Everything" : item[0].toUpperCase() + item.slice(1)}<span>{item === "all" ? notices.length : item === "unread" ? unread : notices.filter(n => n.category === item).length}</span></button>)}</aside>
      <main className="notification-feed">{error && <div className="notification-error"><CircleAlert size={18} />{error}</div>}{visible.length ? visible.map(item => <article key={item.id} className={`notification-item notification-item--${item.level} ${read.has(item.id) ? "is-read" : ""}`} onClick={() => markRead(item.id)}>
        <div className="notification-icon">{item.category === "security" ? <Camera /> : item.category === "system" ? <Server /> : <WifiOff />}</div><div><header><strong>{item.title}</strong><span>{formatTime(item.time)}</span></header><p>{item.detail}</p><footer>{item.source}<i />{item.category}</footer></div>{!read.has(item.id) && <b title="Unread" />}
      </article>) : <div className="notification-empty"><CheckCheck /><strong>All clear</strong><span>No notifications match this view.</span></div>}</main>
    </div>
  </div>;
}
