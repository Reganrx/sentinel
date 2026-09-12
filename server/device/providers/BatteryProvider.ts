import {
  DEVICE_PROVIDER_PRIORITY,
} from "../config.js";

import {
  updateBatteryState,
} from "../deviceState.js";

import type {
  BatteryState,
} from "../deviceTypes.js";

import {
  getWindowsBattery,
} from "../../system/windows/battery.js";

import type {
  DeviceProvider,
} from "./DeviceProvider.js";

export class BatteryProvider
  implements DeviceProvider {

  readonly name =
    "battery";

  readonly priority =
    DEVICE_PROVIDER_PRIORITY.BATTERY;

  async refresh(): Promise<void> {

    if (process.platform !== "win32") {

      const battery: BatteryState = {

        present: false,

        charging: false,

        level: 0,

      };

      updateBatteryState(
        battery
      );

      return;

    }

    try {

      const battery =
        await getWindowsBattery();

      updateBatteryState(
        battery
      );

    }

    catch {

      const battery: BatteryState = {

        present: false,

        charging: false,

        level: 0,

      };

      updateBatteryState(
        battery
      );

    }

  }

}