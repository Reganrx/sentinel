import {
  DEVICE_PROVIDER_PRIORITY,
} from "../config.js";

import {
  updateStorageState,
} from "../deviceState.js";

import type {
  StorageDrive,
} from "../deviceTypes.js";

import {
  runPowerShell,
} from "../../system/powershell.js";

import type {
  DeviceProvider,
} from "./DeviceProvider.js";

interface WindowsVolume {

  DriveLetter?: string;

  Size?: number;

  SizeRemaining?: number;

}

export class StorageProvider
  implements DeviceProvider {

  readonly name =
    "storage";

  readonly priority =
    DEVICE_PROVIDER_PRIORITY.STORAGE;

  async refresh(): Promise<void> {

    if (process.platform !== "win32") {

      updateStorageState([]);

      return;

    }

    try {

      const result =
        await runPowerShell<
          WindowsVolume | WindowsVolume[]
        >(
          "Get-Volume | Select-Object DriveLetter,Size,SizeRemaining | ConvertTo-Json"
        );

      const volumes =
        Array.isArray(result)
          ? result
          : [result];

      const storage: StorageDrive[] =

        volumes

          .filter(

            volume =>

              Boolean(
                volume.DriveLetter
              )

          )

          .map(

            volume => ({

              name:

                `${volume.DriveLetter}:`,

              total:

                volume.Size ?? 0,

              free:

                volume.SizeRemaining ?? 0,

              used:

                (volume.Size ?? 0) -

                (volume.SizeRemaining ?? 0),

            })

          );

      updateStorageState(
        storage
      );

    }

    catch {

      updateStorageState([]);

    }

  }

}