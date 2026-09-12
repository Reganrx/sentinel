import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export type ScannedDevice = {
  id: string;
  name: string;
  kind: "bluetooth" | "network";
  address?: string;
  mac?: string;
  interfaceName?: string;
  networkState?: string;
  status: "available" | "unknown";
  support: "ready" | "needs-integration" | "informational";
  detail: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function powershellJson(script: string) {
  const { stdout } = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, timeout: 10_000, maxBuffer: 1024 * 1024 });
  const value = stdout.trim();
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed : [parsed];
}

function classifyBluetooth(name: string): Pick<ScannedDevice, "support" | "detail"> {
  const lower = name.toLowerCase();
  if (lower.includes("sony") && (lower.includes("ht-a9") || lower.includes("sound"))) {
    return { support: "needs-integration", detail: "Sony audio device detected. Control requires a supported Sony network or cloud integration." };
  }
  if (lower.includes("hue") || lower.includes("ring") || lower.includes("govee")) {
    return { support: "ready", detail: "Recognised brand. Sentinel uses its approved service integration rather than Bluetooth control." };
  }
  return { support: "informational", detail: "Paired Bluetooth device. Discovery does not grant control permission." };
}

export async function scanDevices(): Promise<{ scannedAt: string; devices: ScannedDevice[]; notes: string[] }> {
  if (process.platform !== "win32") {
    return { scannedAt: new Date().toISOString(), devices: [], notes: ["Device Scanner currently uses Windows device discovery."] };
  }

  const bluetoothRows = await powershellJson("Get-PnpDevice -Class Bluetooth -PresentOnly | Where-Object { $_.FriendlyName -and $_.FriendlyName -notmatch 'Enumerator|Radio|Adapter|RFCOMM|Microsoft Bluetooth' } | Select-Object FriendlyName,Status,InstanceId | ConvertTo-Json -Compress").catch(() => []);
  const neighbourRows = await powershellJson("$adapters = @{}; Get-NetAdapter -ErrorAction SilentlyContinue | ForEach-Object { $adapters[$_.ifIndex] = $_.Name }; Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -and $_.IPAddress -notlike '127.*' -and $_.State -notin 'Unreachable','Incomplete','Permanent' } | ForEach-Object { [PSCustomObject]@{ IPAddress=$_.IPAddress; LinkLayerAddress=$_.LinkLayerAddress; State=$_.State; InterfaceName=$adapters[$_.InterfaceIndex] } } | ConvertTo-Json -Compress").catch(() => []);

  const bluetooth = bluetoothRows
    .map((row: any) => ({ name: text(row.FriendlyName), status: text(row.Status), id: text(row.InstanceId) }))
    .filter((row) => row.name)
    .map((row) => {
      const classification = classifyBluetooth(row.name);
      return { id: `bluetooth:${row.id || row.name}`, name: row.name, kind: "bluetooth" as const, status: row.status.toLowerCase() === "ok" ? "available" as const : "unknown" as const, ...classification };
    });

  const network = neighbourRows
    .map((row: any) => ({ address: text(row.IPAddress), mac: text(row.LinkLayerAddress), state: text(row.State), interfaceName: text(row.InterfaceName) }))
    .filter((row) => row.address && row.address !== "0.0.0.0")
    .slice(0, 80)
    .map((row) => ({
      id: `network:${row.address}`,
      name: row.mac ? `Network device ${row.mac}` : `Network device ${row.address}`,
      kind: "network" as const,
      address: row.address,
      mac: row.mac || undefined,
      interfaceName: row.interfaceName || undefined,
      networkState: row.state || undefined,
      status: "available" as const,
      support: "needs-integration" as const,
      detail: "Seen on the local network. Sentinel will only control it after an approved integration is connected.",
    }));

  const devices = [...bluetooth, ...network];
  return {
    scannedAt: new Date().toISOString(),
    devices,
    notes: [
      "This scan reads paired Windows Bluetooth devices and the local network neighbour table.",
      "It does not probe devices, bypass logins, or attempt control.",
      "Control is available only through explicit, supported integrations.",
    ],
  };
}
