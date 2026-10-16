/** Version 5 rules shared by generation, client simulation and result verification. */
export const STAGES = [
  { at: 0, name: "Warm-up", cap: 2 },
  { at: 200, name: "Easy", cap: 3 },
  { at: 500, name: "Moderate", cap: 4 },
  { at: 900, name: "Hard", cap: 5 },
  { at: 1400, name: "Expert", cap: 6 },
  { at: 2000, name: "Endless", cap: 7 },
] as const;
export function stageAt(metres: number) {
  const index = Math.max(0, STAGES.filter((s) => metres >= s.at).length - 1);
  return {
    ...STAGES[index],
    level: index + 1,
    progress: Math.min(1, metres / 2000),
    telegraph: Math.max(650, 1000 - index * 60),
    projectiles: Math.min(12, 4 + index * 2),
    reactionDistance: 150,
    cooldown: Math.max(1700, 3200 - index * 250),
  };
}
export const FOES = {
  rattata: { id: 19, hp: 2, fly: false, color: 0xc1a0db, points: 50 },
  pidgey: { id: 16, hp: 2, fly: true, color: 0xe9cca4, points: 50 },
  zubat: { id: 41, hp: 1, fly: true, color: 0xb2a4ed, points: 50 },
  geodude: { id: 74, hp: 5, fly: false, color: 0xbab3cc, points: 100 },
  gastly: { id: 92, hp: 3, fly: true, color: 0xc89fdf, points: 100 },
  voltorb: { id: 100, hp: 2, fly: false, color: 0xff9eac, points: 75 },
  ekans: { id: 23, hp: 3, fly: false, color: 0xb89bcf, points: 75 },
  haunter: { id: 93, hp: 6, fly: true, color: 0xd5a6ed, points: 150 },
  gengar: { id: 94, hp: 28, fly: true, color: 0xb8a0eb, points: 1500 },
  onix: { id: 95, hp: 36, fly: false, color: 0xc5bdcf, points: 1800 },
  electabuzz: { id: 125, hp: 30, fly: false, color: 0xffdc85, points: 1800 },
} as const;
export type Foe = keyof typeof FOES;
export const isBoss = (kind: Foe) =>
  ["gengar", "onix", "electabuzz"].includes(kind);
export type Trap =
  | "thorns"
  | "poison"
  | "electric"
  | "boulder"
  | "pendulum"
  | "barrier"
  | "retract"
  | "rocks"
  | "current"
  | "ice"
  | "icicle"
  | "fog"
  | "laser";
export const TRAPS: Trap[] = [
  "thorns",
  "poison",
  "electric",
  "boulder",
  "pendulum",
  "barrier",
  "retract",
  "rocks",
  "current",
  "ice",
  "icicle",
  "fog",
  "laser",
];
export type HeldItem =
  | "shield"
  | "speed"
  | "berry"
  | "damage"
  | "star"
  | "energy"
  | "magnet"
  | "slow";
export const ITEMS: Record<
  HeldItem,
  { name: string; seconds: number; weight: number }
> = {
  shield: { name: "Guard shell", seconds: 0, weight: 25 },
  speed: { name: "Swift feather", seconds: 6, weight: 16 },
  berry: { name: "Healing berry", seconds: 0, weight: 2 },
  damage: { name: "Power band", seconds: 8, weight: 18 },
  star: { name: "Starlight charm", seconds: 4, weight: 2 },
  energy: { name: "Energy crystal", seconds: 0, weight: 17 },
  magnet: { name: "Coin magnet", seconds: 8, weight: 16 },
  slow: { name: "Slow-time orb", seconds: 6, weight: 4 },
};
export function itemRoll(value: number): HeldItem {
  let roll =
    Math.max(0, Math.min(0.999999, value)) *
    Object.values(ITEMS).reduce((n, i) => n + i.weight, 0);
  for (const [key, item] of Object.entries(ITEMS)) {
    roll -= item.weight;
    if (roll < 0) return key as HeldItem;
  }
  return "shield";
}
export type Kit = {
  basic: string;
  special: string;
  mode: "bolt" | "bite" | "vine";
  specialMode: "thunder" | "water" | "flame" | "guard" | "leaf";
  color: number;
  cost: number;
};
export function kitFor(id: number): Kit {
  if ([25, 26, 135, 403].includes(id))
    return {
      basic: "Thunder Shock",
      special: "Thunderbolt",
      mode: "bolt",
      specialMode: "thunder",
      color: 0xffdc75,
      cost: 40,
    };
  if (id === 158)
    return {
      basic: "Bite",
      special: "Water Gun",
      mode: "bite",
      specialMode: "water",
      color: 0x9bdbff,
      cost: 30,
    };
  if ([4, 5, 6, 155, 136].includes(id))
    return {
      basic: "Ember",
      special: "Flamethrower",
      mode: "bolt",
      specialMode: "flame",
      color: 0xffae80,
      cost: 35,
    };
  if ([7, 8, 9].includes(id))
    return {
      basic: "Water Burst",
      special: "Withdraw",
      mode: "bolt",
      specialMode: "guard",
      color: 0x9bdfff,
      cost: 30,
    };
  if ([1, 2, 3, 152].includes(id))
    return {
      basic: "Vine Whip",
      special: "Razor Leaf",
      mode: "vine",
      specialMode: "leaf",
      color: 0xd5c79c,
      cost: 35,
    };
  return {
    basic: "Pulse",
    special: "Element Burst",
    mode: "bolt",
    specialMode: id % 2 ? "water" : "leaf",
    color: 0xc4b6ff,
    cost: 35,
  };
}
export type CombatEvent = {
  id: string;
  at: number;
  chain: number;
  air: boolean;
  special: boolean;
};
export type StyleEvent = { id: string; at: number; kind: "dodge" | "clean" };
export const styleBonus = (events: StyleEvent[]) =>
  events.reduce((n, e) => n + (e.kind === "clean" ? 200 : 50), 0);
export const multiplier = (chain: number) =>
  chain >= 10 ? 5 : chain >= 5 ? 3 : chain >= 3 ? 2 : 1;
export function combatBonus(
  events: CombatEvent[],
  kindOf: (id: string) => Foe | undefined,
) {
  return events.reduce((score, e) => {
    const kind = kindOf(e.id),
      base = kind ? FOES[kind].points : 50;
    return (
      score +
      base * multiplier(e.chain) -
      50 +
      (e.air ? 25 : 0) +
      (e.special && e.chain > 1 ? 25 : 0)
    );
  }, 0);
}
export function validCombat(
  events: CombatEvent[],
  enemies: string[],
  duration: number,
) {
  const ids = new Set<string>();
  return (
    events.length === enemies.length &&
    events.every((e, i) => {
      const previous = events[i - 1];
      if (
        !enemies.includes(e.id) ||
        ids.has(e.id) ||
        e.at < 0 ||
        e.at > duration ||
        e.chain < 1 ||
        (previous && e.at < previous.at) ||
        e.chain >
          (previous && e.at - previous.at <= 5000 ? previous.chain + 1 : 1)
      )
        return false;
      ids.add(e.id);
      return true;
    })
  );
}
