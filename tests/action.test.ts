import test from "node:test";
import assert from "node:assert/strict";
import {
  FOES,
  ITEMS,
  STAGES,
  TRAPS,
  stageAt,
  itemRoll,
  kitFor,
  validCombat,
  combatBonus,
  multiplier,
  type Foe,
} from "../shared/action";
import { generateChunk, validateChunk } from "../shared/world";
import { fairEncounter } from "../shared/encounters";
import { fresh, purchase, achievements } from "../src/game/action/progression";
import { readFileSync, existsSync } from "node:fs";

test("six distance gates unlock all enemies and hazards while preserving fair floor geometry", () => {
  const foes = new Set<string>(),
    traps = new Set<string>();
  let bosses = 0,
    secrets = 0;
  for (const seed of [1, 8, 42, -17])
    for (let i = 0; i < 800; i++) {
      const c = generateChunk(seed, i, 5);
      assert.ok(validateChunk(c), `${seed}:${i}`);
      assert.ok(fairEncounter(c), `${seed}:${i}`);
      c.enemies.forEach((e) => {
        foes.add(e.kind!);
        if (e.id.endsWith("boss")) {
          bosses++;
          assert.equal(c.hazards.length, 0);
          assert.equal(c.platforms[0].width, 768);
        }
      });
      c.hazards.forEach((h) => traps.add(h.kind));
      if (c.secret) {
        secrets++;
        assert.ok(c.coins.some((c) => c.id.includes("secret")));
      }
    }
  assert.deepEqual([...foes].sort(), Object.keys(FOES).sort());
  for (const trap of [...TRAPS, "spikes", "saw"])
    assert.ok(traps.has(trap), trap);
  assert.ok(bosses > 10 && secrets > 10);
  for (const [i, stage] of STAGES.entries()) {
    assert.equal(stageAt(stage.at).level, i + 1);
    assert.ok(stageAt(stage.at).telegraph >= 650);
    assert.ok(stageAt(stage.at).projectiles <= 12);
  }
});
test("item distribution keeps healing and invincibility rare and exposes all eight rewards", () => {
  const counts: Record<string, number> = {};
  for (let i = 0; i < 10000; i++) {
    const k = itemRoll(i / 10000);
    counts[k] = (counts[k] || 0) + 1;
  }
  assert.deepEqual(Object.keys(counts).sort(), Object.keys(ITEMS).sort());
  assert.ok(counts.berry <= 210 && counts.star <= 210);
  assert.ok(counts.shield > counts.berry * 10);
});
test("five featured partners have different functional combat kits", () => {
  assert.equal(kitFor(25).specialMode, "thunder");
  assert.equal(kitFor(158).mode, "bite");
  assert.equal(kitFor(4).specialMode, "flame");
  assert.equal(kitFor(7).specialMode, "guard");
  assert.equal(kitFor(1).mode, "vine");
});
test("combat chains reject duplicates, impossible chain jumps and late timestamps", () => {
  const events = Array.from({ length: 10 }, (_, i) => ({
    id: `1:e:${i}`,
    at: 1000 + i * 100,
    chain: i + 1,
    air: false,
    special: false,
  }));
  const ids = events.map((e) => e.id);
  assert.ok(validCombat(events, ids, 3000));
  assert.equal(multiplier(10), 5);
  assert.equal(multiplier(5), 3);
  assert.equal(multiplier(3), 2);
  assert.ok(!validCombat([...events, events[0]], ids, 3000));
  assert.ok(!validCombat([{ ...events[0], chain: 5 }], ids.slice(0, 1), 3000));
  assert.ok(!validCombat(events, ids, 1500));
  assert.ok(
    combatBonus(events, () => "geodude" as Foe) >
      combatBonus(events, () => "rattata" as Foe),
  );
});
test("workshop purchases charge once, preserve starting access and unlock achievements at their actual thresholds", () => {
  const s = fresh();
  assert.equal(purchase(s, "partner-403"), null);
  s.coins = 1000;
  const next = purchase(s, "partner-403")!;
  assert.equal(next.coins, 700);
  assert.equal(purchase(next, "partner-403"), null);
  const mastery = purchase(next, "mastery", 25)!;
  assert.equal(mastery.coins, 450);
  assert.deepEqual(mastery.upgrades, [25]);
  assert.equal(achievements(s).filter((a) => a.done).length, 0);
  Object.assign(s, {
    kills: 100,
    distance: 1000,
    bosses: 1,
    combo: 10,
    earned: 500,
    bestSeconds: 300,
  });
  assert.equal(achievements(s).filter((a) => a.done).length, 6);
});
test("all eleven enemies and both bonus partners have local animated frames and credits", () => {
  const enemies = JSON.parse(
    readFileSync("public/assets/enemies/motion.json", "utf8"),
  );
  assert.equal(enemies.length, 11);
  const partners = JSON.parse(
    readFileSync("public/assets/motion/manifest.json", "utf8"),
  ).pokemon.filter((p: any) => [403, 447].includes(p.id));
  assert.equal(partners.length, 2);
  for (const p of [...enemies, ...partners]) {
    assert.ok(existsSync(`public${p.sheet}`));
    assert.ok(p.states.run.frames.length > 1);
    assert.ok(p.states.hurt.frames.length);
    assert.ok(p.credits.length);
  }
});
