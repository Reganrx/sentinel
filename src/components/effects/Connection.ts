import Node from "./Node";

export default class Connection {
  static draw(
    ctx: CanvasRenderingContext2D,
    a: Node,
    b: Node
  ) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;

    const distance = Math.sqrt(
      dx * dx + dy * dy
    );

    const maxDistance = 55;

    if (distance > maxDistance) return;

    const opacity =
      1 - distance / maxDistance;

    ctx.beginPath();

    ctx.moveTo(a.x, a.y);

    ctx.lineTo(b.x, b.y);

    ctx.strokeStyle = `rgba(0,216,255,${
      opacity * 0.35
    })`;

    ctx.lineWidth = 1.2;

    ctx.shadowBlur = 6;

    ctx.shadowColor = "#00D8FF";

    ctx.stroke();

    ctx.shadowBlur = 0;
  }
}