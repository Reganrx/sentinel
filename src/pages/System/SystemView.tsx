import "./SystemView.css";

import { useEffect, useState } from "react";
import {
  Activity,
  BatteryCharging,
  Cpu,
  HardDrive,
  Fan,
  Gauge,
  Monitor,
  Network,
  RefreshCw,
  Thermometer,
  Timer,
} from "lucide-react";

import { getDeviceState } from "../../services/device";
import type { DeviceState } from "../../types/device";
import LoadingSkeleton from "../../components/LoadingSkeleton";

const REFRESH_INTERVAL = 5000;

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function gigabytes(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function duration(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", `${minutes}m`].filter(Boolean).join(" ");
}

function Meter({ label, value, detail }: { label: string; value: number; detail: string }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="vital-meter">
      <div className="vital-meter-label"><span>{label}</span><strong>{safeValue}%</strong></div>
      <div className="vital-meter-track"><div className="vital-meter-fill" style={{ width: `${safeValue}%` }} /></div>
      <small>{detail}</small>
    </div>
  );
}

export default function SystemView() {
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      setDevice(await getDeviceState());
      setError(null);
    } catch {
      setError("Sentinel could not reach the local device service.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, REFRESH_INTERVAL);
    return () => window.clearInterval(timer);
  }, []);

  const memoryUsage = device ? percentage(device.memory.used, device.memory.total) : 0;
  const primaryDrive = device?.storage[0];
  const storageUsage = primaryDrive ? percentage(primaryDrive.used, primaryDrive.total) : 0;
  const sensors = device?.hardware?.sensors ?? [];
  const temperatures = sensors.filter((sensor) => sensor.type === "Temperature");
  const liveSensors = sensors.filter((sensor) => ["Temperature", "Fan", "Power", "Load"].includes(sensor.type)).slice(0, 18);

  return (
    <section className="system-view">
      <header className="system-heading">
        <div>
          <p>LIVE DEVICE MONITORING</p>
          <h1>System Vitals</h1>
        </div>
        <button className="system-refresh" type="button" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={18} className={refreshing ? "is-spinning" : ""} />
          Refresh
        </button>
      </header>

      {error && <div className="system-error">{error}</div>}

      {!device && !error && <LoadingSkeleton lines={5} />}

      {device && <div className="system-vitals-grid">
        <div className="system-health-strip">
          <span><i className="health-dot" /> Live monitoring</span>
          <span><Timer size={15} /> Uptime <strong>{duration(device.hardware?.uptimeSeconds ?? 0)}</strong></span>
          <span><Gauge size={15} /> Sensor source <strong>{device.hardware?.sensorProvider ?? "Windows"}</strong></span>
          <span>Last sample <strong>{device.hardware?.updatedAt ? new Date(device.hardware.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Pending"}</strong></span>
        </div>
        <article className="vital-card vital-card--wide">
          <div className="vital-card-heading"><Cpu /><div><span>Processor</span><strong>{device?.cpu.model || "Detecting processor…"}</strong></div></div>
          <div className="vital-meters">
            <Meter label="CPU load" value={device?.cpu.usage ?? 0} detail={`${device?.cpu.cores ?? 0} cores · ${device?.cpu.speed ?? 0} MHz`} />
            <Meter label="Memory" value={memoryUsage} detail={device ? `${gigabytes(device.memory.used)} of ${gigabytes(device.memory.total)}` : "Waiting for data…"} />
          </div>
        </article>

        {device.gpu.model && <article className="vital-card vital-card--wide">
          <div className="vital-card-heading"><Gauge /><div><span>Graphics</span><strong>{device.gpu.model}</strong></div></div>
          <div className="vital-meters"><Meter label="GPU load" value={device.gpu.usage} detail={device.gpu.usage ? "Live graphics utilisation" : "Detailed load requires a hardware sensor provider"} /><Meter label="Graphics memory" value={device.gpu.memoryTotal ? percentage(device.gpu.memoryUsed, device.gpu.memoryTotal) : 0} detail={device.gpu.memoryTotal ? `${gigabytes(device.gpu.memoryTotal)} detected` : "Dedicated memory not reported by Windows"} /></div>
        </article>}

        {liveSensors.length > 0 ? <article className="vital-card vital-card--wide sensor-card">
          <div className="vital-card-heading"><Thermometer /><div><span>Thermals and sensors</span><strong>{temperatures.length} temperature readings · {liveSensors.length} active sensors</strong></div></div>
          <div className="sensor-grid">{liveSensors.map((sensor, index) => <div className={`sensor-reading ${sensor.type === "Temperature" && sensor.value >= 85 ? "sensor-reading--hot" : ""}`} key={`${sensor.hardware}-${sensor.name}-${index}`}><span>{sensor.type === "Fan" ? <Fan size={16} /> : sensor.type === "Temperature" ? <Thermometer size={16} /> : <Activity size={16} />}{sensor.name}</span><strong>{sensor.value}{sensor.unit}</strong><small>{sensor.hardware.replace(/^\//, "")}</small></div>)}</div>
        </article> : <article className="vital-card vital-card--wide sensor-help">
          <div className="vital-card-heading"><Thermometer /><div><span>Advanced hardware sensors</span><strong>Ready for a local sensor provider</strong></div></div>
          <p>Windows is reporting the core system data shown above. Run LibreHardwareMonitor on this PC to add supported CPU/GPU temperatures, fan speeds, power and thermal-load readings automatically.</p>
          <small>Unsupported sensors stay hidden. Sentinel never substitutes estimated temperatures.</small>
        </article>}

        <article className="vital-card">
          <div className="vital-card-heading"><BatteryCharging /><div><span>Power</span><strong>{device?.battery.present ? `${device.battery.level}% battery` : "Desktop power"}</strong></div></div>
          <p>{device?.battery.present ? (device.battery.charging ? "Charging" : "On battery") : "No battery detected"}</p>
        </article>

        <article className="vital-card">
          <div className="vital-card-heading"><Network /><div><span>Network</span><strong>{device?.network.connected ? "Connected" : "Checking connection…"}</strong></div></div>
          <p>{device?.network.localIP || "Local address unavailable"}</p>
        </article>

        <article className="vital-card vital-card--wide">
          <div className="vital-card-heading"><HardDrive /><div><span>Storage</span><strong>{primaryDrive ? `${primaryDrive.name} drive` : "Detecting storage…"}</strong></div></div>
          <Meter label="Used space" value={storageUsage} detail={primaryDrive ? `${gigabytes(primaryDrive.used)} of ${gigabytes(primaryDrive.total)}` : "Waiting for data…"} />
          {device.hardware?.disks?.length > 0 && <div className="disk-health-list">{device.hardware.disks.map((disk) => <span key={disk.name}><HardDrive size={15} /><b>{disk.name}</b><small>{disk.mediaType}</small><em className={disk.health.toLowerCase() === "healthy" ? "is-healthy" : ""}>{disk.health}{disk.temperature != null ? ` · ${disk.temperature}°C` : ""}</em></span>)}</div>}
        </article>

        <article className="vital-card">
          <div className="vital-card-heading"><Monitor /><div><span>Display</span><strong>{device?.display.width && device?.display.height ? `${device.display.width} × ${device.display.height}` : "Detecting display…"}</strong></div></div>
          <p>{device?.display.refreshRate ? `${device.display.refreshRate} Hz · ${device.display.scale}% scale` : "Display details loading"}</p>
        </article>

        <article className="vital-card">
          <div className="vital-card-heading"><Activity /><div><span>Sentinel status</span><strong>{error ? "Service needs attention" : "Monitoring live"}</strong></div></div>
          <p>Updates every {REFRESH_INTERVAL / 1000} seconds.</p>
        </article>
      </div>
      }
    </section>
  );
}
