export function lerp(
  start: number,
  end: number,
  amount: number
) {
  return start + (end - start) * amount;
}

export function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.min(max, Math.max(min, value));
}

export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  return Math.sqrt(dx * dx + dy * dy);
}

export function random(
  min: number,
  max: number
) {
  return Math.random() * (max - min) + min;
}

export function radians(
  degrees: number
) {
  return degrees * Math.PI / 180;
}