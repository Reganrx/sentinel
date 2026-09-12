import type {
  DeviceProvider,
} from "./DeviceProvider.js";

import {
  MemoryProvider,
} from "./MemoryProvider.js";

import {
  CPUProvider,
} from "./CPUProvider.js";

import {
  NetworkProvider,
} from "./NetworkProvider.js";

import {
  StorageProvider,
} from "./StorageProvider.js";

import {
  DisplayProvider,
} from "./DisplayProvider.js";

import {
  BatteryProvider,
} from "./BatteryProvider.js";
import { HardwareProvider } from "./HardwareProvider.js";

export const DEVICE_PROVIDERS: DeviceProvider[] = [

  new MemoryProvider(),

  new CPUProvider(),

  new NetworkProvider(),

  new StorageProvider(),

  new DisplayProvider(),

  new BatteryProvider(),

  new HardwareProvider(),

];
