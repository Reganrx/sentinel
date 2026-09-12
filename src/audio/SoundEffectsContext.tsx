import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { SentinelState } from "../state/SentinelContext";
import { soundEngine } from "./soundEngine";
import startupWelcome from "../assets/welcome-jarvis.mp3";

type StartupAudioHandlers = {
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onUnavailable?: () => void;
};

type SoundEffects = { enabled: boolean; volume: number; setEnabled: (enabled: boolean) => void; setVolume: (volume: number) => void; playNavigation: () => void; playStartupCue: (stage: "power" | "systems" | "online") => void; playStartupWelcome: (resumeBootAudio?: boolean, handlers?: StartupAudioHandlers) => void; fadeStartupWelcome: (durationMs?: number) => void; setReactorState: (state: SentinelState | null) => void; setReactorMuted: (muted: boolean) => void };
const SoundEffectsContext = createContext<SoundEffects | null>(null);
const enabledKey = "sentinel-sound-effects-enabled";
const volumeKey = "sentinel-sound-effects-volume";

export function SoundEffectsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(() => localStorage.getItem(enabledKey) !== "false");
  const [volume, setVolumeState] = useState(() => Number(localStorage.getItem(volumeKey) ?? .45));
  const startupAudio = useRef<HTMLAudioElement | null>(null);
  const startupFade = useRef<number | null>(null);
  useEffect(() => { soundEngine.configure(enabled, volume); localStorage.setItem(enabledKey, String(enabled)); localStorage.setItem(volumeKey, String(volume)); }, [enabled, volume]);
  const playStartupWelcome = useCallback((resumeBootAudio = false, handlers: StartupAudioHandlers = {}) => {
    if (!enabled) {
      handlers.onUnavailable?.();
      return;
    }

    if (startupFade.current !== null) window.clearInterval(startupFade.current);
    startupFade.current = null;
    startupAudio.current?.pause();
    const audio = new Audio(startupWelcome);
    startupAudio.current = audio;
    const initialVolume = Math.min(1, volume);
    const bootStarted = Number(localStorage.getItem("sentinel-boot-audio-started") ?? 0);
    const resumeAt = resumeBootAudio && bootStarted ? Math.max(0, (Date.now() - bootStarted) / 1000) : 0;
    localStorage.removeItem("sentinel-boot-audio-started");
    audio.volume = resumeAt ? initialVolume : 0;
    const reportProgress = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 37;
      const remaining = duration - audio.currentTime;
      if (remaining <= 2.5) audio.volume = Math.min(audio.volume, initialVolume * Math.max(0, remaining / 2.5));
      handlers.onProgress?.(audio.currentTime, duration);
    };
    audio.addEventListener("timeupdate", reportProgress);
    audio.addEventListener("ended", () => {
      handlers.onProgress?.(audio.duration, audio.duration);
      if (startupAudio.current === audio) startupAudio.current = null;
      handlers.onEnded?.();
    }, { once: true });
    audio.addEventListener("error", () => handlers.onUnavailable?.(), { once: true });
    audio.addEventListener("loadedmetadata", () => {
      if (resumeAt && Number.isFinite(audio.duration)) audio.currentTime = Math.min(resumeAt, Math.max(0, audio.duration - .2));
      reportProgress();
      // The supplied file has a sharp first transient; fade it in so it does
      // not resemble a navigation click when the Home screen appears.
      if (resumeAt) return;
      const fadeInSteps = 12;
      const fadeIn = window.setInterval(() => {
        audio.volume = Math.min(initialVolume, audio.volume + initialVolume / fadeInSteps);
        if (audio.volume >= initialVolume) window.clearInterval(fadeIn);
      }, 18);

    }, { once: true });
    void audio.play().catch(() => handlers.onUnavailable?.());
  }, [enabled, volume]);
  const fadeStartupWelcome = useCallback((durationMs = 320) => {
    const audio = startupAudio.current;
    if (!audio || audio.paused || startupFade.current !== null) return;
    const steps = 20;
    const startingVolume = audio.volume;
    startupFade.current = window.setInterval(() => {
      audio.volume = Math.max(0, audio.volume - startingVolume / steps);
      if (audio.volume <= 0) {
        if (startupFade.current !== null) window.clearInterval(startupFade.current);
        startupFade.current = null;
        audio.pause();
        audio.currentTime = 0;
        if (startupAudio.current === audio) startupAudio.current = null;
      }
    }, Math.max(10, durationMs / steps));
  }, []);
  const setReactorMuted = useCallback((muted: boolean) => soundEngine.setReactorMuted(muted), []);
  return <SoundEffectsContext.Provider value={{ enabled, volume, setEnabled: setEnabledState, setVolume: value => setVolumeState(Math.max(0, Math.min(1, value))), playNavigation: () => soundEngine.playNavigation(), playStartupCue: stage => soundEngine.playStartupCue(stage), playStartupWelcome, fadeStartupWelcome, setReactorState: state => soundEngine.setReactorState(state), setReactorMuted }}>{children}</SoundEffectsContext.Provider>;
}

export function useSoundEffects() {
  const context = useContext(SoundEffectsContext);
  if (!context) throw new Error("useSoundEffects must be used inside SoundEffectsProvider.");
  return context;
}
