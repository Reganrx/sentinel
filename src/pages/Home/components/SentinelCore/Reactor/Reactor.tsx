import type { CSSProperties } from "react";
import "./Reactor.css";

export type ReactorState =
  | "offline"
  | "initialising"
  | "idle"
  | "listening"
  | "thinking"
  | "streaming"
  | "speaking"
  | "warning"
  | "critical";

export interface ReactorProps {
  state?: ReactorState;
  size?: number;
  intensity?: number;
  className?: string;
  interactive?: boolean;
}

const clampAngles = [45, 135, 225, 315];
const ticks = Array.from({ length: 48 }, (_, index) => index);
const nodes = Array.from({ length: 16 }, (_, index) => index);
const particles = Array.from({ length: 6 }, (_, index) => index);

function ReactorDefs() {
  return (
    <defs>
      <radialGradient id="reactor-core" cx="38%" cy="30%">
        <stop offset="0%" stopColor="#ffffff" /><stop offset="13%" stopColor="var(--sentinel-accent-light)" /><stop offset="42%" stopColor="var(--sentinel-accent)" /><stop offset="76%" stopColor="var(--sentinel-accent)" stopOpacity=".72" /><stop offset="100%" stopColor="#031329" />
      </radialGradient>
      <radialGradient id="reactor-glass" cx="34%" cy="22%">
        <stop offset="0%" stopColor="var(--sentinel-accent-light)" stopOpacity=".58" /><stop offset="26%" stopColor="var(--sentinel-accent)" stopOpacity=".17" /><stop offset="72%" stopColor="#071b3d" stopOpacity=".45" /><stop offset="100%" stopColor="#020711" stopOpacity=".9" />
      </radialGradient>
      <linearGradient id="reactor-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#91a7c2" /><stop offset="15%" stopColor="#334861" /><stop offset="48%" stopColor="#101c2d" /><stop offset="78%" stopColor="#304967" /><stop offset="100%" stopColor="#090f1c" />
      </linearGradient>
      <linearGradient id="reactor-arm" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#667b95" /><stop offset="14%" stopColor="#17263b" /><stop offset="78%" stopColor="#0a1321" /><stop offset="100%" stopColor="#4f6680" />
      </linearGradient>
      <filter id="reactor-bloom" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="10" result="blur" /><feColorMatrix in="blur" type="matrix" values="1 0 0 0 0 0 1 0 0 .35 0 0 1 0 1 0 0 0 1 0" result="blueBlur" /><feMerge><feMergeNode in="blueBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="reactor-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#00030a" floodOpacity=".85" /></filter>
      <radialGradient id="reactor-scan" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="var(--sentinel-accent-light)" stopOpacity=".58" /><stop offset="64%" stopColor="var(--sentinel-accent)" stopOpacity=".16" /><stop offset="100%" stopColor="var(--sentinel-accent)" stopOpacity="0" /></radialGradient>
    </defs>
  );
}

function Clamp({ angle }: { angle: number }) {
  return <g className="reactor-clamp" transform={`rotate(${angle} 400 400)`}>
    <path className="reactor-clamp-shadow" d="M330 30 L470 30 L489 242 L449 287 L351 287 L311 242 Z" />
    <path className="reactor-clamp-body" d="M333 20 L467 20 L485 232 L444 277 L356 277 L315 232 Z" />
    <path className="reactor-clamp-cap" d="M343 28 L457 28 L466 83 L334 83 Z" />
    <path className="reactor-clamp-edge" d="M349 39 L451 39 L457 65 L343 65 Z" />
    <path className="reactor-clamp-recess" d="M347 94 L453 94 L465 217 L435 251 L365 251 L335 217 Z" />
    <path className="reactor-clamp-spine" d="M382 95 H418 L428 231 H372 Z" />
    <rect className="reactor-clamp-light" x="359" y="119" width="13" height="56" rx="3" /><rect className="reactor-clamp-light" x="382" y="119" width="13" height="56" rx="3" /><rect className="reactor-clamp-light" x="405" y="119" width="13" height="56" rx="3" />
    <path className="reactor-clamp-rail" d="M327 220 L473 220 L458 258 L342 258 Z" />
    {[[-1, 52], [1, 52], [-1, 206], [1, 206], [-1, 254], [1, 254]].map(([side, y], index) => <circle key={index} className="reactor-bolt" cx={400 + side * (y === 254 ? 42 : 48)} cy={y} r="5" />)}
  </g>;
}

export default function Reactor({ state = "idle", size = 480, intensity = 1, className, interactive = false }: ReactorProps) {
  const style = { "--reactor-user-intensity": intensity } as CSSProperties;
  const classes = ["sentinel-reactor-art", `is-${state}`, interactive && "is-interactive", className].filter(Boolean).join(" ");
  return <svg className={classes} style={style} width={size} height={size} viewBox="0 0 800 800" role="img" aria-label={`Sentinel reactor is ${state}`}>
    <title>Sentinel reactor</title><ReactorDefs />
    <g className="reactor-hud" aria-hidden="true"><circle className="reactor-hud-ring reactor-hud-ring--outer" cx="400" cy="400" r="382" /><circle className="reactor-hud-ring reactor-hud-ring--inner" cx="400" cy="400" r="340" />{ticks.map((tick) => <line key={tick} className={tick % 6 === 0 ? "reactor-tick reactor-tick--major" : "reactor-tick"} x1="400" y1="16" x2="400" y2={tick % 6 === 0 ? "51" : "36"} transform={`rotate(${tick * 7.5} 400 400)`} />)}<path className="reactor-crosshair" d="M12 400 H788 M400 12 V788" /><path className="reactor-axis-beam" d="M25 400 H775 M400 25 V775" /><path className="reactor-axis-hot" d="M96 400 H704 M400 96 V704" /></g>
    <g className="reactor-bloom" filter="url(#reactor-bloom)"><circle cx="400" cy="400" r="276" /><circle cx="400" cy="400" r="208" /></g>
    <g className="reactor-machine" filter="url(#reactor-shadow)"><circle className="reactor-outer-shell" cx="400" cy="400" r="292" /><circle className="reactor-outer-inset" cx="400" cy="400" r="268" /><circle className="reactor-rail reactor-rail--outer" cx="400" cy="400" r="251" /><circle className="reactor-rail reactor-rail--middle" cx="400" cy="400" r="223" />{nodes.map((node) => <g key={node} transform={`rotate(${node * 22.5} 400 400)`}><rect className="reactor-segment" x="386" y="125" width="28" height="47" rx="4" /><circle className="reactor-segment-bolt" cx="400" cy="142" r="2.4" /></g>)}</g>
    <g className="reactor-energy"><circle className="reactor-energy-ring reactor-energy-ring--one" cx="400" cy="400" r="211" /><circle className="reactor-energy-ring reactor-energy-ring--two" cx="400" cy="400" r="181" /><circle className="reactor-energy-ring reactor-energy-ring--three" cx="400" cy="400" r="148" /><circle className="reactor-dash-ring" cx="400" cy="400" r="196" /><circle className="reactor-dash-ring reactor-dash-ring--reverse" cx="400" cy="400" r="165" /></g>
    <g className="reactor-state-effects" aria-hidden="true">
      <path className="reactor-idle-sweep" d="M400 50 A350 350 0 0 1 647 153" />
      <g className="reactor-orbit-particles">{particles.map((particle) => <circle key={particle} cx="400" cy="54" r={particle % 2 ? 2.5 : 4} transform={`rotate(${particle * 60} 400 400)`} />)}</g>
      <path className="reactor-scan-cone" d="M400 400 L318 78 A332 332 0 0 1 482 78 Z" />
      <circle className="reactor-listen-pulse" cx="400" cy="400" r="132" />
      <circle className="reactor-listen-pulse reactor-listen-pulse--late" cx="400" cy="400" r="132" />
      <g className="reactor-processing-nodes">{Array.from({ length: 12 }, (_, index) => <circle key={index} cx="400" cy="220" r="4" transform={`rotate(${index * 30} 400 400)`} />)}</g>
      <path className="reactor-stream reactor-stream--horizontal" d="M76 400 H724" /><path className="reactor-stream reactor-stream--vertical" d="M400 76 V724" />
      <circle className="reactor-stream-orb reactor-stream-orb--one" cx="400" cy="400" r="8" /><circle className="reactor-stream-orb reactor-stream-orb--two" cx="400" cy="400" r="5" />
    </g>
    {clampAngles.map((angle) => <Clamp key={angle} angle={angle} />)}
    <g className="reactor-core-assembly"><circle className="reactor-core-frame" cx="400" cy="400" r="133" /><circle className="reactor-core-glass" cx="400" cy="400" r="120" /><circle className="reactor-core-lens" cx="400" cy="400" r="98" /><circle className="reactor-core-orbit" cx="400" cy="400" r="84" />{nodes.slice(0, 8).map((node) => <circle key={node} className="reactor-core-node" cx="400" cy="307" r="3.5" transform={`rotate(${node * 45} 400 400)`} />)}<path className="reactor-hex" d="M400 341 L451 370 L451 430 L400 459 L349 430 L349 370 Z" /><path className="reactor-hex reactor-hex--inner" d="M400 361 L434 381 L434 419 L400 439 L366 419 L366 381 Z" /><circle className="reactor-kernel" cx="400" cy="400" r="49" /><path className="reactor-mark" d="M421 380 C413 371 399 368 387 373 C375 378 375 389 388 394 L411 403 C424 408 425 420 413 427 C400 435 385 430 378 421 M379 378 L421 422" /></g>
  </svg>;
}
