import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CheckCircle2, Cpu, Power, Zap } from "lucide-react";
import Reactor, { type ReactorState } from "../pages/Home/components/SentinelCore/Reactor/Reactor";
import { useSentinel } from "../state/SentinelContext";
import { useSoundEffects } from "../audio/SoundEffectsContext";
import { API_URL } from "../services/api";
import "./StartupSequence.css";
import "./StartupSequenceEpic.css";
import "./StartupSequencePrelude.css";
import "./StartupSequenceCinematic.css";

type Step = { label: string; detail: string; icon: typeof Power };

const steps: Step[] = [
  { label: "CORE POWER", detail: "Containment field stabilising", icon: Power },
  { label: "SYSTEMS LINK", detail: "Neural interface synchronised", icon: Cpu },
  { label: "ENERGY TRANSFER", detail: "Reactor operating at nominal output", icon: Zap },
];

export default function StartupSequence({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [reactorVisible, setReactorVisible] = useState(false);
  const [audioFinished, setAudioFinished] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const fallbackClock = useRef<number | null>(null);
  const finished = useRef(false);
  const { setState } = useSentinel();
  const { fadeStartupWelcome, playStartupWelcome, setReactorMuted } = useSoundEffects();
  const states: ReactorState[] = ["offline", "thinking", "streaming"];

  useEffect(() => {
    setReactorMuted(true);
    setState("offline");
    playStartupWelcome(true, {
      onProgress: currentTime => setElapsed(currentTime),
      onEnded: () => setAudioFinished(true),
      onUnavailable: () => {
        const started = performance.now();
        fallbackClock.current = window.setInterval(() => {
          const current = Math.min(37, (performance.now() - started) / 1000);
          setElapsed(current);
          if (current >= 37) {
            if (fallbackClock.current !== null) window.clearInterval(fallbackClock.current);
            fallbackClock.current = null;
            setAudioFinished(true);
          }
        }, 100);
      },
    });

    let cancelled = false;
    const checkBackend = async () => {
      try {
        const response = await fetch(`${API_URL}/`, { cache: "no-store" });
        if (!cancelled && response.ok) setBackendReady(true);
      } catch { /* Hold the final frame until core services answer. */ }
    };
    void checkBackend();
    const backendPoll = window.setInterval(checkBackend, 400);
    return () => {
      cancelled = true;
      window.clearInterval(backendPoll);
      if (fallbackClock.current !== null) window.clearInterval(fallbackClock.current);
      fadeStartupWelcome();
      setReactorMuted(false);
    };
  }, [fadeStartupWelcome, onComplete, playStartupWelcome, setReactorMuted, setState]);

  useEffect(() => {
    const nextStep = elapsed < 13 ? 0 : elapsed < 23 ? 1 : 2;
    setStep(nextStep);
    setReactorVisible(elapsed >= 4);
    setComplete(elapsed >= 31);
    setExiting(elapsed >= 35.5);
    setState(elapsed < 4 ? "initialising" : nextStep === 0 ? "offline" : nextStep === 1 ? "thinking" : "streaming");
  }, [elapsed, setState]);

  useEffect(() => {
    if (!audioFinished || !backendReady || finished.current) return;
    finished.current = true;
    const handoff = window.setTimeout(() => {
      setState("idle");
      setReactorMuted(false);
      onComplete();
    }, 350);
    return () => window.clearTimeout(handoff);
  }, [audioFinished, backendReady, onComplete, setReactorMuted, setState]);

  function skip() { if (finished.current) return; finished.current = true; window.speechSynthesis?.cancel(); fadeStartupWelcome(300); setState("idle"); setReactorMuted(false); onComplete(); }
  const reactorState = complete ? "initialising" : states[step];
  const phase = elapsed < 4 ? "cold" : elapsed < 13 ? "ignition" : elapsed < 23 ? "assembly" : elapsed < 31 ? "surge" : "online";
  const phaseLabel = { cold: "COLD BOOT", ignition: "CORE IGNITION", assembly: "SYSTEM ASSEMBLY", surge: "POWER TRANSFER", online: "SENTINEL ONLINE" }[phase];
  const progress = Math.min(100, (elapsed / 37) * 100);

  return <div style={{ "--startup-progress": `${progress}%` } as CSSProperties} className={`startup-sequence startup-sequence--${phase} ${complete ? "startup-sequence--complete" : ""} ${exiting ? "startup-sequence--exiting" : ""} ${reactorVisible ? "startup-sequence--reactor-visible" : "startup-sequence--prelude"}`}>
    <button className="startup-skip" onClick={skip}>Skip sequence</button>
    <div className="startup-cinema-bars" aria-hidden="true" />
    <div className="startup-phase-title" aria-hidden="true"><span>SEQUENCE PHASE</span><strong>{phaseLabel}</strong></div>
    <div className="startup-frame" aria-hidden="true"><i /><i /><i /><i /></div>
    <div className="startup-topline" aria-hidden="true"><span>SNTL / CORE-01</span><b>BOOT SEQUENCE</b><span>LOCAL NODE · SECURE</span></div>
    <div className="startup-grid" /><div className="startup-vignette" /><div className="startup-horizon" /><div className="startup-shockwave" aria-hidden="true" />
    <div className="startup-axis startup-axis--vertical" /><div className="startup-axis startup-axis--horizontal" />
    <div className="startup-particles" aria-hidden="true">{Array.from({ length: 22 }, (_, index) => <i key={index} style={{ "--particle": index } as CSSProperties} />)}</div>
    <div className="startup-diagnostics startup-diagnostics--left"><span>REACTOR CORE</span><strong>{complete ? "100.0" : ["07.2", "61.4", "94.8"][step]}%</strong><i /><small>CONTAINMENT STABLE</small></div>
    <div className="startup-diagnostics startup-diagnostics--right"><span>NEURAL LINK</span><strong>{complete ? "LINKED" : ["BOOT", "SYNC", "ACTIVE"][step]}</strong><i /><small>SYS. SENTINEL / 01</small></div>
    <div className="startup-orbital-readout startup-orbital-readout--left" aria-hidden="true"><b>{["01", "02", "03"][step]}</b><span>POWER PHASE</span><small>{["AWAITING IGNITION", "CORE SYNCHRONISED", "OUTPUT NOMINAL"][step]}</small></div>
    <div className="startup-orbital-readout startup-orbital-readout--right" aria-hidden="true"><b>{complete ? "100" : ["18", "67", "96"][step]}%</b><span>SYSTEM INTEGRITY</span><small>NO ANOMALIES DETECTED</small></div>
    <div className="startup-system-panels" aria-hidden="true"><div><span>CORE INTEGRITY</span><strong>OPTIMAL</strong><i /></div><div><span>NETWORK LINK</span><strong>SECURE</strong><i /></div><div><span>SECURITY SHIELD</span><strong>ARMED</strong><i /></div><div><span>LOCAL NODE</span><strong>VERIFIED</strong><i /></div></div>
    <div className="startup-prelude" aria-hidden={reactorVisible}><div className="startup-prelude-orbit" /><div className="startup-prelude-scan" /><div className="startup-prelude-signal"><i /><i /><i /><i /><i /></div><p>CONTAINMENT CHAMBER / STANDBY</p><strong>ENERGY SIGNATURE DETECTED</strong></div>
    <div className="startup-content">
      <div className="startup-eyebrow"><span /> SENTINEL OS · BOOT PROTOCOL</div>
      <div className="startup-reactor"><div className="startup-reactor-flare" /><Reactor state={reactorState} size={640} /></div>
      <div className="startup-copy"><h1>{complete ? "SENTINEL ONLINE" : steps[step].label}</h1><p>{complete ? (backendReady ? "Startup sequence complete · All systems powered up" : "Startup sequence complete · Synchronising core services") : steps[step].detail}</p></div>
      <div className="startup-steps">{steps.map((item, index) => { const Icon = item.icon; const active = index === step && !complete; const done = index < step || complete; return <div className={active ? "startup-step--active" : done ? "startup-step--done" : ""} key={item.label}>{done ? <CheckCircle2 /> : <Icon />}<span>{item.label}</span><i /></div>; })}</div>
    </div>
    <div className="startup-progress" aria-hidden="true"><i /><span>{Math.round(progress).toString().padStart(2, "0")}%</span></div><div className="startup-bottom-telemetry" aria-hidden="true"><span>SECURE BOOT <b>VERIFIED</b></span><i /><span>MEMORY MATRIX <b>ONLINE</b></span><i /><span>COMMAND BUS <b>ACTIVE</b></span></div>
  </div>;
}
