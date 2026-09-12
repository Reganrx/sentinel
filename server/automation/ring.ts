import fs from "node:fs/promises";
import path from "node:path";
import { RingApi } from "ring-client-api";
import { RingRestClient } from "ring-client-api/rest-client";

type RingConfig = { refreshToken: string };
type StoredConfig = { ring?: RingConfig };
const configPath = process.env.SENTINEL_DATA_DIR
  ? path.join(process.env.SENTINEL_DATA_DIR, "automation.json")
  : path.join(process.env.APPDATA ?? process.cwd(), "Sentinel", "automation.json");
const liveSessions = new Map<string, { end(): Promise<unknown>; activateCameraSpeaker(): Promise<unknown> }>();
let activeApi: RingApi | undefined;
let activeRefreshToken: string | undefined;
const authSessions = new Map<string, { client: RingRestClient; expiresAt: number }>();

async function stored(): Promise<StoredConfig> {
  try { return JSON.parse(await fs.readFile(configPath, "utf8")) as StoredConfig; }
  catch { return {}; }
}

async function saveRingConfig(config: RingConfig) {
  const current = await stored();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify({ ...current, ring: config }, null, 2), "utf8");
}

export async function getRingConfig(): Promise<RingConfig | undefined> {
  if (process.env.RING_REFRESH_TOKEN) return { refreshToken: process.env.RING_REFRESH_TOKEN };
  return (await stored()).ring;
}

async function ringApi() {
  const config = await getRingConfig();
  if (!config?.refreshToken) throw new Error("Ring is not connected.");

  // A snapshot refreshes frequently. Reusing the authenticated client keeps
  // compact camera previews responsive instead of reconnecting for every image.
  if (activeApi && activeRefreshToken === config.refreshToken) return activeApi;

  const api = new RingApi({ refreshToken: config.refreshToken, cameraStatusPollingSeconds: 60 });
  activeApi = api;
  activeRefreshToken = config.refreshToken;
  api.onRefreshTokenUpdated.subscribe(({ newRefreshToken }) => {
    activeRefreshToken = newRefreshToken;
    void saveRingConfig({ refreshToken: newRefreshToken });
  });
  return api;
}

async function findRingCamera(id: string) {
  const cameras = await (await ringApi()).getCameras();
  const camera = cameras.find(item => String(item.id) === id);
  if (!camera) throw new Error("Ring camera not found.");
  return camera;
}

export type RingDevice = { id: string; name: string; model: string; kind: "doorbell" | "camera"; battery: number | null; online: boolean; hasLight: boolean; hasSiren: boolean; panTiltSupported: boolean };
export type RingEvent = { id: string; deviceName: string; kind: "motion" | "doorbell" | "event"; occurredAt: string };

export async function getRingDevices(): Promise<RingDevice[]> {
  const cameras = await (await ringApi()).getCameras();
  return cameras.map(camera => {
    const data = camera.data as unknown as Record<string, unknown>;
    const model = [camera.model, data.description, data.kind, data.device_api_id]
      .find((value) => typeof value === "string" && value.trim() && value.trim() !== camera.name.trim() && !/^unknown(?: model)?$/i.test(value.trim())) as string | undefined;
    return {
      id: String(camera.id),
      name: camera.name,
      model: model ?? "Ring device",
      kind: camera.isDoorbot ? "doorbell" : "camera",
      battery: camera.batteryLevel,
      online: !camera.isOffline,
      hasLight: camera.hasLight,
      hasSiren: camera.hasSiren,
      panTiltSupported: Boolean(camera.data.health?.ptz_connected),
    };
  });
}

export async function getRingEvents(): Promise<RingEvent[]> {
  const cameras = await (await ringApi()).getCameras();
  const results = await Promise.all(cameras.map(async camera => ({ name: camera.name, events: (await camera.getEvents({ limit: 8 })).events })));
  return results.flatMap(result => result.events.map(event => ({
    id: event.ding_id_str, deviceName: result.name,
    kind: (event.kind === "motion" ? "motion" : event.kind === "ding" ? "doorbell" : "event") as RingEvent["kind"],
    occurredAt: event.created_at,
  }))).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 12);
}

export async function getRingSnapshot(id: string) {
  return (await findRingCamera(id)).getSnapshot();
}

export async function setRingCameraLight(id: string, on: boolean) {
  const camera = await findRingCamera(id);
  if (!camera.hasLight) throw new Error("This Ring device does not have a controllable light.");
  await camera.setLight(on);
  return { id, on };
}

export async function setRingCameraSiren(id: string, on: boolean) {
  const camera = await findRingCamera(id);
  if (!camera.hasSiren) throw new Error("This Ring device does not have a controllable siren.");
  await camera.setSiren(on);
  return { id, on };
}

export async function startRingTalkback(id: string, offerSdp: string) {
  if (!offerSdp.trim()) throw new Error("A browser WebRTC offer is required.");
  const camera = await findRingCamera(id);
  const session = camera.createSimpleWebRtcSession();
  try {
    const answerSdp = await session.start(offerSdp);
    await session.activateCameraSpeaker();
    liveSessions.set(session.sessionId, session);
    return { sessionId: session.sessionId, answerSdp };
  } catch (error) {
    await session.end().catch(() => undefined);
    throw error;
  }
}

export async function startRingLiveView(id: string, offerSdp: string) {
  if (!offerSdp.trim()) throw new Error("A browser WebRTC offer is required.");
  const camera = await findRingCamera(id);
  const session = camera.createSimpleWebRtcSession();
  try {
    const answerSdp = await session.start(offerSdp);
    liveSessions.set(session.sessionId, session);
    return { sessionId: session.sessionId, answerSdp };
  } catch (error) {
    await session.end().catch(() => undefined);
    throw error;
  }
}

export async function stopRingTalkback(sessionId: string) {
  const session = liveSessions.get(sessionId);
  if (!session) return { stopped: true };
  liveSessions.delete(sessionId);
  await session.end();
  return { stopped: true };
}

export async function connectRing(refreshToken: string) {
  const token = refreshToken.trim();
  if (token.length < 40) throw new Error("Paste the full Ring refresh token generated by Ring Auth.");
  await saveRingConfig({ refreshToken: token });
  try { return { connected: true, devices: await getRingDevices() }; }
  catch (error) { await saveRingConfig({ refreshToken: "" }); throw error; }
}

async function finishRingSignIn(refreshToken: string) {
  await saveRingConfig({ refreshToken });
  activeApi = undefined;
  activeRefreshToken = undefined;
  try { return { connected: true, devices: await getRingDevices() }; }
  catch (error) { await saveRingConfig({ refreshToken: "" }); throw error; }
}

export async function beginRingSignIn(email: string, password: string) {
  const cleanEmail = email.trim();
  if (!cleanEmail.includes("@") || password.length < 6)
    throw new Error("Enter the email address and password for the Ring account.");
  const client = new RingRestClient({ email: cleanEmail, password, controlCenterDisplayName: "Sentinel" });
  try {
    const auth = await client.getCurrentAuth();
    return { ...(await finishRingSignIn(auth.refresh_token)), needsVerification: false };
  } catch (error) {
    if (!client.promptFor2fa) throw error;
    const sessionId = crypto.randomUUID();
    authSessions.set(sessionId, { client, expiresAt: Date.now() + 10 * 60_000 });
    return { connected: false, needsVerification: true, sessionId, prompt: client.promptFor2fa };
  }
}

export async function completeRingSignIn(sessionId: string, code: string) {
  const session = authSessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    authSessions.delete(sessionId);
    throw new Error("The Ring sign-in expired. Start again.");
  }
  const cleanCode = code.replace(/\D/g, "");
  if (cleanCode.length < 4) throw new Error("Enter the verification code sent by Ring.");
  try {
    const auth = await session.client.getAuth(cleanCode);
    authSessions.delete(sessionId);
    return { ...(await finishRingSignIn(auth.refresh_token)), needsVerification: false };
  } catch (error) {
    throw new Error(session.client.promptFor2fa || (error instanceof Error ? error.message : "Ring rejected that verification code."));
  }
}
