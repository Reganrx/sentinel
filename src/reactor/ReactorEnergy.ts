import type { ReactorLink } from "./ReactorLinks";

export interface EnergyPulse {

  link: ReactorLink;

  progress: number;

  speed: number;

}

export function createEnergy(
  links: ReactorLink[]
): EnergyPulse[] {

  return links.map(link => ({

    link,

    progress: Math.random(),

    speed:
      0.002 +
      Math.random() * 0.004,

  }));

}

export function updateEnergy(
  pulses: EnergyPulse[],
  speedMultiplier: number
) {

  for (const pulse of pulses) {

    pulse.progress +=
      pulse.speed * speedMultiplier;

    if (pulse.progress > 1) {

      pulse.progress = 0;

    }

  }

}

export function drawEnergy(
  ctx: CanvasRenderingContext2D,
  pulses: EnergyPulse[]
) {

  for (const pulse of pulses) {

    const x =
      pulse.link.from.x +
      (pulse.link.to.x - pulse.link.from.x) *
      pulse.progress;

    const y =
      pulse.link.from.y +
      (pulse.link.to.y - pulse.link.from.y) *
      pulse.progress;

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      2.2,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = "#7EF5FF";

    ctx.shadowBlur = 16;
    ctx.shadowColor = "#00D8FF";

    ctx.fill();

    ctx.shadowBlur = 0;

  }

}