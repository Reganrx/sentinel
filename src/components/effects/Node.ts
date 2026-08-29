export default class Node {

  x: number;

  y: number;

  vx: number;

  vy: number;

  radius: number;

  opacity: number;

  constructor() {

    this.x = (Math.random() - 0.5) * 160;

    this.y = (Math.random() - 0.5) * 160;

    this.vx = (Math.random() - 0.5) * 0.45;

    this.vy = (Math.random() - 0.5) * 0.45;

    this.radius = 2 + Math.random() * 2.5;

    this.opacity = 0.35 + Math.random() * 0.65;

  }

  update(

    _centerX: number,

    _centerY: number,

    multiplier = 1

  ) {

    this.x += this.vx * multiplier;

    this.y += this.vy * multiplier;

    const limit = 82;

    if (

      this.x > limit ||

      this.x < -limit

    ) {

      this.vx *= -1;

    }

    if (

      this.y > limit ||

      this.y < -limit

    ) {

      this.vy *= -1;

    }

  }

  draw(
    ctx: CanvasRenderingContext2D
  ) {

    ctx.beginPath();

    ctx.arc(

      this.x,

      this.y,

      this.radius,

      0,

      Math.PI * 2

    );

    ctx.fillStyle = `rgba(120,246,255,${this.opacity})`;

    ctx.shadowBlur = 16;

    ctx.shadowColor = "#00D8FF";

    ctx.fill();

    ctx.shadowBlur = 0;

  }

  get screenX(): number {

    return this.x;

  }

  get screenY(): number {

    return this.y;

  }

  set screenX(
    value: number
  ) {

    this.x = value;

  }

  set screenY(
    value: number
  ) {

    this.y = value;

  }

}