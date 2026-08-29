import { Ear, EarOff, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigation } from "../navigation/NavigationContext";
import { API_URL } from "../services/api";
import { lockDeveloperMode } from "../services/developer";
import { defaultSleepPhrases, defaultWakePhrases, playWakeTone, readPhraseList, recordWakeActivity, SLEEP_PHRASES_KEY, WAKE_ENABLED_KEY, WAKE_PHRASES_KEY, WAKE_SENSITIVITY_KEY } from "../services/wakeVoice";

type WakeState = "off" | "standby" | "hearing" | "processing" | "paused" | "error";

export default function WakeWordButton({ hidden = false }: { hidden?: boolean }) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(WAKE_ENABLED_KEY) === "true");
  const [liveConversationOpen, setLiveConversationOpen] = useState(false);
  const [state, setState] = useState<WakeState>(enabled ? "standby" : "off");
  const [settingsRevision, setSettingsRevision] = useState(0);
  const { navigate } = useNavigation();
  const activeRef = useRef(true);

  useEffect(() => {
    const update = (event: Event) => {
      const open = Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open);
      setLiveConversationOpen(open);
      if (enabled) setState(open ? "paused" : "standby");
    };
    window.addEventListener("sentinel:live-conversation-state", update);
    return () => window.removeEventListener("sentinel:live-conversation-state", update);
  }, [enabled]);

  useEffect(() => {
    const refresh = () => {
      const next = localStorage.getItem(WAKE_ENABLED_KEY) === "true";
      setEnabled(next);
      setState(next ? (liveConversationOpen ? "paused" : "standby") : "off");
      setSettingsRevision((revision) => revision + 1);
    };
    window.addEventListener("sentinel:wake-settings-change", refresh);
    return () => window.removeEventListener("sentinel:wake-settings-change", refresh);
  }, [liveConversationOpen]);

  useEffect(() => {
    activeRef.current = true;
    if (!enabled || liveConversationOpen) return;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let animationFrame: number | null = null;
    let retryTimer: number | null = null;

    const processPhrase = async (blob: Blob) => {
      if (!activeRef.current || blob.size < 200) return;
      setState("processing");
      try {
        const response = await fetch(`${API_URL}/audio/transcribe`, {
          method: "POST",
          headers: { "Content-Type": blob.type || "audio/webm" },
          body: blob,
        });
        const result = await response.json() as { text?: string; error?: string };
        if (!response.ok || !result.text) throw new Error(result.error ?? "Wake phrase was not recognised.");
        const phrase = result.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const wakePhrases = readPhraseList(WAKE_PHRASES_KEY, defaultWakePhrases);
        const sleepPhrases = readPhraseList(SLEEP_PHRASES_KEY, defaultSleepPhrases);
        if (/\bhey sentinel (?:unlock|open) developer mode(?: permission granted)?\b/.test(phrase)) {
          playWakeTone("wake"); recordWakeActivity("developer-unlock", "Secure Developer Mode prompt requested");
          navigate("settings");
          window.setTimeout(() => window.dispatchEvent(new Event("sentinel:developer-unlock-request")), 180);
        } else if (/\bhey sentinel lock developer mode\b/.test(phrase)) {
          await lockDeveloperMode();
          playWakeTone("sleep"); recordWakeActivity("developer-lock", "Developer Mode locked by voice");
          window.dispatchEvent(new CustomEvent("sentinel:developer-status-change", { detail: { unlocked: false } }));
        } else if (sleepPhrases.some((candidate) => phrase.includes(candidate))) {
          window.dispatchEvent(new Event("sentinel:live-conversation-end"));
        } else if (/\bhey sentinel (?:start|open|begin)(?: a)? (?:chat|conversation)\b/.test(phrase) || wakePhrases.some((candidate) => phrase.includes(candidate))) {
          recordWakeActivity("wake", `Wake phrase recognised: ${phrase}`);
          window.dispatchEvent(new Event("sentinel:live-conversation-toggle"));
        }
      } catch {
        // Standby remains quiet on failed or irrelevant speech. The visible
        // state is enough to show whether the microphone itself is healthy.
      } finally {
        if (activeRef.current) setState("standby");
      }
    };

    const begin = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
          video: false,
        });
        if (!activeRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
        audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        let noiseFloor = 0.008;
        const sensitivity = Math.max(1, Math.min(100, Number(localStorage.getItem(WAKE_SENSITIVITY_KEY) ?? 60)));
        const speechMultiplier = 3.1 - sensitivity * 0.017;
        const minimumLevel = 0.027 - sensitivity * 0.00016;
        let recorder: MediaRecorder | null = null;
        let chunks: BlobPart[] = [];
        let speechStartedAt = 0;
        let quietSince = 0;

        const monitor = () => {
          if (!activeRef.current || !stream) return;
          analyser.getByteTimeDomainData(samples);
          let energy = 0;
          for (const sample of samples) { const value = (sample - 128) / 128; energy += value * value; }
          const level = Math.sqrt(energy / samples.length);
          if (!recorder) {
            noiseFloor = noiseFloor * 0.96 + level * 0.04;
            if (level > Math.max(minimumLevel, noiseFloor * speechMultiplier)) {
              chunks = [];
              const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]
                .find((type) => MediaRecorder.isTypeSupported(type));
              const activeRecorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
              recorder = activeRecorder;
              activeRecorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
              activeRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: activeRecorder.mimeType || preferredType || "audio/webm" });
                void processPhrase(blob);
              };
              activeRecorder.start(250);
              speechStartedAt = performance.now();
              quietSince = 0;
              setState("hearing");
            }
          } else if (level > Math.max(0.011, noiseFloor * 1.55)) {
            quietSince = 0;
          } else {
            if (!quietSince) quietSince = performance.now();
            const duration = performance.now() - speechStartedAt;
            if ((performance.now() - quietSince > 1100 && duration > 650) || duration > 8500) {
              const finishedRecorder = recorder;
              recorder = null;
              finishedRecorder.stop();
            }
          }
          animationFrame = window.requestAnimationFrame(monitor);
        };
        setState("standby");
        animationFrame = window.requestAnimationFrame(monitor);
      } catch {
        setState("error");
        recordWakeActivity("microphone-error", "Standby microphone could not start");
        retryTimer = window.setTimeout(() => { if (activeRef.current) void begin(); }, 5000);
      }
    };
    void begin();
    return () => {
      activeRef.current = false;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (retryTimer) window.clearTimeout(retryTimer);
      stream?.getTracks().forEach((track) => track.stop());
      void audioContext?.close();
    };
  }, [enabled, liveConversationOpen, navigate, settingsRevision]);

  function toggle() {
    const next = !enabled;
    localStorage.setItem(WAKE_ENABLED_KEY, String(next));
    recordWakeActivity(next ? "enabled" : "disabled", next ? "Always listening enabled" : "Always listening disabled");
    setEnabled(next);
    setState(next ? (liveConversationOpen ? "paused" : "standby") : "off");
  }

  const label = !enabled ? "Enable Hey Sentinel standby" : state === "paused" ? "Wake listener paused during live conversation" : state === "hearing" ? "Listening for command" : state === "processing" ? "Checking wake phrase" : state === "error" ? "Wake listener needs microphone access" : "Hey Sentinel standby active";
  if (hidden) return null;
  return <button className={`system-wake-listener is-${state}`} onClick={toggle} title={label} aria-label={label} aria-pressed={enabled}>{state === "processing" ? <LoaderCircle className="system-wake-spin" size={14} /> : enabled ? <Ear size={14} /> : <EarOff size={14} />}<span>{!enabled ? "WAKE OFF" : state === "paused" ? "VOICE ACTIVE" : state === "hearing" ? "HEARING" : state === "processing" ? "CHECKING" : state === "error" ? "MIC ERROR" : "HEY SENTINEL"}</span></button>;
}
