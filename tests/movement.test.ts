import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { characterState } from "../src/game/characterAnimation";
import { generateChunk, validateChunk } from "../shared/world";
import { generateChunk as legacyChunk } from "../shared/legacyWorld";
import { ROSTER } from "../shared/roster";

test("character responds to motion, landing, damage and completion", () => {
  const base = {
    finished: false,
    hurt: false,
    grounded: true,
    landing: false,
    velocityX: 0,
    velocityY: 0,
  };
  assert.equal(characterState(base), "idle");
  assert.equal(characterState({ ...base, velocityX: 210 }), "run");
  assert.equal(
    characterState({ ...base, grounded: false, velocityY: -200 }),
    "jump",
  );
  assert.equal(
    characterState({ ...base, grounded: false, velocityY: 200 }),
    "fall",
  );
  assert.equal(
    characterState({ ...base, landing: true, velocityX: 210 }),
    "land",
  );
  assert.equal(
    characterState({ ...base, hurt: true, grounded: false, velocityY: -200 }),
    "hurt",
  );
  assert.equal(characterState({ ...base, finished: true }), "celebrate");
});
test("all 38 partners have distinct walking and hopping frame sets and local credits", () => {
  const m = JSON.parse(
    readFileSync("public/assets/motion/manifest.json", "utf8"),
  );
  for (const partner of ROSTER) {
    const p = m.pokemon.find((x: any) => x.id === partner.id);
    assert.ok(p, partner.name);
    const png = readFileSync("public" + p.sheet);
    assert.equal(png.readUInt32BE(16), 8 * 96);
    assert.equal(png.readUInt32BE(20), Math.ceil(p.frameCount / 8) * 96);
    assert.ok(existsSync(`public/assets/motion/sources/${p.id}/credits.txt`));
    for (const state of [
      "idle",
      "run",
      "jump",
      "fall",
      "land",
      "hurt",
      "celebrate",
    ]) {
      assert.ok(p.states[state].frames.length > 0, `${p.name} ${state}`);
      assert.ok(
        p.states[state].frames.every((n: number) => n >= 0 && n < p.frameCount),
      );
    }
    assert.ok(p.states.run.frames.length > 1);
    assert.ok(p.states.jump.frames.length > 1);
    assert.ok(
      p.states.run.frames.every(
        (n: number) => !p.states.idle.frames.includes(n),
      ),
    );
    assert.ok(
      p.states.jump.frames.every(
        (n: number) => !p.states.run.frames.includes(n),
      ),
    );
  }
});
test("each eight-encounter block includes every obstacle route with bounded variations", () => {
  for (const seed of [0, 1, 42, 20261013, -17]) {
    const chunks = Array.from({ length: 8 }, (_, i) =>
      generateChunk(seed, i + 1, 4),
    );
    assert.equal(new Set(chunks.map((c) => c.route)).size, 8);
    assert.ok(chunks.every(validateChunk));
    assert.ok(chunks.some((c) => c.hazards.some((h) => h.kind === "spikes")));
    assert.ok(chunks.some((c) => c.hazards.some((h) => h.kind === "saw")));
    assert.ok(chunks.some((c) => c.springs.length));
    assert.ok(chunks.some((c) => c.platforms.some((p) => p.solid)));
    assert.ok(chunks.some((c) => c.platforms.some((p) => p.crumble)));
    assert.ok(chunks.some((c) => c.platforms.some((p) => p.motion)));
    assert.ok(chunks.some((c) => c.enemies.some((e) => e.kind === "bat")));
    assert.ok(chunks.some((c) => c.enemies.some((e) => e.kind === "mushroom")));
  }
});
test("world version one preserves scoring events for previously reserved attempts", () => {
  for (let i = 0; i < 100; i++) {
    const before = legacyChunk(20261013, i),
      after = generateChunk(20261013, i, 1);
    assert.deepEqual(after.coins, before.coins);
    assert.deepEqual(after.enemies, before.enemies);
    assert.deepEqual(after.platforms, before.platforms);
    assert.deepEqual(after.hazards, []);
  }
});
