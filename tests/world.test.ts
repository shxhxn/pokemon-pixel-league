import test from "node:test";
import assert from "node:assert/strict";
import {
  generateChunk,
  validateChunk,
  chunkWindow,
  calculateScore,
  RULES,
} from "../shared/world";
import { ROSTER } from "../shared/roster";
import { readFileSync, existsSync } from "node:fs";
test("20,000 chunks connect and stay within the jump envelope", () => {
  for (const seed of [1, 42, 20261013, 2147483647])
    for (let i = 0; i < 5000; i++) {
      const c = generateChunk(seed, i);
      assert.ok(validateChunk(c), `seed ${seed}, chunk ${i}`);
      assert.equal(c.end, generateChunk(seed, i + 1).start);
      assert.ok(
        c.platforms.filter((p) => p.ground).every((p) => p.y === RULES.groundY),
      );
      const floor = c.platforms.filter((p) => p.ground);
      if (floor.length > 1) {
        const gap = floor[1].x - floor[0].x - floor[0].width;
        assert.ok(gap < (RULES.speed * 2 * RULES.jump) / RULES.gravity - 64);
      }
      for (const e of c.enemies) {
        assert.ok(
          floor.some((p) => e.x >= p.x + 64 && e.x <= p.x + p.width - 64),
        );
      }
      for (const item of [...c.coins, ...c.enemies])
        assert.ok(item.x >= c.start && item.x < c.end);
    }
});
test("world is deterministic, varied, and cycles all four biomes", () => {
  assert.deepEqual(generateChunk(73, 12), generateChunk(73, 12));
  assert.notDeepEqual(generateChunk(73, 12), generateChunk(74, 12));
  assert.deepEqual(
    new Set(Array.from({ length: 24 }, (_, i) => generateChunk(1, i).biome)),
    new Set([0, 1, 2, 3]),
  );
});
test("chunk recycling keeps at most four chunks for arbitrarily long runs", () => {
  const live = new Set<number>();
  for (let x = 0; x < 10000000; x += 210) {
    const w = chunkWindow(x);
    for (let i = w.min; i <= w.max; i++) live.add(i);
    for (const i of live) if (i < w.min || i > w.max) live.delete(i);
    assert.ok(live.size <= 4);
    assert.ok(live.has(Math.floor(x / 768)));
  }
});
test("scoring is stable, distance-based, and independent of character", () => {
  assert.equal(calculateScore(100, 4, 2), 1200);
  assert.equal(calculateScore(0, 0, 0), 0);
});
test("every selectable partner has local PNG, GIF, and valid sheet geometry", () => {
  const manifest = JSON.parse(
    readFileSync("public/assets/pokemon/manifest.json", "utf8"),
  );
  assert.equal(ROSTER.length, 38);
  assert.equal(new Set(ROSTER.map((p) => p.id)).size, 38);
  for (const p of ROSTER) {
    const m = manifest.pokemon.find((a: any) => a.id === p.id);
    assert.ok(m);
    for (const field of ["image", "gif", "sheet"])
      assert.ok(existsSync("public" + m[field]), `${p.name} ${field}`);
    const png = readFileSync("public" + m.sheet);
    assert.equal(png.readUInt32BE(16), m.columns * m.frameWidth);
    assert.equal(
      png.readUInt32BE(20),
      Math.ceil(m.frameCount / m.columns) * m.frameHeight,
    );
    assert.ok(m.frameCount > 1);
  }
});
