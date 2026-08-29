import {
  runPowerShell,
} from "../powershell.js";

interface BatteryResult {

  EstimatedChargeRemaining?: number;

  BatteryStatus?: number;

}

export async function getWindowsBattery() {

  const result =
    await runPowerShell<
      BatteryResult | BatteryResult[]
    >(
      "Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json"
    );

  if (!result) {

    return {

      present: false,

      charging: false,

      level: 0,

    };

  }

  const battery =
    Array.isArray(result)

      ? result[0]

      : result;

  return {

    present: true,

    charging:
      battery.BatteryStatus === 6 ||

      battery.BatteryStatus === 2,

    level:
      battery.EstimatedChargeRemaining ?? 0,

  };

}