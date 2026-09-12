import { Bluetooth, Check, Clipboard, Filter, LockKeyhole, Network, Radar, RefreshCw, Search, ShieldCheck, ShieldQuestion, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getDeveloperStatus } from "../../services/developer";
import { scanDevices, type DeviceScan, type ScannedDevice } from "../../services/deviceScanner";
import "./DeviceScannerView.css";

type DeviceTrust = "trusted" | "unknown";
type FilterMode = "all" | "new" | "trusted" | "unknown" | "bluetooth" | "network";
const TRUST_KEY = "sentinel-device-trust";
const LAST_SCAN_KEY = "sentinel-device-scan-ids";

function readTrust(): Record<string, DeviceTrust> {
  try { return JSON.parse(localStorage.getItem(TRUST_KEY) ?? "{}"); } catch { return {}; }
}

function DeviceCard({ device, trust, isNew, onTrust }: { device: ScannedDevice; trust: DeviceTrust; isNew: boolean; onTrust: (value: DeviceTrust) => void }) {
  const Icon = device.kind === "bluetooth" ? Bluetooth : Network;
  const label = device.support === "ready" ? "Supported" : device.support === "needs-integration" ? "Integration required" : "Information only";
  const copyValue = device.address ?? device.mac;
  return <article className={`scanner-device-card scanner-device-card--${trust}`}>
    <div className="scanner-device-icon"><Icon size={22} /></div>
    <div className="scanner-device-copy">
      <div className="scanner-device-title"><h3 title={device.name}>{device.name}</h3><div className="scanner-device-badges">{isNew && <span className="scanner-new">New</span>}<span className={`scanner-support scanner-support--${device.support}`}>{label}</span></div></div>
      <p>{device.detail}</p>
      <dl className="scanner-device-facts">
        {device.address && <><dt>IP address</dt><dd>{device.address}</dd></>}
        {device.mac && <><dt>Hardware address</dt><dd>{device.mac}</dd></>}
        {device.interfaceName && <><dt>Connection</dt><dd>{device.interfaceName}</dd></>}
        {device.networkState && <><dt>Network state</dt><dd>{device.networkState}</dd></>}
        <dt>Sentinel status</dt><dd>{trust === "trusted" ? "Recognised by you" : "Not yet reviewed"}</dd>
      </dl>
      <div className="scanner-device-actions"><button className={trust === "trusted" ? "trusted" : ""} onClick={() => onTrust(trust === "trusted" ? "unknown" : "trusted")}>{trust === "trusted" ? <Check /> : <ShieldQuestion />}{trust === "trusted" ? "Trusted" : "Mark trusted"}</button>{copyValue && <button onClick={() => void navigator.clipboard.writeText(copyValue)}><Clipboard />Copy address</button>}</div>
    </div>
  </article>;
}

export default function DeviceScannerView() {
  const [unlocked, setUnlocked] = useState(false);
  const [scan, setScan] = useState<DeviceScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [trust, setTrust] = useState<Record<string, DeviceTrust>>(readTrust);
  const [previousIds, setPreviousIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(LAST_SCAN_KEY) ?? "[]"); } catch { return []; } });

  useEffect(() => { void getDeveloperStatus().then((status) => setUnlocked(status.unlocked)).catch(() => setUnlocked(false)); }, []);

  async function runScan() {
    setScanning(true); setError("");
    try {
      const result = await scanDevices();
      if (scan) setPreviousIds(scan.devices.map(device => device.id));
      setScan(result);
      localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(result.devices.map(device => device.id)));
    } catch (err) { setError(err instanceof Error ? err.message : "Scanner failed."); }
    finally { setScanning(false); }
  }

  function updateTrust(id: string, value: DeviceTrust) {
    const next = { ...trust, [id]: value };
    setTrust(next); localStorage.setItem(TRUST_KEY, JSON.stringify(next));
  }

  const newIds = useMemo(() => new Set(scan?.devices.filter(device => !previousIds.includes(device.id)).map(device => device.id) ?? []), [scan, previousIds]);
  const filtered = useMemo(() => (scan?.devices ?? []).filter(device => {
    const matchesSearch = `${device.name} ${device.address ?? ""} ${device.mac ?? ""} ${device.interfaceName ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const state = trust[device.id] ?? "unknown";
    const matchesFilter = filter === "all" || filter === device.kind || filter === state || (filter === "new" && newIds.has(device.id));
    return matchesSearch && matchesFilter;
  }).sort((a, b) => a.name.localeCompare(b.name)), [scan, query, filter, trust, newIds]);
  const trustedCount = scan?.devices.filter(device => trust[device.id] === "trusted").length ?? 0;
  const unknownCount = (scan?.devices.length ?? 0) - trustedCount;

  return <div className="device-scanner-view">
    <header className="scanner-heading"><div><p>NETWORK INVENTORY</p><h1>Device Scanner</h1><span>See what this PC already knows, review unfamiliar devices, and build a trusted inventory.</span></div>{unlocked && <button onClick={() => void runScan()} disabled={scanning}><RefreshCw size={17} className={scanning ? "scanner-spinning" : ""} />{scanning ? "Scanning..." : scan ? "Scan again" : "Run safe scan"}</button>}</header>
    {!unlocked ? <section className="scanner-locked"><div className="scanner-lock-icon"><LockKeyhole size={31} /></div><div><span>ADMIN APPROVAL REQUIRED</span><h2>Scanner controls are locked</h2><p>Unlock Developer Mode in Settings to run discovery. Sentinel never attempts to sign in to or control discovered hardware.</p></div></section> : <>
      <section className="scanner-safety"><ShieldCheck size={25} /><div><strong>Passive and safe</strong><span>The scanner reads paired Bluetooth records and Windows’ existing network neighbour table. It does not probe ports or bypass security.</span></div></section>
      {error && <div className="scanner-error">{error}</div>}
      {!scan && !scanning && <section className="scanner-empty"><Radar size={37} /><h2>Build your device inventory</h2><p>Run a scan, then mark devices you recognise as trusted. Future scans make unfamiliar additions easier to spot.</p></section>}
      {scan && <>
        <section className="scanner-overview"><div><strong>{scan.devices.length}</strong><span>Observed</span></div><div><strong>{trustedCount}</strong><span>Trusted</span></div><div className={unknownCount ? "attention" : ""}><strong>{unknownCount}</strong><span>Needs review</span></div><div className={newIds.size ? "attention" : ""}><strong>{newIds.size}</strong><span>New this scan</span></div></section>
        <div className="scanner-meta"><span><Wifi size={15} /> Scan completed {new Date(scan.scannedAt).toLocaleTimeString()}</span><span>Results come from this PC’s current records</span></div>
        <section className="scanner-tools"><label><Search /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, IP, hardware address or connection" /></label><div><Filter />{(["all", "new", "trusted", "unknown", "bluetooth", "network"] as FilterMode[]).map(value => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value === "all" ? "All" : value[0].toUpperCase() + value.slice(1)}</button>)}</div></section>
        <section className="scanner-section"><div className="scanner-section-heading"><Network size={21} /><div><h2>Observed devices</h2><p>{filtered.length} matching device{filtered.length === 1 ? "" : "s"}, sorted alphabetically.</p></div></div><div className="scanner-grid">{filtered.length ? filtered.map(device => <DeviceCard key={device.id} device={device} trust={trust[device.id] ?? "unknown"} isNew={newIds.has(device.id)} onTrust={value => updateTrust(device.id, value)} />) : <p className="scanner-none">No devices match the current search and filter.</p>}</div></section>
        <section className="scanner-notes"><h2>How to interpret this scan</h2>{scan.notes.map(note => <p key={note}>{note}</p>)}<p>A device marked trusted is only a personal label. It does not grant Sentinel access or weaken the device’s security.</p></section>
      </>}
    </>}
  </div>;
}
