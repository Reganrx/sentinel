import { useState } from "react";
import { Play, RefreshCw } from "lucide-react";
import {
  discoverSetupModuleDevices,
  executeSetupModuleCommand,
  type CustomDevice,
  type SetupModule,
} from "../../services/setup";

export default function CustomIntegrationConsole({
  module,
  onNotice,
}: {
  module: SetupModule;
  onNotice: (type: "success" | "error", text: string) => void;
}) {
  const [devices, setDevices] = useState<CustomDevice[]>([]),
    [deviceId, setDeviceId] = useState(""),
    [values, setValues] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState("");
  async function discover() {
    setBusy("discover");
    try {
      const found = await discoverSetupModuleDevices(module.id);
      setDevices(found);
      setDeviceId((current) => current || found[0]?.id || "");
      onNotice(
        "success",
        `${found.length} device${found.length === 1 ? "" : "s"} found.`,
      );
    } catch (error) {
      onNotice(
        "error",
        error instanceof Error ? error.message : "Device discovery failed.",
      );
    } finally {
      setBusy("");
    }
  }
  async function run(commandId: string, commandName: string) {
    if (!deviceId)
      return onNotice("error", "Discover and select a device first.");
    const device = devices.find((item) => item.id === deviceId);
    if (
      !window.confirm(
        `Send “${commandName}” to ${device?.name || "this device"}?`,
      )
    )
      return;
    setBusy(commandId);
    try {
      const result = await executeSetupModuleCommand(
        module.id,
        commandId,
        deviceId,
        values[commandId] ?? "",
      );
      onNotice(
        "success",
        `${commandName} succeeded (provider status ${result.status}).`,
      );
    } catch (error) {
      onNotice(
        "error",
        error instanceof Error ? error.message : "Command failed.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="integration-console">
      <div className="console-toolbar">
        <strong>Device controls</strong>
        <button onClick={() => void discover()} disabled={busy === "discover"}>
          <RefreshCw />
          {busy === "discover" ? "Finding…" : "Discover devices"}
        </button>
      </div>
      {devices.length > 0 && (
        <label>
          Device
          <select
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
          >
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {(module.commands ?? []).map((command) => (
        <div className="command-row" key={command.id}>
          <div>
            <strong>{command.name}</strong>
            <small>
              {command.method} {command.path}
            </small>
          </div>
          {command.valueHint && (
            <input
              placeholder={command.valueHint}
              value={values[command.id] ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [command.id]: event.target.value,
                }))
              }
            />
          )}
          <button
            disabled={Boolean(busy)}
            onClick={() => void run(command.id, command.name)}
          >
            <Play />
            {busy === command.id ? "Sending…" : "Run"}
          </button>
        </div>
      ))}
      {!module.devicesPath && (
        <small>
          Add a device-list path by recreating this integration to enable
          discovery.
        </small>
      )}
      {module.devicesPath && !module.commands?.length && (
        <small>No commands have been configured for this integration.</small>
      )}
    </div>
  );
}
