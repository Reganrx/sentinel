import type { ReactorMode } from "./ReactorEngine";

const colours = {
  offline: "#2E3B46",
  idle: "#00AEEF",
  thinking: "#7A5CFF",
  streaming: "#00E5FF",
  listening: "#35FF88",
};

export function applyAmbient(mode: ReactorMode) {
  const colour = colours[mode];

  document.documentElement.style.setProperty(
    "--reactor-accent",
    colour
  );

  document.documentElement.style.setProperty(
    "--reactor-glow",
    `${colour}55`
  );
}