import { useEffect, useMemo, useState } from "react";
import { BellRing, CloudSun, Command, DraftingCompass, Map, MessageSquare, Monitor, Music2, Plane, Radar, Search, Settings, ShieldCheck, Sparkles, X } from "lucide-react";
import { useNavigation, type NavigationView } from "../navigation/NavigationContext";
import "./CommandPalette.css";
import { useHiddenPages } from "../services/pageVisibility";

const commands: Array<{ view: NavigationView; label: string; detail: string; icon: typeof Command }> = [
  { view: "home", label: "Go to Home", detail: "Sentinel reactor and quick command", icon: Sparkles },
  { view: "chat", label: "Open Chat", detail: "Continue a conversation with Sentinel", icon: MessageSquare },
  ...(import.meta.env.VITE_SENTINEL_EDITION !== "base" ? [{ view: "design" as NavigationView, label: "Open Design", detail: "Foam inserts and printable models", icon: DraftingCompass }] : []),
  { view: "scanner", label: "Open Device Scanner", detail: "Discover devices on the current network", icon: Radar },
  { view: "media", label: "Open Audio Control", detail: "Playback controls and Sentinel AI DJ", icon: Music2 },
  { view: "navigation", label: "Open Navigation", detail: "Search a destination and route", icon: Map },
  { view: "notifications", label: "Open Notifications", detail: "Security activity and system attention", icon: BellRing },
  { view: "automation", label: "Open Mission Control", detail: "Home Command, automation and security", icon: ShieldCheck },
  { view: "settings", label: "Open Settings", detail: "Preferences and developer mode", icon: Settings },
  { view: "system", label: "Open System Vitals", detail: "Live device monitoring", icon: Monitor },
  { view: "travel", label: "Open Travel", detail: "Trips, flights and destination briefing", icon: Plane },
  { view: "weather", label: "Open Weather", detail: "Live local conditions and forecast", icon: CloudSun },
];

export default function CommandPalette() {
  const { navigate } = useNavigation();
  const hiddenPages = useHiddenPages();
  const [open, setOpen] = useState(false); const [query, setQuery] = useState("");
  useEffect(() => { const listener = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(value => !value); } if (event.key === "Escape") setOpen(false); }; window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener); }, []);
  const matches = useMemo(() => commands.filter(item => !hiddenPages.includes(item.view) && `${item.label} ${item.detail}`.toLowerCase().includes(query.toLowerCase().trim())), [query, hiddenPages]);
  function run(view: NavigationView) { navigate(view); setOpen(false); setQuery(""); }
  if (!open) return null;
  return <div className="command-palette-backdrop" onMouseDown={() => setOpen(false)}><section className="command-palette" onMouseDown={event => event.stopPropagation()}><header><Search size={20} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search Sentinel commands…" /><button onClick={() => setOpen(false)}><X size={18} /></button></header><p><Command size={13} /> COMMAND CENTRE</p><div>{matches.map(item => { const Icon = item.icon; return <button key={item.view} onClick={() => run(item.view)}><span className="command-palette-icon"><Icon size={18} /></span><span><strong>{item.label}</strong><small>{item.detail}</small></span><kbd>↵</kbd></button>; })}{!matches.length && <div className="command-palette-empty">No matching commands.</div>}</div><footer><kbd>Ctrl K</kbd> to toggle <span>·</span> <kbd>Esc</kbd> to close</footer></section></div>;
}
