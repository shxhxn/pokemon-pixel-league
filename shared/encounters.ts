import type { Chunk } from "./world";
import { FOES, isBoss, stageAt, TRAPS, type Foe } from "./action";

/** Distance gates, deliberately separated encounters and safe bypasses. */
export function expandEncounter(c: Chunk, seed: number): Chunk {
  const stage = stageAt(Math.max(0, (c.start - 96) / 10));
  c.enemies = [];
  c.hazards = [];
  if (c.index === 0) return c;
  const boss = c.index >= 20 && c.index % 12 === 8;
  if (boss) {
    const kind = (["gengar", "onix", "electabuzz"] as const)[
      Math.floor((c.index - 20) / 12) % 3
    ];
    c.platforms = [
      { x: c.start, y: 336, width: 768, ground: true },
      { x: c.start + 250, y: 264, width: 168, ground: false },
    ];
    c.springs = [];
    c.enemies.push({
      id: `${c.index}:e:boss`,
      x: c.start + 550,
      y: FOES[kind].fly ? 230 : 312,
      kind,
      range: 80,
    });
    return c;
  }
  const available: Foe[] = [
    "rattata",
    "pidgey",
    "zubat",
    "geodude",
    "gastly",
    "voltorb",
    "ekans",
    "haunter",
  ];
  const count = stage.level >= 5 ? 8 : Math.min(8, stage.level + 1);
  const mixed = Math.imul(c.index + seed, 0x45d9f3b);
  const kind = available[((mixed ^ (mixed >>> 16)) >>> 0) % count];
  // A single new pattern gets a whole section. Groups appear after 500 m.
  const wave = stage.level >= 3 && c.index % 4 === 0;
  const members: Foe[] = wave
    ? kind === "geodude"
      ? ["geodude", "rattata"]
      : kind === "gastly"
        ? ["gastly"]
        : [
            kind,
            kind,
            ...(kind === "rattata" || kind === "zubat" ? [kind] : []),
          ]
    : [kind];
  if (kind === "gastly" && wave)
    c.platforms.push({
      x: c.start + 180,
      y: 280,
      width: 144,
      ground: false,
      motion: 12,
    });
  const floor = c.platforms.filter((p) => p.ground).at(-1)!;
  members.forEach((enemy, n) => {
    const x = Math.min(
      floor.x + floor.width - 110,
      Math.max(
        floor.x + 110,
        !FOES[enemy].fly && c.platforms.some((p) => p.solid)
          ? c.start + 630
          : c.start + 350 + n * 140,
      ),
    );
    if (c.enemies.some((e) => Math.abs(e.x - x) < 100)) return;
    c.enemies.push({
      id: `${c.index}:e:${n}`,
      x,
      y: FOES[enemy].fly ? 224 + (n % 2) * 32 : 324,
      kind: enemy,
      range: 26,
    });
  });
  if (stage.level >= 2 && !wave && c.route !== 6) {
    const kind =
      TRAPS[
        (c.index + Math.abs(seed)) % Math.min(TRAPS.length, stage.level * 3)
      ];
    // The warning and danger stay well clear of enemy patrols and chunk edges.
    c.hazards.push({
      id: `${c.index}:h:action`,
      x: c.start + 170,
      y: ["pendulum", "icicle", "rocks", "barrier"].includes(kind) ? 244 : 327,
      kind,
      width: 40,
      range: 28,
    });
  }
  if (c.route === 1 && stage.level === 1)
    c.hazards.push({
      id: `${c.index}:h:spikes`,
      x: c.start + 170,
      y: 327,
      kind: "spikes",
      width: 48,
    });
  if (c.route === 8 && !c.hazards.length)
    c.hazards.push({
      id: `${c.index}:h:saw`,
      x: c.start + 170,
      y: 244,
      kind: "saw",
      width: 32,
      range: 14,
    });
  // Rare elevated detour, reachable with the ordinary double jump. Main floor
  // remains intact and players can always drop back down without a power-up.
  if (c.index > 4 && (c.index + Math.abs(seed)) % 11 === 0) {
    c.platforms.push({
      x: c.start + 520,
      y: 264,
      width: 168,
      ground: false,
      crumble: c.index % 3 === 0,
    });
    for (let i = 0; i < 6; i++)
      c.coins.push({
        id: `${c.index}:c:secret${i}`,
        x: c.start + 532 + i * 24,
        y: 238,
      });
    c.secret = true;
  }
  return fairEncounter(c) ? c : { ...c, enemies: [], hazards: [] };
}
export function fairEncounter(c: Chunk) {
  return (
    c.enemies.length <= stageAt(c.start / 10).cap &&
    c.enemies.every((e) => {
      const kind = e.kind as Foe;
      return (
        !!FOES[kind] &&
        (FOES[kind].fly ||
          c.platforms.some(
            (p) =>
              p.ground &&
              e.x - (e.range || 0) >= p.x + 48 &&
              e.x + (e.range || 0) <= p.x + p.width - 48,
          ))
      );
    }) &&
    c.hazards.every(
      (h) =>
        h.width <= 48 &&
        h.x >= c.start + 140 &&
        h.x <= c.end - 140 &&
        c.enemies.every(
          (e) => isBoss(e.kind as Foe) || Math.abs(e.x - h.x) > 150,
        ) &&
        c.platforms.some(
          (p) => p.ground && h.x > p.x + 100 && h.x < p.x + p.width - 100,
        ),
    )
  );
}
