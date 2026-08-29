import "leaflet/dist/leaflet.css";
import "./WeatherRadar.css";
import "./WeatherRadarEnhancements.css";

import L from "leaflet";
import { ChevronLeft, ChevronRight, LocateFixed, MapPinned, Pause, Play, Radar } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import DashboardCard from "../../../components/dashboard/DashboardCard";
import useWorld from "../../../hooks/useWorld";

interface RadarFrame {
  time: number;
  path: string;
  forecast?: boolean;
}
interface RadarPayload {
  radar?: { past?: RadarFrame[]; nowcast?: RadarFrame[] };
}

const fallbackPosition: [number, number] = [51.628, -0.75];

export default function WeatherRadar() {
  const { world } = useWorld();
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map>();
  const radarLayerRef = useRef<L.TileLayer>();
  const markerRef = useRef<L.CircleMarker>();
  const timerRef = useRef<number>();
  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackDelay, setPlaybackDelay] = useState(900);
  const [error, setError] = useState("");
  const latitude = world?.location.latitude;
  const longitude = world?.location.longitude;
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);

  useEffect(() => {
    void fetch("https://api.rainviewer.com/public/weather-maps.json")
      .then((response) =>
        response.ok
          ? (response.json() as Promise<RadarPayload>)
          : Promise.reject(new Error("Radar feed unavailable")),
      )
      .then((payload) => {
        const available = [
          ...(payload.radar?.past ?? []).map((frame) => ({ ...frame, forecast: false })),
          ...(payload.radar?.nowcast ?? []).map((frame) => ({ ...frame, forecast: true })),
        ].slice(-12);
        if (!available.length)
          throw new Error("No radar frames are currently available.");
        setFrames(available);
        setFrameIndex(Math.max(available.length - 1, 0));
      })
      .catch(() =>
        setError("Live radar is temporarily unavailable. Try again shortly."),
      );
  }, [hasLocation, latitude, longitude]);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return;
    const center: [number, number] = hasLocation
      ? [latitude as number, longitude as number]
      : fallbackPosition;
    const map = L.map(mapElementRef.current, {
      center,
      zoom: 9,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = undefined;
    };
  }, [hasLocation, latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasLocation) return;
    const point: [number, number] = [latitude as number, longitude as number];
    map.setView(point, Math.max(map.getZoom(), 10));
    if (!markerRef.current)
      markerRef.current = L.circleMarker(point, {
        radius: 8,
        color: "#ffffff",
        weight: 3,
        fillColor: "#45dfff",
        fillOpacity: 1,
      }).addTo(map);
    else markerRef.current.setLatLng(point);
  }, [hasLocation, latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    const frame = frames[frameIndex];
    if (!map || !frame) return;
    radarLayerRef.current?.remove();
    radarLayerRef.current = L.tileLayer(
      `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
      {
        opacity: 0.72,
        zIndex: 10,
        maxNativeZoom: 7,
        maxZoom: 19,
      },
    ).addTo(map);
  }, [frames, frameIndex]);

  useEffect(() => {
    window.clearInterval(timerRef.current);
    if (playing && frames.length > 1)
      timerRef.current = window.setInterval(
        () => setFrameIndex((index) => {
          if (index >= frames.length - 1) {
            setPlaying(false);
            return index;
          }
          return index + 1;
        }),
        playbackDelay,
      );
    return () => window.clearInterval(timerRef.current);
  }, [playing, frames.length, playbackDelay]);

  const frameTime = frames[frameIndex]
    ? new Date(frames[frameIndex].time * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Loading";
  const frameKind = frames[frameIndex]?.forecast ? "Forecast" : "Observed";

  const returnToLocation = () => {
    const map = mapRef.current;
    if (!map || !hasLocation) return;
    const point: [number, number] = [latitude as number, longitude as number];
    map.flyTo(point, Math.max(map.getZoom(), 10), { duration: 0.75 });
    markerRef.current?.bringToFront();
  };

  return (
    <DashboardCard
      title="Daily weather radar"
      subtitle="Live precipitation around your current location"
      icon={Radar}
      className="weather-radar-card"
    >
      <div className="weather-radar">
        <div
          ref={mapElementRef}
          className="weather-radar-map"
          aria-label="Live precipitation radar"
        />
        {error && <div className="weather-radar-error">{error}</div>}
        <div className="weather-radar-status">
          <MapPinned size={16} />
          <span>{world?.location.city ?? "Your location"}</span>
          <b>{frameTime} · {frameKind}</b>
        </div>
      </div>
      <div className="weather-radar-key" aria-label="Radar rainfall intensity key">
        <strong>Rainfall intensity</strong>
        <div className="radar-key-scale"><i /><i /><i /><i /><i /><i /></div>
        <div className="radar-key-labels"><span>Very light</span><span>Light</span><span>Moderate</span><span>Heavy</span><span>Very heavy</span><span>Extreme</span></div>
        <p>Red indicates heavy rainfall; dark red or purple indicates very heavy to extreme rainfall. Blue marks lighter precipitation.</p>
      </div>
      <div className="weather-radar-timeline">
        <button disabled={!frames.length || frameIndex === 0} onClick={() => { setPlaying(false); setFrameIndex((index) => Math.max(0, index - 1)); }} aria-label="Previous radar frame"><ChevronLeft /></button>
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={frameIndex} disabled={!frames.length} onChange={(event) => { setPlaying(false); setFrameIndex(Number(event.target.value)); }} aria-label="Radar timeline" />
        <button disabled={!frames.length || frameIndex >= frames.length - 1} onClick={() => { setPlaying(false); setFrameIndex((index) => Math.min(frames.length - 1, index + 1)); }} aria-label="Next radar frame"><ChevronRight /></button>
        <span>{frameIndex + 1} / {frames.length || 0}</span>
        <select value={playbackDelay} onChange={(event) => setPlaybackDelay(Number(event.target.value))} aria-label="Radar playback speed">
          <option value={1400}>Slow</option><option value={900}>Normal</option><option value={500}>Fast</option>
        </select>
      </div>
      <div className="weather-radar-controls">
        <div className="weather-radar-legend">
          <span>{frames.length ? `Timeline covers ${new Date(frames[0].time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} to ${new Date(frames[frames.length - 1].time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` : "Loading radar timeline…"}</span>
        </div>
        <div className="weather-radar-actions">
          <button onClick={returnToLocation} disabled={!hasLocation}>
            <LocateFixed size={16} /> My location
          </button>
          <button
            onClick={() => {
              if (!playing && frameIndex >= frames.length - 1) setFrameIndex(0);
              setPlaying((value) => !value);
            }}
            disabled={!frames.length}
          >
            {playing ? (
              <>
                <Pause size={16} /> Pause radar
              </>
            ) : (
              <>
                <Play size={16} /> Play radar
              </>
            )}
          </button>
        </div>
      </div>
    </DashboardCard>
  );
}
