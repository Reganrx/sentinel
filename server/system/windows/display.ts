import {
  runPowerShell,
} from "../powershell.js";

interface DisplayResult {

  CurrentHorizontalResolution?: number;

  CurrentVerticalResolution?: number;

  CurrentRefreshRate?: number;

}

export async function getWindowsDisplay() {

  const result =
    await runPowerShell<
      DisplayResult | DisplayResult[]
    >(
      "Get-CimInstance Win32_VideoController | Select-Object CurrentHorizontalResolution,CurrentVerticalResolution,CurrentRefreshRate | ConvertTo-Json"
    );

  const displays =
    Array.isArray(result)

      ? result

      : [result];

  const display =
    displays[0];

  return {

    width:
      display?.CurrentHorizontalResolution ?? 0,

    height:
      display?.CurrentVerticalResolution ?? 0,

    refreshRate:
      display?.CurrentRefreshRate ?? 0,

    scale: 100,

    primary: true,

  };

}