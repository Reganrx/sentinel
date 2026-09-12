import { distance } from "./ReactorMath";
import type { ReactorNode } from "./ReactorNodes";

export interface ReactorLink {
  from: ReactorNode;
  to: ReactorNode;
  strength: number;
}

export function createLinks(
  nodes: ReactorNode[],
  maxDistance = 55
): ReactorLink[] {

  const links: ReactorLink[] = [];

  for (let i = 0; i < nodes.length; i++) {

    for (let j = i + 1; j < nodes.length; j++) {

      const a = nodes[i];
      const b = nodes[j];

      const d = distance(
        a.x,
        a.y,
        b.x,
        b.y
      );

      if (d > maxDistance) continue;

      links.push({

        from: a,

        to: b,

        strength: 1 - d / maxDistance,

      });

    }

  }

  return links;
}

export function drawLinks(
  ctx: CanvasRenderingContext2D,
  links: ReactorLink[],
  brightness: number
) {

  for (const link of links) {

    // Average depth of both nodes
    const depth =
      (link.from.z + link.to.z) / 2;

    const perspective =
      0.45 + ((depth + 1) * 0.275);

    const alpha =
      perspective *
      brightness *
      link.strength;

    ctx.beginPath();

    ctx.moveTo(
      link.from.x,
      link.from.y
    );

    ctx.lineTo(
      link.to.x,
      link.to.y
    );

    ctx.lineWidth =
      0.6 +
      perspective *
      1.8;

    ctx.strokeStyle =
      `rgba(0,216,255,${alpha})`;

    ctx.shadowColor = "#00D8FF";
    ctx.shadowBlur = 8 * perspective;

    ctx.stroke();

  }

  ctx.shadowBlur = 0;
}