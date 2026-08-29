import { API_URL, apiGet, apiPost } from "./api";
export type IntegrationCommand = {
  id: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH";
  path: string;
  bodyTemplate?: string;
  valueHint?: string;
};
export type SetupModule = {
  id: string;
  name: string;
  description: string;
  category: string;
  installed: boolean;
  enabled: boolean;
  builtIn: boolean;
  auth: string;
  configured: boolean;
  baseUrl?: string;
  devicesPath?: string;
  commands?: IntegrationCommand[];
};
export type CustomDevice = { id: string; name: string };
export type SetupCentreState = {
  edition: string;
  configuration: {
    core: "local-environment";
    integrations: "encrypted-local-store";
    mobileServices: "device-scoped-worker-access";
    secretsExposedToClients: false;
  };
  core: {
    owner: string;
    openAI: boolean;
    maps: boolean;
    weather: boolean;
    aviation: boolean;
    openSky: boolean;
    relay: boolean;
    govee: boolean;
  };
  modules: SetupModule[];
};
export const getSetupCentre = () => apiGet<SetupCentreState>("/setup/centre");
export const saveCoreSetup = (values: Record<string, string>) =>
  apiPost<{ saved: boolean; restartRequired: boolean }>(
    "/setup/configuration",
    values,
  );
export const setSetupModuleState = (
  id: string,
  installed: boolean,
  enabled: boolean,
) =>
  apiPost<SetupModule[]>(`/setup/modules/${encodeURIComponent(id)}/state`, {
    installed,
    enabled,
  });
export async function removeSetupModule(id: string) {
  const response = await fetch(
    `${API_URL}/setup/modules/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to remove module.");
  return result as SetupModule[];
}
export const createCustomModule = (input: Record<string, unknown>) =>
  apiPost<SetupModule[]>("/setup/modules/custom", input);
export const testSetupModule = (id: string) =>
  apiPost<{ connected: boolean }>(
    `/setup/modules/${encodeURIComponent(id)}/test`,
    {},
  );
export const discoverSetupModuleDevices = (id: string) =>
  apiGet<CustomDevice[]>(`/setup/modules/${encodeURIComponent(id)}/devices`);
export const executeSetupModuleCommand = (
  id: string,
  commandId: string,
  deviceId: string,
  value: unknown,
) =>
  apiPost<{ success: boolean; status: number }>(
    `/setup/modules/${encodeURIComponent(id)}/commands/${encodeURIComponent(commandId)}`,
    { deviceId, value },
  );
