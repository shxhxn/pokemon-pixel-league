// All characters share this movement envelope. A 96px maximum gap is well
// inside the 184px horizontal range of a full jump at the minimum run speed.
export const RULES = {
  speed: 210,
  jump: 440,
  gravity: 1000,
  chunkWidth: 768,
  groundY: 336,
  tile: 24,
  coinPoints: 25,
  enemyPoints: 50,
};
export const BIOMES = [
  "Verdant Meadow",
  "Amber Woods",
  "Moonlit Cavern",
  "Crystal Peaks",
] as const;
export function random(seed: number) {
  let a = seed | 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Platform = { x: number; y: number; width: number; ground: boolean };
export type Item = { id: string; x: number; y: number };
export type Chunk = {
  index: number;
  start: number;
  end: number;
  biome: number;
  platforms: Platform[];
  coins: Item[];
  enemies: Item[];
};
export function generateChunk(seed: number, index: number): Chunk {
  const r = random(seed + Math.imul(index, 7919)),
    start = index * RULES.chunkWidth,
    difficulty = Math.min(1, index / 35);
  const gap = index < 2 ? 0 : 48 + 24 * Math.floor(r() * (1 + 2 * difficulty));
  const gapStart = 384 + Math.floor(r() * 3) * 24;
  const platforms: Platform[] = [
    { x: start, y: 336, width: gap ? gapStart : 768, ground: true },
  ];
  if (gap)
    platforms.push({
      x: start + gapStart + gap,
      y: 336,
      width: 768 - gapStart - gap,
      ground: true,
    });
  const height = r() > 0.5 ? 264 : 288,
    px = start + 144 + Math.floor(r() * 3) * 24;
  platforms.push({
    x: px,
    y: height,
    width: 120 + 24 * Math.floor(r() * 3),
    ground: false,
  });
  const coins = Array.from({ length: 5 }, (_, j) => ({
    id: `${index}:c:${j}`,
    x: px + 12 + j * 24,
    y: height - 24,
  }));
  for (let j = 0; j < 3; j++)
    coins.push({ id: `${index}:g:${j}`, x: start + 624 + j * 24, y: 306 });
  const enemies =
    index === 0 ? [] : [{ id: `${index}:e:0`, x: start + 650, y: 320 }];
  return {
    index,
    start,
    end: start + 768,
    biome: Math.floor(index / 6) % 4,
    platforms,
    coins,
    enemies,
  };
}
export function validateChunk(c: Chunk) {
  const floor = c.platforms.filter((p) => p.ground);
  return (
    floor[0].x === c.start &&
    floor.at(-1)!.x + floor.at(-1)!.width === c.end &&
    floor.every(
      (p, i) =>
        p.width >= 192 &&
        (!i || p.x - (floor[i - 1].x + floor[i - 1].width) <= 96),
    ) &&
    c.platforms.every((p) => p.ground || (336 - p.y <= 72 && p.width >= 120))
  );
}
export function chunkWindow(x: number) {
  const i = Math.max(0, Math.floor(x / RULES.chunkWidth));
  return { min: Math.max(0, i - 1), max: i + 2 };
}
export const calculateScore = (
  distance: number,
  coins: number,
  enemies: number,
) =>
  Math.floor(distance) * 10 +
  coins * RULES.coinPoints +
  enemies * RULES.enemyPoints;
export type RunResult = {
  distance: number;
  coins: string[];
  enemies: string[];
  durationMs: number;
  score: number;
};
