import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AudioLines,
  ArrowUp,
  Bot,
  LoaderCircle,
  MessageSquareText,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useConversation } from "../../../conversation/ConversationContext";
import { useMemory } from "../../../memory/MemoryContext";
import { API_URL } from "../../../services/api";
import {
  getGoveeDevices,
  getHueLights,
  getRingDevices,
  setGoveeDevice,
  setHueLight,
  startRingLiveView,
  stopRingTalkback,
  type RingDevice,
} from "../../../services/automation";
import { sendMessage } from "../../../services/chat";
import { getDeveloperToken, lockDeveloperMode } from "../../../services/developer";
import { useSentinel } from "../../../state/SentinelContext";
import { useNavigation, type NavigationView } from "../../../navigation/NavigationContext";
import { useSoundEffects } from "../../../audio/SoundEffectsContext";
import { playWakeTone, recordWakeActivity } from "../../../services/wakeVoice";
import "./QuickChatBar.css";
import "./QuickChatBarLayout.css";
import "./RealtimeConversation.css";

const time = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const clean = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const cameraWords = /\b(camera|doorbell|front door|live view)\b/i;
const lightWords = /\b(light|lights|lamp|lamps)\b/i;
const developerHeaders = (headers: Record<string, string>) => {
  const token = getDeveloperToken();
  return token ? { ...headers, "x-sentinel-developer-token": token } : headers;
};

type RealtimeState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";
type RealtimeLine = { id: string; speaker: "you" | "sentinel"; text: string };

function LiveCamera({
  device,
  stream,
  status,
  muted,
  onMuted,
  onRetry,
  onClose,
}: {
  device: RingDevice;
  stream: MediaStream | null;
  status: string;
  muted: boolean;
  onMuted: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="home-camera-backdrop" onMouseDown={onClose}>
      <section className="home-camera-viewer" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span>SECURE LIVE VIEW</span><h2>{device.name}</h2></div>
          <button onClick={onClose} aria-label="Close camera"><X /></button>
        </header>
        {stream ? (
          <video ref={videoRef} autoPlay playsInline muted={muted} />
        ) : (
          <div className="home-camera-loading"><LoaderCircle className="quick-chat-spin" /><strong>{status}</strong><small>Sentinel is negotiating an encrypted Ring session.</small></div>
        )}
        <footer>
          <span><i className={stream ? "is-live" : ""} />{status}</span>
          <div>
            <button onClick={onMuted}>{muted ? <VolumeX /> : <Volume2 />}{muted ? "Unmute" : "Mute"}</button>
            <button onClick={onRetry}><RefreshCw />Reconnect</button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export default function QuickChatBar() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "transcribing" | "executing">("idle");
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [camera, setCamera] = useState<RingDevice | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState("");
  const [cameraMuted, setCameraMuted] = useState(false);
  const [realtimeOpen, setRealtimeOpen] = useState(false);
  const [realtimePanelVisible, setRealtimePanelVisible] = useState(false);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("idle");
  const [realtimeError, setRealtimeError] = useState("");
  const [realtimeMuted, setRealtimeMuted] = useState(false);
  const [realtimeLines, setRealtimeLines] = useState<RealtimeLine[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const silenceFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const sessionRef = useRef<string | null>(null);
  const realtimePeerRef = useRef<RTCPeerConnection | null>(null);
  const realtimeStreamRef = useRef<MediaStream | null>(null);
  const realtimeAudioRef = useRef<HTMLAudioElement | null>(null);
  const realtimeChannelRef = useRef<RTCDataChannel | null>(null);
  const realtimeAssistantDraftRef = useRef("");
  const realtimeToolCallsRef = useRef(new Set<string>());
  const realtimeInactivityRef = useRef<number | null>(null);
  const realtimeMemoryRef = useRef<Array<{ sender: "user" | "sentinel"; text: string }>>([]);
  const realtimeTranscriptRef = useRef<HTMLDivElement | null>(null);
  const previousViewRef = useRef<NavigationView | null>(null);
  const { currentConversation, addMessage } = useConversation();
  const { saveConversation } = useMemory();
  const { setState } = useSentinel();
  const { navigate, view } = useNavigation();
  const { setReactorMuted, fadeStartupWelcome } = useSoundEffects();

  useEffect(() => {
    const element = realtimeTranscriptRef.current;
    if (!element || !realtimePanelVisible) return;
    window.requestAnimationFrame(() => { element.scrollTop = element.scrollHeight; });
  }, [realtimeLines, realtimePanelVisible, realtimeState]);

  useEffect(() => {
    if (previousViewRef.current !== null && previousViewRef.current !== view && realtimeOpen) setRealtimePanelVisible(false);
    previousViewRef.current = view;
  }, [view, realtimeOpen]);

  // Realtime speech and the reactor ambience share the same output device.
  // Silence the reactor for the complete lifetime of the conversation panel,
  // including connection and error states, then restore it on close/unmount.
  useEffect(() => {
    if (!realtimeOpen) return;
    setReactorMuted(true);
    return () => setReactorMuted(false);
  }, [realtimeOpen, setReactorMuted]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("sentinel:live-conversation-state", {
      detail: { open: realtimeOpen, state: realtimeState },
    }));
  }, [realtimeOpen, realtimeState]);

  useEffect(() => {
    const toggle = () => realtimeOpen ? setRealtimePanelVisible((visible) => !visible) : void startRealtime();
    const end = () => { if (realtimeOpen) endRealtime(); };
    window.addEventListener("sentinel:live-conversation-toggle", toggle);
    window.addEventListener("sentinel:live-conversation-end", end);
    return () => {
      window.removeEventListener("sentinel:live-conversation-toggle", toggle);
      window.removeEventListener("sentinel:live-conversation-end", end);
    };
    // The listener is deliberately replaced when the open state changes; the
    // function declarations use the current transport refs on that render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeOpen]);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (silenceFrameRef.current) window.cancelAnimationFrame(silenceFrameRef.current);
    if (realtimeInactivityRef.current) window.clearTimeout(realtimeInactivityRef.current);
    void audioContextRef.current?.close();
    microphoneRef.current?.getTracks().forEach((track) => track.stop());
    peerRef.current?.close();
    realtimeChannelRef.current?.close();
    realtimePeerRef.current?.close();
    realtimeStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (realtimeAudioRef.current) realtimeAudioRef.current.srcObject = null;
  }, []);

  function closeRealtimeTransport() {
    if (realtimeInactivityRef.current) window.clearTimeout(realtimeInactivityRef.current);
    realtimeInactivityRef.current = null;
    realtimeChannelRef.current?.close(); realtimeChannelRef.current = null;
    realtimePeerRef.current?.close(); realtimePeerRef.current = null;
    realtimeStreamRef.current?.getTracks().forEach((track) => track.stop()); realtimeStreamRef.current = null;
    if (realtimeAudioRef.current) realtimeAudioRef.current.srcObject = null;
    realtimeAssistantDraftRef.current = "";
    realtimeToolCallsRef.current.clear();
  }

  function endRealtime() {
    closeRealtimeTransport();
    playWakeTone("sleep");
    recordWakeActivity("sleep", "Live conversation ended");
    setRealtimeOpen(false); setRealtimePanelVisible(false); setRealtimeState("idle"); setRealtimeError(""); setRealtimeMuted(false); setState("idle");
  }

  function armRealtimeInactivityTimeout() {
    if (realtimeInactivityRef.current) window.clearTimeout(realtimeInactivityRef.current);
    realtimeInactivityRef.current = window.setTimeout(() => endRealtime(), 30_000);
  }

  function pauseRealtimeInactivityTimeout() {
    if (realtimeInactivityRef.current) window.clearTimeout(realtimeInactivityRef.current);
    realtimeInactivityRef.current = null;
  }

  function addRealtimeLine(speaker: RealtimeLine["speaker"], text: string) {
    const cleaned = text.trim();
    if (!cleaned) return;
    setRealtimeLines((lines) => [...lines.slice(-7), { id: crypto.randomUUID(), speaker, text: cleaned }]);
    const sender = speaker === "you" ? "user" as const : "sentinel" as const;
    realtimeMemoryRef.current = [...realtimeMemoryRef.current, { sender, text: cleaned }].slice(-80);
    addMessage({ id: crypto.randomUUID(), sender, text: cleaned, timestamp: time() });
    if (currentConversation) {
      const content = realtimeMemoryRef.current.map((item) => `${item.sender === "user" ? "You" : "Sentinel"}: ${item.text}`).join("\n\n");
      saveConversation(currentConversation.id, currentConversation.title, content);
    }
  }

  async function runRealtimeTool(payload: Record<string, unknown>) {
    const callId = String(payload.call_id ?? "");
    const name = String(payload.name ?? "");
    if (!callId || name !== "use_sentinel" || realtimeToolCallsRef.current.has(callId)) return;
    realtimeToolCallsRef.current.add(callId);
    setRealtimeState("thinking"); setState("thinking");
    let output: Record<string, unknown>;
    let afterResponse: (() => void) | undefined;
    try {
      const parsed = JSON.parse(String(payload.arguments ?? "{}")) as { request?: unknown };
      const request = String(parsed.request ?? "").trim();
      if (!request) throw new Error("The voice request was empty.");
      const response = await fetch(`${API_URL}/realtime/tool`, {
        method: "POST",
        headers: developerHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
        body: JSON.stringify({ request, page: view }),
      });
      const result = await response.json() as {
        ok?: boolean;
        reply?: string;
        error?: string;
        action?: { type?: string; page?: NavigationView; deviceId?: string; theme?: string; destination?: string; flightNumber?: string; departure?: string; arrival?: string; missionSection?: "mission" | "home" | "routines" | "automation" | "security"; imageUrl?: string; prompt?: string };
      };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Sentinel could not complete the request.");
      if (result.action?.type === "open_page" && result.action.page) {
        const page = result.action.page;
        const missionSection = result.action.missionSection;
        afterResponse = () => {
          navigate(page);
          if (page === "automation" && missionSection) {
            window.setTimeout(() => window.dispatchEvent(new CustomEvent("sentinel:mission-section", { detail: { section: missionSection } })), 80);
          }
        };
      }
      if (result.action?.type === "show_generated_image" && result.action.imageUrl) {
        const imageUrl = result.action.imageUrl;
        const prompt = result.action.prompt;
        afterResponse = () => {
          navigate("chat");
          window.setTimeout(() => window.dispatchEvent(new CustomEvent("sentinel:generated-image", { detail: { imageUrl, prompt } })), 220);
        };
      }
      if (result.action?.type === "end_realtime") { output = { ok: true, result: result.reply ?? "Ending the conversation." }; window.setTimeout(endRealtime, 350); }
      if (result.action?.type === "set_theme" && result.action.theme) {
        const theme = result.action.theme;
        afterResponse = () => {
          localStorage.setItem("sentinel-accent-theme", theme);
          document.documentElement.dataset.sentinelTheme = theme;
          window.dispatchEvent(new CustomEvent("sentinel:theme-change", { detail: { theme } }));
          navigate("settings");
        };
      }
      if (result.action?.type === "prefill_travel") {
        const action = result.action;
        afterResponse = () => {
          navigate("travel");
          window.setTimeout(() => window.dispatchEvent(new CustomEvent("sentinel:travel-prefill", { detail: action })), 80);
        };
      }
      if (result.action?.type === "developer_unlock") {
        afterResponse = () => {
          navigate("settings");
          window.setTimeout(() => window.dispatchEvent(new Event("sentinel:developer-unlock-request")), 180);
        };
      }
      if (result.action?.type === "developer_lock") {
        await lockDeveloperMode();
        window.dispatchEvent(new CustomEvent("sentinel:developer-status-change", { detail: { unlocked: false } }));
      }
      if (result.action?.type === "open_camera" && result.action.deviceId) {
        const devices = await getRingDevices();
        const device = devices.find((item) => item.id === result.action?.deviceId);
        if (device) await openCamera(device);
      }
      output = { ok: true, result: result.reply ?? "The request completed." };
    } catch (error) {
      output = { ok: false, error: error instanceof Error ? error.message : "The request failed." };
    }
    const channel = realtimeChannelRef.current;
    if (channel?.readyState === "open") {
      channel.send(JSON.stringify({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) },
      }));
      channel.send(JSON.stringify({ type: "response.create" }));
    }
    if (afterResponse) window.setTimeout(afterResponse, 0);
  }

  function handleRealtimeEvent(event: MessageEvent<string>) {
    try {
      const payload = JSON.parse(event.data) as Record<string, unknown>;
      const type = String(payload.type ?? "");
      if (type === "input_audio_buffer.speech_started") { pauseRealtimeInactivityTimeout(); setRealtimeState("listening"); setState("listening"); }
      else if (type === "input_audio_buffer.speech_stopped") { pauseRealtimeInactivityTimeout(); setRealtimeState("thinking"); setState("thinking"); }
      else if (type === "conversation.item.input_audio_transcription.completed") {
        const transcript = String(payload.transcript ?? "").trim();
        if (transcript) {
          addRealtimeLine("you", transcript);
          const channel = realtimeChannelRef.current;
          if (channel?.readyState === "open") channel.send(JSON.stringify({ type: "response.create" }));
        } else {
          setRealtimeState("listening");
          setState("listening");
          armRealtimeInactivityTimeout();
        }
      } else if (type === "response.output_audio_transcript.delta") {
        realtimeAssistantDraftRef.current += String(payload.delta ?? "");
        setRealtimeState("speaking"); setState("streaming");
      } else if (type === "response.output_audio_transcript.done") {
        const transcript = String(payload.transcript ?? realtimeAssistantDraftRef.current);
        addRealtimeLine("sentinel", transcript); realtimeAssistantDraftRef.current = "";
      } else if (type === "response.function_call_arguments.done") {
        void runRealtimeTool(payload);
      } else if (type === "response.done") { setRealtimeState("listening"); setState("listening"); armRealtimeInactivityTimeout(); }
      else if (type === "error") {
        const error = payload.error as { message?: string } | undefined;
        setRealtimeError(error?.message ?? "The realtime conversation encountered an error."); setRealtimeState("error"); setState("idle");
      }
    } catch { /* Ignore non-JSON WebRTC events. */ }
  }

  async function startRealtime() {
    closeRealtimeTransport(); setRealtimeOpen(true); setRealtimePanelVisible(true); setRealtimeState("connecting"); setRealtimeError(""); setState("listening");
    fadeStartupWelcome(120);
    playWakeTone("wake");
    recordWakeActivity("wake", "Live conversation started");
    realtimeMemoryRef.current = currentConversation?.messages.map((item) => ({ sender: item.sender, text: item.text })) ?? [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
          sampleSize: 16,
        },
        video: false,
      });
      const peer = new RTCPeerConnection();
      const audio = new Audio(); audio.autoplay = true;
      peer.ontrack = (event) => { audio.srcObject = event.streams[0] ?? new MediaStream([event.track]); void audio.play().catch(() => undefined); };
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const channel = peer.createDataChannel("oai-events");
      channel.onopen = () => { setRealtimeState("listening"); setState("listening"); armRealtimeInactivityTimeout(); };
      channel.onmessage = handleRealtimeEvent;
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
          setRealtimeError("The live voice connection was interrupted."); setRealtimeState("error"); setState("idle");
        }
      };
      realtimePeerRef.current = peer; realtimeStreamRef.current = stream; realtimeAudioRef.current = audio; realtimeChannelRef.current = channel;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await new Promise<void>((resolve) => {
        if (peer.iceGatheringState === "complete") return resolve();
        let settled = false;
        const finish = () => {
          if (settled || peer.iceGatheringState !== "complete") return;
          settled = true;
          peer.removeEventListener("icegatheringstatechange", finish);
          resolve();
        };
        peer.addEventListener("icegatheringstatechange", finish);
        window.setTimeout(() => {
          if (settled) return;
          settled = true;
          peer.removeEventListener("icegatheringstatechange", finish);
          resolve();
        }, 5000);
      });
      const rawOfferSdp = peer.localDescription?.sdp;
      if (!rawOfferSdp || !rawOfferSdp.trimStart().startsWith("v=0")) throw new Error("Sentinel could not create a valid voice session offer.");
      // SDP is a line-oriented protocol and must retain its terminating CRLF.
      // Trimming the browser offer makes strict upstream SDP parsers report EOF.
      const normalisedOfferSdp = rawOfferSdp.replace(/\r?\n/g, "\r\n");
      const offerSdp = normalisedOfferSdp.endsWith("\r\n") ? normalisedOfferSdp : `${normalisedOfferSdp}\r\n`;
      const response = await fetch(`${API_URL}/realtime/session`, { method: "POST", headers: developerHeaders({ "Content-Type": "application/sdp", Accept: "application/sdp" }), body: offerSdp });
      const answer = await response.text();
      if (!response.ok) {
        try { throw new Error((JSON.parse(answer) as { error?: string }).error ?? "Realtime voice could not start."); }
        catch (error) { if (error instanceof SyntaxError) throw new Error(answer || "Realtime voice could not start."); throw error; }
      }
      if (!answer.trim().startsWith("v=0")) throw new Error("The realtime voice service returned an invalid session answer.");
      await peer.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (error) {
      closeRealtimeTransport(); setRealtimeError(error instanceof Error ? error.message : "Realtime voice could not start."); setRealtimeState("error"); setState("idle");
    }
  }

  function toggleRealtimeMute() {
    setRealtimeMuted((muted) => {
      realtimeStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = muted; });
      return !muted;
    });
  }

  async function ask(prompt: string) {
    if (!prompt || loading || !currentConversation) return;
    const history = currentConversation.messages.map((item) => ({
      role: item.sender === "sentinel" ? "assistant" as const : "user" as const,
      content: item.text,
    }));
    addMessage({ id: crypto.randomUUID(), sender: "user", text: prompt, timestamp: time() });
    setMessage(""); setReply(""); setLoading(true); setState("thinking");
    try {
      const response = await sendMessage(prompt, history);
      if (response.action?.type === "open_page") navigate(response.action.page as NavigationView);
      if (response.action?.type === "open_camera") {
        const cameraAction = response.action;
        const devices = await getRingDevices();
        const device = devices.find((item) => item.id === cameraAction.deviceId);
        if (device) await openCamera(device);
      }
      addMessage({ id: crypto.randomUUID(), sender: "sentinel", text: response.reply, timestamp: time() });
      setReply(response.reply);
      const content = [...currentConversation.messages, { sender: "user" as const, text: prompt }, { sender: "sentinel" as const, text: response.reply }]
        .map((item) => `${item.sender === "user" ? "You" : "Sentinel"}: ${item.text}`).join("\n\n");
      saveConversation(currentConversation.id, currentConversation.title, content);
    } catch {
      setReply("I’m unable to reach the Sentinel service at the moment.");
    } finally { setLoading(false); setState("idle"); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const command = message.trim();
    if (command) await executeVoiceCommand(command);
  }

  async function closeCamera() {
    const session = sessionRef.current;
    sessionRef.current = null;
    peerRef.current?.close(); peerRef.current = null;
    setCameraStream(null); setCamera(null);
    if (session) await stopRingTalkback(session).catch(() => undefined);
  }

  async function openCamera(device: RingDevice) {
    if (sessionRef.current) await closeCamera();
    setCamera(device); setCameraStatus("Connecting to camera…"); setCameraStream(null);
    try {
      const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peer.addTransceiver("video", { direction: "recvonly" });
      peer.addTransceiver("audio", { direction: "recvonly" });
      peer.ontrack = (event) => setCameraStream(event.streams[0] ?? new MediaStream([event.track]));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await new Promise<void>((resolve) => {
        if (peer.iceGatheringState === "complete") return resolve();
        const finish = () => { if (peer.iceGatheringState === "complete") { peer.removeEventListener("icegatheringstatechange", finish); resolve(); } };
        peer.addEventListener("icegatheringstatechange", finish);
        window.setTimeout(() => { peer.removeEventListener("icegatheringstatechange", finish); resolve(); }, 5000);
      });
      const result = await startRingLiveView(device.id, peer.localDescription?.sdp ?? "");
      await peer.setRemoteDescription({ type: "answer", sdp: result.answerSdp });
      peerRef.current = peer; sessionRef.current = result.sessionId;
      setCameraStatus("Live video active");
    } catch (error) {
      peerRef.current?.close(); peerRef.current = null;
      setCameraStatus(error instanceof Error ? error.message : "Live view could not be started.");
    }
  }

  async function executeVoiceCommand(spoken: string) {
    const command = clean(spoken);
    setMessage(spoken); setVoiceState("executing"); setState("thinking");
    try {
      if ((/\b(show|open|view|display)\b/.test(command) && cameraWords.test(command))) {
        const devices = await getRingDevices();
        const wanted = command.replace(/\b(show|open|view|display|me|the|camera|doorbell|live|feed|please)\b/g, " ").replace(/\s+/g, " ").trim();
        const match = devices.find((item) => clean(item.name).includes(wanted) || wanted.includes(clean(item.name)))
          ?? devices.find((item) => command.includes(clean(item.name)));
        if (!match) throw new Error(devices.length ? `I could not match “${spoken}” to a Ring camera.` : "No Ring cameras are connected.");
        if (!match.online) throw new Error(`${match.name} is currently offline.`);
        setReply(`Opening ${match.name}.`); setMessage("");
        await openCamera(match);
        return;
      }
      const desired = /\b(turn|switch|power)\s+off\b|\boff\b/.test(command) ? false
        : /\b(turn|switch|power)\s+on\b|\bon\b/.test(command) ? true : null;
      if (desired !== null && lightWords.test(command)) {
        const [hue, govee] = await Promise.all([getHueLights().catch(() => []), getGoveeDevices().catch(() => [])]);
        const all = /\b(all|every|everything)\b/.test(command);
        const target = command.replace(/\b(turn|switch|power|on|off|the|my|please|a|an|some|light|lights|lamp|lamps)\b/g, " ").replace(/\s+/g, " ").trim();
        const hueMatches = all ? hue : target ? hue.filter((item) => clean(item.name).includes(target) || target.includes(clean(item.name))) : [];
        const goveeMatches = all ? govee : target ? govee.filter((item) => clean(item.name).includes(target) || target.includes(clean(item.name))) : [];
        if (!target && !all) {
          const available = [...hue.map(item => item.name), ...govee.map(item => item.name)];
          if (available.length === 1) {
            if (hue.length === 1) hueMatches.push(hue[0]);
            else goveeMatches.push(govee[0]);
          } else {
            throw new Error(available.length ? `Which light? You can say ${available.slice(0, 4).join(", ")}, or all lights.` : "No controllable lights are currently connected.");
          }
        }
        if (!hueMatches.length && !goveeMatches.length) throw new Error(target ? `I could not find a light matching “${target}”.` : "Say the light name, or say all lights.");
        await Promise.all([
          ...hueMatches.map((item) => setHueLight(item.id, desired)),
          ...goveeMatches.map((item) => setGoveeDevice(item.id, item.model, desired)),
        ]);
        const count = hueMatches.length + goveeMatches.length;
        setReply(`${count === 1 ? (hueMatches[0]?.name ?? goveeMatches[0]?.name) : `${count} lights`} turned ${desired ? "on" : "off"}.`);
        setMessage("");
        return;
      }
      if (/\b(turn|switch|power|open|show|control)\b/.test(command) && /\b(light|lamp|camera|doorbell)\b/.test(command)) {
        throw new Error(`I heard “${spoken}”, but could not safely identify the requested device or action.`);
      }
      await ask(spoken);
    } catch (error) {
      setReply(error instanceof Error ? error.message : "The voice command could not be completed.");
    } finally {
      setVoiceState("idle"); setState("idle");
    }
  }

  async function toggleVoice() {
    if (voiceState === "listening") { recorderRef.current?.stop(); return; }
    if (voiceState !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setReply("Microphone recording is unavailable in this window."); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      microphoneRef.current = stream;
      const chunks: BlobPart[] = [];
      const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      recorderRef.current = recorder;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let speechStarted = false;
      let speechStartedAt = 0;
      let quietSince = 0;
      let noiseFloor = .008;
      const monitorSilence = () => {
        if (recorder.state !== "recording") return;
        analyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) {
          const normalised = (sample - 128) / 128;
          energy += normalised * normalised;
        }
        const level = Math.sqrt(energy / samples.length);
        if (!speechStarted) {
          noiseFloor = noiseFloor * .94 + level * .06;
          if (level > Math.max(.018, noiseFloor * 2.5)) {
            speechStarted = true;
            speechStartedAt = performance.now();
            quietSince = 0;
          }
        } else if (level > Math.max(.012, noiseFloor * 1.7)) {
          quietSince = 0;
        } else {
          if (!quietSince) quietSince = performance.now();
          if (performance.now() - quietSince >= 1250 && performance.now() - speechStartedAt >= 500) {
            recorder.stop();
            return;
          }
        }
        silenceFrameRef.current = window.requestAnimationFrame(monitorSilence);
      };
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        if (silenceFrameRef.current) window.cancelAnimationFrame(silenceFrameRef.current);
        silenceFrameRef.current = null;
        void audioContext.close(); audioContextRef.current = null;
        stream.getTracks().forEach((track) => track.stop()); microphoneRef.current = null;
        const blob = new Blob(chunks, { type: recorder.mimeType || preferredType || "audio/webm" });
        if (blob.size < 100) { setVoiceState("idle"); setReply("No speech was captured."); return; }
        setVoiceState("transcribing");
        try {
          const response = await fetch(`${API_URL}/audio/transcribe`, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
          const result = await response.json() as { text?: string; error?: string };
          if (!response.ok || !result.text) throw new Error(result.error ?? "No speech was recognised.");
          await executeVoiceCommand(result.text.trim());
        } catch (error) {
          setReply(error instanceof Error ? error.message : "Speech could not be transcribed."); setVoiceState("idle");
        }
      };
      setVoiceSeconds(0); setReply(""); setVoiceState("listening"); setState("listening"); recorder.start();
      silenceFrameRef.current = window.requestAnimationFrame(monitorSilence);
      timerRef.current = window.setInterval(() => setVoiceSeconds((value) => {
        if (value >= 14) recorder.stop();
        return value + 1;
      }), 1000);
    } catch (error) {
      setReply(error instanceof Error ? error.message : "Microphone permission was denied."); setVoiceState("idle"); setState("idle");
    }
  }

  const voiceLabel = voiceState === "listening" ? `Listening · ${voiceSeconds}s · tap to finish`
    : voiceState === "transcribing" ? "Transcribing voice command…"
      : voiceState === "executing" ? "Executing verified command…" : "Voice command";
  return <>
    {view === "home" && createPortal(<div className="quick-command-layer"><div className="quick-command-shell">
      <section className="quick-chat">
        <form onSubmit={submit} className="quick-chat-form"><div className="quick-chat-icon"><MessageSquareText size={20} /></div><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask Sentinel anything…" aria-label="Quick message to Sentinel" /><button type="submit" disabled={!message.trim() || loading} aria-label="Send quick message">{loading ? <LoaderCircle className="quick-chat-spin" size={20} /> : <ArrowUp size={20} />}</button></form>
        {(reply || loading || voiceState !== "idle") && <div className={`quick-chat-reply ${voiceState === "listening" ? "is-listening" : ""}`}>{voiceState === "listening" ? <Mic size={18} /> : <Bot size={18} />}<p>{voiceState !== "idle" ? voiceLabel : loading ? "Sentinel is processing your request…" : reply}</p>{!loading && voiceState === "idle" && <button onClick={() => setReply("")} aria-label="Close reply"><X size={17} /></button>}</div>}
      </section>
      <button className={`home-voice-button ${voiceState !== "idle" ? `is-${voiceState}` : ""}`} onClick={() => void toggleVoice()} disabled={voiceState === "transcribing" || voiceState === "executing"} aria-label={voiceLabel} title={voiceLabel}>{voiceState === "transcribing" || voiceState === "executing" ? <LoaderCircle className="quick-chat-spin" /> : voiceState === "listening" ? <MicOff /> : <Mic />}</button>
      <button className={`home-realtime-button ${realtimeOpen ? `is-${realtimeState}` : ""}`} onClick={() => realtimeOpen ? setRealtimePanelVisible((visible) => !visible) : void startRealtime()} aria-label={realtimeOpen ? "Show or minimise live conversation" : "Start live conversation"} title="Live conversation"><AudioLines /></button>
    </div></div>, document.body)}
    {camera && <LiveCamera device={camera} stream={cameraStream} status={cameraStatus} muted={cameraMuted} onMuted={() => setCameraMuted((value) => !value)} onRetry={() => void openCamera(camera)} onClose={() => void closeCamera()} />}
    {realtimeOpen && realtimePanelVisible && createPortal(<div className="home-realtime-backdrop">
      <section className="home-realtime-panel">
        <header><div><span>LIVE CONVERSATION · PERSISTENT</span><h2>Talk with Sentinel</h2></div><button onClick={() => setRealtimePanelVisible(false)} aria-label="Minimise live conversation"><X /></button></header>
        <div className={`home-realtime-orb is-${realtimeState}`}><AudioLines /><i /><i /><i /></div>
        <div className="home-realtime-status"><strong>{realtimeState === "connecting" ? "Connecting securely" : realtimeState === "listening" ? "Listening" : realtimeState === "thinking" ? "Thinking" : realtimeState === "speaking" ? "Sentinel is speaking" : realtimeState === "error" ? "Connection interrupted" : "Ready"}</strong><small>{realtimeState === "listening" ? "Move between pages or speak naturally · session ends after 30 seconds of silence." : realtimeState === "speaking" ? "You can interrupt at any time." : "Conversation memory and page controls remain active"}</small></div>
        {realtimeLines.length > 0 && <div className="home-realtime-transcript" ref={realtimeTranscriptRef}>{realtimeLines.map((line) => <p key={line.id} className={`is-${line.speaker}`}><b>{line.speaker === "you" ? "YOU" : "SENTINEL"}</b>{line.text}</p>)}</div>}
        {realtimeError && <div className="home-realtime-error">{realtimeError}</div>}
        <footer><button onClick={toggleRealtimeMute} className={realtimeMuted ? "is-muted" : ""}>{realtimeMuted ? <MicOff /> : <Mic />}{realtimeMuted ? "Unmute" : "Mute"}</button>{realtimeState === "error" && <button onClick={() => void startRealtime()}><RefreshCw />Reconnect</button>}<button className="is-end" onClick={endRealtime}><PhoneOff />End conversation</button></footer>
      </section>
    </div>, document.body)}
  </>;
}
