import test from "node:test";
import assert from "node:assert/strict";
import {
  atmosphere,
  pickupForChunk,
  attackCooldown,
} from "../shared/adventure";
import { generateChunk, validateChunk } from "../shared/world";

test("day phases follow dawn, day, sunset, night and repeat in order", () => {
  assert.deepEqual(
    [0, 30000, 60000, 90000, 120000].map((t) => atmosphere(t).name),
    ["Dawn", "Day", "Sunset", "Night", "Dawn"],
  );
  assert.equal(atmosphere(-100).name, "Dawn");
  assert.equal(atmosphere(29999).name, "Dawn");
});

test("pickups are reproducible, hearts are rare and every pickup has safe floor below it", () => {
  let hearts = 0,
    boosts = 0;
  for (let seed = 1; seed <= 50; seed++)
    for (let index = 0; index < 100; index++) {
      const p = pickupForChunk(seed, index);
      assert.deepEqual(p, pickupForChunk(seed, index));
      if (!p) continue;
      const c = generateChunk(seed, index);
      assert.ok(
        c.platforms.some(
          (f) => f.ground && p.x > f.x + 20 && p.x < f.x + f.width - 20,
        ),
        `unsafe pickup ${seed}:${index}`,
      );
      if (p.kind === "heart") {
        hearts++;
        assert.ok(index >= 22);
        assert.equal(index % 22, 0);
      } else boosts++;
    }
  assert.ok(hearts > 0 && hearts < 100);
  assert.ok(hearts / boosts < 0.08);
  assert.deepEqual(
    [2, 6, 10].map((i) => pickupForChunk(8, i)?.kind),
    ["shield", "magnet", "rapid"],
  );
  assert.ok(attackCooldown(true) < attackCooldown(false));
});

test("reactive enemies arrive after the warm-up and preserve earlier session worlds", () => {
  const kinds = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const c = generateChunk(8, i, 4);
    assert.ok(validateChunk(c));
    const smart = c.enemies.filter(
      (e) => e.kind === "charger" || e.kind === "turret",
    );
    smart.forEach((e) => kinds.add(e.kind!));
    if (i < 2 || c.route === 6) assert.equal(smart.length, 0);
    assert.ok(
      generateChunk(8, i, 3).enemies.every(
        (e) => e.kind !== "charger" && e.kind !== "turret",
      ),
    );
  }
  assert.deepEqual(kinds, new Set(["charger", "turret"]));
});
