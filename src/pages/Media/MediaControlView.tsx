import { useCallback, useEffect, useState } from "react";
import {
  AudioLines,
  CircleStop,
  ExternalLink,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import "./MediaControlView.css";
import "./AIDJView.css";
import AIDJView from "./AIDJView";

type Command =
  | "previous"
  | "next"
  | "playPause"
  | "stop"
  | "mute"
  | "volumeDown"
  | "volumeUp";
type AudioDevice = { name: string; status: string };
type MediaService = { id: string; name: string; url: string };

const MEDIA_SERVICES_KEY = "sentinel.media.services.v1";
const DEFAULT_MEDIA_SERVICES: MediaService[] = [
  { id: "spotify", name: "Spotify", url: "https://open.spotify.com/" },
  { id: "youtube", name: "YouTube Music", url: "https://music.youtube.com/" },
  { id: "bbc", name: "BBC Sounds", url: "https://www.bbc.co.uk/sounds" },
];

function loadMediaServices(): MediaService[] {
  try {
    const saved = localStorage.getItem(MEDIA_SERVICES_KEY);
    if (saved === null) return DEFAULT_MEDIA_SERVICES;
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return DEFAULT_MEDIA_SERVICES;
    return parsed.filter(
      (item): item is MediaService =>
        typeof item?.id === "string" &&
        typeof item?.name === "string" &&
        typeof item?.url === "string",
    );
  } catch {
    return DEFAULT_MEDIA_SERVICES;
  }
}

export default function MediaControlView() {
  const [page, setPage] = useState<"controls" | "dj">("controls");
  const [devices, setDevices] = useState<AudioDevice[]>([]),
    [available, setAvailable] = useState(Boolean(window.sentinelDesktop)),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(
      "Ready to control the active Windows media session.",
    ),
    [playing, setPlaying] = useState<boolean | null>(null),
    [services, setServices] = useState<MediaService[]>(loadMediaServices),
    [managingServices, setManagingServices] = useState(false),
    [serviceName, setServiceName] = useState(""),
    [serviceUrl, setServiceUrl] = useState(""),
    [serviceError, setServiceError] = useState("");
  useEffect(() => {
    localStorage.setItem(MEDIA_SERVICES_KEY, JSON.stringify(services));
  }, [services]);
  const refresh = useCallback(async () => {
    if (!window.sentinelDesktop) return setAvailable(false);
    setBusy("refresh");
    try {
      const status = await window.sentinelDesktop.mediaStatus();
      setAvailable(status.available);
      setDevices(status.devices);
      setMessage(
        status.devices.length
          ? `${status.devices.length} Windows audio device${status.devices.length === 1 ? "" : "s"} available.`
          : "Windows media keys are ready; no audio hardware details were returned.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not read Windows audio devices.",
      );
    } finally {
      setBusy("");
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function command(action: Command) {
    if (!window.sentinelDesktop) return;
    setBusy(action);
    try {
      await window.sentinelDesktop.mediaCommand(action);
      if (action === "playPause")
        setPlaying((current) => (current === null ? true : !current));
      if (action === "stop") setPlaying(false);
      setMessage(
        action === "volumeUp"
          ? "Windows volume increased by 5%."
          : action === "volumeDown"
            ? "Windows volume reduced by 5%."
            : action === "mute"
              ? "Windows mute toggled."
              : "Command sent to the active media app.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Media command failed.",
      );
    } finally {
      setBusy("");
    }
  }
  function addService() {
    const name = serviceName.trim();
    let url = serviceUrl.trim();
    if (!name || !url) {
      setServiceError("Enter a service name and website.");
      return;
    }
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
        throw new Error();
      url = parsed.toString();
    } catch {
      setServiceError("Enter a valid website address.");
      return;
    }
    if (
      services.some(
        (service) =>
          service.name.toLowerCase() === name.toLowerCase() ||
          service.url === url,
      )
    ) {
      setServiceError("That service has already been added.");
      return;
    }
    const id =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    setServices((current) => [...current, { id, name, url }]);
    setServiceName("");
    setServiceUrl("");
    setServiceError("");
  }
  const control = (
    action: Command,
    label: string,
    icon: React.ReactNode,
    primary = false,
  ) => (
    <button
      className={
        primary ? "media-control media-control--primary" : "media-control"
      }
      disabled={!available || Boolean(busy)}
      onClick={() => void command(action)}
      aria-label={label}
    >
      {icon}
      <span>{busy === action ? "Sending…" : label}</span>
    </button>
  );
  return (
    <div className="media-view">
      <header className="media-heading">
        <div>
          <p>SENTINEL AUDIO CENTRE</p>
          <h1>Audio Control</h1>
          <span>Control playback or let Sentinel build and mix the session.</span>
        </div>
        <button
          className="media-refresh"
          onClick={() => void refresh()}
          disabled={busy === "refresh"}
        >
          <RefreshCw className={busy === "refresh" ? "spin" : ""} />
          Refresh devices
        </button>
      </header>
      <nav className="media-subnav" aria-label="Audio Control pages">
        <button className={page === "controls" ? "active" : ""} onClick={() => setPage("controls")}><AudioLines /> Audio controls</button>
        <button className={page === "dj" ? "active" : ""} onClick={() => setPage("dj")}><Sparkles /> AI DJ</button>
      </nav>
      {page === "dj" ? <AIDJView /> : <>
      <section className="media-now-playing">
        <div className="media-orb">
          <Music2 />
        </div>
        <div className="media-now-copy">
          <span>ACTIVE WINDOWS SESSION</span>
          <h2>
            {playing === true
              ? "Playback active"
              : playing === false
                ? "Playback paused"
                : "Ready for playback"}
          </h2>
          <p>{message}</p>
        </div>
        <div className="media-live">
          <i className={available ? "online" : ""} />
          {available ? "System control online" : "Desktop controls unavailable"}
        </div>
      </section>
      <section className="media-transport">
        <div className="transport-heading">
          <AudioLines />
          <div>
            <h2>Playback</h2>
            <p>
              Works with Spotify, browsers, VLC and most apps that respond to
              Windows media keys.
            </p>
          </div>
        </div>
        <div className="transport-controls">
          {control("previous", "Previous", <SkipBack />)}
          {control(
            "playPause",
            playing ? "Pause" : "Play / pause",
            playing ? <Pause /> : <Play />,
            true,
          )}
          {control("next", "Next", <SkipForward />)}
          {control("stop", "Stop", <CircleStop />)}
        </div>
      </section>
      <div className="media-grid">
        <section className="media-card">
          <div className="media-card-heading">
            <div>
              <Volume2 />
              <h2>System volume</h2>
            </div>
          </div>
          <p className="media-card-copy">
                  Adjusts the real Windows output volume in 5% steps.
          </p>
          <div className="volume-controls">
            {control("volumeDown", "Quieter", <Volume1 />)}
            {control("mute", "Mute / unmute", <VolumeX />)}
            {control("volumeUp", "Louder", <Volume2 />)}
          </div>
        </section>
        <section className="media-card">
          <div className="media-card-heading media-card-heading--actions">
            <div>
              <Radio />
              <h2>Open a service</h2>
            </div>
            <button
              className="media-manage"
              onClick={() => setManagingServices((value) => !value)}
            >
              {managingServices ? "Done" : "Manage services"}
            </button>
          </div>
          <p className="media-card-copy">
            Launch a player, then use the controls here without changing pages.
          </p>
          {managingServices ? (
            <div className="media-service-manager">
              <div className="media-service-list">
                {services.map((service) => (
                  <div key={service.id}>
                    <span>{service.name}</span>
                    <button
                      aria-label={`Remove ${service.name}`}
                      onClick={() =>
                        setServices((current) =>
                          current.filter((item) => item.id !== service.id),
                        )
                      }
                    >
                      <X />
                    </button>
                  </div>
                ))}
              </div>
              <div className="media-service-form">
                <input
                  value={serviceName}
                  onChange={(event) => setServiceName(event.target.value)}
                  placeholder="Service name"
                />
                <input
                  value={serviceUrl}
                  onChange={(event) => setServiceUrl(event.target.value)}
                  placeholder="Website, e.g. tidal.com"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addService();
                  }}
                />
                <button onClick={addService}>
                  <Plus /> Add service
                </button>
              </div>
              {serviceError && (
                <p className="media-service-error">{serviceError}</p>
              )}
              <button
                className="media-restore"
                onClick={() => {
                  setServices(DEFAULT_MEDIA_SERVICES);
                  setServiceError("");
                }}
              >
                Restore defaults
              </button>
            </div>
          ) : services.length ? (
            <div className="media-services">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() =>
                    void window.sentinelDesktop?.openMediaService(service.url)
                  }
                >
                  {service.name}
                  <ExternalLink />
                </button>
              ))}
            </div>
          ) : (
            <button
              className="media-empty-services"
              onClick={() => setManagingServices(true)}
            >
              No services shown — add one
            </button>
          )}
        </section>
      </div>
      <section className="media-devices">
        <header>
          <div>
            <h2>Detected audio hardware</h2>
            <p>Windows devices currently available to media applications.</p>
          </div>
          <strong>
            {
              devices.filter((device) => device.status.toLowerCase() === "ok")
                .length
            }{" "}
            ready
          </strong>
        </header>
        {devices.length ? (
          <div>
            {devices.map((device, index) => (
              <article key={`${device.name}-${index}`}>
                <AudioLines />
                <span>
                  <strong>{device.name}</strong>
                  <small>{device.status}</small>
                </span>
                <i
                  className={
                    device.status.toLowerCase() === "ok" ? "online" : ""
                  }
                />
              </article>
            ))}
          </div>
        ) : (
          <p className="media-empty">
            No hardware details reported. Playback controls may still work with
            the active Windows session.
          </p>
        )}
      </section>
      </>}
    </div>
  );
}
