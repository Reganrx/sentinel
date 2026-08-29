import os from "node:os";
import { DEVICE_PROVIDER_PRIORITY } from "../config.js";
import { updateGPUState, updateHardwareState } from "../deviceState.js";
import type { DiskHealth, HardwareSensor } from "../deviceTypes.js";
import { runPowerShell } from "../../system/powershell.js";
import type { DeviceProvider } from "./DeviceProvider.js";

type Result = {
  provider?: "LibreHardwareMonitor" | "OpenHardwareMonitor" | "Windows";
  sensors?: Array<{ Name?: string; Hardware?: string; SensorType?: string; Value?: number; Min?: number; Max?: number }>;
  gpus?: Array<{ Name?: string; AdapterRAM?: number }>;
  disks?: Array<{ FriendlyName?: string; MediaType?: string; HealthStatus?: string; Temperature?: number }>;
};

const units: Record<string, string> = { Temperature: "°C", Load: "%", Fan: "RPM", Power: "W", Clock: "MHz", Data: "GB", Control: "%", Voltage: "V" };

export class HardwareProvider implements DeviceProvider {
  readonly name = "hardware-sensors";
  readonly priority = DEVICE_PROVIDER_PRIORITY.GPU;

  async refresh(): Promise<void> {
    const fallback = () => updateHardwareState({ sensorProvider: "Windows", sensors: [], disks: [], uptimeSeconds: os.uptime(), updatedAt: new Date().toISOString() });
    if (process.platform !== "win32") return fallback();
    try {
      const result = await runPowerShell<Result>(`
$provider='Windows'; $sensors=@();
try { $sensors=@(Get-CimInstance -Namespace 'root/LibreHardwareMonitor' -ClassName Sensor -ErrorAction Stop | Select-Object Name,@{n='Hardware';e={$_.Parent}},SensorType,Value,Min,Max); if($sensors.Count -gt 0){$provider='LibreHardwareMonitor'} } catch {}
if($sensors.Count -eq 0){ try { $sensors=@(Get-CimInstance -Namespace 'root/OpenHardwareMonitor' -ClassName Sensor -ErrorAction Stop | Select-Object Name,@{n='Hardware';e={$_.Parent}},SensorType,Value,Min,Max); if($sensors.Count -gt 0){$provider='OpenHardwareMonitor'} } catch {} }
$gpus=@(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Where-Object {$_.Name} | Select-Object Name,AdapterRAM);
$disks=@(Get-PhysicalDisk -ErrorAction SilentlyContinue | Select-Object FriendlyName,MediaType,HealthStatus,@{n='Temperature';e={try{(Get-StorageReliabilityCounter -PhysicalDisk $_ -ErrorAction Stop).Temperature}catch{$null}}});
[pscustomobject]@{provider=$provider;sensors=$sensors;gpus=$gpus;disks=$disks} | ConvertTo-Json -Depth 5 -Compress
      `);
      const sensors: HardwareSensor[] = (result.sensors ?? []).filter((item) => Number.isFinite(Number(item.Value))).map((item) => ({ name: item.Name || "Sensor", hardware: item.Hardware || "Hardware", type: item.SensorType || "Value", value: Number(Number(item.Value).toFixed(1)), min: item.Min == null ? undefined : Number(item.Min), max: item.Max == null ? undefined : Number(item.Max), unit: units[item.SensorType || ""] || "" }));
      const disks: DiskHealth[] = (result.disks ?? []).map((disk) => ({ name: disk.FriendlyName || "Storage device", mediaType: disk.MediaType || "Unspecified", health: disk.HealthStatus || "Unknown", temperature: disk.Temperature == null ? undefined : Number(disk.Temperature) }));
      const gpu = result.gpus?.[0];
      updateGPUState({ model: gpu?.Name || "", usage: sensors.find((item) => item.type === "Load" && /gpu core/i.test(item.name))?.value ?? 0, memoryUsed: 0, memoryTotal: Number(gpu?.AdapterRAM ?? 0) });
      updateHardwareState({ sensorProvider: result.provider ?? "Windows", sensors, disks, uptimeSeconds: os.uptime(), updatedAt: new Date().toISOString() });
    } catch { fallback(); }
  }
}
