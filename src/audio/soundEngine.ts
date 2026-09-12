import type { SentinelState } from "../state/SentinelContext";

type ReactorState = SentinelState | null;

class SoundEngine {
  private context: AudioContext | null = null;
  private enabled = true;
  private volume = .45;
  private reactorState: ReactorState = null;
  private reactorMuted = false;
  private reactorNodes: { oscillators: OscillatorNode[]; gains: GainNode[] } | null = null;

  configure(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = volume;
    if (!enabled) this.stopReactor();
    else this.applyReactorState();
  }

  setReactorMuted(muted: boolean) {
    this.reactorMuted = muted;
    if (muted) this.stopReactor();
    else this.applyReactorState();
  }

  private getContext() {
    if (!this.context) this.context = new AudioContext();
    void this.context.resume();
    return this.context;
  }

  playNavigation() {
    if (!this.enabled) return;
    const context = this.getContext();
    const now = context.currentTime;
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(370, now);
    oscillator.frequency.exponentialRampToValueAtTime(720, now + .09);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.1 * this.volume, now + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .16);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now); oscillator.stop(now + .18);
    this.applyReactorState();
  }

  playStartupCue(stage: "power" | "systems" | "online") {
    if (!this.enabled) return;
    const context = this.getContext();
    const now = context.currentTime;
    const level = this.volume;

    // A small, scored three-act boot rather than unrelated UI bleeps.
    if (stage === "power") {
      this.playSweep(context, now, 42, 76, 1.35, .09 * level, "sine");
      this.playSweep(context, now + .08, 84, 151, 1.16, .026 * level, "sine");
      return;
    }

    if (stage === "systems") {
      [220, 277.18, 329.63].forEach((frequency, index) =>
        this.playSweep(context, now + index * .16, frequency, frequency * 1.04, .5, .047 * level, "triangle")
      );
      return;
    }

    // The final chord lands with the visual flare and leaves room for speech.
    [196, 293.66, 392].forEach((frequency, index) =>
      this.playSweep(context, now + index * .018, frequency * .96, frequency, 1.05, .058 * level, "sine")
    );
  }

  private playSweep(context: AudioContext, startAt: number, start: number, end: number, duration: number, level: number, type: OscillatorType) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(end, startAt + duration * .72);
    gain.gain.setValueAtTime(.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(level, startAt + Math.min(.1, duration * .18));
    gain.gain.exponentialRampToValueAtTime(.0001, startAt + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + .03);
  }

  setReactorState(state: ReactorState) {
    this.reactorState = state;
    this.applyReactorState();
  }

  private applyReactorState() {
    if (!this.enabled || this.reactorMuted || !this.reactorState) { this.stopReactor(); return; }
    const context = this.getContext();
    const profiles: Record<SentinelState, [number, number]> = {
      initialising: [39, .016],
      idle: [48, .025], listening: [62, .035], thinking: [86, .047], streaming: [112, .055], offline: [30, .008],
    };
    const [frequency, level] = profiles[this.reactorState];
    if (!this.reactorNodes) {
      const low = context.createOscillator(); const shimmer = context.createOscillator();
      const lowGain = context.createGain(); const shimmerGain = context.createGain();
      const lfo = context.createOscillator(); const lfoGain = context.createGain();
      low.type = "sine"; shimmer.type = "triangle"; lfo.type = "sine";
      // Begin silent, then let the Home reactor emerge gradually.  Starting a
      // fresh oscillator at its default gain caused a short click/thump when
      // returning to Home.
      lowGain.gain.value = .0001;
      shimmerGain.gain.value = .0001;
      low.connect(lowGain).connect(context.destination); shimmer.connect(shimmerGain).connect(context.destination);
      lfo.connect(lfoGain).connect(lowGain.gain); lfoGain.gain.value = .007;
      low.start(); shimmer.start(); lfo.start();
      this.reactorNodes = { oscillators: [low, shimmer, lfo], gains: [lowGain, shimmerGain, lfoGain] };
    }
    const [low, shimmer, lfo] = this.reactorNodes.oscillators;
    const [lowGain, shimmerGain] = this.reactorNodes.gains;
    const now = context.currentTime;
    low.frequency.setTargetAtTime(frequency, now, .18);
    shimmer.frequency.setTargetAtTime(frequency * 2.01, now, .18);
    const animationRate: Record<SentinelState, number> = {
      initialising: .42,
      idle: .2, listening: 1 / 1.8, thinking: 2.4, streaming: 1 / .72, offline: .08,
    };
    lfo.frequency.setTargetAtTime(animationRate[this.reactorState], now, .2);
    lowGain.gain.setTargetAtTime(level * this.volume, now, .42);
    shimmerGain.gain.setTargetAtTime(level * .28 * this.volume, now, .42);
  }

  private stopReactor() {
    if (!this.reactorNodes || !this.context) return;
    const { oscillators } = this.reactorNodes;
    const now = this.context.currentTime;
    this.reactorNodes.gains.forEach(gain => gain.gain.setTargetAtTime(.0001, now, .08));
    window.setTimeout(() => oscillators.forEach(oscillator => oscillator.stop()), 450);
    this.reactorNodes = null;
  }
}

export const soundEngine = new SoundEngine();
