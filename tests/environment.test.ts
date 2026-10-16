import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ENVIRONMENT_URLS,
  ENVIRONMENT_FRAMES,
} from "../src/game/environmentAssets";
import {
  DISTRICTS,
  DISTRICT_WIDTH,
  environmentAt,
  PARALLAX,
  sceneryCells,
} from "../src/game/environmentPlan";

test("all scenery frames fit their local RGBA source atlases", () => {
  for (const [key, url] of Object.entries(ENVIRONMENT_URLS)) {
    const png = readFileSync("public" + url),
      w = png.readUInt32BE(16),
      h = png.readUInt32BE(20);
    assert.equal(png[25], 6, "source must have an alpha channel");
    for (const [sheet, x, y, width, height] of Object.values(
      ENVIRONMENT_FRAMES,
    ))
      if (sheet === key) {
        assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0);
        assert.ok(x + width <= w && y + height <= h);
      }
  }
});
test("the environment remains deterministic and visits all six districts at arbitrarily long distances", () => {
  for (const seed of [8, 42, 20261013])
    for (const block of [0, 1, 17, 5000]) {
      const kinds = new Set<number>();
      for (let i = 0; i < 6; i++) {
        const x = (block * 6 + i) * DISTRICT_WIDTH + 100;
        assert.deepEqual(environmentAt(x, seed), environmentAt(x, seed));
        const region = environmentAt(x, seed);
        kinds.add(region.kind);
        assert.ok(DISTRICTS.includes(region.name));
      }
      assert.equal(kinds.size, 6);
    }
  assert.equal(environmentAt(0, 8).name, "Moonlit Village");
});
test("layer speeds preserve depth and visible scenery work is independent of distance", () => {
  const rates = Object.values(PARALLAX);
  rates.forEach((rate, i) => {
    assert.ok(rate > 0 && rate < 1);
    if (i) assert.ok(rate > rates[i - 1]);
  });
  for (const x of [0, 768, 100000, 100000000]) {
    const cells = sceneryCells(x, 960, 230);
    assert.ok(cells.length < 15);
    assert.ok(cells[0] * 230 < x);
    assert.ok(cells.at(-1)! * 230 >= x + 960);
  }
});
