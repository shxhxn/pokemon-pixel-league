import { random } from "../../shared/world";
export const DISTRICT_WIDTH = 1152;
export const DISTRICTS = [
  "Moonlit Village",
  "Lavender Woodland",
  "Lakeside Bridges",
  "Waterfall Quarter",
  "Castle Highlands",
  "Lantern Walk",
] as const;
export const PARALLAX = {
  stars: 0.02,
  moon: 0.05,
  clouds: 0.07,
  far: 0.12,
  ridges: 0.25,
  town: 0.4,
  near: 0.65,
} as const;
// Visual randomness never consumes the gameplay generator.
export function environmentAt(worldX: number, seed: number) {
  const index = Math.floor(worldX / DISTRICT_WIDTH),
    block = Math.floor(index / 6),
    order = [0, 1, 2, 3, 4, 5],
    rng = random(seed + block * 7919);
  for (let i = 5; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const kind =
    block === 0 ? ((index % 6) + 6) % 6 : order[((index % 6) + 6) % 6];
  return { index, kind, name: DISTRICTS[kind] };
}
export function sceneryCells(
  start: number,
  width: number,
  step: number,
  padding = 700,
) {
  const first = Math.floor((start - padding) / step),
    last = Math.ceil((start + width + padding) / step);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

export function waterfallForCell(cell: number, seed: number) {
  if (environmentAt(cell * 384, seed).kind !== 3 || ((cell % 3) + 3) % 3 === 1)
    return null;
  const r = random(seed + cell * 197 + 401);
  return {
    x: cell * 384 + 130 + r() * 38,
    width: 175 + r() * 45,
    height: 155 + r() * 40,
    bottom: 330,
  };
}
