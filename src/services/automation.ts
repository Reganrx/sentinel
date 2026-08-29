import { apiFetch, apiGet, apiPost } from "./api";
import { getDeveloperToken } from "./developer";

export type AutomationIntegration = {
  id: string;
  name: string;
  connected: boolean;
  description: string;
  setup: string;
};

export function getAutomationIntegrations() {
  return apiGet<AutomationIntegration[]>("/automation/integrations");
}
export type RelayStatus = {
  configured: boolean;
  connected: boolean;
  lastCheckedAt?: string;
  lastCommandAt?: string;
  lastError?: string;
};
export function getRelayStatus() {
  return apiGet<RelayStatus>("/automation/relay/status");
}
export function configureRelay(relayUrl: string, sharedSecret: string) {
  return apiPost<RelayStatus>("/automation/relay/configure", {
    relayUrl,
    sharedSecret,
  });
}
export function createRelayInstallation(
  relayUrl: string,
  ownerSecret: string,
  name: string,
) {
  return apiPost<{
    installationId: string;
    pairingPhrase?: string;
    pairingExpiresIn?: number;
    connected: boolean;
  }>("/automation/relay/create-installation", { relayUrl, ownerSecret, name });
}
export function createRelayInvite(
  relayUrl: string,
  ownerSecret: string,
  name: string,
) {
  return apiPost<{ inviteCode: string; expiresIn: number }>(
    "/automation/relay/create-invite",
    { relayUrl, ownerSecret, name },
  );
}
export type RelayInstallation = {
  id: string;
  name: string;
  createdAt: string | null;
};
async function ownerRelayRequest<T>(endpoint: string, body: unknown) {
  const response = await apiFetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sentinel-developer-token": getDeveloperToken(),
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok)
    throw new Error(result.error || "Cloudflare installation request failed.");
  return result;
}
export function listRelayInstallations(
  relayUrl: string,
  ownerSecret: string,
) {
  return ownerRelayRequest<{ installations: RelayInstallation[] }>(
    "/automation/relay/installations/list",
    { relayUrl, ownerSecret },
  );
}
export function deleteRelayInstallation(
  relayUrl: string,
  ownerSecret: string,
  installationId: string,
) {
  return ownerRelayRequest<{ deleted: true; installationId: string }>(
    `/automation/relay/installations/${encodeURIComponent(installationId)}/delete`,
    { relayUrl, ownerSecret },
  );
}
export function redeemRelayInvite(inviteCode: string) {
  return apiPost<{
    connected: boolean;
    installationId: string;
    pairingPhrase?: string;
    pairingExpiresIn?: number;
  }>("/automation/relay/redeem-invite", { inviteCode });
}
export function createAlexaPairingPhrase() {
  return apiPost<{ pairingPhrase: string; pairingExpiresIn: number }>(
    "/automation/relay/pairing",
    {},
  );
}
export function createAlexaLinkCode() {
  return apiPost<{ linkCode: string; expiresIn: number }>(
    "/automation/relay/alexa-link-code",
    {},
  );
}
export type AmazonDevice = {
  id: string;
  name: string;
  model: string;
  connection: "Alexa skill" | "Network" | "Bluetooth";
  address?: string;
  available: boolean;
  firstSeenAt?: string;
  lastSeenAt?: string;
  capabilities?: string[];
};
export function getAmazonDevices() {
  return apiGet<AmazonDevice[]>("/automation/amazon/devices");
}
export function renameAmazonDevice(id: string, name: string) {
  return apiPost<{ renamed: true }>(
    `/automation/amazon/devices/${encodeURIComponent(id)}/name`,
    { name },
  );
}
export async function forgetAmazonDevice(id: string) {
  const response = await apiFetch(
    `/automation/amazon/devices/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  const data = (await response.json().catch(() => ({}))) as {
    forgotten?: true;
    error?: string;
  };
  if (!response.ok) throw new Error(data.error ?? "Unable to forget device.");
  return data;
}

export type CompanionStatus = {
  configured: boolean;
  online: boolean;
  lastHeartbeatAt?: string;
  lastError?: string;
  /** Present only immediately after an explicit enable/pairing action. */
  link?: string;
  activeDeviceCount?: number;
  lastDeviceSeenAt?: string;
  activityState?: "active" | "recently-seen" | "offline" | "unpaired";
  devices?: CompanionDevice[];
};
export type CompanionDevice = {
  id: string;
  name?: string;
  platform?: string;
  pairedAt?: string;
  lastSeenAt?: string;
};
export type CompanionPairingCode = { code: string; expiresAt: string };
export function getCompanionStatus() {
  return apiGet<CompanionStatus>("/automation/companion/status");
}
export type MobileServiceId = "chat" | "navigation" | "weather" | "aviation" | "aircraft";
export type MobileAccessStatus = { configured: boolean; permissionVersion: number; availableServices: MobileServiceId[]; provisionedServices: MobileServiceId[]; updatedAt?: string };
export function getMobileAccessStatus() { return apiGet<MobileAccessStatus>("/automation/companion/mobile-access"); }
export function provisionMobileAccess(services: MobileServiceId[]) { return apiPost<MobileAccessStatus>("/automation/companion/mobile-access", { services }); }
export async function revokeMobileAccess() {
  const response = await apiFetch("/automation/companion/mobile-access", { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Unable to revoke mobile access.");
  return data as MobileAccessStatus;
}
export function enableCompanion() {
  return apiPost<CompanionStatus>("/automation/companion/enable", {});
}
export function disableCompanion() {
  return apiPost<CompanionStatus>("/automation/companion/disable", {});
}
export function createCompanionPairingCode() {
  return apiPost<CompanionPairingCode>("/automation/companion/pairing-code", {});
}
export async function revokeCompanionDevice(deviceId: string) {
  const response = await apiFetch(
    `/automation/companion/devices/${encodeURIComponent(deviceId)}`,
    { method: "DELETE" },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Unable to revoke paired device.");
  return data;
}
export type CompanionItem = {
  id: string;
  kind: "text" | "file";
  name?: string;
  text?: string;
  mimeType?: string;
  size?: number;
  createdAt: string;
  sourceName?: string;
};
export function listCompanionItems() {
  return apiGet<{ items: CompanionItem[] }>("/automation/companion/items");
}
export function sendCompanionText(text: string) {
  return apiPost<{ queued: boolean; transport: string; cloudBackup?: boolean }>(
    "/automation/companion/items",
    { kind: "text", text },
  );
}
export function sendCompanionFile(input: { name: string; mimeType: string; data: string }) {
  return apiPost<{ queued: boolean; transport: string; cloudBackup?: boolean }>(
    "/automation/companion/items",
    { kind: "file", ...input },
  );
}
export function downloadCompanionItem(itemId: string) {
  return apiGet<CompanionItem & { data?: string }>(`/automation/companion/items/${encodeURIComponent(itemId)}`);
}
export async function deleteCompanionItem(itemId: string) {
  const response = await apiFetch(`/automation/companion/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Unable to delete shared item.");
  return data;
}

export type HueBridge = { id: string; ip: string };
export type HueLight = {
  id: string;
  name: string;
  on: boolean;
  brightness: number;
  supportsBrightness: boolean;
  supportsColour: boolean;
  supportsColourTemperature: boolean;
  colourTemperature?: number;
};
export function discoverHueBridges() {
  return apiGet<HueBridge[]>("/automation/hue/discover");
}
export function pairHueBridge(bridgeIp: string) {
  return apiPost<{ connected: boolean }>("/automation/hue/pair", { bridgeIp });
}
export type HueCloudStatus = {
  configured: boolean;
  connected: boolean;
  awaitingAuthorisation: boolean;
};
export function getHueCloudStatus() {
  return apiGet<HueCloudStatus>("/automation/hue/cloud/status");
}
export function configureHueCloud(clientId: string, clientSecret: string) {
  return apiPost<HueCloudStatus>("/automation/hue/cloud/config", {
    clientId,
    clientSecret,
  });
}
export function beginHueCloudAuthorisation() {
  return apiPost<{ url: string }>("/automation/hue/cloud/authorise", {});
}
export function completeHueCloudAuthorisation() {
  return apiPost<HueCloudStatus>("/automation/hue/cloud/complete", {});
}
export function getHueLights() {
  return apiGet<HueLight[]>("/automation/hue/lights");
}
export function setHueLight(id: string, on: boolean) {
  return apiPost<{ id: string; on: boolean }>(
    `/automation/hue/lights/${encodeURIComponent(id)}`,
    { on },
  );
}
export type SmartLightControl = { on?: boolean; brightness?: number; colour?: { r: number; g: number; b: number }; colourTemperature?: number };
export function setHueLightControl(id: string, control: SmartLightControl) {
  return apiPost<{ id: string } & SmartLightControl>(`/automation/hue/lights/${encodeURIComponent(id)}/control`, control);
}
export type GoveeDevice = {
  id: string;
  model: string;
  name: string;
  controllable: boolean;
  supportsBrightness: boolean;
  supportsColour: boolean;
  supportsColourTemperature: boolean;
};
export function connectGovee(apiKey: string) {
  return apiPost<{ connected: boolean; devices: GoveeDevice[] }>(
    "/automation/govee/connect",
    { apiKey },
  );
}
export function getGoveeDevices() {
  return apiGet<GoveeDevice[]>("/automation/govee/devices");
}
export function setGoveeDevice(id: string, model: string, on: boolean) {
  return apiPost<{ id: string; on: boolean }>(
    `/automation/govee/devices/${encodeURIComponent(id)}`,
    { model, on },
  );
}
export function setGoveeDeviceControl(id: string, model: string, control: SmartLightControl) {
  return apiPost<{ id: string } & SmartLightControl>(`/automation/govee/devices/${encodeURIComponent(id)}/control`, { model, ...control });
}
export type RingDevice = {
  id: string;
  name: string;
  model: string;
  kind: "doorbell" | "camera";
  battery: number | null;
  online: boolean;
  hasLight: boolean;
  hasSiren: boolean;
  panTiltSupported: boolean;
};
export type RingEvent = {
  id: string;
  deviceName: string;
  kind: "motion" | "doorbell" | "event";
  occurredAt: string;
};
export function connectRing(refreshToken: string) {
  return apiPost<{ connected: boolean; devices: RingDevice[] }>(
    "/automation/ring/connect",
    { refreshToken },
  );
}
export type RingSignInResult = { connected: boolean; needsVerification: boolean; sessionId?: string; prompt?: string; devices?: RingDevice[] };
export function beginRingSignIn(email: string, password: string) {
  return apiPost<RingSignInResult>("/automation/ring/sign-in", { email, password });
}
export function completeRingSignIn(sessionId: string, code: string) {
  return apiPost<RingSignInResult>("/automation/ring/verify", { sessionId, code });
}
export function getRingDevices() {
  return apiGet<RingDevice[]>("/automation/ring/devices");
}
export function getRingEvents() {
  return apiGet<RingEvent[]>("/automation/ring/events");
}
export function setRingCameraLight(id: string, on: boolean) {
  return apiPost<{ id: string; on: boolean }>(
    `/automation/ring/devices/${encodeURIComponent(id)}/light`,
    { on },
  );
}
export function setRingCameraSiren(id: string, on: boolean) {
  return apiPost<{ id: string; on: boolean }>(
    `/automation/ring/devices/${encodeURIComponent(id)}/siren`,
    { on },
  );
}
export function startRingTalkback(id: string, sdp: string) {
  return apiPost<{ sessionId: string; answerSdp: string }>(
    `/automation/ring/devices/${encodeURIComponent(id)}/talkback/start`,
    { sdp },
  );
}
export function startRingLiveView(id: string, sdp: string) {
  return apiPost<{ sessionId: string; answerSdp: string }>(
    `/automation/ring/devices/${encodeURIComponent(id)}/live/start`,
    { sdp },
  );
}
export function stopRingTalkback(sessionId: string) {
  return apiPost<{ stopped: boolean }>(
    `/automation/ring/talkback/${encodeURIComponent(sessionId)}/stop`,
    {},
  );
}
