import Node from "./Node";
import Connection from "./Connection";

export default class Renderer {
  static render(
    ctx: CanvasRenderingContext2D,
    nodes: Node[],
    centerX: number,
    centerY: number,
    glowRadius: number,
    pulse: number,
    multiplier = 1
  ) {
    // ==========================
    // Reactor Glow
    // ==========================

    const glow = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      glowRadius
    );

    glow.addColorStop(0, "rgba(0,220,255,.75)");
    glow.addColorStop(0.35, "rgba(0,220,255,.18)");
    glow.addColorStop(1, "rgba(0,220,255,0)");

    ctx.fillStyle = glow;

    ctx.beginPath();
    ctx.arc(
      centerX,
      centerY,
      glowRadius,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // ==========================
    // Update Nodes
    // ==========================

    for (const node of nodes) {
      node.update(centerX, centerY, multiplier);
    }

    // ==========================
    // Draw Connections
    // ==========================

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        Connection.draw(
          ctx,
          nodes[i],
          nodes[j]
        );
      }
    }

    // ==========================
    // Draw Nodes
    // ==========================

    for (const node of nodes) {
      node.draw(ctx);
    }

    // ==========================
    // Orbit Ring
    // ==========================

    ctx.beginPath();

    ctx.arc(
      centerX,
      centerY,
      72 + Math.sin(pulse * 0.5) * 2,
      0,
      Math.PI * 2
    );

    ctx.strokeStyle = "rgba(0,216,255,.08)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ==========================
    // Reactor Core
    // ==========================

    const radius =
      16 +
      Math.sin(pulse) * 2.5;

    ctx.beginPath();

    ctx.arc(
      centerX,
      centerY,
      radius,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = "#74F6FF";

    ctx.shadowColor = "#00D8FF";
    ctx.shadowBlur = glowRadius / 3;

    ctx.fill();

    ctx.shadowBlur = 0;

    // ==========================
    // Inner Core
    // ==========================

    ctx.beginPath();

    ctx.arc(
      centerX,
      centerY,
      radius * 0.45,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.fill();
  }
}