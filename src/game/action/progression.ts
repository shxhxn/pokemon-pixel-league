export type Save = {
  version: 1;
  coins: number;
  earned: number;
  kills: number;
  seconds: number;
  bestSeconds: number;
  distance: number;
  combo: number;
  bosses: number;
  owned: string[];
  skin: string;
  trail: string;
  bonus: string;
  upgrades: number[];
};
const KEY = "pixel-league-adventure-v1";
export const fresh = (): Save => ({
  version: 1,
  coins: 0,
  earned: 0,
  kills: 0,
  seconds: 0,
  bestSeconds: 0,
  distance: 0,
  combo: 0,
  bosses: 0,
  owned: [],
  skin: "classic",
  trail: "classic",
  bonus: "none",
  upgrades: [],
});
export function readSave(): Save {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (
      !s ||
      s.version !== 1 ||
      !Array.isArray(s.owned) ||
      !Array.isArray(s.upgrades)
    )
      return fresh();
    const result = { ...fresh(), ...s };
    for (const key of [
      "coins",
      "earned",
      "kills",
      "seconds",
      "distance",
      "combo",
      "bosses",
    ] as const)
      if (!Number.isFinite(result[key]) || result[key] < 0) return fresh();
    return result;
  } catch {
    return fresh();
  }
}
export function saveProgress(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
export const SHOP = [
  {
    id: "partner-403",
    name: "Shinx · bonus partner",
    cost: 300,
    description: "Unlock Shinx for practice adventures.",
  },
  {
    id: "partner-447",
    name: "Riolu · bonus partner",
    cost: 300,
    description: "Unlock Riolu for practice adventures.",
  },
  {
    id: "effect-prism",
    name: "Prismatic attacks",
    cost: 120,
    description: "A lavender attack palette and sparkling casts.",
  },
  {
    id: "skin-moon",
    name: "Moonstone palette",
    cost: 100,
    description: "A cool lunar tint for your partner.",
  },
  {
    id: "skin-sunset",
    name: "Sunset palette",
    cost: 100,
    description: "A warm coral tint for your partner.",
  },
  {
    id: "trail-star",
    name: "Starlight trail",
    cost: 150,
    description: "Golden running and dash particles.",
  },
  {
    id: "start-energy",
    name: "Energy pouch",
    cost: 180,
    description: "Optional practice start: +20 energy.",
  },
  {
    id: "start-dash",
    name: "Quick-step badge",
    cost: 180,
    description: "Optional practice start: dash already unlocked.",
  },
] as const;
export function purchase(s: Save, id: string, pokemon?: number): Save | null {
  const mastery = id === "mastery" && pokemon !== undefined;
  const item = SHOP.find((i) => i.id === id),
    cost = mastery ? 250 : item?.cost;
  if (
    cost === undefined ||
    s.coins < cost ||
    (mastery ? s.upgrades.includes(pokemon!) : s.owned.includes(id))
  )
    return null;
  return {
    ...s,
    coins: s.coins - cost,
    owned: mastery ? s.owned : [...s.owned, id],
    upgrades: mastery ? [...s.upgrades, pokemon!] : s.upgrades,
  };
}
export function achievements(s: Save) {
  return [
    {
      name: "Wild defender",
      goal: "Defeat 100 enemies",
      done: s.kills >= 100,
      progress: `${Math.min(100, s.kills)}/100`,
    },
    {
      name: "Long road",
      goal: "Travel 1,000 m in one run",
      done: s.distance >= 1000,
      progress: `${Math.min(1000, s.distance)}/1,000 m`,
    },
    {
      name: "Untouchable",
      goal: "Defeat a boss without taking damage",
      done: s.bosses > 0,
      progress: `${s.bosses} flawless bosses`,
    },
    {
      name: "Chain reaction",
      goal: "Reach a 10-enemy combo",
      done: s.combo >= 10,
      progress: `${Math.min(10, s.combo)}/10`,
    },
    {
      name: "Coin collector",
      goal: "Collect 500 coins across runs",
      done: s.earned >= 500,
      progress: `${Math.min(500, s.earned)}/500`,
    },
    {
      name: "Five-minute adventurer",
      goal: "Survive five minutes in one practice run",
      done: s.bestSeconds >= 300,
      progress: `${Math.min(300, Math.floor(s.bestSeconds))}/300 s`,
    },
  ];
}
export function recordRun(stats: {
  coins: number;
  kills: number;
  seconds: number;
  distance: number;
  combo: number;
  bosses: number;
}) {
  const s = readSave();
  s.coins += stats.coins + stats.kills * 3;
  s.earned += stats.coins;
  s.kills += stats.kills;
  s.seconds += stats.seconds;
  s.bestSeconds = Math.max(s.bestSeconds, stats.seconds);
  s.distance = Math.max(s.distance, stats.distance);
  s.combo = Math.max(s.combo, stats.combo);
  s.bosses += stats.bosses;
  return saveProgress(s);
}
