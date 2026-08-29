export default class Particle {

    angle: number;
    distance: number;
    speed: number;
    radius: number;
    opacity: number;

    constructor() {

        this.angle = Math.random() * Math.PI * 2;

        this.distance = 70 + Math.random() * 90;

        this.speed = 0.002 + Math.random() * 0.004;

        this.radius = 2 + Math.random() * 3;

        this.opacity = 0.3 + Math.random() * 0.7;

    }

    update() {

        this.angle += this.speed;

    }

    draw(
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number
    ) {

        const x =
            centerX +
            Math.cos(this.angle) * this.distance;

        const y =
            centerY +
            Math.sin(this.angle) * this.distance;

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            this.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = `rgba(120,246,255,${this.opacity})`;

        ctx.shadowColor = "#00D8FF";
        ctx.shadowBlur = 12;

        ctx.fill();

    }

}