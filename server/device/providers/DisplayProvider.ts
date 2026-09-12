import {
  DEVICE_PROVIDER_PRIORITY,
} from "../config.js";

import {
  updateDisplayState,
} from "../deviceState.js";

import type {
  DisplayState,
} from "../deviceTypes.js";

import {
  getWindowsDisplay,
} from "../../system/windows/display.js";

import type {
  DeviceProvider,
} from "./DeviceProvider.js";

export class DisplayProvider
  implements DeviceProvider {

  readonly name =
    "display";

  readonly priority =
    DEVICE_PROVIDER_PRIORITY.DISPLAY;

  async refresh(): Promise<void> {

    if (process.platform !== "win32") {

      const display: DisplayState = {

        width: 0,

        height: 0,

        refreshRate: 0,

        scale: 100,

        primary: true,

      };

      updateDisplayState(
        display
      );

      return;

    }

    try {

      const display =
        await getWindowsDisplay();

      updateDisplayState(
        display
      );

    }

    catch {

      const display: DisplayState = {

        width: 0,

        height: 0,

        refreshRate: 0,

        scale: 100,

        primary: true,

      };

      updateDisplayState(
        display
      );

    }

  }

}