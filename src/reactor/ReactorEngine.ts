export type ReactorMode =
  | "offline"
  | "idle"
  | "thinking"
  | "streaming"
  | "listening";

export interface ReactorState {

  mode: ReactorMode;

  pulseSpeed: number;

  glow: number;

  particleSpeed: number;

  nodeIntensity: number;

  linkBrightness: number;

}

const STATES: Record<
  ReactorMode,
  ReactorState
> = {

  offline:{
    mode:"offline",
    pulseSpeed:0,
    glow:0,
    particleSpeed:0,
    nodeIntensity:.1,
    linkBrightness:0,
  },

  idle:{
    mode:"idle",
    pulseSpeed:.8,
    glow:.35,
    particleSpeed:.35,
    nodeIntensity:.45,
    linkBrightness:.2,
  },

  thinking:{
    mode:"thinking",
    pulseSpeed:2,
    glow:.75,
    particleSpeed:1.25,
    nodeIntensity:.9,
    linkBrightness:.6,
  },

  streaming:{
    mode:"streaming",
    pulseSpeed:3,
    glow:1,
    particleSpeed:2,
    nodeIntensity:1,
    linkBrightness:1,
  },

  listening:{
    mode:"listening",
    pulseSpeed:1.5,
    glow:.65,
    particleSpeed:.8,
    nodeIntensity:.8,
    linkBrightness:.45,
  },

};

export class ReactorEngine {

  private mode: ReactorMode = "idle";

  private entered = performance.now();

  setMode(
    mode: ReactorMode
  ){

    if(mode===this.mode) return;

    this.mode=mode;

    this.entered=performance.now();

  }

  getState(){

    return STATES[this.mode];

  }

  getMode(){

    return this.mode;

  }

  getElapsed(){

    return performance.now()-this.entered;

  }

}
export function getReactorState(
  mode: ReactorMode
): ReactorState {
  return STATES[mode];
}