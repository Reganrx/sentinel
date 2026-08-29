import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { toFile } from "openai";
import { config } from "./config/index.js";
import client from "./services/client.js";
import { handleDeveloperSourceRequest } from "./services/openai.js";

dotenv.config();

import { runAgent } from "./brain/agent.js";

import { getBrainHealth } from "./core/health.js";

import { loadCapabilities } from "./capabilities/index.js";

import {
  initialiseWorld,
  refreshWorld,
  refreshCurrentLocation,
  updateCurrentLocation,
  getCurrentWorld,
} from "./world/index.js";

import { initialiseDevice, refreshDevice } from "./device/deviceManager.js";

import { getDeviceState } from "./device/deviceState.js";

import { GoogleMapsProvider } from "./world/providers/GoogleMapsProvider.js";

import { refreshWeather } from "./world/weather.js";

import { WeatherApiProvider } from "./world/providers/WeatherApiProvider.js";

import {
  addAssistantMessage,
  addUserMessage,
  replaceConversation,
  type ConversationMessage,
} from "./memory/conversation.js";

import { addMemory } from "./memory/longTermMemory.js";

import { extractMemory } from "./services/memoryExtractor.js";

import {
  approveSourceProposal,
  getSourceProposal,
  getSourceStatus,
  listSourceFiles,
  proposeSourceWrite,
  readSourceFile,
  searchSource,
} from "./source/sourceControl.js";

import {
  developerStatus,
  clearDeveloperSessions,
  hasActiveDeveloperSession,
  hashDeveloperPassword,
  lockDeveloperMode,
  requireDeveloperMode,
  unlockDeveloperMode,
  verifyDeveloperPassword,
} from "./security/developerAccess.js";

import { getAutomationIntegrations } from "./automation/automationHub.js";
import {
  discoverAmazonDevices,
  forgetAmazonDevice,
  renameAmazonDevice,
} from "./automation/amazonDevices.js";

import {
  discoverHueBridges,
  beginHueCloudAuthorisation,
  completeHueCloudAuthorisation,
  configureHueCloud,
  getHueCloudStatus,
  getHueLights,
  pairHueBridge,
  setHueLight,
  setHueLightControl,
} from "./automation/hue.js";
import {
  connectGovee,
  getGoveeDevices,
  setGoveeDevice,
  setGoveeDeviceControl,
} from "./automation/govee.js";
import {
  beginRingSignIn,
  completeRingSignIn,
  connectRing,
  getRingDevices,
  getRingEvents,
  getRingSnapshot,
  setRingCameraLight,
  setRingCameraSiren,
  startRingLiveView,
  startRingTalkback,
  stopRingTalkback,
} from "./automation/ring.js";
import {
  applySpokenAutomationCommand,
  getRelayStatus,
  refreshRelayConnection,
  startRelayPolling,
} from "./automation/relay.js";
import {
  disableCompanion,
  enableCompanion,
  getCompanionStatus,
  getCompanionServiceAccess,
  createCompanionPairingCode,
  revokeCompanionDevice,
  sendCompanionItem,
  listCompanionItems,
  downloadCompanionItem,
  deleteCompanionItem,
  startCompanionHeartbeat,
  getMobileAccessStatus,
  provisionMobileAccess,
  revokeMobileAccess,
  type MobileServiceId,
} from "./automation/companion.js";
import { scanDevices } from "./device/deviceScanner.js";
import {
  discoverCustomDevices,
  executeCustomCommand,
  listModules,
  removeModule,
  saveCustomModule,
  setModuleState,
  testCustomModule,
} from "./setup/integrationManager.js";
import {
  approveWindowsControlPlan,
  createWindowsControlPlan,
} from "./services/windowsControl.js";

const app = express();

const localApiToken = process.env.SENTINEL_LOCAL_API_TOKEN?.trim() ?? "";
if (!localApiToken) {
  throw new Error("SENTINEL_LOCAL_API_TOKEN is required.");
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === "null" || /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin is not permitted by Sentinel."));
  },
  allowedHeaders: [
    "content-type",
    "x-sentinel-local-token",
    "x-sentinel-developer-token",
  ],
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
}));

app.use((req, res, next) => {
  if (req.method === "OPTIONS") return next();
  const supplied = req.header("x-sentinel-local-token") ?? "";
  if (supplied.length !== localApiToken.length || supplied !== localApiToken) {
    return res.status(401).json({ error: "Sentinel local access denied." });
  }
  next();
});

const generatedImageDirectory = path.join(
  process.env.SENTINEL_DATA_DIR ?? path.join(process.env.APPDATA ?? process.cwd(), "Sentinel"),
  "generated-images",
);
mkdirSync(generatedImageDirectory, { recursive: true });
app.use("/generated-images", express.static(generatedImageDirectory, {
  immutable: true,
  maxAge: "365d",
}));

async function generateSentinelImage(prompt: string) {
  const cleanPrompt = prompt.trim().slice(0, 4000);
  if (!cleanPrompt) throw new Error("Describe the image you want Sentinel to create.");
  const result = await client.images.generate({
    model: "gpt-image-2",
    prompt: cleanPrompt,
    size: "1024x1024",
    quality: "medium",
  });
  const image = result.data?.[0];
  if (!image?.b64_json) throw new Error("The image service returned no image data.");
  const fileName = `${Date.now()}-${randomUUID()}.png`;
  writeFileSync(path.join(generatedImageDirectory, fileName), Buffer.from(image.b64_json, "base64"));
  return {
    prompt: cleanPrompt,
    revisedPrompt: image.revised_prompt ?? cleanPrompt,
    url: `/generated-images/${fileName}`,
  };
}

const realtimeInstructions = `You are Sentinel, Regan's calm, capable personal AI assistant. Speak with an original refined British identity: composed, intelligent, precise, quietly confident and reassuring. Use a measured pace, crisp diction, restrained warmth and occasional subtle dry humour when appropriate. Operational acknowledgements should be brief and polished; explanations should remain natural and conversational. Use British English consistently in wording and speech. Use British spelling and vocabulary: colour, favourite, organise, centre, programme, postcode, mobile phone, holiday, petrol, motorway, lift, queue, car park, takeaway, bill, pavement and rubbish. Avoid American forms such as color, favorite, organize, center, zip code, cell phone, vacation, gas, freeway, elevator, line, parking lot, takeout, check, sidewalk, trash, gotten, “you guys” and casual “awesome”. Use day–month–year dates, Celsius for weather, and UK road conventions (miles and mph) where appropriate. Pronounce place names and ordinary terms naturally for a British speaker. Do not force slang, repeatedly say “sir”, or caricature the accent; remain contemporary and natural. Never imitate or claim to be any actor or fictional character. Never become theatrical, melodramatic, robotic or excessively formal. Never use markdown, headings, bullet symbols, or stage directions in spoken replies. Listen carefully, allow interruptions, and continue naturally from the conversation context. Never initiate a greeting or speak merely because the session connected. Wait for a clear user utterance. Ignore wake tones, startup audio and the phrase used to open the session; do not answer them as conversation content.

You have access to the same verified Sentinel agent used by desktop chat through the use_sentinel tool. You MUST use it whenever the user asks for current or personal information, a system or service check, diagnostics, weather, forecasts, nearby places, directions or routes, travel or aviation information, connected-device information, home control, cameras, files, source/project information, changing a page or setting, filling a form, ending the live session, or any action. Pass the user's complete request without weakening or paraphrasing important details. The live conversation persists while the user moves between Sentinel pages. After the tool returns, explain its verified result naturally. Never claim a check or action succeeded unless the tool result confirms it. If the user says to end, stop or close the conversation, call use_sentinel and then end cleanly. For ordinary greetings, casual conversation and general knowledge that does not require current information or an action, answer directly.`;

app.post(
  "/realtime/session",
  express.text({ type: ["application/sdp", "text/plain"], limit: "1mb" }),
  async (req, res) => {
    const apiKey = config.openAI.apiKey?.trim();
    const rawOfferSdp = typeof req.body === "string" ? req.body : "";
    const normalisedOfferSdp = rawOfferSdp.replace(/\r?\n/g, "\r\n");
    const offerSdp = normalisedOfferSdp.endsWith("\r\n") ? normalisedOfferSdp : `${normalisedOfferSdp}\r\n`;
    if (!apiKey) return res.status(409).json({ error: "OpenAI is not configured in Sentinel Setup Centre." });
    if (!offerSdp.trim()) return res.status(400).json({ error: "A WebRTC session offer is required." });
    if (!offerSdp.startsWith("v=0\r\n") || !offerSdp.includes("m=audio ")) {
      return res.status(400).json({ error: "Sentinel created an incomplete WebRTC voice offer. Please reconnect." });
    }

    try {
      const developerUnlocked = developerStatus(
        req.header("x-sentinel-developer-token"),
      ).unlocked || hasActiveDeveloperSession();
      const sessionInstructions = `${realtimeInstructions}\n\n${
        developerUnlocked
          ? "Developer Mode is unlocked for this exact live session. You have Codex-style developer access to Sentinel Personal's live source through use_sentinel. For every question about Sentinel's code, source, files, components, implementation, behaviour or project, call use_sentinel before answering. Never claim the source is unavailable or that no workspace is loaded. Give a concise spoken summary of the inspected evidence and relevant file names. You cannot reveal hidden chain-of-thought; offer a brief rationale instead and continue helping. Source changes remain proposal-only and require explicit approval."
          : "Developer Mode is locked for this live session. Do not inspect protected Sentinel source. Tell the user to unlock Developer Mode in Settings if source access is requested."
      }`;
      const sessionConfig = JSON.stringify({
        type: "realtime",
        model: "gpt-realtime-2.1",
        instructions: sessionInstructions,
        audio: {
          input: {
            noise_reduction: { type: "far_field" },
            transcription: {
              model: "gpt-4o-mini-transcribe",
              language: "en",
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.35,
              prefix_padding_ms: 500,
              silence_duration_ms: 900,
              create_response: false,
              interrupt_response: true,
            },
          },
          // Cedar provides Sentinel's lower, composed male presentation.
          // Keep this server-side so every Personal desktop live session uses
          // the same voice and the provider key remains private.
          output: { voice: "cedar" },
        },
        tools: [{
          type: "function",
          name: "use_sentinel",
          description: "Run a request through the verified Sentinel Personal desktop agent. Use for checks, live information, navigation, weather, connected services, files and actions.",
          parameters: {
            type: "object",
            properties: {
              request: { type: "string", description: "The user's complete request, including names, places and constraints." },
            },
            required: ["request"],
            additionalProperties: false,
          },
        }],
        tool_choice: "auto",
      });
      // The Realtime calls endpoint expects both values as ordinary multipart
      // form fields. Supplying SDP as a file/blob makes some multipart parsers
      // expose an empty field value, which OpenAI then reports as an SDP EOF.
      const form = new FormData();
      form.set("sdp", offerSdp);
      form.set("session", sessionConfig);

      console.info(
        `[Realtime] Forwarding validated SDP offer (${Buffer.byteLength(offerSdp, "utf8")} bytes, ${offerSdp.split("\r\n").length - 1} lines).`,
      );

      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Safety-Identifier": "sentinel-personal-desktop",
        },
        body: form,
      });
      const responseBody = await response.text();
      if (!response.ok) {
        let message = "Sentinel could not create the realtime voice session.";
        try {
          const parsed = JSON.parse(responseBody) as { error?: { message?: string } | string };
          message = typeof parsed.error === "string" ? parsed.error : parsed.error?.message ?? message;
        } catch { /* Upstream may return plain text. */ }
        return res.status(response.status).json({ error: message });
      }
      if (!responseBody.trim().startsWith("v=0")) {
        console.error("Realtime session returned a non-SDP response.");
        return res.status(502).json({ error: "The realtime voice service returned an invalid session answer." });
      }
      return res.type("application/sdp").send(responseBody);
    } catch (error) {
      console.error("Realtime session error:", error);
      return res.status(502).json({ error: "The realtime voice service is temporarily unavailable." });
    }
  },
);

// Files are base64 encoded in JSON, so a 100 MB local transfer needs roughly
// 134 MB on the wire. Keep a small allowance for metadata.
app.use(express.json({ limit: "140mb" }));

app.post("/windows/control/plan", requireDeveloperMode, async (req, res) => {
  const request = String(req.body?.request ?? "").trim();
  if (!request) return res.status(400).json({ error: "Describe the Windows check or change you want Sentinel to prepare." });
  try {
    return res.json(await createWindowsControlPlan(request));
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Windows diagnostics failed." });
  }
});

app.post("/windows/control/:id/approve", requireDeveloperMode, async (req, res) => {
  const password = String(req.body?.password ?? "");
  if (!verifyDeveloperPassword(password)) return res.status(403).json({ error: "Developer password is incorrect." });
  try {
    return res.json(await approveWindowsControlPlan(String(req.params.id), String(req.body?.confirmation ?? "")));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "The Windows proposal could not be applied." });
  }
});

type SentinelUiAction =
  | { type: "open_page"; page: string; missionSection?: string }
  | { type: "open_camera"; deviceId: string; deviceName: string }
  | { type: "show_generated_image"; page: "chat"; imageUrl: string; prompt: string };

async function tryConnectedDeviceCommand(request: string): Promise<{ reply: string; action?: SentinelUiAction } | null> {
  const normalised = request.toLocaleLowerCase("en-GB");
  const cameraRequest = /\b(camera|cameras|doorbell|doorbells|ring|security feed)\b/.test(normalised);
  const powerRequest = /\b(turn|switch|power)\s+(on|off)\b/.test(normalised);
  const lightAppearanceRequest = /\b(?:set|make|change)\b.*\b(?:colour|color|brightness|warm|cosy|cool|daylight|red|orange|yellow|green|blue|purple|pink|white|cyan|teal|percent|%)\b/.test(normalised);
  if (cameraRequest) {
    const cameras = await getRingDevices();
    if (!cameras.length) return { reply: "No Ring cameras are currently available in Sentinel.", action: { type: "open_page", page: "automation" } };
    const requestedName = normalised.replace(/\b(show|open|view|watch|live|check|camera|cameras|doorbell|doorbells|ring|security|feed|the|my|please|turn|switch|power|on|off|light|siren)\b/g, " ").replace(/\s+/g, " ").trim();
    const selected = cameras.find((camera) => requestedName && (camera.name.toLowerCase().includes(requestedName) || requestedName.includes(camera.name.toLowerCase()))) ?? cameras.find((camera) => /front door/.test(normalised) && /front|door/.test(camera.name.toLowerCase())) ?? cameras[0];
    const desiredOn = /\b(on|enable|start|activate)\b/.test(normalised);
    const desiredOff = /\b(off|disable|stop|deactivate)\b/.test(normalised);
    if (/\bsiren\b/.test(normalised) && (desiredOn || desiredOff)) {
      if (desiredOn && !/\b(confirm|confirmed|emergency)\b/.test(normalised)) return { reply: `For safety, say “confirm turn on ${selected.name} siren” before I activate it.` };
      await setRingCameraSiren(selected.id, desiredOn);
      return { reply: `${selected.name} siren has been turned ${desiredOn ? "on" : "off"}.` };
    }
    if (/\blight\b/.test(normalised) && (desiredOn || desiredOff)) {
      await setRingCameraLight(selected.id, desiredOn);
      return { reply: `${selected.name} light has been turned ${desiredOn ? "on" : "off"}.` };
    }
    if (/\b(show|open|view|watch|live)\b/.test(normalised)) return { reply: `${selected.name} is ${selected.online ? "online" : "offline"}. ${selected.online ? "Opening its live-view controls." : "Live view cannot start while it is offline."}`, action: selected.online ? { type: "open_camera", deviceId: selected.id, deviceName: selected.name } : { type: "open_page", page: "automation" } };
    const events = /\b(event|events|motion|activity|alert|alerts|recent)\b/.test(normalised) ? await getRingEvents() : [];
    const summary = cameras.map((camera) => `${camera.name} is ${camera.online ? "online" : "offline"}${camera.battery === null ? "" : ` with ${camera.battery}% battery`}`).join("; ");
    const activity = events.length ? ` Recent activity: ${events.slice(0, 4).map((event) => `${event.kind} at ${event.deviceName}`).join("; ")}.` : "";
    return { reply: `Camera check complete. ${summary}.${activity}` };
  }
  if (!(powerRequest || /\b(light|lights|lamp|lamps|plug|plugs|smart device|smart devices|home devices|hue|govee)\b/.test(normalised))) return null;
  if (powerRequest || lightAppearanceRequest) {
    if (!/\b(confirm|confirmed|permission granted|yes do it)\b/.test(normalised)) {
      return { reply: `That will change a connected device. Please confirm by saying “confirm, ${request}”.` };
    }
    try {
      const result = await applySpokenAutomationCommand(request);
      const setting = result.colour ? `set to ${result.colour}` : result.brightness ? `set to ${result.brightness}% brightness` : result.colourTemperature ? "set to the requested white temperature" : `turned ${result.on ? "on" : "off"}`;
      return { reply: `${result.devices.join(", ")} ${result.devices.length === 1 ? "has" : "have"} been ${setting}.` };
    } catch (builtInError) {
      const modules = (await listModules()).filter((module) => !module.builtIn && module.installed && module.enabled && (module.category === "home" || module.category === "security"));
      const desiredOn = /\b(turn|switch|power)\s+on\b/.test(normalised);
      for (const module of modules) {
        const devices = await discoverCustomDevices(module.id).catch(() => []);
        const device = devices.find((item) => normalised.includes(item.name.toLowerCase()));
        const command = module.commands?.find((item) => new RegExp(`\\b${desiredOn ? "on|enable|start" : "off|disable|stop"}\\b`, "i").test(`${item.id} ${item.name}`));
        if (device && command) {
          await executeCustomCommand(module.id, command.id, device.id, desiredOn);
          return { reply: `${device.name} has been turned ${desiredOn ? "on" : "off"} through ${module.name}.` };
        }
      }
      throw builtInError;
    }
  }
  const [hue, govee, modules] = await Promise.all([getHueLights().catch(() => []), getGoveeDevices().catch(() => []), listModules()]);
  const custom = modules.filter((module) => !module.builtIn && module.installed && module.enabled && (module.category === "home" || module.category === "security"));
  const customDevices = (await Promise.all(custom.map(async (module) => ({ module: module.name, devices: await discoverCustomDevices(module.id).catch(() => []) })))).flatMap((entry) => entry.devices.map((device) => `${device.name} (${entry.module})`));
  const summary = [...hue.map((item) => `${item.name}: ${item.on ? "on" : "off"}`), ...govee.map((item) => `${item.name}: available`), ...customDevices];
  return { reply: summary.length ? `Connected smart technology: ${summary.join("; ")}.` : "No controllable smart-home devices are currently available.", action: { type: "open_page", page: "automation" } };
}

app.post("/realtime/tool", async (req, res) => {
  const request = String(req.body?.request ?? "").trim();
  const currentPage = String(req.body?.page ?? "").trim();
  if (!request) return res.status(400).json({ error: "A Sentinel request is required." });
  try {
    const normalised = request.toLowerCase();
    if (/\b(end|stop|close|finish)\s+(?:the\s+)?(?:voice\s+|live\s+)?(?:chat|conversation|session|call)\b|\bgoodbye sentinel\b|\bhey sentinel shutdown\b/i.test(request)) {
      return res.json({ ok: true, reply: "Of course. Ending our live conversation now.", action: { type: "end_realtime" } });
    }
    if (/\bhey sentinel (?:unlock|open) developer mode(?: permission granted)?\b|\bunlock developer mode\b/i.test(request)) {
      return res.json({ ok: true, reply: "Developer Mode requires operator authentication. I have opened the secure password prompt for you.", action: { type: "developer_unlock", page: "settings" } });
    }
    if (/\bhey sentinel lock developer mode\b|\block developer mode\b/i.test(request)) {
      return res.json({ ok: true, reply: "Developer Mode is being locked now.", action: { type: "developer_lock" } });
    }

    const imageRequest = request.match(/\b(?:generate|create|make|draw|design)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|illustration|artwork|poster)\s+(?:of|showing|for)?\s*(.+)/i);
    if (imageRequest) {
      const prompt = imageRequest[1]?.trim() || request;
      const generated = await generateSentinelImage(prompt);
      return res.json({
        ok: true,
        reply: "Your image is ready. I have opened it in Chat, where you can view or save it.",
        action: { type: "show_generated_image", page: "chat", imageUrl: generated.url, prompt: generated.revisedPrompt },
      });
    }

    const requestedTheme = [
      ["emerald", /\b(?:emerald|green)\b/], ["amber", /\b(?:amber|gold|orange)\b/],
      ["purple", /\bpurple\b/], ["crimson", /\b(?:crimson|red)\b/],
      ["ice", /\b(?:ice|white|arctic)\b/], ["teal", /\bteal\b/],
      ["magenta", /\b(?:magenta|pink)\b/], ["indigo", /\bindigo\b/],
      ["blue", /\b(?:sentinel blue|blue|default colour|default color)\b/],
    ].find(([, pattern]) => (pattern as RegExp).test(normalised))?.[0] as string | undefined;
    if (requestedTheme && /\b(?:change|set|make|switch|use)\b.*\b(?:colour|color|theme|sentinel)\b|\b(?:colour|color|theme)\b.*\b(?:change|set|make|switch|use)\b/i.test(request)) {
      return res.json({ ok: true, reply: `Sentinel's interface colour is now ${requestedTheme}.`, action: { type: "set_theme", theme: requestedTheme } });
    }

    const wantsFlightForm = /\b(?:add|create|save|enter|new)\b.*\bflight\b|\bflight\b.*\b(?:add|create|save|enter|new)\b/i.test(request);
    if (wantsFlightForm) {
      const flightNumber = request.match(/\b([A-Z]{2,3})\s?(\d{1,4}[A-Z]?)\b/i);
      const departure = request.match(/\bfrom\s+([A-Z]{3})\b/i)?.[1]?.toUpperCase();
      const arrival = request.match(/\bto\s+([A-Z]{3})\b/i)?.[1]?.toUpperCase();
      return res.json({
        ok: true,
        reply: `Opening Travel and preparing a new flight${flightNumber ? ` for ${flightNumber[1].toUpperCase()}${flightNumber[2].toUpperCase()}` : ""}. Please confirm any missing booking details before saving.`,
        action: { type: "prefill_travel", page: "travel", flightNumber: flightNumber ? `${flightNumber[1].toUpperCase()}${flightNumber[2].toUpperCase()}` : undefined, departure, arrival },
      });
    }

    const wantsDestinationForm = /\b(?:add|create|plan|save|enter|new)\b.*\b(?:trip|destination|holiday)\b|\b(?:trip|destination|holiday)\b.*\b(?:add|create|plan|save|enter|new)\b/i.test(request);
    if (wantsDestinationForm) {
      const destination = request.match(/\b(?:to|for)\s+([A-Za-z][A-Za-z .'-]{1,60}?)(?=\s+(?:from|on|departing|leaving|between|next|this)\b|[,.!?]|$)/i)?.[1]?.trim();
      return res.json({ ok: true, reply: `Opening Travel${destination ? ` and entering ${destination}` : " ready for a new destination"}. Please confirm the dates before saving.`, action: { type: "prefill_travel", page: "travel", destination } });
    }
    const windowsControlRequest = /\b(?:windows|this pc|computer|operating system|taskbar|explorer|microsoft store|dns)\b.*\b(?:check|diagnos|repair|fix|control|change|maintain|maintenance|restart|reset)|\b(?:check|diagnos|repair|fix|control|change|maintain|maintenance|restart|reset)\b.*\b(?:windows|this pc|computer|operating system|taskbar|explorer|microsoft store|dns)\b/i.test(request);
    if (windowsControlRequest) {
      const developerUnlocked = developerStatus(
        req.header("x-sentinel-developer-token"),
      ).unlocked || hasActiveDeveloperSession();
      if (!developerUnlocked) {
        return res.status(403).json({ ok: false, error: "Developer Mode is locked. Unlock it before using Windows Control." });
      }
      const plan = await createWindowsControlPlan(request);
      const d = plan.diagnostics;
      const diagnostics = `Windows check complete. Memory use is ${d.memory.usedPercent} percent, the system drive has ${d.systemDrive.freePercent} percent free, internet connectivity is ${d.network.internetReachable ? "available" : "not confirmed"}, and ${d.pendingRestart ? "a restart is pending" : "no pending restart was detected"}.`;
      const proposal = plan.actions.length
        ? ` I prepared ${plan.actions.length} approved-list ${plan.actions.length === 1 ? "change" : "changes"}: ${plan.actions.map((action) => action.label).join(", ")}. For safety, approve proposal ${plan.id} in text chat; I will not execute it from voice alone.`
        : " No Windows changes were inferred, so this was a read-only diagnostic check.";
      return res.json({ ok: true, reply: `${diagnostics}${proposal}` });
    }
    const sourceRequest = /\b(codex|source|source code|codebase|repository|repo|project files?|implementation|component|function|class|typescript|tsx|css|backend|frontend|developer mode)\b/i.test(request);
    if (sourceRequest) {
      const developerUnlocked = developerStatus(
        req.header("x-sentinel-developer-token"),
      ).unlocked || hasActiveDeveloperSession();
      if (!developerUnlocked) {
        return res.status(403).json({
          ok: false,
          error: "Developer Mode is locked. Unlock it in Settings before asking live voice to inspect Sentinel source.",
        });
      }
      const developerReply = await handleDeveloperSourceRequest(request);
      if (developerReply) return res.json({ ok: true, reply: developerReply });
    }
    const connectedDeviceResult = await tryConnectedDeviceCommand(request);
    if (connectedDeviceResult) return res.json({ ok: true, ...connectedDeviceResult });
    const wantsLiveCamera = /\b(show|open|view|watch|live)\b/.test(normalised) && /\b(camera|doorbell|front door|ring)\b/.test(normalised);
    const asksAboutCameras = /\b(camera|cameras|doorbell|doorbells|ring)\b/.test(normalised);
    if (asksAboutCameras) {
      const cameras = await getRingDevices();
      const events = /\b(event|events|motion|activity|alert|alerts|recent)\b/.test(normalised)
        ? await getRingEvents()
        : [];
      if (!cameras.length) return res.json({ ok: true, reply: "No Ring cameras are currently available in Sentinel." });
      const requestedName = normalised.replace(/\b(show|open|view|watch|live|check|camera|cameras|doorbell|doorbells|ring|the|my|please)\b/g, " ").replace(/\s+/g, " ").trim();
      const selected = cameras.find((camera) => requestedName && camera.name.toLowerCase().includes(requestedName))
        ?? cameras.find((camera) => /front door/.test(normalised) && /front|door/.test(camera.name.toLowerCase()))
        ?? cameras[0];
      const cameraSummary = cameras.map((camera) => `${camera.name}: ${camera.online ? "online" : "offline"}${camera.battery === null ? "" : `, battery ${camera.battery}%`}`).join("; ");
      const eventSummary = events.length
        ? ` Recent activity: ${events.slice(0, 4).map((event) => `${event.kind} at ${event.deviceName}, ${new Date(event.occurredAt).toLocaleString("en-GB")}`).join("; ")}.`
        : "";
      return res.json({
        ok: true,
        reply: wantsLiveCamera
          ? `${selected.name} is ${selected.online ? "online" : "offline"}. ${selected.online ? "I am opening Mission Control Security and its live-view controls now." : "I cannot open live view while it is offline."}`
          : `Security camera check complete. ${cameraSummary}.${eventSummary}`,
        action: wantsLiveCamera && selected.online ? { type: "open_camera", deviceId: selected.id, deviceName: selected.name } : undefined,
      });
    }

    if (/\b(weather|forecast|temperature|rain|radar)\b/.test(normalised)) {
      await refreshWorld();
      const world = getCurrentWorld();
      const current = world.weather.current;
      const wantsWeekly = /\b(week|weekly|seven day|7 day|next few days|daily forecast)\b/.test(normalised);
      const weekly = world.weather.daily.slice(0, 7).map((day) => {
        const date = new Date(`${day.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
        return `${date}: ${day.condition}, high ${Math.round(day.maxTemp)} degrees, low ${Math.round(day.minTemp)} degrees, ${Math.round(day.chanceOfRain)} percent chance of rain`;
      });
      const reply = wantsWeekly && weekly.length
        ? `Seven-day forecast for ${world.location.city || "your current location"}. ${weekly.join(". ")}.`
        : `Weather service checked for ${world.location.city || "your current location"}. It is ${Math.round(current.temperature)} degrees with ${current.condition}, feels like ${Math.round(current.feelsLike)} degrees, humidity ${Math.round(current.humidity)} percent and wind ${Math.round(current.windSpeed)} kilometres per hour.`;
      return res.json({ ok: true, reply, action: /\b(open|show|radar|page)\b/.test(normalised) ? { type: "open_page", page: "weather" } : undefined });
    }

    if (/\b(direction|directions|route|navigate|navigation|nearest|nearby|find a|find the)\b/.test(normalised)) {
      const provider = new GoogleMapsProvider();
      const results = await provider.search(request.replace(/\b(give me|show me|directions?|route|navigate|navigation|please)\b/gi, " ").replace(/\s+/g, " ").trim());
      const places = Array.isArray(results) ? results.slice(0, 3) : [];
      const summary = places.length
        ? places.map((place: any) => `${place.name || place.displayName || "Result"}, ${place.address || place.formattedAddress || "address available in Navigation"}`).join("; ")
        : "No matching destination was found.";
      return res.json({ ok: true, reply: `Navigation search complete. ${summary}`, action: { type: "open_page", page: "navigation" } });
    }

    if (/\b(system check|diagnostic|diagnostics|health check|check sentinel|check the system|system status)\b/.test(normalised)) {
      await refreshDevice();
      const device = getDeviceState();
      const brain = getBrainHealth();
      const integrations = await getAutomationIntegrations();
      const connected = integrations.filter((item) => item.connected).map((item) => item.name);
      return res.json({
        ok: true,
        reply: `System check complete. CPU usage is ${Math.round(device.cpu.usage)} percent. Memory use is ${Math.round(device.memory.used)} of ${Math.round(device.memory.total)} megabytes. Network is ${device.network.connected ? "connected" : "offline"}. The conversation engine has completed ${brain.successes} successful requests with ${brain.failures} failures. Connected services: ${connected.join(", ") || "none"}.`,
        action: /\b(open|show|page|details)\b/.test(normalised) ? { type: "open_page", page: "system" } : undefined,
      });
    }

    const pageAliases: Array<[string, string[]]> = [
      ["automation", ["mission control", "security control", "security", "automation", "home command", "home control", "routines", "routine"]],
      ["home", ["home"]], ["chat", ["chat"]], ["design", ["design", "cnc", "3d print", "audio design"]],
      ["concierge", ["concierge", "order food", "order pizza", "pizza"]],
      ["scanner", ["device scanner", "network centre", "scanner"]], ["media", ["media", "media control", "audio", "audio control", "ai dj", "dj"]],
      ["navigation", ["navigation", "map"]], ["notifications", ["notifications", "alerts"]],
      ["settings", ["settings", "setup centre"]],
      ["system", ["system", "system vitals"]], ["travel", ["travel", "flight tracker"]], ["weather", ["weather"]],
    ];
    if (/\b(open|show|go to|take me to|move to|switch to|change to|head to|bring up|display)\b/.test(normalised)) {
      const page = pageAliases.find(([, aliases]) => aliases.some((alias) => normalised.includes(alias)))?.[0];
      if (page) {
        const missionSection = page === "automation" ? (normalised.includes("home command") || normalised.includes("home control") ? "home" : normalised.includes("routine") ? "routines" : normalised.includes("security") ? "security" : normalised.includes("automation") ? "automation" : "mission") : undefined;
        const missionLabel = missionSection === "home" ? "Home Command" : missionSection === "routines" ? "Mission Control Routines" : missionSection === "mission" ? "Mission Control" : `Mission Control ${missionSection}`;
        return res.json({ ok: true, reply: `Opening ${page === "automation" ? missionLabel : page}.`, action: { type: "open_page", page, missionSection } });
      }
    }

    const result = await runAgent({ source: "chat", message: currentPage ? `[Current Sentinel page: ${currentPage}] ${request}` : request });
    return res.json({ ok: true, reply: result.reply });
  } catch (error) {
    console.error("Realtime Sentinel tool failed:", error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Sentinel could not complete that request.",
    });
  }
});

const SETUP_ALLOWED_KEYS = [
  "SENTINEL_USER_NAME",
  "OPENAI_API_KEY",
  "GOOGLE_MAPS_API_KEY",
  "WEATHER_API_KEY",
  "FLYSTACK_API_KEY",
  "OPENSKY_CLIENT_ID",
  "OPENSKY_CLIENT_SECRET",
  "GOVEE_API_KEY",
  "HUE_BRIDGE_URL",
  "HUE_APPLICATION_KEY",
  "RING_REFRESH_TOKEN",
  "SENTINEL_RELAY_URL",
  "SENTINEL_RELAY_SHARED_SECRET",
  "SENTINEL_DEVELOPER_PASSWORD_HASH",
] as const;

function currentSetupPath() {
  return path.join(process.cwd(), ".env");
}

function quoteEnvironmentValue(value: string) {
  return JSON.stringify(value.replace(/[\r\n]/g, ""));
}

app.get("/setup/status", (_req, res) => {
  const edition = process.env.SENTINEL_EDITION ?? "personal";
  res.json({
    edition,
    configured:
      Boolean(process.env.SENTINEL_USER_NAME) &&
      (edition !== "base" ||
        Boolean(process.env.SENTINEL_DEVELOPER_PASSWORD_HASH)),
    name: process.env.SENTINEL_USER_NAME ?? "",
  });
});

app.post("/setup/configuration", (req, res) => {
  const input = req.body as Record<string, unknown>;
  const edition = process.env.SENTINEL_EDITION ?? "personal";
  if (typeof input.edition === "string" && input.edition !== edition) {
    return res.status(409).json({
      error: `This setup request is for ${input.edition}, but the connected service is ${edition}.`,
    });
  }
  if (edition === "base" && input.edition !== "base") {
    return res
      .status(409)
      .json({ error: "Base setup requires a verified Base client." });
  }
  if (edition === "base" && !process.env.SENTINEL_DEVELOPER_PASSWORD_HASH) {
    const developerPassword =
      typeof input.developerPassword === "string"
        ? input.developerPassword
        : "";
    const confirmation =
      typeof input.developerPasswordConfirmation === "string"
        ? input.developerPasswordConfirmation
        : "";
    if (developerPassword !== confirmation)
      return res
        .status(400)
        .json({ error: "Developer passwords do not match." });
    try {
      input.SENTINEL_DEVELOPER_PASSWORD_HASH =
        hashDeveloperPassword(developerPassword);
    } catch (error) {
      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Developer password is invalid.",
      });
    }
  }
  const lines: string[] = ["# Sentinel Base — owner configuration"];
  for (const key of SETUP_ALLOWED_KEYS) {
    const value =
      typeof input[key] === "string" && String(input[key]).trim()
        ? input[key]
        : process.env[key];
    if (typeof value === "string" && value.trim()) {
      const cleanValue = value.trim();
      lines.push(`${key}=${quoteEnvironmentValue(cleanValue)}`);
      process.env[key] = cleanValue;
    }
  }

  if (!lines.some((line) => line.startsWith("SENTINEL_USER_NAME="))) {
    return res.status(400).json({ error: "Your name is required." });
  }

  writeFileSync(currentSetupPath(), `${lines.join("\n")}\n`, "utf8");
  res.json({ saved: true, restartRequired: true });
});

app.post("/setup/factory-reset", (req, res) => {
  if ((process.env.SENTINEL_EDITION ?? "personal") !== "base") {
    return res
      .status(403)
      .json({ error: "Factory reset is available only in Sentinel Base." });
  }
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  if (!verifyDeveloperPassword(password)) {
    return res.status(403).json({ error: "Developer password is incorrect." });
  }
  if (req.body?.confirmation !== "REFRESH SENTINEL") {
    return res
      .status(400)
      .json({ error: "Factory reset confirmation is required." });
  }

  const dataDirectory = process.env.SENTINEL_DATA_DIR ?? process.cwd();
  const targets = [
    currentSetupPath(),
    path.join(dataDirectory, "automation.json"),
    path.join(dataDirectory, "integration-modules.json"),
  ];
  for (const target of targets) {
    if (existsSync(target)) unlinkSync(target);
  }
  for (const key of SETUP_ALLOWED_KEYS) delete process.env[key];
  delete process.env.SENTINEL_DEVELOPER_PASSWORD;
  clearDeveloperSessions();
  res.json({ reset: true, restartRequired: true });
});

app.get("/setup/centre", async (_req, res) => {
  const modules = await listModules();
  const connections = await getAutomationIntegrations();
  res.json({
    edition: process.env.SENTINEL_EDITION ?? "personal",
    configuration: {
      core: "local-environment",
      integrations: "encrypted-local-store",
      mobileServices: "device-scoped-worker-access",
      secretsExposedToClients: false,
    },
    modules: modules.map((module) => ({
      ...module,
      configured:
        module.configured ||
        Boolean(connections.find((item) => item.id === module.id)?.connected),
    })),
    core: {
      owner: process.env.SENTINEL_USER_NAME ?? "",
      openAI: Boolean(process.env.OPENAI_API_KEY),
      maps: Boolean(process.env.GOOGLE_MAPS_API_KEY),
      weather: Boolean(process.env.WEATHER_API_KEY),
      aviation: Boolean(process.env.FLYSTACK_API_KEY),
      openSky: Boolean(
        process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET,
      ),
      relay: Boolean(
        process.env.SENTINEL_RELAY_URL &&
          process.env.SENTINEL_RELAY_SHARED_SECRET,
      ),
      govee: Boolean(process.env.GOVEE_API_KEY),
    },
  });
});
app.post("/setup/modules/:id/state", async (req, res) => {
  try {
    res.json(
      await setModuleState(
        req.params.id,
        Boolean(req.body?.installed),
        Boolean(req.body?.enabled),
      ),
    );
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Unable to update module.",
    });
  }
});
app.delete("/setup/modules/:id", async (req, res) => {
  try {
    res.json(await removeModule(req.params.id));
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Unable to remove module.",
    });
  }
});
app.post("/setup/modules/custom", async (req, res) => {
  try {
    res.json(await saveCustomModule(req.body));
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Unable to create module.",
    });
  }
});
app.post("/setup/modules/:id/test", async (req, res) => {
  try {
    res.json(await testCustomModule(req.params.id));
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Connection test failed.",
    });
  }
});
app.get("/setup/modules/:id/devices", async (req, res) => {
  try {
    res.json(await discoverCustomDevices(req.params.id));
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Device discovery failed.",
    });
  }
});
app.post("/setup/modules/:id/commands/:commandId", async (req, res) => {
  try {
    res.json(
      await executeCustomCommand(
        req.params.id,
        req.params.commandId,
        String(req.body?.deviceId ?? ""),
        req.body?.value,
      ),
    );
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Command failed.",
    });
  }
});

/* ==========================================================
   Sentinel Initialisation
========================================================== */

async function initialiseSentinel() {
  console.log("");

  console.log("======================================================");
  console.log("🚀 Initialising Sentinel");
  console.log("======================================================");

  loadCapabilities();

  console.log("🧩 Capabilities Loaded");

  await initialiseWorld();

  console.log("🌍 World Engine Online");

  await initialiseDevice();

  console.log("💻 Device Engine Online");

  console.log("🧠 Brain Online");

  console.log("======================================================");

  console.log("");
}

/* ==========================================================
   Root
========================================================== */

app.get("/", (_, res) => {
  res.send("🛡 Sentinel AI Operating System");
});

/* ==========================================================
   Health
========================================================== */

app.get("/brain/health", (_, res) => {
  res.json(getBrainHealth());
});

/* ==========================================================
   World State
========================================================== */

app.get("/world", (_, res) => {
  res.json(getCurrentWorld());
});

/* ==========================================================
   Device State
========================================================== */

app.get("/device", (_, res) => {
  res.json(getDeviceState());
});

type DiagnosticStatus = "pass" | "warn" | "fail";
type DiagnosticCheck = {
  id: string;
  label: string;
  status: DiagnosticStatus;
  detail: string;
  action?: string;
  latencyMs?: number;
  repair?: "refresh-device" | "refresh-world";
};

async function checkOpenAI(): Promise<DiagnosticCheck> {
  const started = Date.now();
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${config.openAI.apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - started;
    if (response.ok)
      return {
        id: "ai",
        label: "AI connection",
        status: "pass",
        detail: "OpenAI authentication and network access are working",
        latencyMs,
      };
    if (response.status === 401)
      return {
        id: "ai",
        label: "AI connection",
        status: "fail",
        detail: "The OpenAI key was rejected",
        action: "Replace OPENAI_API_KEY in Sentinel configuration",
        latencyMs,
      };
    if (response.status === 429)
      return {
        id: "ai",
        label: "AI connection",
        status: "warn",
        detail: "OpenAI is reachable but the account is currently rate limited",
        action: "Check account limits and try again shortly",
        latencyMs,
      };
    return {
      id: "ai",
      label: "AI connection",
      status: "warn",
      detail: `OpenAI returned status ${response.status}`,
      action: "Check the internet connection and OpenAI service status",
      latencyMs,
    };
  } catch {
    return {
      id: "ai",
      label: "AI connection",
      status: "fail",
      detail: "OpenAI could not be reached within 5 seconds",
      action: "Check internet access, firewall settings, and the API key",
      latencyMs: Date.now() - started,
    };
  }
}

app.get("/system/diagnostics", async (_, res) => {
  const started = Date.now();
  const device = getDeviceState();
  const world = getCurrentWorld();
  const brain = getBrainHealth();
  const storage = device.storage.reduce(
    (lowest, drive) =>
      !lowest ||
      drive.free / Math.max(1, drive.total) <
        lowest.free / Math.max(1, lowest.total)
        ? drive
        : lowest,
    device.storage[0],
  );
  const storageFreePercent = storage
    ? Math.round((storage.free / Math.max(1, storage.total)) * 100)
    : null;
  const locationReady = Object.keys(world.location ?? {}).length > 0;
  const checks: DiagnosticCheck[] = [
    {
      id: "backend",
      label: "Sentinel backend",
      status: "pass",
      detail: `Responding normally · uptime ${Math.max(1, Math.floor(process.uptime() / 60))} min`,
    },
    await checkOpenAI(),
    {
      id: "device",
      label: "Device telemetry",
      status: device.cpu.cores > 0 && device.memory.total > 0 ? "pass" : "fail",
      detail:
        device.cpu.cores > 0
          ? `${device.cpu.cores} CPU cores and live memory telemetry detected`
          : "Hardware telemetry did not initialise",
      action:
        device.cpu.cores > 0
          ? undefined
          : "Restart Sentinel; if this persists, check the local backend logs",
      repair: device.cpu.cores > 0 ? undefined : "refresh-device",
    },
    {
      id: "network",
      label: "Network",
      status: device.network.connected ? "pass" : "fail",
      detail: device.network.connected
        ? `Connected via ${device.network.interface || "an active interface"}`
        : "Sentinel reports no active network",
      action: device.network.connected
        ? undefined
        : "Reconnect Windows to the network, then run diagnosis again",
    },
    {
      id: "storage",
      label: "Storage capacity",
      status:
        storageFreePercent === null
          ? "warn"
          : storageFreePercent < 5
            ? "fail"
            : storageFreePercent < 15
              ? "warn"
              : "pass",
      detail:
        storageFreePercent === null
          ? "Storage telemetry is unavailable"
          : `${storageFreePercent}% free on the fullest monitored drive`,
      action:
        storageFreePercent !== null && storageFreePercent < 15
          ? "Free disk space to prevent updates and local memory from failing"
          : undefined,
    },
    {
      id: "context",
      label: "Location and world context",
      status: locationReady ? "pass" : "warn",
      detail: locationReady
        ? "Location context is available for weather and navigation"
        : "A live location has not been established",
      action: locationReady
        ? undefined
        : "Use Location access in Settings and allow access in Windows privacy settings",
      repair: locationReady ? undefined : "refresh-world",
    },
    {
      id: "brain",
      label: "Conversation engine",
      status:
        brain.lastError && brain.failures > brain.successes ? "warn" : "pass",
      detail:
        brain.requests === 0
          ? "Ready; no chat requests have been made this session"
          : `${brain.successes} successful and ${brain.failures} failed requests this session`,
      action:
        brain.lastError && brain.failures > brain.successes
          ? `Last error: ${brain.lastError}`
          : undefined,
    },
  ];
  res.json({
    status: checks.some((check) => check.status === "fail")
      ? "attention"
      : checks.some((check) => check.status === "warn")
        ? "warning"
        : "healthy",
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    summary: {
      passed: checks.filter((check) => check.status === "pass").length,
      warnings: checks.filter((check) => check.status === "warn").length,
      failed: checks.filter((check) => check.status === "fail").length,
    },
    checks,
  });
});

app.post("/system/repair", async (req, res) => {
  const action = req.body?.action as DiagnosticCheck["repair"];
  try {
    if (action === "refresh-device") await refreshDevice();
    else if (action === "refresh-world") await refreshWorld();
    else
      return res
        .status(400)
        .json({ error: "That repair is not allow-listed." });
    res.json({ repaired: true, action, completedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Repair failed.",
    });
  }
});

app.post(
  "/audio/transcribe",
  express.raw({ type: ["audio/*", "application/octet-stream"], limit: "20mb" }),
  async (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length < 800) {
        return res
          .status(400)
          .json({ error: "The microphone recording was too short to transcribe." });
      }
      const contentType =
        req.header("content-type")?.split(";")[0] || "audio/webm";
      if (!new Set(["audio/webm", "audio/ogg", "audio/mp4", "application/octet-stream"]).has(contentType)) {
        return res.status(415).json({ error: "That microphone recording format is not supported." });
      }
      const extension = contentType.includes("ogg")
        ? "ogg"
        : contentType.includes("mp4")
          ? "m4a"
          : "webm";
      const file = await toFile(req.body, `sentinel-recording.${extension}`, {
        type: contentType,
      });
      const transcription = await client.audio.transcriptions.create({
        file,
        model: "gpt-4o-mini-transcribe",
      });
      res.json({ text: transcription.text.trim() });
    } catch (error) {
      console.error("Voice transcription failed:", error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Voice transcription failed.",
      });
    }
  },
);

/* ==========================================================
   Automation Hub
========================================================== */

app.get("/automation/integrations", async (_, res) => {
  res.json(await getAutomationIntegrations());
});

app.get("/automation/amazon/devices", async (_req, res) => {
  try {
    res.json(await discoverAmazonDevices());
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Amazon device discovery failed.",
    });
  }
});
app.post("/automation/amazon/devices/:id/name", async (req, res) => {
  try {
    res.json(
      await renameAmazonDevice(
        String(req.params.id),
        String(req.body?.name ?? ""),
      ),
    );
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to rename Amazon device.",
    });
  }
});
app.delete("/automation/amazon/devices/:id", async (req, res) => {
  try {
    res.json(await forgetAmazonDevice(String(req.params.id)));
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to forget Alexa device.",
    });
  }
});

app.get("/automation/relay/status", (_, res) => {
  res.json(getRelayStatus());
});

app.post("/automation/relay/configure", async (req, res) => {
  const relayUrl = String(req.body?.relayUrl ?? "")
    .trim()
    .replace(/\/$/, "");
  const sharedSecret = String(req.body?.sharedSecret ?? "").trim();
  if (!/^https:\/\//i.test(relayUrl) || sharedSecret.length < 20)
    return res
      .status(400)
      .json({ error: "Enter a valid HTTPS relay URL and shared secret." });
  try {
    process.env.SENTINEL_RELAY_URL = relayUrl;
    process.env.SENTINEL_RELAY_SHARED_SECRET = sharedSecret;
    const existing = existsSync(currentSetupPath())
      ? readFileSync(currentSetupPath(), "utf8").split(/\r?\n/).filter(Boolean)
      : [];
    const retained = existing.filter(
      (line) =>
        !line.startsWith("SENTINEL_RELAY_URL=") &&
        !line.startsWith("SENTINEL_RELAY_SHARED_SECRET="),
    );
    retained.push(
      `SENTINEL_RELAY_URL=${quoteEnvironmentValue(relayUrl)}`,
      `SENTINEL_RELAY_SHARED_SECRET=${quoteEnvironmentValue(sharedSecret)}`,
    );
    writeFileSync(currentSetupPath(), `${retained.join("\n")}\n`, "utf8");
    res.json(await refreshRelayConnection());
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to connect to the Alexa relay.",
    });
  }
});

app.post("/automation/relay/create-installation", async (req, res) => {
  const relayUrl = String(req.body?.relayUrl ?? "")
    .trim()
    .replace(/\/$/, "");
  const ownerSecret = String(req.body?.ownerSecret ?? "").trim();
  const name = String(req.body?.name ?? "Sentinel Personal").trim();
  if (!/^https:\/\//i.test(relayUrl) || ownerSecret.length < 20)
    return res
      .status(400)
      .json({ error: "Enter the relay address and Cloudflare owner secret." });
  try {
    const response = await fetch(`${relayUrl}/installations/register`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ownerSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(8_000),
    });
    const result = (await response.json().catch(() => ({}))) as {
      installationId?: string;
      installationSecret?: string;
      pairingPhrase?: string;
      pairingExpiresIn?: number;
      error?: string;
    };
    if (!response.ok || !result.installationId || !result.installationSecret)
      throw new Error(result.error || `Relay returned ${response.status}.`);
    process.env.SENTINEL_RELAY_URL = relayUrl;
    process.env.SENTINEL_RELAY_SHARED_SECRET = result.installationSecret;
    process.env.SENTINEL_RELAY_INSTALLATION_ID = result.installationId;
    const existing = existsSync(currentSetupPath())
      ? readFileSync(currentSetupPath(), "utf8").split(/\r?\n/).filter(Boolean)
      : [];
    const retained = existing.filter(
      (line) =>
        !line.startsWith("SENTINEL_RELAY_URL=") &&
        !line.startsWith("SENTINEL_RELAY_SHARED_SECRET=") &&
        !line.startsWith("SENTINEL_RELAY_INSTALLATION_ID="),
    );
    retained.push(
      `SENTINEL_RELAY_URL=${quoteEnvironmentValue(relayUrl)}`,
      `SENTINEL_RELAY_SHARED_SECRET=${quoteEnvironmentValue(result.installationSecret)}`,
      `SENTINEL_RELAY_INSTALLATION_ID=${quoteEnvironmentValue(result.installationId)}`,
    );
    writeFileSync(currentSetupPath(), `${retained.join("\n")}\n`, "utf8");
    await refreshRelayConnection();
    res.json({
      installationId: result.installationId,
      pairingPhrase: result.pairingPhrase,
      pairingExpiresIn: result.pairingExpiresIn,
      connected: true,
    });
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to create isolated relay installation.",
    });
  }
});
app.post("/automation/relay/create-invite", async (req, res) => {
  const relayUrl = String(req.body?.relayUrl ?? "")
    .trim()
    .replace(/\/$/, "");
  const ownerSecret = String(req.body?.ownerSecret ?? "").trim();
  const name = String(req.body?.name ?? "Sentinel Base").trim();
  if (!/^https:\/\//i.test(relayUrl) || ownerSecret.length < 20)
    return res
      .status(400)
      .json({ error: "Enter the relay address and Cloudflare owner secret." });
  try {
    const response = await fetch(`${relayUrl}/installations/invite`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ownerSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(8_000),
    });
    const result = (await response.json()) as {
      inviteCode?: string;
      expiresIn?: number;
      error?: string;
    };
    if (!response.ok || !result.inviteCode)
      throw new Error(result.error || `Relay returned ${response.status}.`);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to create Base setup code.",
    });
  }
});

app.post(
  "/automation/relay/installations/list",
  requireDeveloperMode,
  async (req, res) => {
    const relayUrl = String(req.body?.relayUrl ?? "").trim().replace(/\/$/, "");
    const ownerSecret = String(req.body?.ownerSecret ?? "").trim();
    if (!/^https:\/\//i.test(relayUrl) || ownerSecret.length < 20)
      return res.status(400).json({ error: "Enter the relay address and Cloudflare owner secret." });
    try {
      const response = await fetch(`${relayUrl}/installations`, {
        headers: { Authorization: `Bearer ${ownerSecret}` },
        signal: AbortSignal.timeout(8_000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error((result as { error?: string }).error || `Relay returned ${response.status}.`);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to list relay installations." });
    }
  },
);

app.post(
  "/automation/relay/installations/:installationId/delete",
  requireDeveloperMode,
  async (req, res) => {
    const relayUrl = String(req.body?.relayUrl ?? "").trim().replace(/\/$/, "");
    const ownerSecret = String(req.body?.ownerSecret ?? "").trim();
    const installationId = String(req.params.installationId ?? "").trim();
    if (!/^https:\/\//i.test(relayUrl) || ownerSecret.length < 20 || !/^[0-9a-f-]{20,}$/i.test(installationId))
      return res.status(400).json({ error: "Invalid installation request." });
    try {
      const response = await fetch(`${relayUrl}/installations/${encodeURIComponent(installationId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerSecret}` },
        signal: AbortSignal.timeout(8_000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error((result as { error?: string }).error || `Relay returned ${response.status}.`);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to revoke installation." });
    }
  },
);

const MANAGED_SENTINEL_RELAY =
  "https://sentinel-relay.reganbelson.workers.dev";

app.post("/automation/relay/redeem-invite", async (req, res) => {
  const inviteCode = String(req.body?.inviteCode ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (inviteCode.length < 6)
    return res.status(400).json({ error: "Enter the complete Base setup code." });
  try {
    const response = await fetch(`${MANAGED_SENTINEL_RELAY}/installations/redeem`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inviteCode }),
      signal: AbortSignal.timeout(8_000),
    });
    const result = (await response.json().catch(() => ({}))) as {
      installationId?: string;
      installationSecret?: string;
      pairingPhrase?: string;
      pairingExpiresIn?: number;
      error?: string;
    };
    if (!response.ok || !result.installationId || !result.installationSecret)
      throw new Error(result.error || `Relay returned ${response.status}.`);

    process.env.SENTINEL_RELAY_URL = MANAGED_SENTINEL_RELAY;
    process.env.SENTINEL_RELAY_SHARED_SECRET = result.installationSecret;
    process.env.SENTINEL_RELAY_INSTALLATION_ID = result.installationId;
    const existing = existsSync(currentSetupPath())
      ? readFileSync(currentSetupPath(), "utf8").split(/\r?\n/).filter(Boolean)
      : [];
    const retained = existing.filter(
      (line) =>
        !line.startsWith("SENTINEL_RELAY_URL=") &&
        !line.startsWith("SENTINEL_RELAY_SHARED_SECRET=") &&
        !line.startsWith("SENTINEL_RELAY_INSTALLATION_ID="),
    );
    retained.push(
      `SENTINEL_RELAY_URL=${quoteEnvironmentValue(MANAGED_SENTINEL_RELAY)}`,
      `SENTINEL_RELAY_SHARED_SECRET=${quoteEnvironmentValue(result.installationSecret)}`,
      `SENTINEL_RELAY_INSTALLATION_ID=${quoteEnvironmentValue(result.installationId)}`,
    );
    writeFileSync(currentSetupPath(), `${retained.join("\n")}\n`, "utf8");
    await refreshRelayConnection();
    res.json({
      connected: true,
      installationId: result.installationId,
      pairingPhrase: result.pairingPhrase,
      pairingExpiresIn: result.pairingExpiresIn,
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unable to connect Base to the managed relay.",
    });
  }
});
app.post("/automation/relay/pairing", async (_req, res) => {
  const relayUrl = String(process.env.SENTINEL_RELAY_URL ?? "").replace(
    /\/$/,
    "",
  );
  const secret = String(process.env.SENTINEL_RELAY_SHARED_SECRET ?? "");
  const installationId = String(
    process.env.SENTINEL_RELAY_INSTALLATION_ID ?? "",
  );
  if (!relayUrl || !secret || !installationId)
    return res
      .status(400)
      .json({ error: "Create an isolated relay installation first." });
  try {
    const response = await fetch(`${relayUrl}/installations/pairing`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "X-Sentinel-Installation": installationId,
      },
      signal: AbortSignal.timeout(8_000),
    });
    const result = (await response.json()) as {
      pairingPhrase?: string;
      pairingExpiresIn?: number;
      error?: string;
    };
    if (!response.ok || !result.pairingPhrase)
      throw new Error(result.error || `Relay returned ${response.status}.`);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to create Alexa pairing phrase.",
    });
  }
});
app.post("/automation/relay/alexa-link-code", async (_req, res) => {
  const relayUrl = String(process.env.SENTINEL_RELAY_URL ?? "").replace(
    /\/$/,
    "",
  );
  const secret = String(process.env.SENTINEL_RELAY_SHARED_SECRET ?? "");
  const installationId = String(
    process.env.SENTINEL_RELAY_INSTALLATION_ID ?? "",
  );
  if (!relayUrl || !secret || !installationId)
    return res
      .status(400)
      .json({ error: "Create an isolated relay installation first." });
  try {
    const response = await fetch(`${relayUrl}/installations/alexa-link-code`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "X-Sentinel-Installation": installationId,
      },
      signal: AbortSignal.timeout(8_000),
    });
    const result = (await response.json()) as {
      linkCode?: string;
      expiresIn?: number;
      error?: string;
    };
    if (!response.ok || !result.linkCode)
      throw new Error(result.error || `Relay returned ${response.status}.`);
    res.json(result);
  } catch (error) {
    res
      .status(400)
      .json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Alexa linking code.",
      });
  }
});

app.use("/automation/companion", (_req, res, next) => {
  if ((process.env.SENTINEL_EDITION ?? "personal") !== "personal") {
    res.status(404).json({ error: "Companion Sync is available only in Sentinel Personal." });
    return;
  }
  next();
});

app.get("/automation/companion/status", async (_, res) => {
  res.json(await getCompanionStatus());
});

app.get("/automation/companion/service-access", (_, res) => {
  res.json(getCompanionServiceAccess());
});

app.get("/automation/companion/mobile-access", async (_, res) => {
  try { res.json(await getMobileAccessStatus()); }
  catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : "Unable to read mobile access." }); }
});

app.post("/automation/companion/mobile-access", async (req, res) => {
  try {
    const services = Array.isArray(req.body?.services) ? req.body.services : [];
    res.json(await provisionMobileAccess(services as MobileServiceId[]));
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unable to enable mobile access." }); }
});

app.delete("/automation/companion/mobile-access", async (_, res) => {
  try { res.json(await revokeMobileAccess()); }
  catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : "Unable to revoke mobile access." }); }
});

app.post("/automation/companion/enable", async (_, res) => {
  try {
    res.json(await enableCompanion());
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to enable the companion.",
    });
  }
});

app.post("/automation/companion/disable", async (_, res) => {
  try {
    res.json(await disableCompanion());
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to disable the companion.",
    });
  }
});

app.post("/automation/companion/pairing-code", async (_, res) => {
  try { res.json(await createCompanionPairingCode()); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to create pairing code." }); }
});

app.delete("/automation/companion/devices/:deviceId", async (req, res) => {
  try { res.json(await revokeCompanionDevice(req.params.deviceId)); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to revoke device." }); }
});

app.get("/automation/companion/items", async (_, res) => {
  try { res.json(await listCompanionItems()); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load shared items." }); }
});

app.post("/automation/companion/items", async (req, res) => {
  try { res.json(await sendCompanionItem(req.body)); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to share item." }); }
});

app.get("/automation/companion/items/:itemId", async (req, res) => {
  try { res.json(await downloadCompanionItem(req.params.itemId)); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to download item." }); }
});

app.delete("/automation/companion/items/:itemId", async (req, res) => {
  try { res.json(await deleteCompanionItem(req.params.itemId)); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to delete item." }); }
});

app.get("/automation/hue/discover", async (_, res) => {
  try {
    res.json(await discoverHueBridges());
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : "Hue discovery failed.",
    });
  }
});

app.post("/automation/hue/pair", async (req, res) => {
  try {
    res.json(await pairHueBridge(String(req.body?.bridgeIp ?? "")));
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Hue pairing failed.",
    });
  }
});

app.get("/automation/hue/cloud/status", async (_, res) => {
  try {
    res.json(await getHueCloudStatus());
  } catch (err) {
    res.status(400).json({
      error:
        err instanceof Error ? err.message : "Unable to read Hue cloud status.",
    });
  }
});

app.post("/automation/hue/cloud/config", async (req, res) => {
  try {
    res.json(
      await configureHueCloud(
        String(req.body?.clientId ?? ""),
        String(req.body?.clientSecret ?? ""),
      ),
    );
  } catch (err) {
    res.status(400).json({
      error:
        err instanceof Error
          ? err.message
          : "Unable to save Hue cloud credentials.",
    });
  }
});

app.post("/automation/hue/cloud/authorise", async (_, res) => {
  try {
    res.json(await beginHueCloudAuthorisation());
  } catch (err) {
    res.status(400).json({
      error:
        err instanceof Error
          ? err.message
          : "Unable to start Hue authorisation.",
    });
  }
});

app.post("/automation/hue/cloud/complete", async (_, res) => {
  try {
    res.json(await completeHueCloudAuthorisation());
  } catch (err) {
    res.status(400).json({
      error:
        err instanceof Error
          ? err.message
          : "Unable to finish Hue authorisation.",
    });
  }
});

app.get("/automation/hue/lights", async (_, res) => {
  try {
    res.json(await getHueLights());
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Unable to load Hue lights.",
    });
  }
});

app.post("/automation/hue/lights/:id", async (req, res) => {
  try {
    res.json(await setHueLight(String(req.params.id), Boolean(req.body?.on)));
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Unable to update Hue light.",
    });
  }
});

app.post("/automation/hue/lights/:id/control", async (req, res) => {
  try {
    res.json(await setHueLightControl(String(req.params.id), req.body ?? {}));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Unable to update Hue light settings." });
  }
});

app.post("/automation/govee/connect", async (req, res) => {
  try {
    res.json(await connectGovee(String(req.body?.apiKey ?? "")));
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Unable to connect Govee.",
    });
  }
});

app.get("/automation/govee/devices", async (_, res) => {
  try {
    res.json(await getGoveeDevices());
  } catch (err) {
    res.status(400).json({
      error:
        err instanceof Error ? err.message : "Unable to load Govee devices.",
    });
  }
});

app.post("/automation/govee/devices/:id", async (req, res) => {
  try {
    res.json(
      await setGoveeDevice(
        String(req.params.id),
        String(req.body?.model ?? ""),
        Boolean(req.body?.on),
      ),
    );
  } catch (err) {
    res.status(400).json({
      error:
        err instanceof Error ? err.message : "Unable to update Govee device.",
    });
  }
});

app.post("/automation/govee/devices/:id/control", async (req, res) => {
  try {
    res.json(await setGoveeDeviceControl(String(req.params.id), String(req.body?.model ?? ""), req.body ?? {}));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Unable to update Govee device settings." });
  }
});

app.post("/automation/ring/connect", async (req, res) => {
  try {
    res.json(await connectRing(String(req.body?.refreshToken ?? "")));
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Unable to connect Ring.",
    });
  }
});

app.post("/automation/ring/sign-in", async (req, res) => {
  try {
    res.json(await beginRingSignIn(String(req.body?.email ?? ""), String(req.body?.password ?? "")));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Unable to sign in to Ring." });
  }
});

app.post("/automation/ring/verify", async (req, res) => {
  try {
    res.json(await completeRingSignIn(String(req.body?.sessionId ?? ""), String(req.body?.code ?? "")));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Unable to verify the Ring sign-in." });
  }
});

app.get("/automation/ring/devices", async (_, res) => {
  try {
    res.json(await getRingDevices());
  } catch (err) {
    res.status(400).json({
      error:
        err instanceof Error ? err.message : "Unable to load Ring devices.",
    });
  }
});

app.get("/automation/ring/events", async (_, res) => {
  try {
    res.json(await getRingEvents());
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Unable to load Ring events.",
    });
  }
});

app.get("/automation/ring/devices/:id/snapshot", async (req, res) => {
  try {
    const snapshot = await getRingSnapshot(String(req.params.id));
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0",
    );
    res.type("image/jpeg").send(snapshot);
  } catch (err) {
    // A camera can be temporarily unreachable away from the home network.
    // This is a normal unavailable state for the preview, not a bad request.
    res.setHeader("X-Sentinel-Preview", "unavailable");
    res.status(204).end();
  }
});

app.post("/automation/ring/devices/:id/light", async (req, res) => {
  try {
    res.json(
      await setRingCameraLight(String(req.params.id), Boolean(req.body?.on)),
    );
  } catch (err) {
    res.status(400).json({
      error:
        err instanceof Error ? err.message : "Unable to change the Ring light.",
    });
  }
});

app.post("/automation/ring/devices/:id/siren", async (req, res) => {
  try {
    res.json(
      await setRingCameraSiren(String(req.params.id), Boolean(req.body?.on)),
    );
  } catch (err) {
    res.status(400).json({
      error:
        err instanceof Error ? err.message : "Unable to change the Ring siren.",
    });
  }
});

app.post("/automation/ring/devices/:id/talkback/start", async (req, res) => {
  try {
    res.json(
      await startRingTalkback(
        String(req.params.id),
        String(req.body?.sdp ?? ""),
      ),
    );
  } catch (err) {
    res.status(400).json({
      error:
        err instanceof Error ? err.message : "Unable to start Ring talkback.",
    });
  }
});

app.post("/automation/ring/devices/:id/live/start", async (req, res) => {
  try {
    res.json(
      await startRingLiveView(
        String(req.params.id),
        String(req.body?.sdp ?? ""),
      ),
    );
  } catch (err) {
    res.status(400).json({
      error:
        err instanceof Error
          ? err.message
          : "Unable to start the Ring live view.",
    });
  }
});

app.post("/automation/ring/talkback/:sessionId/stop", async (req, res) => {
  try {
    res.json(await stopRingTalkback(String(req.params.sessionId)));
  } catch (err) {
    res.status(400).json({
      error:
        err instanceof Error ? err.message : "Unable to stop Ring talkback.",
    });
  }
});

/* ==========================================================
   Navigation
========================================================== */

app.get("/navigation/search", async (req, res) => {
  try {
    const query = String(req.query.q ?? "").trim();
    if (query.length < 2)
      return res
        .status(400)
        .json({ error: "Enter at least two characters to search." });
    const google = new GoogleMapsProvider();
    res.json(await google.search(query));
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : "Location search failed.",
    });
  }
});

app.get("/navigation/discover", async (req, res) => {
  try {
    const query = String(req.query.q ?? "").trim();
    const location = getCurrentWorld().location;
    if (query.length < 2)
      return res.status(400).json({
        error: "Enter at least two characters to discover nearby places.",
      });
    if (
      !Number.isFinite(Number(location.latitude)) ||
      !Number.isFinite(Number(location.longitude))
    )
      return res
        .status(400)
        .json({ error: "Your live location is not available yet." });
    res.json(
      await new GoogleMapsProvider().discover(query, {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
      }),
    );
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : "Nearby discovery failed.",
    });
  }
});

app.get("/travel/recommendations", async (req, res) => {
  try {
    const query = String(req.query.q ?? "attractions restaurants").trim();
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
      return res
        .status(400)
        .json({ error: "A valid trip destination is required." });
    res.json(
      await new GoogleMapsProvider().discover(query, { latitude, longitude }),
    );
  } catch (error) {
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : "Destination recommendations are unavailable.",
    });
  }
});

app.get("/travel/flights/:number", async (req, res) => {
  const apiKey = process.env.FLYSTACK_API_KEY;
  if (!apiKey)
    return res.status(428).json({
      error:
        "Add a FlyStack API key in Settings → Setup Centre to enable live flight status.",
    });
  try {
    const number = String(req.params.number)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    const response = await fetch(
      `https://api.flystack.dev/v1/flights/lookup?flight_iata=${encodeURIComponent(number)}`,
      { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(10000) },
    );
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok)
      throw new Error(
        String(
          data.message ??
            data.error ??
            `Flight provider returned ${response.status}.`,
        ),
      );
    res.json({
      number: data.flight_iata ?? number,
      status: data.status ?? "Tracking",
      departure: data.dep_iata,
      arrival: data.arr_iata,
      terminal: data.dep_terminal,
      gate: data.dep_gate,
      scheduledDeparture: data.dep_time,
      scheduledArrival: data.arr_time,
      delayMinutes: data.dep_delayed,
      latitude: data.lat,
      longitude: data.lng,
      updatedAt: data.updated,
    });
  } catch (error) {
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : "Live flight status is unavailable.",
    });
  }
});

app.get("/navigation/map-config", (_req, res) => {
  res.json({ mapsApiKey: config.google.mapsApiKey });
});

app.get("/navigation/route", async (req, res) => {
  try {
    const destination = {
      latitude: Number(req.query.latitude),
      longitude: Number(req.query.longitude),
    };
    const currentLocation = getCurrentWorld().location;
    const origin = {
      latitude: Number(currentLocation.latitude),
      longitude: Number(currentLocation.longitude),
    };
    if (
      !Number.isFinite(origin.latitude) ||
      !Number.isFinite(origin.longitude)
    ) {
      return res
        .status(400)
        .json({ error: "Your live location is not available yet." });
    }
    if (
      !Number.isFinite(destination.latitude) ||
      !Number.isFinite(destination.longitude)
    ) {
      return res
        .status(400)
        .json({ error: "A valid destination is required." });
    }
    const google = new GoogleMapsProvider();
    res.json(
      await google.route(
        { latitude: origin.latitude, longitude: origin.longitude },
        destination,
      ),
    );
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : "Route calculation failed.",
    });
  }
});

/* ==========================================================
   Project Source Control
========================================================== */

app.post("/developer/unlock", (req, res) => {
  try {
    res.json(unlockDeveloperMode(String(req.body?.password ?? "")));
  } catch (err) {
    res.status(401).json({
      error:
        err instanceof Error ? err.message : "Unable to unlock Developer Mode.",
    });
  }
});

app.get("/developer/status", (req, res) => {
  res.json(developerStatus(req.header("x-sentinel-developer-token")));
});

app.post("/developer/lock", requireDeveloperMode, (req, res) => {
  lockDeveloperMode(req.header("x-sentinel-developer-token"));
  res.json({ unlocked: false });
});

app.get("/devices/scan", requireDeveloperMode, async (_req, res) => {
  try {
    res.json(await scanDevices());
  } catch (err) {
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : "Device Scanner was unable to run.",
    });
  }
});

app.get("/source/status", requireDeveloperMode, (_, res) => {
  res.json(getSourceStatus());
});

app.get("/source/files", requireDeveloperMode, async (_, res) => {
  try {
    res.json(await listSourceFiles());
  } catch (err) {
    res.status(500).json({
      error:
        err instanceof Error ? err.message : "Unable to list source files.",
    });
  }
});

app.get("/source/read", requireDeveloperMode, async (req, res) => {
  try {
    res.json(await readSourceFile(String(req.query.path ?? "")));
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Unable to read source file.",
    });
  }
});

app.get("/source/search", requireDeveloperMode, async (req, res) => {
  try {
    res.json(await searchSource(String(req.query.query ?? "")));
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Unable to search source.",
    });
  }
});

app.post("/source/proposals", requireDeveloperMode, async (req, res) => {
  try {
    const proposal = await proposeSourceWrite(
      String(req.body?.path ?? ""),
      String(req.body?.content ?? ""),
    );
    res.status(201).json(proposal);
  } catch (err) {
    res.status(400).json({
      error:
        err instanceof Error
          ? err.message
          : "Unable to create source proposal.",
    });
  }
});

app.get("/source/proposals/:id", requireDeveloperMode, (req, res) => {
  const proposal = getSourceProposal(String(req.params.id));
  if (!proposal)
    return res
      .status(404)
      .json({ error: "Source proposal not found or has expired." });
  res.json(proposal);
});

app.post(
  "/source/proposals/:id/approve",
  requireDeveloperMode,
  async (req, res) => {
    try {
      res.json(await approveSourceProposal(String(req.params.id)));
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : "Unable to approve source proposal.",
      });
    }
  },
);

/* ==========================================================
   Google Maps Test
========================================================== */

app.get("/test/google", async (_, res) => {
  try {
    const google = new GoogleMapsProvider();

    const result = await google.reverseGeocode(
      51.5074,

      -0.1278,
    );

    res.json(result);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,

      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
/* ==========================================================
   Weather Test
========================================================== */

app.get("/test/weather", async (_, res) => {
  try {
    const weather = new WeatherApiProvider();

    const result = await weather.getWeather(
      51.5074,

      -0.1278,
    );

    res.json(result);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,

      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/* ==========================================================
   Location Updates
========================================================== */

app.post("/world/location", async (req, res) => {
  try {
    const latitude = Number(req.body?.latitude);

    const longitude = Number(req.body?.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        success: false,

        error: "A valid latitude and longitude are required.",
      });
    }

    console.log(
      "📍 Location Update:",

      req.body,
    );

    void updateCurrentLocation({ latitude, longitude });
    void refreshWeather();

    res.json({
      success: true,

      location: getCurrentWorld().location,

      accuracy: Number.isFinite(Number(req.body?.accuracy))
        ? Number(req.body.accuracy)
        : undefined,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,

      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

app.post("/world/location/approximate", async (_req, res) => {
  try {
    const location = await refreshCurrentLocation();
    if (!location) {
      return res.status(503).json({
        success: false,
        error: "An approximate network location is unavailable.",
      });
    }

    void refreshWeather();
    res.json({
      success: true,
      approximate: true,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: 25000,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error:
        err instanceof Error ? err.message : "Unable to estimate location.",
    });
  }
});

/* ==========================================================
   Memory Learning
========================================================== */

async function storeMemory(
  userMessage: string,

  assistantReply: string,
) {
  try {
    const memory = await extractMemory(
      userMessage,

      assistantReply,
    );

    if (
      !memory.remember ||
      !memory.title ||
      !memory.content ||
      !memory.category
    ) {
      return;
    }

    addMemory(
      memory.title,

      memory.content,

      memory.category,

      memory.importance ?? 5,
    );
  } catch (err) {
    console.error(
      "Memory extraction failed:",

      err,
    );
  }
}
/* ==========================================================
   Chat
========================================================== */

type DesignAttachment = { name: string; type: string; data: string };

app.use("/design", (_req, res, next) => {
  if ((process.env.SENTINEL_EDITION ?? "personal") !== "personal") {
    res.status(404).json({ error: "Not found." });
    return;
  }
  next();
});

app.use("/concierge", (_req, res, next) => {
  if ((process.env.SENTINEL_EDITION ?? "personal") !== "personal") {
    res.status(404).json({ error: "Not found." });
    return;
  }
  next();
});

app.post("/concierge/plan", async (req, res) => {
  try {
    const request = String(req.body?.request ?? "").trim();
    const allergies = String(req.body?.allergies ?? "").trim();
    const people = Math.max(1, Math.min(12, Number(req.body?.people) || 1));
    const budget = Math.max(0, Number(req.body?.budget) || 0);
    if (!request) return res.status(400).json({ error: "Describe what you would like to order." });
    const response = await client.responses.create({
      model: "gpt-5.5",
      input: `You are Sentinel Concierge. Convert the user's pizza request into an editable basket plan. Never claim an order was placed, never invent a restaurant, live menu, discount or exact provider price. Treat all prices as rough planning estimates in GBP. Allergies are safety-critical: repeat them in warnings and state that the restaurant must confirm suitability. Return JSON only with this exact shape: {"summary":string,"size":"Personal"|"Medium"|"Large","crust":"Classic"|"Thin"|"Stuffed","quantity":number,"pizzas":[{"name":string,"toppings":[string],"remove":[string],"notes":string}],"sides":[string],"drinks":[string],"estimatedTotal":number,"warnings":[string]}. User request: ${request}. People: ${people}. Budget: ${budget || "not set"}. Allergies/dietary requirements: ${allergies || "none supplied"}. Keep quantity between 1 and 8 and estimatedTotal conservative.`,
    } as any);
    const raw = response.output_text?.trim() ?? "";
    const plan = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    res.json(plan);
  } catch (error) {
    console.error("Concierge planning failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Sentinel could not prepare the order." });
  }
});

app.post("/design/machine", async (req, res) => {
  try {
    const query = String(req.body?.query ?? "").trim();
    const material = String(req.body?.material ?? "foam").trim();
    if (!query) return res.status(400).json({ error: "Enter the machine make and model." });
    const response = await client.responses.create({
      model: "gpt-5.5",
      tools: [{ type: "web_search_preview" }] as any,
      input: `Search for and identify this cutting machine: ${query}. The intended material is ${material}. Prefer the manufacturer's specifications. Return JSON only: {"identifiedName":string,"machineType":string,"workingWidth":number,"workingHeight":number,"cutterDiameter":number,"kerf":number,"recommendedTool":string,"materialGuidance":string,"notes":[string]}. Use 0 for specifications that cannot be verified. Do not invent specifications. Keep materialGuidance concise and flag unsafe or unsuitable material.`,
    } as any);
    const raw = response.output_text?.trim() ?? "";
    res.json(JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")));
  } catch (error) {
    console.error("Machine lookup failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to identify the machine." });
  }
});

app.post("/design/generate", async (req, res) => {
  try {
    const mode = req.body?.mode === "print" ? "print" : "foam";
    const message = String(req.body?.message ?? "").trim();
    const current = req.body?.current && typeof req.body.current === "object" ? req.body.current : {};
    const attachments = Array.isArray(req.body?.attachments)
      ? (req.body.attachments as DesignAttachment[]).filter(item => item && typeof item.data === "string").slice(0, 6)
      : [];
    if (!message && !attachments.length) return res.status(400).json({ error: "Describe the design or attach reference files." });
    const content: any[] = [{ type: "input_text", text: `You are Sentinel Design Studio. Produce a practical ${mode === "foam" ? "foam insert cutting layout" : "3D-print model plan"}. Dimensions are millimetres. Analyse attached photos and documents, but never invent scale from an image: if no known dimension or scale reference is supplied, set needsClarification true and ask for it. Preserve safe borders and clearance. Return JSON only with this exact shape:\n{\"assistantMessage\":string,\"needsClarification\":boolean,\"project\":{\"name\":string,\"width\":number,\"height\":number,\"depth\":number},\"shapes\":[{\"id\":string,\"label\":string,\"kind\":\"circle\"|\"rectangle\"|\"polygon\"|\"box\"|\"cylinder\",\"x\":number,\"y\":number,\"width\":number,\"height\":number,\"depth\":number,\"radius\":number,\"points\":[[number,number]],\"clearance\":number}],\"notes\":[string]}. For irregular photographed objects use polygon points relative to the project top-left. For 3D printing use one or more box/cylinder primitives and explain if true freeform CAD needs further measurements. Current project: ${JSON.stringify(current)}\nUser request: ${message || "Analyse the attached references."}` }];
    content[0].text += "\nTreat the current project as editable conversation state: revise it for follow-up instructions instead of starting again. For foam, use the supplied workshop profile and check cutter diameter, kerf, edge margin, pocket depth, overlap, finger access and layered foam. For printing, check wall thickness, tolerance, print orientation and unsupported spans. State assumptions and ask one focused question when a reliable fabrication design cannot yet be produced.";
    for (const attachment of attachments) {
      if (attachment.type.startsWith("image/")) content.push({ type: "input_image", image_url: attachment.data, detail: "high" });
      else content.push({ type: "input_file", filename: attachment.name, file_data: attachment.data });
    }
    const response = await client.responses.create({ model: "gpt-5.5", input: [{ role: "user", content }] as any });
    const raw = response.output_text?.trim() ?? "";
    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const design = JSON.parse(jsonText);
    res.json(design);
  } catch (error) {
    console.error("Design generation failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to generate the design." });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const message = String(req.body?.message ?? "").trim();

    if (!message) {
      return res.status(400).json({
        reply: "No message supplied.",
      });
    }

    const history = Array.isArray(req.body?.history)
      ? req.body.history
          .filter(
            (entry: unknown): entry is ConversationMessage =>
              Boolean(entry) &&
              typeof entry === "object" &&
              ((entry as ConversationMessage).role === "user" ||
                (entry as ConversationMessage).role === "assistant") &&
              typeof (entry as ConversationMessage).content === "string",
          )
          .slice(-30)
      : [];

    replaceConversation(history);

    addUserMessage(message);

    const fastReply = (() => {
      const normalised = message.toLowerCase().replace(/[^a-z0-9'? ]/g, " ").replace(/\s+/g, " ").trim();
      if (/^(hi|hello|hey|hiya|good (morning|afternoon|evening))[?!. ]*$/.test(normalised)) {
        return "Hello, Regan. Sentinel is online and ready.";
      }
      if (/^(online|online\?|are you online|you online|status)[?!. ]*$/.test(normalised)) {
        return "Online and ready.";
      }
      if (/^(thanks|thank you|cheers)[?!. ]*$/.test(normalised)) {
        return "You're welcome.";
      }
      return undefined;
    })();
    if (fastReply) {
      addAssistantMessage(fastReply);
      void storeMemory(message, fastReply).catch((error) =>
        console.warn("Fast-reply memory storage was deferred:", error instanceof Error ? error.message : "unknown error"),
      );
      return res.json({ reply: fastReply, local: true });
    }

    const connectedDeviceResult = await tryConnectedDeviceCommand(message);
    if (connectedDeviceResult) {
      addAssistantMessage(connectedDeviceResult.reply);
      await storeMemory(message, connectedDeviceResult.reply);
      return res.json(connectedDeviceResult);
    }

    const result = await runAgent({
      source: "chat",

      message,
    });

    addAssistantMessage(result.reply);

    await storeMemory(
      message,

      result.reply,
    );

    res.json(result);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      reply: "Sentinel encountered an error.",
    });
  }
});

app.post("/image/generate", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt ?? "").trim();
    if (!prompt) return res.status(400).json({ error: "Describe the image you want Sentinel to create." });
    const generated = await generateSentinelImage(prompt);
    return res.json(generated);
  } catch (error) {
    console.error("Image generation failed", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Sentinel could not generate the image." });
  }
});

/* ==========================================================
   Startup
========================================================== */

const PORT = Number(process.env.PORT) || 3001;

(async () => {
  app.listen(PORT, "127.0.0.1", () => {
    console.log("");

    console.log("======================================================");
    console.log("🛡 Sentinel AI Operating System");
    console.log("======================================================");

    console.log(`🌐 Server          http://localhost:${PORT}`);

    console.log("");

    console.log("Endpoints");

    console.log("--------------------------------");

    console.log("GET  /");
    console.log("GET  /brain/health");
    console.log("GET  /world");
    console.log("GET  /device");
    console.log("GET  /test/google");
    console.log("GET  /test/weather");
    console.log("POST /world/location");
    console.log("POST /chat");

    console.log("");
    console.log("🧠 Brain             Online");
    console.log("🎯 Goal Engine       Online");
    console.log("🌍 World Engine      Online");
    console.log("💻 Device Engine     Online");
    console.log("📚 Memory            Online");
    console.log("🧩 Capabilities      Loaded");

    console.log("");

    console.log("✅ Sentinel Ready");

    console.log("======================================================");

    console.log("");
  });

  // Keep the local API available even when an external provider is slow to
  // initialise.  Integrations such as Ring must not be blocked by weather or
  // location startup work.
  try {
    await initialiseSentinel();
    startRelayPolling();
    startCompanionHeartbeat();
  } catch (err) {
    console.error("Sentinel background initialisation failed.", err);
  }
})();
