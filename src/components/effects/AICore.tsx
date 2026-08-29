import { useEffect, useRef } from "react";
import "./core.css";

import { useSentinel } from "../../state/SentinelContext";
import { ReactorRenderer } from "../../reactor/ReactorRenderer";
import type { ReactorMode } from "../../reactor/ReactorEngine";

type Props = {
  size?: number;
  fullscreen?: boolean;
};

export default function AICore({
  size = 220,
  fullscreen = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef(new ReactorRenderer());

  const { state } = useSentinel();

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const resize = () => {
      if (fullscreen) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      } else {
        canvas.width = size;
        canvas.height = size;
      }
    };

    resize();

    window.addEventListener("resize", resize);

    let animationId = 0;

    const render = () => {
      animationId = requestAnimationFrame(render);

      rendererRef.current.render(
        ctx,
        canvas.width,
        canvas.height,
        state as ReactorMode
      );
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [fullscreen, size, state]);

  return (
    <canvas
      ref={canvasRef}
      className={
        fullscreen
          ? "ai-core ai-core-fullscreen"
          : "ai-core ai-core-card"
      }
    />
  );
}