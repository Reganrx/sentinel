import { apiGet } from "./api";

import type {
  DeviceState,
} from "../types/device";

export async function getDeviceState(): Promise<DeviceState> {

  return apiGet<DeviceState>("/device");

}