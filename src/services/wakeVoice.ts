export const WAKE_ENABLED_KEY = "sentinel-wake-listening-enabled";
export const WAKE_PHRASES_KEY = "sentinel-wake-phrases";
export const SLEEP_PHRASES_KEY = "sentinel-sleep-phrases";
export const WAKE_SENSITIVITY_KEY = "sentinel-wake-sensitivity";
export const WAKE_TONES_KEY = "sentinel-wake-tones";
export const WAKE_ACTIVITY_KEY = "sentinel-wake-activity";

export type WakeActivityKind = "enabled" | "disabled" | "wake" | "sleep" | "developer-lock" | "developer-unlock" | "microphone-error";
export type WakeActivity = { id: string; kind: WakeActivityKind; label: string; at: string };

export const defaultWakePhrases = ["hey sentinel wake up", "hey sentinel start listening", "hey sentinel start a chat"];
export const defaultSleepPhrases = ["hey sentinel shutdown", "hey sentinel go to standby"];

export function readPhraseList(key: string, fallback: string[]) {
  const saved = localStorage.getItem(key);
  return saved ? saved.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean).slice(0, 6) : fallback;
}

export function getWakeActivity(): WakeActivity[] {
  try { return JSON.parse(localStorage.getItem(WAKE_ACTIVITY_KEY) ?? "[]") as WakeActivity[]; }
  catch { return []; }
}

export function recordWakeActivity(kind: WakeActivityKind, label: string) {
  const activity = [{ id: crypto.randomUUID(), kind, label, at: new Date().toISOString() }, ...getWakeActivity()].slice(0, 30);
  localStorage.setItem(WAKE_ACTIVITY_KEY, JSON.stringify(activity));
  window.dispatchEvent(new CustomEvent("sentinel:wake-activity", { detail: { activity } }));
}

export function clearWakeActivity() {
  localStorage.removeItem(WAKE_ACTIVITY_KEY);
  window.dispatchEvent(new CustomEvent("sentinel:wake-activity", { detail: { activity: [] } }));
}

export function playWakeTone(kind: "wake" | "sleep") {
  if (localStorage.getItem(WAKE_TONES_KEY) === "false") return;
  try {
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.34);
    gain.connect(context.destination);
    const frequencies = kind === "wake" ? [520, 720] : [620, 390];
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.1);
      oscillator.stop(context.currentTime + 0.2 + index * 0.1);
    });
    window.setTimeout(() => void context.close(), 600);
  } catch { /* Confirmation tones are optional. */ }
}
