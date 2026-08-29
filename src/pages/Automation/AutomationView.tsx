import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BellRing,
  ArrowDown,
  ArrowUp,
  Camera,
  ChevronDown,
  CircleAlert,
  Expand,
  House,
  LayoutDashboard,
  MapPinned,
  Lightbulb,
  LockKeyhole,
  Maximize2,
  Moon,
  Play,
  Plus,
  Puzzle,
  Power,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wifi,
  Eye,
  EyeOff,
  X,
  Zap,
} from "lucide-react";
import {
  beginRingSignIn,
  completeRingSignIn,
  connectGovee,
  beginHueCloudAuthorisation,
  completeHueCloudAuthorisation,
  configureHueCloud,
  discoverHueBridges,
  getAutomationIntegrations,
  getAmazonDevices,
  getGoveeDevices,
  getHueLights,
  getHueCloudStatus,
  getRingDevices,
  getRingEvents,
  pairHueBridge,
  setGoveeDevice,
  setGoveeDeviceControl,
  setHueLight,
  setHueLightControl,
  setRingCameraLight,
  setRingCameraSiren,
  startRingLiveView,
  startRingTalkback as beginRingTalkback,
  stopRingTalkback,
  type AutomationIntegration,
  type AmazonDevice,
  type GoveeDevice,
  type HueBridge,
  type HueLight,
  type HueCloudStatus,
  type RingDevice,
  type RingEvent,
  type SmartLightControl,
} from "../../services/automation";
import { API_URL } from "../../services/api";
import "./AutomationView.css";
import "./SecurityPanel.css";
import "./AutomationCommandCentre.css";
import "./RingSecurity.css";
import "./RingAccountSetup.css";
import "./RingViewer.css";
import AmazonDevicePanel from "./AmazonDevicePanel";
import { getSetupCentre, type SetupModule } from "../../services/setup";

const icons = {
  hue: Lightbulb,
  govee: Sparkles,
  alexa: Wifi,
  ring: Camera,
};

type RoomAssignments = Record<string, string>;
type Scene = {
  id: string;
  name: string;
  description: string;
  icon: "arrival" | "movie" | "night";
  target: "all" | string;
  on: boolean;
};

type MissionCardId = "attention" | "quick" | "rooms" | "security" | "health" | "activity" | "operations";
const missionCardDefaults: MissionCardId[] = ["attention", "quick", "rooms", "security", "health", "activity", "operations"];

const savedRoomsKey = "sentinel-automation-rooms";
const savedAssignmentsKey = "sentinel-automation-assignments";
const defaultScenes: Scene[] = [
  {
    id: "arrival",
    name: "Arrival",
    description: "Bring the whole home online.",
    icon: "arrival",
    target: "all",
    on: true,
  },
  {
    id: "movie",
    name: "Movie mode",
    description: "Fade the house down for the screen.",
    icon: "movie",
    target: "all",
    on: false,
  },
  {
    id: "good-night",
    name: "Good night",
    description: "Power down your connected lights.",
    icon: "night",
    target: "all",
    on: false,
  },
];

function readSaved<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function AutomationView() {
  const [integrations, setIntegrations] = useState<AutomationIntegration[]>([]);
  const [addedModules, setAddedModules] = useState<SetupModule[]>([]);
  const [amazonDevices, setAmazonDevices] = useState<AmazonDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [bridges, setBridges] = useState<HueBridge[]>([]);
  const [bridgeIp, setBridgeIp] = useState("");
  const [pairing, setPairing] = useState(false);
  const [hueCloud, setHueCloud] = useState<HueCloudStatus | null>(null);
  const [hueClientId, setHueClientId] = useState("");
  const [hueClientSecret, setHueClientSecret] = useState("");
  const [hueCloudBusy, setHueCloudBusy] = useState(false);
  const [lights, setLights] = useState<HueLight[]>([]);
  const [goveeKey, setGoveeKey] = useState("");
  const [goveeDevices, setGoveeDevices] = useState<GoveeDevice[]>([]);
  const [goveeConnecting, setGoveeConnecting] = useState(false);
  const [ringDevices, setRingDevices] = useState<RingDevice[]>([]);
  const [ringEvents, setRingEvents] = useState<RingEvent[]>([]);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [goveePower, setGoveePower] = useState<Record<string, boolean>>(() => readSaved("sentinel-govee-power-state", {}));
  const [houseMode, setHouseMode] = useState(() => localStorage.getItem("sentinel-house-mode") ?? "Home");
  const [missionCards, setMissionCards] = useState<MissionCardId[]>(() => readSaved("sentinel-mission-card-order", missionCardDefaults));
  const [hiddenMissionCards, setHiddenMissionCards] = useState<MissionCardId[]>(() => readSaved("sentinel-mission-card-hidden", []));
  const [section, setSection] = useState<"mission" | "home" | "routines" | "automation" | "security">(
    "mission",
  );
  const [rooms, setRooms] = useState<string[]>(() =>
    readSaved(savedRoomsKey, ["Living room", "Bedroom", "Kitchen"]),
  );
  const [assignments, setAssignments] = useState<RoomAssignments>(() =>
    readSaved(savedAssignmentsKey, {}),
  );
  const [roomName, setRoomName] = useState("");
  const [runningScene, setRunningScene] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const next = await getAutomationIntegrations();
      setIntegrations(next);
      const setup = await getSetupCentre().catch(() => null);
      setAddedModules(setup?.modules.filter((module) => !module.builtIn && module.installed) ?? []);
      const connected = (id: string) => Boolean(next.find((integration) => integration.id === id)?.connected);
      const [amazon, hueStatus, hueLights, govee, ringDeviceResult, ringEventResult] = await Promise.allSettled([
        getAmazonDevices(),
        getHueCloudStatus(),
        connected("hue") ? getHueLights() : Promise.resolve([] as HueLight[]),
        connected("govee") ? getGoveeDevices() : Promise.resolve([] as GoveeDevice[]),
        connected("ring") ? getRingDevices() : Promise.resolve([] as RingDevice[]),
        connected("ring") ? getRingEvents() : Promise.resolve([] as RingEvent[]),
      ]);
      setAmazonDevices(amazon.status === "fulfilled" ? amazon.value : []);
      setHueCloud(hueStatus.status === "fulfilled" ? hueStatus.value : null);
      setLights(hueLights.status === "fulfilled" ? hueLights.value : []);
      setGoveeDevices(govee.status === "fulfilled" ? govee.value : []);
      setRingDevices(ringDeviceResult.status === "fulfilled" ? ringDeviceResult.value : []);
      setRingEvents(ringEventResult.status === "fulfilled" ? ringEventResult.value : []);
      setLastRefreshAt(new Date().toISOString());

      const failed: string[] = [];
      if (amazon.status === "rejected") failed.push("Amazon device refresh failed");
      if (hueStatus.status === "rejected" || hueLights.status === "rejected") failed.push("Philips Hue needs reconnecting");
      if (govee.status === "rejected") failed.push("Govee device refresh failed");
      if (ringDeviceResult.status === "rejected" || ringEventResult.status === "rejected") failed.push("Ring device refresh failed");
      if (failed.length) setError(`${failed.join(". ")}. Healthy providers have still been loaded.`);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Sentinel could not reach the Automation service. Check that the server is running.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const openSection = (event: Event) => {
      const next = (event as CustomEvent<{ section?: typeof section }>).detail?.section;
      if (next && ["mission", "home", "routines", "automation", "security"].includes(next)) setSection(next);
    };
    window.addEventListener("sentinel:mission-section", openSection);
    return () => window.removeEventListener("sentinel:mission-section", openSection);
  }, []);
  useEffect(() => {
    window.localStorage.setItem(savedRoomsKey, JSON.stringify(rooms));
  }, [rooms]);
  useEffect(() => {
    const root = document.querySelector(".automation-view");
    if (!root) return;
    const cleanups = new Map<HTMLElement, () => void>();
    const enhance = () => {
      root.querySelectorAll<HTMLElement>(".automation-section").forEach((panel) => {
        if (cleanups.has(panel)) return;
        const heading = panel.querySelector<HTMLElement>(":scope > .automation-section-title");
        const title = heading?.querySelector("h2")?.textContent?.trim();
        if (!heading || !title) return;
        const storageKey = `sentinel-mission-collapse:${section}:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        const saved = localStorage.getItem(storageKey);
        const collapsed = saved === "true" || (saved === null && title === "Integrations");
        panel.classList.toggle("automation-section--collapsed", collapsed);
        heading.classList.add("automation-section-title--collapsible");
        heading.tabIndex = 0;
        heading.setAttribute("role", "button");
        heading.setAttribute("aria-expanded", String(!collapsed));
        heading.setAttribute("title", `${collapsed ? "Expand" : "Collapse"} ${title}`);
        const toggle = (event: Event) => {
          if ((event.target as HTMLElement).closest("button,input,select,a,textarea")) return;
          const next = !panel.classList.contains("automation-section--collapsed");
          panel.classList.toggle("automation-section--collapsed", next);
          heading.setAttribute("aria-expanded", String(!next));
          heading.setAttribute("title", `${next ? "Expand" : "Collapse"} ${title}`);
          localStorage.setItem(storageKey, String(next));
        };
        const keydown = (event: KeyboardEvent) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault(); toggle(event);
        };
        heading.addEventListener("click", toggle);
        heading.addEventListener("keydown", keydown);
        cleanups.set(panel, () => { heading.removeEventListener("click", toggle); heading.removeEventListener("keydown", keydown); });
      });
    };
    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(root, { childList: true, subtree: true });
    return () => { observer.disconnect(); cleanups.forEach((cleanup) => cleanup()); };
  }, [section]);
  useEffect(() => {
    window.localStorage.setItem(
      savedAssignmentsKey,
      JSON.stringify(assignments),
    );
  }, [assignments]);
  useEffect(() => { localStorage.setItem("sentinel-govee-power-state", JSON.stringify(goveePower)); }, [goveePower]);
  useEffect(() => { localStorage.setItem("sentinel-house-mode", houseMode); }, [houseMode]);
  useEffect(() => { localStorage.setItem("sentinel-mission-card-order", JSON.stringify(missionCards)); }, [missionCards]);
  useEffect(() => { localStorage.setItem("sentinel-mission-card-hidden", JSON.stringify(hiddenMissionCards)); }, [hiddenMissionCards]);
  const connected = integrations.filter(
    (integration) => integration.connected,
  ).length;

  const deviceKey = (provider: "hue" | "govee", id: string) =>
    `${provider}:${id}`;
  const assignedRoom = (provider: "hue" | "govee", id: string) =>
    assignments[deviceKey(provider, id)] ?? "Unassigned";
  const assignRoom = (provider: "hue" | "govee", id: string, room: string) =>
    setAssignments((current) => ({
      ...current,
      [deviceKey(provider, id)]: room,
    }));
  const allRooms = ["Unassigned", ...rooms];

  async function saveHueCloudCredentials() {
    setHueCloudBusy(true);
    setError("");
    try {
      setHueCloud(await configureHueCloud(hueClientId, hueClientSecret));
      setHueClientSecret("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save Hue cloud credentials.",
      );
    } finally {
      setHueCloudBusy(false);
    }
  }

  async function authoriseHueCloud() {
    setHueCloudBusy(true);
    setError("");
    try {
      const { url } = await beginHueCloudAuthorisation();
      window.open(url, "_blank", "noopener,noreferrer");
      setHueCloud(await getHueCloudStatus());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start Hue authorisation.",
      );
    } finally {
      setHueCloudBusy(false);
    }
  }

  async function finishHueCloud() {
    setHueCloudBusy(true);
    setError("");
    try {
      setHueCloud(await completeHueCloudAuthorisation());
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to finish Hue authorisation.",
      );
    } finally {
      setHueCloudBusy(false);
    }
  }

  function addRoom() {
    const next = roomName.trim().replace(/\s+/g, " ");
    if (
      !next ||
      rooms.some(
        (room) => room.toLocaleLowerCase() === next.toLocaleLowerCase(),
      )
    )
      return;
    setRooms((current) => [...current, next]);
    setRoomName("");
  }

  function removeRoom(room: string) {
    setRooms((current) => current.filter((item) => item !== room));
    setAssignments((current) =>
      Object.fromEntries(
        Object.entries(current).map(([key, value]) => [
          key,
          value === room ? "Unassigned" : value,
        ]),
      ),
    );
  }

  async function findBridges() {
    setPairing(true);
    setError("");
    try {
      const found = await discoverHueBridges();
      setBridges(found);
      if (found[0]) setBridgeIp(found[0].ip);
      if (!found.length)
        setError(
          "No Hue Bridge was found. Enter its local IP address manually.",
        );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Hue Bridge discovery failed.",
      );
    } finally {
      setPairing(false);
    }
  }

  async function pairHue() {
    if (!bridgeIp) return;
    setPairing(true);
    setError("");
    try {
      await pairHueBridge(bridgeIp);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pairing failed.");
    } finally {
      setPairing(false);
    }
  }

  async function toggleLight(light: HueLight) {
    setError("");
    try {
      await setHueLight(light.id, !light.on);
      setLights((previous) =>
        previous.map((item) =>
          item.id === light.id ? { ...item, on: !item.on } : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update that light.",
      );
    }
  }

  async function toggleGovee(device: GoveeDevice, requested?: boolean) {
    if (!device.controllable) return;
    const known = goveePower[device.id];
    let on = requested ?? (known === undefined ? undefined : !known);
    if (on === undefined) {
      const answer = window.prompt(`${device.name} does not report its current power state. Type ON or OFF for this device.`)?.trim().toLowerCase();
      if (answer !== "on" && answer !== "off") return;
      on = answer === "on";
    }
    setError("");
    try {
      await setGoveeDevice(device.id, device.model, on);
      setGoveePower((current) => ({ ...current, [device.id]: on! }));
    } catch (err) { setError(err instanceof Error ? err.message : `Could not update ${device.name}.`); }
  }

  async function controlHue(light: HueLight, control: SmartLightControl) {
    setError("");
    try {
      await setHueLightControl(light.id, { ...control, on: true });
      setLights((current) => current.map((item) => item.id === light.id ? { ...item, on: true, brightness: control.brightness ?? item.brightness, colourTemperature: control.colourTemperature ?? item.colourTemperature } : item));
    } catch (err) { setError(err instanceof Error ? err.message : `Could not update ${light.name}.`); }
  }

  async function controlGovee(device: GoveeDevice, control: SmartLightControl) {
    setError("");
    try {
      await setGoveeDeviceControl(device.id, device.model, { ...control, on: true });
      setGoveePower((current) => ({ ...current, [device.id]: true }));
    } catch (err) { setError(err instanceof Error ? err.message : `Could not update ${device.name}.`); }
  }

  async function connectGoveeAccount() {
    if (!goveeKey.trim()) return;
    setGoveeConnecting(true);
    setError("");
    try {
      const result = await connectGovee(goveeKey);
      setGoveeDevices(result.devices);
      setGoveeKey("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Govee connection failed.");
    } finally {
      setGoveeConnecting(false);
    }
  }

  async function setAllDevices(on: boolean, room = "all") {
    const hueTargets = lights.filter(
      (light) => room === "all" || assignedRoom("hue", light.id) === room,
    );
    const goveeTargets = goveeDevices.filter(
      (device) =>
        device.controllable &&
        (room === "all" || assignedRoom("govee", device.id) === room),
    );
    const failures: string[] = [];
    const hueResults = await Promise.allSettled(hueTargets.map((light) => setHueLight(light.id, on)));
    hueResults.forEach((result, index) => { if (result.status === "rejected") failures.push(hueTargets[index].name); });
    for (const device of goveeTargets) {
      try {
        await setGoveeDevice(device.id, device.model, on);
        setGoveePower((current) => ({ ...current, [device.id]: on }));
      } catch { failures.push(device.name); }
      if (goveeTargets.length > 1) await new Promise((resolve) => window.setTimeout(resolve, 900));
    }
    setLights((current) =>
      current.map((light) =>
        hueTargets.some((target, index) => target.id === light.id && hueResults[index].status === "fulfilled")
          ? { ...light, on }
          : light,
      ),
    );
    if (failures.length) throw new Error(`Routine completed partially. These devices did not confirm the change: ${failures.join(", ")}.`);
  }

  async function runScene(scene: Scene) {
    setRunningScene(scene.id);
    setError("");
    try {
      await setAllDevices(scene.on, scene.target);
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Sentinel could not run that scene.",
      );
      return false;
    } finally {
      setRunningScene(null);
    }
  }

  return (
    <div className="automation-view">
      <header className="automation-heading">
        <div>
          <p>SENTINEL OPERATIONS</p>
          <h1>Mission Control</h1>
          <span>Your live command centre for home systems, automation and security.</span>
        </div>
        <button
          onClick={() => void load()}
          className="automation-refresh"
          disabled={loading}
        >
          <RefreshCw size={17} className={loading ? "automation-spin" : ""} />{" "}
          Refresh connections
        </button>
      </header>
      <div className="security-tabs">
        <button className={section === "mission" ? "security-tab--active" : ""} onClick={() => setSection("mission")}>
          <LayoutDashboard size={16} /> Mission Control
        </button>
        <button className={section === "home" ? "security-tab--active" : ""} onClick={() => setSection("home")}>
          <MapPinned size={16} /> Home Command
        </button>
        <button className={section === "routines" ? "security-tab--active" : ""} onClick={() => setSection("routines")}>
          <Play size={16} /> Routines
        </button>
        <button
          className={section === "automation" ? "security-tab--active" : ""}
          onClick={() => setSection("automation")}
        >
          <Power size={16} /> Automation
        </button>
        <button
          className={section === "security" ? "security-tab--active" : ""}
          onClick={() => setSection("security")}
        >
          <LockKeyhole size={16} /> Security
        </button>
      </div>
      {error && (
        <div className="automation-error">
          <CircleAlert size={18} />
          {error}
        </div>
      )}
      {section === "mission" ? (
        <MissionHub integrations={integrations} lights={lights} goveeDevices={goveeDevices} ringDevices={ringDevices} ringEvents={ringEvents} rooms={rooms} assignedRoom={assignedRoom} onOpen={setSection} onAllOff={() => { if (window.confirm("Turn off every controllable light and device?")) void setAllDevices(false); }} onRunScene={runScene} runningScene={runningScene} houseMode={houseMode} onHouseMode={setHouseMode} lastRefreshAt={lastRefreshAt} cards={missionCards} hiddenCards={hiddenMissionCards} onCards={setMissionCards} onHiddenCards={setHiddenMissionCards} />
      ) : section === "routines" ? (
        <RoutinesPanel runningScene={runningScene} onRun={runScene} />
      ) : section === "home" ? (
        <HomeCommandPanel
          rooms={rooms}
          lights={lights}
          goveeDevices={goveeDevices}
          ringDevices={ringDevices}
          assignedRoom={assignedRoom}
          onSetRoom={(room, on) => { if (window.confirm(`Turn ${on ? "on" : "off"} all controllable devices in ${room}?`)) void setAllDevices(on, room); }}
          onToggleLight={(light) => void toggleLight(light)}
          goveePower={goveePower}
          onToggleGovee={(device) => void toggleGovee(device)}
          onOpenSecurity={() => setSection("security")}
          onOpenAutomation={() => setSection("automation")}
        />
      ) : section === "security" ? (
        <SecurityPanel
          ringConnected={Boolean(
            integrations.find((integration) => integration.id === "ring")
              ?.connected,
          )}
          devices={ringDevices}
          events={ringEvents}
          onRefresh={() => void load()}
          addedModules={addedModules.filter((module) => module.category === "security")}
        />
      ) : (
        <>
          <section className="automation-overview">
            <div className="automation-power">
              <Power />
              <div>
                <span>HOME AUTOMATION</span>
                <strong>
                  {loading
                    ? "Checking systems…"
                    : `${connected} of ${integrations.length} systems connected`}
                </strong>
              </div>
            </div>
            <div className="automation-overview-note">
              <ShieldCheck size={17} /> Credentials remain on your Sentinel
              server and are never sent to the desktop app.
            </div>
          </section>
          <section className="automation-section">
            <div className="automation-section-title">
              <div>
                <h2>Integrations</h2>
                <p>
                  Authorise each service before Sentinel can see or control its
                  devices.
                </p>
              </div>
              <BellRing />
            </div>
            <div className="integration-grid">
              {integrations.map((integration) => {
                const Icon =
                  icons[integration.id as keyof typeof icons] ?? Puzzle;
                const open = expanded === integration.id;
                return (
                  <article
                    className={`integration-card ${integration.connected ? "integration-card--connected" : ""}`}
                    key={integration.id}
                  >
                    <div className="integration-card-top">
                      <div className="integration-icon">
                        <Icon size={25} />
                      </div>
                      <span
                        className={`integration-status ${integration.connected ? "integration-status--connected" : ""}`}
                      >
                        <i />
                        {integration.connected ? "Connected" : "Not connected"}
                      </span>
                    </div>
                    <h3>{integration.name}</h3>
                    <p>{integration.description}</p>
                    {open && (
                      <div className="integration-setup">
                        <strong>Connection required</strong>
                        <span>{integration.setup}</span>
                      </div>
                    )}
                    <button
                      className="integration-action"
                      onClick={() => setExpanded(open ? null : integration.id)}
                    >
                      {integration.connected
                        ? "Connection details"
                        : "How to connect"}
                      <ChevronDown
                        size={16}
                        className={open ? "integration-chevron--open" : ""}
                      />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
          <AddedServiceModules
            title="Added smart-home services"
            modules={addedModules.filter((module) => module.category === "home")}
          />
          <AmazonDevicePanel
            devices={amazonDevices}
            loading={loading}
            onRefresh={load}
            onError={setError}
          />
          <section className="automation-section hue-setup">
            <div className="automation-section-title">
              <div>
                <h2>Philips Hue Cloud</h2>
                <p>
                  Securely link your approved Hue account for controls that work
                  away from home.
                </p>
              </div>
              <Lightbulb />
            </div>
            {hueCloud?.connected ? (
              <div className="integration-setup">
                <strong>Hue cloud connected</strong>
                <span>
                  Remote lighting control is active. Your refresh token stays
                  encrypted in Sentinel’s local app data.
                </span>
              </div>
            ) : !hueCloud?.configured ? (
              <div className="hue-setup-controls">
                <input
                  value={hueClientId}
                  onChange={(event) => setHueClientId(event.target.value)}
                  placeholder="Hue Client ID"
                  autoComplete="off"
                />
                <input
                  type="password"
                  value={hueClientSecret}
                  onChange={(event) => setHueClientSecret(event.target.value)}
                  placeholder="Hue Client Secret"
                  autoComplete="new-password"
                />
                <button
                  className="hue-pair-button"
                  onClick={() => void saveHueCloudCredentials()}
                  disabled={
                    !hueClientId.trim() ||
                    !hueClientSecret.trim() ||
                    hueCloudBusy
                  }
                >
                  {hueCloudBusy ? "Saving…" : "Save cloud credentials"}
                </button>
              </div>
            ) : (
              <div className="hue-setup-controls">
                <button
                  className="hue-pair-button"
                  onClick={() => void authoriseHueCloud()}
                  disabled={hueCloudBusy}
                >
                  {hueCloudBusy ? "Opening Hue…" : "Sign in to Philips Hue"}
                </button>
                <button
                  className="automation-refresh"
                  onClick={() => void finishHueCloud()}
                  disabled={hueCloudBusy}
                >
                  {hueCloudBusy ? "Checking…" : "Finish connection"}
                </button>
              </div>
            )}
          </section>
          {!integrations.find((integration) => integration.id === "hue")
            ?.connected && (
            <section className="automation-section hue-setup">
              <div className="automation-section-title">
                <div>
                  <h2>Connect Philips Hue</h2>
                  <p>Pair Sentinel directly with your local Hue Bridge.</p>
                </div>
                <Lightbulb />
              </div>
              <ol>
                <li>
                  Make sure this computer and the Hue Bridge are on the same
                  home network.
                </li>
                <li>Press the round button on top of your Hue Bridge.</li>
                <li>
                  Within 30 seconds, select the Bridge below and press Pair.
                </li>
              </ol>
              <div className="hue-setup-controls">
                <button
                  className="automation-refresh"
                  onClick={() => void findBridges()}
                  disabled={pairing}
                >
                  <RefreshCw size={17} />{" "}
                  {pairing ? "Searching…" : "Find my Bridge"}
                </button>
                <input
                  value={bridgeIp}
                  onChange={(event) => setBridgeIp(event.target.value)}
                  placeholder="Hue Bridge IP address"
                  inputMode="decimal"
                />
                {bridges.length > 1 && (
                  <select
                    value={bridgeIp}
                    onChange={(event) => setBridgeIp(event.target.value)}
                  >
                    {bridges.map((bridge) => (
                      <option key={bridge.id} value={bridge.ip}>
                        {bridge.ip}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  className="hue-pair-button"
                  onClick={() => void pairHue()}
                  disabled={!bridgeIp || pairing}
                >
                  {pairing ? "Pairing…" : "Pair Bridge"}
                </button>
              </div>
            </section>
          )}
          {!integrations.find((integration) => integration.id === "govee")
            ?.connected && (
            <section className="automation-section hue-setup">
              <div className="automation-section-title">
                <div>
                  <h2>Connect Govee</h2>
                  <p>
                    Paste your Govee Developer API key to discover compatible
                    lights, plugs, and switches.
                  </p>
                </div>
                <Sparkles />
              </div>
              <div className="hue-setup-controls">
                <input
                  type="password"
                  value={goveeKey}
                  onChange={(event) => setGoveeKey(event.target.value)}
                  placeholder="Govee Developer API key"
                  autoComplete="off"
                />
                <button
                  className="hue-pair-button"
                  onClick={() => void connectGoveeAccount()}
                  disabled={!goveeKey.trim() || goveeConnecting}
                >
                  {goveeConnecting ? "Connecting…" : "Connect Govee"}
                </button>
              </div>
            </section>
          )}
          {(lights.length > 0 || goveeDevices.length > 0) && (
            <>
              <section className="automation-section command-centre">
                <div className="automation-section-title">
                  <div>
                    <p className="automation-eyebrow">LIVE CONTROL</p>
                    <h2>Command centre</h2>
                    <p>
                      Run scenes, coordinate rooms, and control your home at a
                      glance.
                    </p>
                  </div>
                  <Zap />
                </div>
                <div className="scene-grid">
                  {defaultScenes.map((scene) => {
                    const SceneIcon =
                      scene.icon === "arrival"
                        ? House
                        : scene.icon === "movie"
                          ? Play
                          : Moon;
                    return (
                      <article className="scene-card" key={scene.id}>
                        <div className="scene-card-icon">
                          <SceneIcon size={22} />
                        </div>
                        <div>
                          <strong>{scene.name}</strong>
                          <span>{scene.description}</span>
                        </div>
                        <button
                          onClick={() => void runScene(scene)}
                          disabled={runningScene !== null}
                        >
                          {runningScene === scene.id ? "Running…" : "Run scene"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
              <section className="automation-section rooms-section">
                <div className="automation-section-title">
                  <div>
                    <p className="automation-eyebrow">YOUR HOME</p>
                    <h2>Rooms & groups</h2>
                    <p>
                      Assign your devices once, then control an entire space
                      with one command.
                    </p>
                  </div>
                  <UsersRound />
                </div>
                <div className="room-create">
                  <input
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") addRoom();
                    }}
                    placeholder="Add a room, for example Office"
                  />
                  <button onClick={addRoom} disabled={!roomName.trim()}>
                    <Plus size={16} /> Add room
                  </button>
                </div>
                <div className="room-grid">
                  {rooms.map((room) => {
                    const count = [
                      ...lights.map((light) => assignedRoom("hue", light.id)),
                      ...goveeDevices.map((device) =>
                        assignedRoom("govee", device.id),
                      ),
                    ].filter((value) => value === room).length;
                    return (
                      <article className="room-card" key={room}>
                        <div>
                          <House size={20} />
                          <span>
                            {count} device{count === 1 ? "" : "s"}
                          </span>
                          <button
                            aria-label={`Remove ${room}`}
                            className="room-remove"
                            onClick={() => removeRoom(room)}
                          >
                            <X size={15} />
                          </button>
                        </div>
                        <strong>{room}</strong>
                        <section>
                          <button
                            onClick={() => void setAllDevices(true, room)}
                          >
                            Turn on
                          </button>
                          <button
                            onClick={() => void setAllDevices(false, room)}
                          >
                            Turn off
                          </button>
                        </section>
                      </article>
                    );
                  })}
                </div>
              </section>
            </>
          )}
          {lights.length > 0 && (
            <section className="automation-section hue-lights">
              <div className="automation-section-title">
                <div>
                  <h2>Hue lights</h2>
                  <p>Live controls from your connected Hue Bridge.</p>
                </div>
                <Lightbulb />
              </div>
              <div className="hue-light-grid">
                {lights.map((light) => (
                  <article
                    className={`hue-light ${light.on ? "hue-light--on" : ""}`}
                    key={light.id}
                  >
                    <div>
                      <Lightbulb size={21} />
                      <span>
                        {light.on ? `${light.brightness}% brightness` : "Off"}
                      </span>
                    </div>
                    <strong>{light.name}</strong>
                    <select
                      aria-label={`Room for ${light.name}`}
                      value={assignedRoom("hue", light.id)}
                      onChange={(event) =>
                        assignRoom("hue", light.id, event.target.value)
                      }
                    >
                      {allRooms.map((room) => (
                        <option value={room} key={room}>
                          {room}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => void toggleLight(light)}>
                      {light.on ? "Turn off" : "Turn on"}
                    </button>
                    <SmartColourControls device={light} onApply={(control) => controlHue(light, control)} />
                  </article>
                ))}
              </div>
            </section>
          )}
          {goveeDevices.length > 0 && (
            <section className="automation-section hue-lights">
              <div className="automation-section-title">
                <div>
                  <h2>Govee devices</h2>
                  <p>Compatible devices discovered from your Govee account.</p>
                </div>
                <Sparkles />
              </div>
              <div className="hue-light-grid">
                {goveeDevices.map((device) => (
                  <article className="hue-light" key={device.id}>
                    <div>
                      <Sparkles size={21} />
                      <span>{device.model}</span>
                    </div>
                    <strong>{device.name}</strong>
                    <select
                      aria-label={`Room for ${device.name}`}
                      value={assignedRoom("govee", device.id)}
                      onChange={(event) =>
                        assignRoom("govee", device.id, event.target.value)
                      }
                    >
                      {allRooms.map((room) => (
                        <option value={room} key={room}>
                          {room}
                        </option>
                      ))}
                    </select>
                    <div className="device-actions">
                      <button
                        disabled={!device.controllable}
                        onClick={() =>
                          void setGoveeDevice(device.id, device.model, true)
                        }
                      >
                        {device.controllable ? "Turn on" : "Not controllable"}
                      </button>
                      <button
                        disabled={!device.controllable}
                        onClick={() =>
                          void setGoveeDevice(device.id, device.model, false)
                        }
                      >
                        Turn off
                      </button>
                    </div>
                    <SmartColourControls device={device} onApply={(control) => controlGovee(device, control)} />
                  </article>
                ))}
              </div>
            </section>
          )}
          {!lights.length && !goveeDevices.length && (
            <section className="automation-section automation-ready">
              <div className="automation-section-title">
                <div>
                  <h2>Command centre</h2>
                  <p>
                    Controls will appear here as soon as an integration has been
                    authorised.
                  </p>
                </div>
              </div>
              <div className="automation-empty">
                <Lightbulb size={31} />
                <div>
                  <strong>No connected devices yet</strong>
                  <span>
                    Start with your Philips Hue Bridge to add rooms, individual
                    lights, and scenes to Sentinel.
                  </span>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return { r: Number.parseInt(value.slice(0, 2), 16), g: Number.parseInt(value.slice(2, 4), 16), b: Number.parseInt(value.slice(4, 6), 16) };
}

function SmartColourControls({ device, onApply }: {
  device: { name: string; supportsBrightness: boolean; supportsColour: boolean; supportsColourTemperature: boolean; brightness?: number; colourTemperature?: number };
  onApply: (control: SmartLightControl) => Promise<void>;
}) {
  const [colour, setColour] = useState("#36cfff");
  const [brightness, setBrightness] = useState(device.brightness || 80);
  const [temperature, setTemperature] = useState(device.colourTemperature || 4000);
  const [saving, setSaving] = useState(false);
  const supported = device.supportsColour || device.supportsBrightness || device.supportsColourTemperature;
  if (!supported) return <small className="smart-colour-unavailable">Power control only</small>;
  const apply = async (control: SmartLightControl) => { setSaving(true); try { await onApply(control); } finally { setSaving(false); } };
  return <div className="smart-colour-controls">
    <span>LIGHT APPEARANCE</span>
    {device.supportsColour && <div className="smart-colour-row"><label><input type="color" value={colour} onChange={(event) => setColour(event.target.value)} aria-label={`${device.name} colour`} /><i style={{ background: colour }} />Colour</label><button disabled={saving} onClick={() => void apply({ colour: hexToRgb(colour) })}>Apply</button></div>}
    {device.supportsBrightness && <div className="smart-colour-range"><label>Brightness <output>{brightness}%</output></label><input type="range" min="1" max="100" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} onPointerUp={() => void apply({ brightness })} onKeyUp={() => void apply({ brightness })} /></div>}
    {device.supportsColourTemperature && <div className="smart-colour-range"><label>Warmth <output>{temperature}K</output></label><input type="range" min="2000" max="6500" step="100" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} onPointerUp={() => void apply({ colourTemperature: temperature })} onKeyUp={() => void apply({ colourTemperature: temperature })} /></div>}
  </div>;
}

function MissionHub({ integrations, lights, goveeDevices, ringDevices, ringEvents, rooms, assignedRoom, onOpen, onAllOff, onRunScene, runningScene, houseMode, onHouseMode, lastRefreshAt, cards, hiddenCards, onCards, onHiddenCards }: {
  integrations: AutomationIntegration[]; lights: HueLight[]; goveeDevices: GoveeDevice[]; ringDevices: RingDevice[]; ringEvents: RingEvent[]; rooms: string[];
  assignedRoom: (provider: "hue" | "govee", id: string) => string;
  onOpen: (section: "home" | "routines" | "automation" | "security") => void; onAllOff: () => void; onRunScene: (scene: Scene) => Promise<boolean>; runningScene: string | null;
  houseMode: string; onHouseMode: (mode: string) => void; lastRefreshAt: string | null; cards: MissionCardId[]; hiddenCards: MissionCardId[]; onCards: (cards: MissionCardId[]) => void; onHiddenCards: (cards: MissionCardId[]) => void;
}) {
  const [customising, setCustomising] = useState(false);
  const connected = integrations.filter((item) => item.connected).length;
  const onlineCameras = ringDevices.filter((item) => item.online).length;
  const devices = lights.length + goveeDevices.length + ringDevices.length;
  const attention = [...integrations.filter((item) => !item.connected).map((item) => `${item.name} is not connected`), ...ringDevices.filter((item) => !item.online).map((item) => `${item.name} camera is offline`)];
  const roomSummary = rooms.map((room) => ({ room, lights: lights.filter((item) => assignedRoom("hue", item.id) === room), govee: goveeDevices.filter((item) => assignedRoom("govee", item.id) === room) }));
  const incidents = [
    ...attention.map((label, index) => ({ id: `attention-${index}`, label, detail: "Needs attention", time: lastRefreshAt })),
    ...ringEvents.slice(0, 6).map((event) => ({ id: event.id, label: `${event.kind === "motion" ? "Motion" : event.kind === "doorbell" ? "Doorbell" : "Activity"} at ${event.deviceName}`, detail: "Verified Ring event", time: event.occurredAt })),
  ];
  const moveCard = (id: MissionCardId, direction: -1 | 1) => { const index = cards.indexOf(id); const nextIndex = index + direction; if (index < 0 || nextIndex < 0 || nextIndex >= cards.length) return; const next = [...cards]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; onCards(next); };
  const setMode = (mode: string) => {
    if (mode === houseMode) return;
    if (!window.confirm(`Change house state to ${mode}? ${mode === "Home" ? "Arrival lighting will be offered." : "This can power down connected devices."}`)) return;
    onHouseMode(mode);
    if (mode === "Night" || mode === "Away" || mode === "Holiday") onRunScene(defaultScenes[2]);
  };
  const card = (id: MissionCardId) => {
    if (hiddenCards.includes(id)) return null;
    if (id === "attention") return <section className={`mission-card mission-attention ${attention.length ? "has-alert" : "is-clear"}`} key={id}><header><CircleAlert /><div><strong>{attention.length ? `${attention.length} item${attention.length === 1 ? "" : "s"} need attention` : "Everything looks healthy"}</strong><small>{attention[0] ?? "Connected providers and cameras are reporting normally."}</small></div></header>{attention.length > 1 && <ul>{attention.slice(1, 5).map((item) => <li key={item}>{item}</li>)}</ul>}</section>;
    if (id === "quick") return <section className="mission-card mission-quick" key={id}><header><Zap /><div><strong>Quick actions</strong><small>Approved controls and verified checks</small></div></header><div><button onClick={onAllOff}><Moon />All devices off</button><button onClick={() => onOpen("security")}><Camera />Show cameras</button><button onClick={() => onRunScene(defaultScenes[2])}><ShieldCheck />Secure home</button><button onClick={() => onOpen("routines")}><Play />Run routine</button></div></section>;
    if (id === "rooms") return <section className="mission-card mission-room-strip" key={id}><header><House /><div><strong>Rooms</strong><small>Live Hue state and assigned connected devices</small></div><button onClick={() => onOpen("home")}>Open map</button></header><div>{roomSummary.map((item) => <button key={item.room} onClick={() => onOpen("home")}><strong>{item.room}</strong><span>{item.lights.filter((light) => light.on).length} lights on · {item.lights.length + item.govee.length} devices</span></button>)}</div></section>;
    if (id === "security") { const latest = ringEvents[0]; return <section className="mission-card mission-security-snapshot" key={id}><header><Camera /><div><strong>Security snapshot</strong><small>{onlineCameras}/{ringDevices.length} cameras online</small></div><button onClick={() => onOpen("security")}>Open Security</button></header><div><ShieldCheck /><span><strong>{latest ? `${latest.kind} at ${latest.deviceName}` : "No recent verified event"}</strong><small>{latest ? new Date(latest.occurredAt).toLocaleString("en-GB") : "Ring activity will appear here when supplied."}</small></span></div></section>; }
    if (id === "health") return <section className="mission-card mission-health" key={id}><header><Wifi /><div><strong>System health matrix</strong><small>Last refresh {lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString("en-GB") : "pending"}</small></div></header><div>{integrations.map((item) => <article key={item.id}><i className={item.connected ? "online" : ""} /><span><strong>{item.name}</strong><small>{item.connected ? "Connected · latency not reported" : "Disconnected"}</small></span></article>)}</div></section>;
    if (id === "activity") return <section className="mission-card mission-activity" key={id}><header><BellRing /><div><strong>Live incident feed</strong><small>Verified provider and security activity</small></div></header>{incidents.length ? <ol>{incidents.map((item) => <li key={item.id}><i /><span><strong>{item.label}</strong><small>{item.detail}{item.time ? ` · ${new Date(item.time).toLocaleString("en-GB")}` : ""}</small></span></li>)}</ol> : <p>No incidents have been reported.</p>}</section>;
    return <section className="mission-card mission-operations" key={id}><header><Activity /><div><strong>Active operations</strong><small>What Sentinel is doing now</small></div></header><div className={runningScene ? "is-active" : ""}><i /><span><strong>{runningScene ? `Running ${defaultScenes.find((item) => item.id === runningScene)?.name ?? "routine"}` : "Standing by"}</strong><small>{runningScene ? "Waiting for connected providers to confirm completion" : "No scene, camera or home operation is currently running."}</small></span></div></section>;
  };
  return <div className="mission-hub">
    <section className="mission-hero"><div><p className="automation-eyebrow">LIVE OPERATIONS</p><h2>Your home at a glance</h2><span>Verified status from connected Sentinel services. Select an area to take control.</span></div><div className="mission-house-state"><small>HOUSE STATE</small><div>{["Home","Away","Night","Guest","Holiday"].map((mode) => <button className={houseMode === mode ? "active" : ""} onClick={() => setMode(mode)} key={mode}>{mode}</button>)}</div></div><button className="mission-customise" onClick={() => setCustomising((value) => !value)}>{customising ? <Eye /> : <LayoutDashboard />}{customising ? "Done" : "Customise"}</button></section>
    <section className="mission-metrics">
      <article><Zap /><span>CONNECTED SYSTEMS</span><strong>{connected}/{integrations.length}</strong><small>{connected ? "Services responding" : "Setup required"}</small></article>
      <article><House /><span>HOME DEVICES</span><strong>{devices}</strong><small>{rooms.length} configured rooms</small></article>
      <article><Camera /><span>SECURITY</span><strong>{onlineCameras}/{ringDevices.length}</strong><small>Cameras online</small></article>
      <article><BellRing /><span>RECENT ACTIVITY</span><strong>{ringEvents.length}</strong><small>Verified security events</small></article>
    </section>
    {customising && <section className="mission-customiser"><header><strong>Customise dashboard</strong><small>Show, hide and reorder operational cards.</small></header>{cards.map((id, index) => <article key={id}><span>{id.replace(/\b\w/g, (letter) => letter.toUpperCase())}</span><button onClick={() => onHiddenCards(hiddenCards.includes(id) ? hiddenCards.filter((item) => item !== id) : [...hiddenCards, id])}>{hiddenCards.includes(id) ? <EyeOff /> : <Eye />}</button><button disabled={!index} onClick={() => moveCard(id, -1)}><ArrowUp /></button><button disabled={index === cards.length - 1} onClick={() => moveCard(id, 1)}><ArrowDown /></button></article>)}</section>}
    <div className="mission-dashboard">{cards.map(card)}</div>
    <section className="mission-launch-grid">
      <button onClick={() => onOpen("home")}><MapPinned /><span><strong>Home Command</strong><small>Room map, live device state and spatial controls</small></span><ChevronDown /></button>
      <button onClick={() => onOpen("routines")}><Play /><span><strong>Routines</strong><small>Morning, away, night and custom operational sequences</small></span><ChevronDown /></button>
      <button onClick={() => onOpen("automation")}><Power /><span><strong>Automation</strong><small>Connections, scenes, rooms and device setup</small></span><ChevronDown /></button>
      <button onClick={() => onOpen("security")}><LockKeyhole /><span><strong>Security</strong><small>Cameras, live view and verified event history</small></span><ChevronDown /></button>
    </section>
  </div>;
}

function HomeCommandPanel({ rooms, lights, goveeDevices, ringDevices, assignedRoom, onSetRoom, onToggleLight, goveePower, onToggleGovee, onOpenSecurity, onOpenAutomation }: {
  rooms: string[]; lights: HueLight[]; goveeDevices: GoveeDevice[]; ringDevices: RingDevice[];
  assignedRoom: (provider: "hue" | "govee", id: string) => string;
  onSetRoom: (room: string, on: boolean) => void; onToggleLight: (light: HueLight) => void; goveePower: Record<string, boolean>; onToggleGovee: (device: GoveeDevice) => void; onOpenSecurity: () => void; onOpenAutomation: () => void;
}) {
  const roomDevices = (room: string) => [
    ...lights.filter((item) => assignedRoom("hue", item.id) === room).map((item) => ({ id: `hue:${item.id}`, name: item.name, detail: item.on ? `${item.brightness}% brightness` : "Off", on: item.on, kind: "light" as const, light: item })),
    ...goveeDevices.filter((item) => assignedRoom("govee", item.id) === room).map((item) => ({ id: `govee:${item.id}`, name: item.name, detail: goveePower[item.id] === undefined ? `${item.model} · state unavailable` : goveePower[item.id] ? "On" : "Off", on: goveePower[item.id] ?? null, kind: "govee" as const, device: item })),
  ];
  return <div className="home-command">
    <section className="home-command-heading"><div><p className="automation-eyebrow">DIGITAL HOME</p><h2>Home Command</h2><span>Select a room to see verified devices and control the whole space.</span></div><button onClick={onOpenAutomation}><Plus /> Manage rooms & devices</button></section>
    <section className="home-command-map">
      {rooms.map((room, index) => { const devices = roomDevices(room); return <article className={`home-command-room room-${index % 4}`} key={room}>
        <header><div><House /><span><strong>{room}</strong><small>{devices.length} assigned device{devices.length === 1 ? "" : "s"}</small></span></div><div><button onClick={() => onSetRoom(room, true)}>All on</button><button onClick={() => onSetRoom(room, false)}>All off</button></div></header>
        <div className="home-command-devices">{devices.length ? devices.map((device) => <button key={device.id} className={device.on ? "is-on" : ""} disabled={device.kind === "govee" && !device.device.controllable} onClick={() => device.kind === "light" ? onToggleLight(device.light) : onToggleGovee(device.device)}><Lightbulb /><span><strong>{device.name}</strong><small>{device.detail}</small></span><i /></button>) : <button className="home-command-empty" onClick={onOpenAutomation}><Plus /><span><strong>Assign devices</strong><small>Use Automation to place verified devices in this room.</small></span></button>}</div>
      </article>; })}
      {!rooms.length && <button className="home-command-no-rooms" onClick={onOpenAutomation}><House /><strong>Create your first room</strong><span>Open Automation to add rooms and assign connected devices.</span></button>}
    </section>
    <section className="home-command-security"><div><Camera /><span><strong>Security perimeter</strong><small>{ringDevices.filter((item) => item.online).length} of {ringDevices.length} cameras online</small></span></div><button onClick={onOpenSecurity}>Open Security</button></section>
  </div>;
}

function RoutinesPanel({ runningScene, onRun }: { runningScene: string | null; onRun: (scene: Scene) => Promise<boolean> }) {
  const [history, setHistory] = useState(() => readSaved<Array<{ id: string; name: string; at: string }>>("sentinel-routine-history", []));
  const run = async (scene: Scene) => { if (!window.confirm(`Run ${scene.name}? ${scene.description}`)) return; const completed = await onRun(scene); if (!completed) return; const next = [{ id: crypto.randomUUID(), name: scene.name, at: new Date().toISOString() }, ...history].slice(0, 20); setHistory(next); localStorage.setItem("sentinel-routine-history", JSON.stringify(next)); };
  return <div className="routines-panel"><section className="routines-hero"><div><p className="automation-eyebrow">SENTINEL ROUTINES</p><h2>One command, coordinated actions</h2><span>Review each routine before Sentinel changes connected devices.</span></div><Play /></section><section className="routine-grid">{defaultScenes.map((scene) => <article key={scene.id}><div><House /><span><strong>{scene.name}</strong><small>{scene.description}</small></span></div><ul><li>{scene.target === "all" ? "All assigned rooms" : scene.target}</li><li>Connected lighting and controllable devices</li><li>Provider-confirmed completion only</li></ul><button disabled={Boolean(runningScene)} onClick={() => void run(scene)}>{runningScene === scene.id ? "Running…" : "Review & run"}</button></article>)}</section><section className="routine-history"><header><BellRing /><div><strong>Run history</strong><small>Only fully confirmed routine runs are recorded here.</small></div></header>{history.length ? history.slice(0, 8).map((item) => <p key={item.id}><span>{item.name}</span><small>{new Date(item.at).toLocaleString("en-GB")}</small></p>) : <p>No confirmed routines have been completed yet.</p>}</section></div>;
}

function AddedServiceModules({ title, modules }: { title: string; modules: SetupModule[] }) {
  if (!modules.length) return null;
  return <section className="automation-section">
    <div className="automation-section-title"><div><h2>{title}</h2><p>Services created through Settings → Integration Builder.</p></div><Puzzle /></div>
    <div className="integration-grid">
      {modules.map((module) => <article className="integration-card" key={module.id}>
        <div className="integration-card-top"><div className="integration-icon">{module.category === "security" ? <Camera size={25} /> : <Puzzle size={25} />}</div><span className="integration-status"><i />{module.baseUrl ? "Connection available" : "Mapping required"}</span></div>
        <h3>{module.name}</h3><p>{module.description}</p>
        <div className="integration-setup"><strong>{module.configured ? "Credential stored securely" : "Credential required"}</strong><span>{module.baseUrl ? "This provider has connection details and can be tested from Modules." : "The service is safely registered, but its provider-specific API and controls still need to be mapped before Sentinel can operate devices."}</span></div>
      </article>)}
    </div>
  </section>;
}

export function AlertsPanel({
  ringConnected,
  devices,
  events,
}: {
  ringConnected: boolean;
  devices: RingDevice[];
  events: RingEvent[];
}) {
  const [filter, setFilter] = useState<"all" | RingEvent["kind"]>("all");
  const visibleEvents =
    filter === "all" ? events : events.filter((event) => event.kind === filter);
  const onlineDevices = devices.filter((device) => device.online).length;
  const eventSummary = (kind: RingEvent["kind"]) => {
    if (kind === "doorbell") return "Doorbell press detected";
    if (kind === "motion") return "Motion activity detected";
    return "Security activity recorded";
  };
  const displayTime = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(date);
  };

  return (
    <div className="alerts-panel">
      <section className="alerts-hero">
        <div>
          <p className="automation-eyebrow">SECURITY ALERTS</p>
          <h2>Live security timeline</h2>
          <p>
            Review recent camera and doorbell activity from your connected home.
          </p>
        </div>
        <div
          className={`alerts-status ${ringConnected ? "alerts-status--ready" : ""}`}
        >
          <BellRing size={18} />
          {ringConnected
            ? "Ring alert link active"
            : "Ring connection required"}
        </div>
      </section>
      <div className="alerts-stats">
        <article>
          <span>Protected devices</span>
          <strong>{devices.length}</strong>
          <small>{onlineDevices} online now</small>
        </article>
        <article>
          <span>Recent events</span>
          <strong>{events.length}</strong>
          <small>Loaded from Ring activity</small>
        </article>
        <article>
          <span>Monitoring</span>
          <strong>{ringConnected ? "Active" : "Standby"}</strong>
          <small>
            {ringConnected
              ? "Watching for new activity"
              : "Awaiting authorisation"}
          </small>
        </article>
      </div>
      <section className="alerts-timeline">
        <header>
          <div>
            <h3>Activity feed</h3>
            <p>Alerts stay available here after the event occurs.</p>
          </div>
          <div className="alert-filters">
            {(["all", "motion", "doorbell", "event"] as const).map((kind) => (
              <button
                key={kind}
                className={filter === kind ? "alert-filter--active" : ""}
                onClick={() => setFilter(kind)}
              >
                {kind === "all"
                  ? "All alerts"
                  : kind[0].toUpperCase() + kind.slice(1)}
              </button>
            ))}
          </div>
        </header>
        {visibleEvents.length ? (
          <ol className="alerts-list">
            {visibleEvents.map((event) => (
              <li key={event.id}>
                <span className="alert-event-icon">
                  {event.kind === "doorbell" ? (
                    <BellRing size={18} />
                  ) : (
                    <Camera size={18} />
                  )}
                </span>
                <div>
                  <strong>{eventSummary(event.kind)}</strong>
                  <span>
                    {event.deviceName || "Ring device"} ·{" "}
                    {displayTime(event.occurredAt)}
                  </span>
                </div>
                <span className="alert-kind">{event.kind}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="alerts-empty">
            <BellRing size={28} />
            <strong>
              {ringConnected
                ? "No matching alerts yet"
                : "Connect Ring to receive security alerts"}
            </strong>
            <span>
              {ringConnected
                ? "New motion, doorbell, and system events will appear here."
                : "Once Ring is connected, Sentinel can organise your recent activity here."}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

function SecurityPanel({
  ringConnected,
  devices,
  events,
  onRefresh,
  addedModules,
}: {
  ringConnected: boolean;
  devices: RingDevice[];
  events: RingEvent[];
  onRefresh: () => void;
  addedModules: SetupModule[];
}) {
  const doorbells = devices.filter(
    (device) => device.kind === "doorbell",
  ).length;
  const cameras = devices.filter((device) => device.kind === "camera").length;
  const [previewTick, setPreviewTick] = useState(Date.now());
  const [previewErrors, setPreviewErrors] = useState<Record<string, boolean>>(
    {},
  );
  const [selectedCamera, setSelectedCamera] = useState<RingDevice | null>(null);
  const [ringAction, setRingAction] = useState<string | null>(null);
  const [talkSessionId, setTalkSessionId] = useState<string | null>(null);
  const [talkbackActive, setTalkbackActive] = useState(false);
  const [talkDeviceName, setTalkDeviceName] = useState<string | null>(null);
  const [talkStatus, setTalkStatus] = useState("");
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [ringEmail, setRingEmail] = useState("");
  const [ringPassword, setRingPassword] = useState("");
  const [ringCode, setRingCode] = useState("");
  const [ringSession, setRingSession] = useState("");
  const [ringPrompt, setRingPrompt] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const connecting = signingIn;
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setPreviewTick(Date.now()), 12000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    // Give a preview another chance after a transient Ring snapshot error.
    setPreviewErrors({});
  }, [previewTick]);
  const snapshotUrl = (id: string) =>
    `${API_URL}/automation/ring/devices/${encodeURIComponent(id)}/snapshot?at=${previewTick}`;
  const runCameraAction = async (
    device: RingDevice,
    action: "light" | "siren",
    on: boolean,
  ) => {
    if (
      action === "siren" &&
      on &&
      !window.confirm(
        `Activate the siren on ${device.name}? This may be loud and alert people nearby.`,
      )
    )
      return;
    setRingAction(`${device.id}-${action}-${on}`);
    try {
      if (action === "light") await setRingCameraLight(device.id, on);
      else await setRingCameraSiren(device.id, on);
    } catch (reason) {
      window.alert(
        reason instanceof Error
          ? reason.message
          : "The Ring command could not be completed.",
      );
    } finally {
      setRingAction(null);
    }
  };
  const stopTalkback = async () => {
    const sessionId = talkSessionId;
    try {
      if (sessionId) await stopRingTalkback(sessionId);
    } catch {
      /* The local microphone and peer connection are still closed below. */
    } finally {
      peerRef.current?.close();
      peerRef.current = null;
      microphoneRef.current?.getTracks().forEach((track) => track.stop());
      microphoneRef.current = null;
      setTalkSessionId(null);
      setTalkbackActive(false);
      setTalkDeviceName(null);
      setLiveStream(null);
      setTalkStatus("");
    }
  };
  const openLiveView = async (device: RingDevice) => {
    setSelectedCamera(device);
    setTalkStatus("Establishing secure live view…");
    try {
      await stopTalkback();
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peer.addTransceiver("video", { direction: "recvonly" });
      peer.addTransceiver("audio", { direction: "recvonly" });
      peer.ontrack = (event) =>
        setLiveStream(event.streams[0] ?? new MediaStream([event.track]));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await new Promise<void>((resolve) => {
        if (peer.iceGatheringState === "complete") return resolve();
        const finish = () => {
          if (peer.iceGatheringState === "complete") {
            peer.removeEventListener("icegatheringstatechange", finish);
            resolve();
          }
        };
        peer.addEventListener("icegatheringstatechange", finish);
        window.setTimeout(() => {
          peer.removeEventListener("icegatheringstatechange", finish);
          resolve();
        }, 5000);
      });
      const result = await startRingLiveView(
        device.id,
        peer.localDescription?.sdp ?? "",
      );
      await peer.setRemoteDescription({
        type: "answer",
        sdp: result.answerSdp,
      });
      peerRef.current = peer;
      setTalkSessionId(result.sessionId);
      setTalkbackActive(false);
      setTalkDeviceName(device.name);
      setTalkStatus("Live video active");
    } catch (reason) {
      peerRef.current?.close();
      peerRef.current = null;
      setLiveStream(null);
      setTalkStatus(
        reason instanceof Error
          ? reason.message
          : "Live view could not be started.",
      );
    }
  };
  const startTalkback = async (device: RingDevice) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setTalkStatus(
        "Microphone access is unavailable in this Sentinel window.",
      );
      return;
    }
    await stopTalkback();
    setTalkStatus("Requesting microphone access…");
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      microphoneRef.current = microphone;
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      microphone
        .getAudioTracks()
        .forEach((track) => peer.addTrack(track, microphone));
      peer.addTransceiver("video", { direction: "recvonly" });
      peer.ontrack = (event) =>
        setLiveStream(event.streams[0] ?? new MediaStream([event.track]));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await new Promise<void>((resolve) => {
        if (peer.iceGatheringState === "complete") return resolve();
        const finish = () => {
          if (peer.iceGatheringState === "complete") {
            peer.removeEventListener("icegatheringstatechange", finish);
            resolve();
          }
        };
        peer.addEventListener("icegatheringstatechange", finish);
        window.setTimeout(() => {
          peer.removeEventListener("icegatheringstatechange", finish);
          resolve();
        }, 5000);
      });
      const result = await beginRingTalkback(
        device.id,
        peer.localDescription?.sdp ?? "",
      );
      await peer.setRemoteDescription({
        type: "answer",
        sdp: result.answerSdp,
      });
      peerRef.current = peer;
      setTalkSessionId(result.sessionId);
      setTalkbackActive(true);
      setTalkDeviceName(device.name);
      setTalkStatus("Two-way audio active");
    } catch (reason) {
      peerRef.current?.close();
      peerRef.current = null;
      microphoneRef.current?.getTracks().forEach((track) => track.stop());
      microphoneRef.current = null;
      setTalkStatus(
        reason instanceof Error
          ? reason.message
          : "Talkback could not be started.",
      );
    }
  };
  return (
    <div className="security-panel">
      <section className="automation-overview security-overview">
        <div className="automation-power">
          <LockKeyhole />
          <div>
            <span>HOME SECURITY</span>
            <strong>
              {ringConnected
                ? "Ring perimeter online"
                : "Security system standing by"}
            </strong>
          </div>
        </div>
        <div className="automation-overview-note">
          <ShieldCheck size={17} />{" "}
          {ringConnected
            ? `${devices.filter((device) => device.online).length} Ring device${devices.filter((device) => device.online).length === 1 ? "" : "s"} reachable.`
            : "Connect Ring to enable camera and doorbell monitoring."}
        </div>
      </section>
      <AddedServiceModules title="Added security services" modules={addedModules} />
      {!ringConnected && (
        <section className="automation-section ring-setup">
          <div className="automation-section-title">
            <div>
              <p className="automation-eyebrow">RING LINK</p>
              <h2>Connect Ring</h2>
              <p>
                Sign in securely here. Sentinel will discover your cameras and
                doorbells without requiring a terminal.
              </p>
            </div>
            <Camera />
          </div>
          {!ringSession ? (
            <div className="ring-account-form">
              <label><span>Ring email address</span><input type="email" value={ringEmail} onChange={(event) => setRingEmail(event.target.value)} autoComplete="username" placeholder="name@example.com" /></label>
              <label><span>Ring password</span><input type="password" value={ringPassword} onChange={(event) => setRingPassword(event.target.value)} autoComplete="current-password" placeholder="Ring account password" /></label>
              <button className="hue-pair-button" disabled={signingIn || !ringEmail.trim() || !ringPassword} onClick={async () => {
                setSigningIn(true);
                try {
                  const result = await beginRingSignIn(ringEmail, ringPassword);
                  setRingPassword("");
                  if (result.needsVerification && result.sessionId) { setRingSession(result.sessionId); setRingPrompt(result.prompt || "Enter the code sent by Ring."); }
                  else onRefresh();
                } catch (error) { window.alert(error instanceof Error ? error.message : "Ring sign-in failed."); }
                finally { setSigningIn(false); }
              }}>
              {connecting ? "Connecting…" : "Connect Ring"}
              </button>
              <p className="ring-privacy-note">Your password is used only for this sign-in and is never saved. Sentinel stores the resulting Ring refresh token locally.</p>
            </div>
          ) : (
            <div className="ring-account-form ring-verification-form">
              <p>{ringPrompt}</p>
              <label><span>Verification code</span><input inputMode="numeric" value={ringCode} onChange={(event) => setRingCode(event.target.value.replace(/\D/g, ""))} autoComplete="one-time-code" placeholder="Enter Ring code" /></label>
              <div className="ring-verification-actions">
                <button className="hue-pair-button" disabled={signingIn || ringCode.length < 4} onClick={async () => {
                  setSigningIn(true);
                  try { await completeRingSignIn(ringSession, ringCode); setRingSession(""); setRingCode(""); onRefresh(); }
                  catch (error) { window.alert(error instanceof Error ? error.message : "Ring verification failed."); }
                  finally { setSigningIn(false); }
                }}>{signingIn ? "Verifying…" : "Verify and connect"}</button>
                <button className="automation-refresh" onClick={() => { setRingSession(""); setRingCode(""); }}>Start again</button>
              </div>
            </div>
          )}
        </section>
      )}
      <section className="automation-section">
        <div className="automation-section-title">
          <div>
            <h2>Security devices</h2>
            <p>
              {ringConnected
                ? "Live status from your authorised Ring account."
                : "Live camera, doorbell, and alert controls will appear after Ring is authorised."}
            </p>
          </div>
          <button
            className="automation-refresh"
            onClick={onRefresh}
            disabled={!ringConnected}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
        <div className="security-device-grid">
          <article>
            <Camera />
            <strong>Ring cameras</strong>
            <span>
              {ringConnected ? `${cameras} discovered` : "Not connected"}
            </span>
          </article>
          <article>
            <BellRing />
            <strong>Video doorbell</strong>
            <span>
              {ringConnected ? `${doorbells} discovered` : "Not connected"}
            </span>
          </article>
          <article>
            <ShieldCheck />
            <strong>Protection status</strong>
            <span>
              {ringConnected
                ? "Monitoring enabled"
                : "Awaiting device authorisation"}
            </span>
          </article>
        </div>
      </section>
      {ringConnected &&
        devices.some((device) => device.hasLight || device.hasSiren) && (
          <section className="automation-section">
            <div className="automation-section-title">
              <div>
                <h2>Camera controls</h2>
                <p>
                  Controls are shown only when the connected Ring camera reports
                  support for them.
                </p>
              </div>
              <Camera />
            </div>
            <div className="ring-control-grid">
              {devices
                .filter((device) => device.hasLight || device.hasSiren)
                .map((device) => (
                  <article key={device.id}>
                    <div>
                      <strong>{device.name}</strong>
                      <span>
                        {device.kind === "doorbell" ? "Doorbell" : "Camera"}
                      </span>
                    </div>
                    {device.hasLight && (
                      <div className="ring-camera-controls">
                        <button
                          disabled={ringAction !== null}
                          onClick={() =>
                            void runCameraAction(device, "light", true)
                          }
                        >
                          Light on
                        </button>
                        <button
                          disabled={ringAction !== null}
                          onClick={() =>
                            void runCameraAction(device, "light", false)
                          }
                        >
                          Light off
                        </button>
                      </div>
                    )}
                    {device.hasSiren && (
                      <div className="ring-camera-controls">
                        <button
                          className="ring-siren-button"
                          disabled={ringAction !== null}
                          onClick={() =>
                            void runCameraAction(device, "siren", true)
                          }
                        >
                          Activate siren
                        </button>
                        <button
                          disabled={ringAction !== null}
                          onClick={() =>
                            void runCameraAction(device, "siren", false)
                          }
                        >
                          Stop siren
                        </button>
                      </div>
                    )}
                  </article>
                ))}
            </div>
          </section>
        )}
      {ringConnected && devices.some((device) => device.online) && (
        <section className="automation-section ring-talkback">
          <div className="automation-section-title">
            <div>
              <h2>Live audio control</h2>
              <p>
                Start a private WebRTC session to hear the camera and speak
                through it.
              </p>
            </div>
            <BellRing />
          </div>
          {talkSessionId && talkbackActive ? (
            <div className="ring-talkback-active">
              <div>
                <strong>{talkDeviceName}</strong>
                <span>{talkStatus}</span>
              </div>
              <button
                className="ring-siren-button"
                onClick={() => void stopTalkback()}
              >
                Stop talkback
              </button>
            </div>
          ) : (
            <div className="ring-talkback-list">
              {devices
                .filter((device) => device.online)
                .map((device) => (
                  <button
                    key={device.id}
                    onClick={() => void startTalkback(device)}
                  >
                    <BellRing size={17} />
                    <span>
                      <strong>{device.name}</strong>
                      <small>
                        {device.kind === "doorbell" ? "Doorbell" : "Camera"}
                      </small>
                    </span>
                    <em>Start talkback</em>
                  </button>
                ))}
            </div>
          )}
          {talkStatus && !talkSessionId && (
            <p className="ring-talkback-status">{talkStatus}</p>
          )}
          {liveStream && (
            <div className="ring-live-video">
              <video
                autoPlay
                playsInline
                ref={(element) => {
                  if (element) element.srcObject = liveStream;
                }}
              />
              <span>
                <i /> Live Ring stream
              </span>
            </div>
          )}
        </section>
      )}
      {ringConnected && devices.length > 0 && (
        <section className="automation-section">
          <div className="automation-section-title">
            <div>
              <h2>Ring devices</h2>
              <p>
                Live-updating secure previews. Select a camera for the expanded
                view.
              </p>
            </div>
            <Camera />
          </div>
          <div className="ring-camera-grid">
            {devices.map((device) => (
              <article className="ring-camera-card" key={device.id}>
                <button
                  className="ring-preview"
                  onClick={() => void openLiveView(device)}
                  disabled={!device.online}
                  aria-label={`Open ${device.name} preview`}
                >
                  <img
                    key={`${device.id}-${previewTick}`}
                    src={snapshotUrl(device.id)}
                    alt={`${device.name} camera preview`}
                    onLoad={() =>
                      setPreviewErrors((current) => {
                        if (!current[device.id]) return current;
                        const next = { ...current };
                        delete next[device.id];
                        return next;
                      })
                    }
                    onError={() =>
                      setPreviewErrors((current) => ({
                        ...current,
                        [device.id]: true,
                      }))
                    }
                    hidden={Boolean(previewErrors[device.id])}
                  />
                  {previewErrors[device.id] && (
                    <div className="ring-preview-unavailable">
                      <Camera size={22} />
                      <strong>Preview unavailable</strong>
                      <small>Ring will retry automatically</small>
                    </div>
                  )}
                  <span>
                    <Expand size={15} />{" "}
                    {device.online
                      ? previewErrors[device.id]
                        ? "Retrying preview…"
                        : "Open live preview"
                      : "Camera offline"}
                  </span>
                </button>
                <strong>{device.name}</strong>
                <span>
                  {device.kind === "doorbell" ? "Doorbell" : "Camera"} ·{" "}
                  {device.online ? "Online" : "Offline"}
                  {device.battery !== null
                    ? ` · ${device.battery}% battery`
                    : ""}
                </span>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="automation-section" hidden>
        <div className="automation-section-title">
          <div>
            <h2>Activity</h2>
            <p>Recent Ring doorbell presses and motion events.</p>
          </div>
          <BellRing />
        </div>
        {events.length ? (
          <div className="security-activity-list">
            {events.map((event) => (
              <article key={`${event.id}-${event.deviceName}`}>
                <BellRing size={17} />
                <div>
                  <strong>
                    {event.kind === "doorbell"
                      ? "Doorbell press"
                      : event.kind === "motion"
                        ? "Motion detected"
                        : "Security event"}
                  </strong>
                  <span>
                    {event.deviceName} ·{" "}
                    {new Date(event.occurredAt).toLocaleString()}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="automation-empty">
            <BellRing size={31} />
            <div>
              <strong>No security events yet</strong>
              <span>
                {ringConnected
                  ? "Your recent Ring events will appear here after activity is detected."
                  : "Connect your Ring account above to start receiving events."}
              </span>
            </div>
          </div>
        )}
      </section>
      {selectedCamera && (
        <div
          className="ring-viewer-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedCamera.name} live preview`}
          onClick={() => {
            setSelectedCamera(null);
            void stopTalkback();
          }}
        >
          <section
            className="ring-viewer"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>RING LIVE PREVIEW</span>
                <h2>{selectedCamera.name}</h2>
              </div>
              <button
                onClick={() => {
                  setSelectedCamera(null);
                  void stopTalkback();
                }}
                aria-label="Close camera preview"
              >
                <X size={20} />
              </button>
            </header>
            {liveStream ? (
              <video
                autoPlay
                playsInline
                ref={(element) => {
                  if (element) element.srcObject = liveStream;
                }}
              />
            ) : (
              <div className="ring-viewer-loading">
                <RefreshCw size={24} className="is-spinning" />
                <span>{talkStatus || "Connecting to live camera…"}</span>
              </div>
            )}
            <footer>
              <span>
                <i /> Refreshing automatically
              </span>
              {!talkbackActive && (
                <button onClick={() => void startTalkback(selectedCamera)}>
                  <BellRing size={16} /> Enable talkback
                </button>
              )}
              <button onClick={() => setPreviewTick(Date.now())}>
                <RefreshCw size={16} /> Refresh now
              </button>
              <button
                onClick={() => {
                  setSelectedCamera(null);
                  void stopTalkback();
                }}
              >
                <Maximize2 size={16} /> Minimise
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
