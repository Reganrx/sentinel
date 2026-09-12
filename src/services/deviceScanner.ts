import { API_URL } from "./api";
import { getDeveloperToken } from "./developer";

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

export type DeviceScan = { scannedAt: string; devices: ScannedDevice[]; notes: string[] };

export async function scanDevices(): Promise<DeviceScan> {
  const response = await fetch(`${API_URL}/devices/scan`, { headers: { "x-sentinel-developer-token": getDeveloperToken() } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Unable to scan devices.");
  return data as DeviceScan;
}
