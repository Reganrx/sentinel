import { getReactorState, ReactorMode } from "./ReactorEngine";

import {
  createNodes,
  updateNodes,
  ReactorNode,
} from "./ReactorNodes";

import {
  createLinks,
  drawLinks,
  ReactorLink,
} from "./ReactorLinks";

import {
  createEnergy,
  updateEnergy,
  drawEnergy,
  EnergyPulse,
} from "./ReactorEnergy";

export class ReactorRenderer {

  private nodes: ReactorNode[] = [];
  private links: ReactorLink[] = [];
  private energy: EnergyPulse[] = [];

  constructor() {
    this.nodes = createNodes();
  }

  render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    mode: ReactorMode
  ) {

    const state = getReactorState(mode);

    const cx = width / 2;
    const cy = height / 2;

    updateNodes(this.nodes, cx, cy);

    this.links = createLinks(this.nodes);

    if (this.energy.length === 0) {
      this.energy = createEnergy(this.links);
    }

    updateEnergy(
      this.energy,
      state.particleSpeed
    );

    ctx.clearRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(
      cx,
      cy,
      0,
      cx,
      cy,
      160
    );

    glow.addColorStop(
      0,
      `rgba(0,216,255,${state.glow * 0.55})`
    );

    glow.addColorStop(
      0.5,
      `rgba(0,216,255,${state.glow * 0.12})`
    );

    glow.addColorStop(1, "rgba(0,216,255,0)");

    ctx.fillStyle = glow;

    ctx.beginPath();
    ctx.arc(cx, cy, 160, 0, Math.PI * 2);
    ctx.fill();

    drawLinks(
      ctx,
      this.links,
      state.linkBrightness
    );

    drawEnergy(ctx, this.energy);

    for (const node of this.nodes) {

      ctx.beginPath();

      ctx.arc(
        node.x,
        node.y,
        node.radius,
        0,
        Math.PI * 2
      );

      ctx.fillStyle = "#7EF5FF";
      ctx.shadowBlur = 16 * state.nodeIntensity;
      ctx.shadowColor = "#00D8FF";

      ctx.fill();
    }

    ctx.shadowBlur = 0;

    const radius =
      18 +
      Math.sin(
        performance.now() *
          0.0015 *
          state.pulseSpeed
      ) *
        3;

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      radius,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = "#74F6FF";
    ctx.shadowBlur = 45 * state.glow;
    ctx.shadowColor = "#00D8FF";
    ctx.fill();

    ctx.shadowBlur = 0;
  }
}