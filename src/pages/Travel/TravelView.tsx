import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Check, ChevronDown, ChevronUp, CirclePlus, CloudSun, ExternalLink, FileCheck2, Luggage, MapPin, Plane, Radar, Search, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { discoverAtDestination, searchLocations, type NearbyPlace } from "../../services/navigation";
import useWorld from "../../hooks/useWorld";
import { API_URL } from "../../services/api";
import { sendCompanionText } from "../../services/automation";
import "./TravelView.css"; import "./FlightTracking.css"; import "./TravelReadability.css"; import "./TravelLayoutFix.css"; import "./TravelTabs.css"; import "./TravelCollapse.css";

type Trip = { id: string; destination: string; startDate: string; endDate: string; latitude?: number; longitude?: number };
type Flight = { id: string; number: string; departure: string; arrival: string; dateTime: string; terminal: string; status: string };
type View = "ready" | "destination" | "flights";
const read = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; } };
const tripKey = "sentinel-travel-trips-v1", flightKey = "sentinel-travel-flights-v1", checklistKey = "sentinel-travel-checklist-v1";
const essentials = ["Passport or photo ID", "Travel insurance", "Boarding passes", "Medication", "Chargers and adapters", "Home security checked"];
function dateText(value: string) { return value ? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "Date not set"; }

export default function TravelView() {
  const { world } = useWorld();
  const [view, setView] = useState<View>("ready");
  const [trips, setTrips] = useState<Trip[]>(() => read(tripKey, [])); const [flights, setFlights] = useState<Flight[]>(() => read(flightKey, []));
  const [flightFormExpanded, setFlightFormExpanded] = useState(() => flights.length === 0);
  const [trip, setTrip] = useState<Partial<Trip>>({}); const [flight, setFlight] = useState<Partial<Flight>>({}); const [selectedId, setSelectedId] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>(() => read(checklistKey, {})); const [recommendations, setRecommendations] = useState<NearbyPlace[]>([]);
  const [recommendationType, setRecommendationType] = useState("things to do"); const [loading, setLoading] = useState(false); const [tracking, setTracking] = useState(""); const [error, setError] = useState("");
  useEffect(() => localStorage.setItem(tripKey, JSON.stringify(trips)), [trips]); useEffect(() => localStorage.setItem(flightKey, JSON.stringify(flights)), [flights]); useEffect(() => localStorage.setItem(checklistKey, JSON.stringify(checks)), [checks]);
  useEffect(() => {
    if (!trips.length && !flights.length) return;
    const snapshot = `SENTINEL_TRAVEL_V1:${JSON.stringify({ trips, flights })}`;
    const timer = window.setTimeout(() => { void sendCompanionText(snapshot).catch(() => undefined); }, 1500);
    return () => window.clearTimeout(timer);
  }, [trips, flights]);
  useEffect(() => { if (!selectedId && trips[0]) setSelectedId(trips[0].id); }, [trips, selectedId]);
  useEffect(() => { if (!flights.length) setFlightFormExpanded(true); }, [flights.length]);
  useEffect(() => {
    const prefill = (event: Event) => {
      const detail = (event as CustomEvent<{ destination?: string; flightNumber?: string; departure?: string; arrival?: string }>).detail ?? {};
      if (detail.flightNumber || detail.departure || detail.arrival) {
        setView("flights");
        setFlightFormExpanded(true);
        setFlight((value) => ({ ...value, number: detail.flightNumber ?? value.number, departure: detail.departure ?? value.departure, arrival: detail.arrival ?? value.arrival }));
      } else {
        setView("ready");
        setTrip((value) => ({ ...value, destination: detail.destination ?? value.destination }));
        window.setTimeout(() => document.getElementById("travel-add")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      }
    };
    window.addEventListener("sentinel:travel-prefill", prefill);
    return () => window.removeEventListener("sentinel:travel-prefill", prefill);
  }, []);
  const selected = trips.find(item => item.id === selectedId) ?? trips[0]; const upcomingFlights = useMemo(() => [...flights].sort((a, b) => +new Date(a.dateTime) - +new Date(b.dateTime)), [flights]);
  const countdown = selected?.startDate ? Math.ceil((+new Date(`${selected.startDate}T00:00:00`) - Date.now()) / 86400000) : null;

  async function addTrip(event: FormEvent) { event.preventDefault(); if (!trip.destination?.trim() || !trip.startDate || !trip.endDate) { setError("Enter a destination, departure date and return date."); return; } setError(""); try { const match = (await searchLocations(trip.destination))[0]; if (!match) throw new Error(); const next = { id: crypto.randomUUID(), destination: trip.destination.trim(), startDate: trip.startDate, endDate: trip.endDate, latitude: match.latitude, longitude: match.longitude }; setTrips(items => [...items, next]); setSelectedId(next.id); setTrip({}); setView("destination"); } catch { setError("The destination could not be located. Use a city, resort or landmark."); } }
  function addFlight(event: FormEvent) { event.preventDefault(); if (!flight.number?.trim() || !flight.departure?.trim() || !flight.arrival?.trim() || !flight.dateTime) { setError("Enter the flight number, departure airport, arrival airport and departure time."); return; } setFlights(items => [...items, { id: crypto.randomUUID(), number: flight.number!.toUpperCase().replace(/\s/g, ""), departure: flight.departure!.toUpperCase(), arrival: flight.arrival!.toUpperCase(), dateTime: flight.dateTime!, terminal: flight.terminal || "TBC", status: "Scheduled" }]); setFlight({}); setFlightFormExpanded(false); setError(""); }
  async function trackFlight(item: Flight) { setTracking(item.id); setError(""); try { const response = await fetch(`${API_URL}/travel/flights/${encodeURIComponent(item.number)}`); const result = await response.json() as Partial<Flight> & { error?: string }; if (!response.ok) throw new Error(result.error || "Flight tracking failed."); setFlights(items => items.map(saved => saved.id === item.id ? { ...saved, status: result.status || saved.status, terminal: result.terminal || saved.terminal, departure: result.departure || saved.departure, arrival: result.arrival || saved.arrival } : saved)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Flight tracking failed."); } finally { setTracking(""); } }
  async function loadRecommendations(type = recommendationType) { if (!selected) { setView("ready"); setError("Add a trip first, then return to Destination."); return; } setLoading(true); setError(""); try { let latitude = selected.latitude, longitude = selected.longitude; if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) { const location = (await searchLocations(selected.destination))[0]; if (!location) throw new Error(`Sentinel could not locate ${selected.destination}.`); latitude = location.latitude; longitude = location.longitude; setTrips(items => items.map(item => item.id === selected.id ? { ...item, latitude, longitude } : item)); } const places = await discoverAtDestination(`${type} in ${selected.destination}`, latitude!, longitude!); setRecommendations(places); if (!places.length) setError(`No ${type} were returned for ${selected.destination}.`); } catch (reason) { setError(reason instanceof Error ? reason.message : "Recommendations are unavailable."); } finally { setLoading(false); } }

  return <div className="travel-view">
    <header className="travel-heading"><div><p>TRAVEL COMMAND</p><h1>Travel</h1><span>A focused workspace for preparation, destinations and live flights.</span></div><button onClick={() => setView("ready")}><CirclePlus />Plan a trip</button></header>
    <nav className="travel-tabs"><button className={view === "ready" ? "active" : ""} onClick={() => setView("ready")}><Luggage />Ready to go</button><button className={view === "destination" ? "active" : ""} onClick={() => setView("destination")}><MapPin />Destination</button><button className={view === "flights" ? "active" : ""} onClick={() => setView("flights")}><Plane />Flight tracker</button></nav>
    {error && <div className="travel-error"><AlertTriangle />{error}</div>}

    {view === "ready" && <div className="travel-subpage travel-ready-page">
      <section className="travel-ready-hero"><div><span><ShieldCheck />PRE-DEPARTURE CONTROL</span><h2>{selected ? `${selected.destination} readiness` : "Ready for your next journey"}</h2><p>{selected ? `${countdown !== null && countdown >= 0 ? `${countdown} days to go` : "Journey dates saved"} · ${dateText(selected.startDate)}` : "Start with a destination, then complete each essential before departure."}</p></div><strong>{Object.values(checks).filter(Boolean).length}/{essentials.length}</strong></section>
      <div className="travel-ready-grid"><section className="travel-card travel-checklist"><header><div><Luggage /><span><h2>Ready to go</h2><p>{Object.values(checks).filter(Boolean).length}/{essentials.length} essentials complete</p></span></div></header><div>{essentials.map(item => <label key={item}><input type="checkbox" checked={Boolean(checks[item])} onChange={() => setChecks(value => ({ ...value, [item]: !value[item] }))} /><i>{checks[item] && <Check />}</i><span>{item}</span></label>)}</div></section>
        <section className="travel-card travel-alerts"><header><div><ShieldCheck /><span><h2>Travel briefing</h2><p>Useful warnings before departure</p></span></div></header><div className="travel-alert-list"><article><CloudSun /><div><strong>Departure weather</strong><span>{world ? `${Math.round(world.weather.current.temperature)}° and ${world.weather.current.condition.toLowerCase()} in ${world.location.city || "your location"}.` : "Weather is updating."}</span></div></article><article><FileCheck2 /><div><strong>Entry requirements</strong><span>Check official passport, visa and health guidance before travel.</span></div></article>{countdown !== null && countdown <= 2 && countdown >= 0 && <article className="warning"><AlertTriangle /><div><strong>Departure approaching</strong><span>Confirm check-in, terminal and baggage allowance now.</span></div></article>}</div></section>
      </div>
      <section className="travel-card travel-add" id="travel-add"><header><div><CalendarDays /><span><h2>Add a trip</h2><p>Save the destination before exploring recommendations or flights.</p></span></div></header><form className="travel-single-form" onSubmit={addTrip}><input placeholder="Destination city or resort" value={trip.destination ?? ""} onChange={e => setTrip(v => ({ ...v, destination: e.target.value }))} /><label>Departure<input type="date" value={trip.startDate ?? ""} onChange={e => setTrip(v => ({ ...v, startDate: e.target.value }))} /></label><label>Return<input type="date" value={trip.endDate ?? ""} onChange={e => setTrip(v => ({ ...v, endDate: e.target.value }))} /></label><button>Add trip</button></form></section>
    </div>}

    {view === "destination" && <div className="travel-subpage"><section className="travel-hero"><div className="travel-hero-copy"><span className="travel-kicker"><MapPin />DESTINATION BRIEFING</span>{selected ? <><h2>{selected.destination}</h2><p>{dateText(selected.startDate)} — {dateText(selected.endDate)}</p><div className="travel-countdown"><strong>{countdown !== null && countdown >= 0 ? countdown : "—"}</strong><span>days until departure</span></div></> : <><h2>No destination selected</h2><p>Add a trip from Ready to Go first.</p></>}</div><div className="travel-trip-switcher">{trips.map(item => <button className={item.id === selected?.id ? "active" : ""} onClick={() => { setSelectedId(item.id); setRecommendations([]); }} key={item.id}><MapPin /><span><strong>{item.destination}</strong><small>{dateText(item.startDate)}</small></span></button>)}</div></section>
      <section className="travel-card travel-discover"><header><div><Sparkles /><span><h2>Discover {selected?.destination || "your destination"}</h2><p>Places worth adding to the itinerary</p></span></div><div className="travel-discover-actions">{["things to do", "restaurants", "hidden gems"].map(type => <button className={recommendationType === type ? "active" : ""} onClick={() => { setRecommendationType(type); void loadRecommendations(type); }} key={type}>{type}</button>)}</div></header>{loading ? <div className="travel-empty">Finding recommendations…</div> : recommendations.length ? <div className="travel-place-grid">{recommendations.slice(0, 6).map(place => <a key={`${place.name}-${place.latitude}`} href={place.googleMapsUri} target="_blank" rel="noreferrer"><div><strong>{place.name}</strong><span>{place.category} · {place.rating ? `${place.rating} ★` : "Recommended"}</span><small>{place.address}</small></div><ExternalLink /></a>)}</div> : <button className="travel-discover-start" onClick={() => void loadRecommendations()}><Search />{selected ? "Find recommendations" : "Add a trip first"}</button>}</section>
    </div>}

    {view === "flights" && <div className="travel-subpage travel-flight-page">
      <section className={`travel-card travel-flight-management ${flightFormExpanded ? "is-expanded" : "is-collapsed"}`}>
        <header className="travel-flight-management-header"><div><Plane /><span><h2>My flights</h2><p>{upcomingFlights.length ? `${upcomingFlights.length} saved ${upcomingFlights.length === 1 ? "flight" : "flights"} · itinerary and live status` : "Save an itinerary and check live status"}</p></span></div>{upcomingFlights.length > 0 && <button type="button" className="travel-collapse-toggle" onClick={() => setFlightFormExpanded(value => !value)} aria-expanded={flightFormExpanded}>{flightFormExpanded ? <><ChevronUp />Collapse flights</> : <><ChevronDown />Show flights</>}</button>}</header>
        {flightFormExpanded && <div className="travel-flight-management-body"><div className="travel-flights">{upcomingFlights.length ? upcomingFlights.map(item => <article key={item.id}><div className="flight-code"><Plane /><strong>{item.number}</strong><span>{item.status}</span></div><div className="flight-route"><strong>{item.departure}</strong><i /><Plane /><i /><strong>{item.arrival}</strong><span>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.dateTime))} · Terminal {item.terminal}</span></div><div className="flight-track-actions"><button onClick={() => void trackFlight(item)} disabled={tracking === item.id}><Radar />{tracking === item.id ? "Checking…" : "Live status"}</button><a href={`https://www.flightradar24.com/data/flights/${item.number.toLowerCase()}`} target="_blank" rel="noreferrer">Map <ExternalLink /></a></div><button className="flight-remove" onClick={() => setFlights(items => items.filter(saved => saved.id !== item.id))}><Trash2 /></button></article>) : <div className="travel-empty"><Plane /><strong>No flights added</strong><span>Add your first flight below.</span></div>}</div>
          <div className="travel-add travel-add-flight"><div className="travel-add-flight-heading"><Plane /><span><h3>Add a new flight</h3><p>Enter the booked itinerary, then use Live status for provider updates.</p></span></div><form className="flight-entry-form" onSubmit={addFlight}><label>Flight number<input placeholder="BA123" value={flight.number ?? ""} onChange={e => setFlight(v => ({ ...v, number: e.target.value }))} /></label><label>From<input placeholder="LHR" value={flight.departure ?? ""} onChange={e => setFlight(v => ({ ...v, departure: e.target.value }))} /></label><label>To<input placeholder="JFK" value={flight.arrival ?? ""} onChange={e => setFlight(v => ({ ...v, arrival: e.target.value }))} /></label><label>Departure time<input type="datetime-local" value={flight.dateTime ?? ""} onChange={e => setFlight(v => ({ ...v, dateTime: e.target.value }))} /></label><label>Terminal<input placeholder="Optional" value={flight.terminal ?? ""} onChange={e => setFlight(v => ({ ...v, terminal: e.target.value }))} /></label><button>Add flight</button></form></div></div>}
      </section>
    </div>}
  </div>;
}
