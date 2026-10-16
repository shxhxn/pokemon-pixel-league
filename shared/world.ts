import { generateChunk as legacyChunk } from "./legacyWorld";
import { expandEncounter } from "./encounters";
import type { Foe, Trap, CombatEvent, StyleEvent } from "./action";
export const WORLD_VERSION = 5;
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
  "Bloomwood Forest",
  "Coral Coast",
  "Crystal Caverns",
  "Frostpeak Pass",
] as const;
export const ROUTES = [
  "Warm-up trail",
  "Spike garden",
  "Crate climb",
  "Spring valley",
  "Patrol crossing",
  "Sky patrol",
  "Crumbling bridge",
  "Moving terraces",
  "Crystal gauntlet",
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
export type Platform = {
  x: number;
  y: number;
  width: number;
  ground: boolean;
  solid?: boolean;
  crumble?: boolean;
  motion?: number;
};
export type Item = {
  id: string;
  x: number;
  y: number;
  kind?: "mushroom" | "bat" | "charger" | "turret" | Foe;
  range?: number;
};
export type Hazard = {
  id: string;
  x: number;
  y: number;
  kind: "spikes" | "saw" | Trap;
  width: number;
  range?: number;
};
export type Chunk = {
  index: number;
  start: number;
  end: number;
  biome: number;
  route: number;
  platforms: Platform[];
  coins: Item[];
  enemies: Item[];
  hazards: Hazard[];
  springs: Item[];
  secret?: boolean;
};
export function generateChunk(
  seed: number,
  index: number,
  version = WORLD_VERSION,
): Chunk {
  if (version === 1)
    return { ...legacyChunk(seed, index), route: 0, hazards: [], springs: [] };
  const r = random(seed + Math.imul(index, 7919)),
    start = index * 768,
    difficulty = Math.min(1, index / 32);
  const route = index === 0 ? 0 : 1 + ((index - 1 + (Math.abs(seed) % 8)) % 8);
  const bridge = route === 6,
    gap = bridge ? 48 + 24 * Math.floor(r() * (1 + 2 * difficulty)) : 0;
  const platforms: Platform[] = [
    { x: start, y: 336, width: gap ? 384 : 768, ground: true },
  ];
  if (gap)
    platforms.push({
      x: start + 384 + gap,
      y: 336,
      width: 384 - gap,
      ground: true,
    });
  const coins: Item[] = [],
    enemies: Item[] = [],
    hazards: Hazard[] = [],
    springs: Item[] = [];
  const line = (x: number, y: number, n = 5) => {
    for (let j = 0; j < n; j++)
      coins.push({
        id: `${index}:c:${coins.length}`,
        x: start + x + j * 24,
        y,
      });
  };
  const platform = (
    x: number,
    y: number,
    width: number,
    extras: Partial<Platform> = {},
  ) => platforms.push({ x: start + x, y, width, ground: false, ...extras });
  const px = 168 + 24 * Math.floor(r() * 3);
  switch (route) {
    case 0:
      platform(px, 288, 168);
      line(px + 12, 262);
      line(570, 306);
      break;
    case 1:
      hazards.push({
        id: `${index}:h:0`,
        x: start + 366,
        y: 327,
        kind: "spikes",
        width: 48,
      });
      platform(492, 288, 144);
      line(314, 246);
      line(530, 260, 4);
      break;
    case 2:
      platform(264, 288, 72, { solid: true });
      platform(416, 264, 96, { solid: true });
      line(270, 256, 3);
      line(422, 232, 4);
      line(636, 306, 3);
      break;
    case 3:
      springs.push({ id: `${index}:s:0`, x: start + 276, y: 328 });
      platform(396, 264, 192);
      line(338, 182, 7);
      line(600, 306, 3);
      break;
    case 4:
      enemies.push({
        id: `${index}:e:0`,
        x: start + 404,
        y: 324,
        kind: "mushroom",
        range: 44,
      });
      platform(156, 280, 144);
      line(168, 254);
      line(570, 306, 5);
      break;
    case 5:
      enemies.push({
        id: `${index}:e:0`,
        x: start + 428,
        y: 244,
        kind: "bat",
        range: 36,
      });
      platform(204, 288, 144);
      line(216, 260);
      line(560, 306, 5);
      break;
    case 6:
      platform(342, 288, 180, { crumble: true });
      line(354, 262, 6);
      line(610, 306, 4);
      break;
    case 7:
      platform(252, 288, 144, { motion: 14 });
      platform(492, 288, 144, { motion: 14 });
      line(264, 252, 5);
      line(504, 252, 5);
      break;
    case 8:
      platform(264, 300, 72, { solid: true });
      hazards.push({
        id: `${index}:h:0`,
        x: start + 468,
        y: 250,
        kind: "saw",
        width: 32,
        range: 14,
      });
      line(260, 260, 4);
      line(568, 306, 5);
      break;
  }
  if (version >= 4 && index >= 2 && route !== 6) {
    const kind = index % 3 === 0 ? "turret" : "charger";
    enemies.push({
      id: `${index}:e:${enemies.length}`,
      x: start + 612,
      y: 324,
      kind,
      range: kind === "charger" ? 48 : 0,
    });
  }
  // Seeded offsets vary each encounter while retaining its verified jump envelope.
  const offset = route ? (Math.floor(r() * 3) - 1) * 24 : 0;
  for (const p of platforms) if (!p.ground) p.x += offset;
  for (const item of [...coins, ...enemies, ...hazards, ...springs])
    item.x += offset;
  const chunk: Chunk = {
    index,
    start,
    end: start + 768,
    biome: Math.floor(index / 6) % 4,
    route,
    platforms,
    coins,
    enemies,
    hazards,
    springs,
  };
  return version >= 5 ? expandEncounter(chunk, seed) : chunk;
}
export function validateChunk(c: Chunk) {
  const floors = c.platforms.filter((p) => p.ground);
  if (
    !floors.length ||
    floors[0].x !== c.start ||
    floors.at(-1)!.x + floors.at(-1)!.width !== c.end
  )
    return false;
  if (
    !floors.every(
      (p, i) =>
        p.y === 336 &&
        p.width >= 192 &&
        (!i || p.x - floors[i - 1].x - floors[i - 1].width <= 96),
    )
  )
    return false;
  if (
    !c.platforms.every(
      (p) => p.ground || (336 - p.y + (p.motion || 0) <= 72 && p.width >= 64),
    )
  )
    return false;
  if (
    !c.hazards.every((h) =>
      ["saw", "pendulum", "icicle", "rocks", "barrier"].includes(h.kind)
        ? h.y + (h.range || 0) + h.width / 2 < 300
        : floors.some(
            (p) =>
              h.x - h.width / 2 >= p.x + 120 &&
              h.x + h.width / 2 <= p.x + p.width - 120,
          ) && h.width <= 48,
    )
  )
    return false;
  return c.enemies.every((e) =>
    floors.some(
      (p) =>
        e.x - (e.range || 0) >= p.x + 80 &&
        e.x + (e.range || 0) <= p.x + p.width - 80,
    ),
  );
}
// Add pressure only when a new section is constructed, never beneath a player.
// Coins and enemies keep their original IDs/positions for server verification.
export function pressureHazards(chunk: Chunk, level: number): Hazard[] {
  if (level < 3 || chunk.route === 0 || chunk.route === 6) return [];
  const hazard: Hazard = {
    id: `${chunk.index}:h:pressure`,
    x: chunk.start + 600,
    y: 327,
    kind: "spikes",
    width: 48,
  };
  return validateChunk({ ...chunk, hazards: [...chunk.hazards, hazard] })
    ? [hazard]
    : [];
}
export function chunkWindow(x: number) {
  const i = Math.max(0, Math.floor(x / 768));
  return { min: Math.max(0, i - 1), max: i + 2 };
}
export const calculateScore = (
  distance: number,
  coins: number,
  enemies: number,
) => Math.floor(distance) * 10 + coins * 25 + enemies * 50;
export type RunResult = {
  distance: number;
  coins: string[];
  enemies: string[];
  durationMs: number;
  score: number;
  combat?: CombatEvent[];
  style?: StyleEvent[];
};
