import { random } from "../../shared/world";
import {
  drawAsset,
  ENVIRONMENT_FRAMES,
  type AssetSources,
  type EnvironmentSprite,
} from "./environmentAssets";
import {
  environmentAt,
  PARALLAX,
  sceneryCells,
  waterfallForCell,
} from "./environmentPlan";
const TILE = 768,
  HEIGHT = 432,
  CACHE_LIMIT = 28;
const wrap = (v: number, n: number) => ((v % n) + n) % n;
type Layer = "far" | "ridges" | "town" | "near";

/** Static sprite compositions are cached as they enter view. Scenery never creates physics bodies. */
export class MoonlitLandscape {
  private cache = new Map<string, HTMLCanvasElement>();
  private sky: HTMLCanvasElement;
  private skies: HTMLCanvasElement[] = [];
  private stars = Array.from({ length: 95 }, (_, i) => {
    const r = random(i * 91 + 81);
    return {
      x: r() * 1500,
      y: r() * 190,
      size: i % 19 === 0 ? 2 : 1,
      phase: r() * 6.28,
    };
  });
  readonly stats = { tilesBuilt: 0, cacheSize: 0 };
  constructor(
    readonly assets: AssetSources,
    readonly seed = 20261013,
  ) {
    this.sky = document.createElement("canvas");
    this.sky.width = 4;
    this.sky.height = HEIGHT;
    const c = this.sky.getContext("2d")!,
      g = c.createLinearGradient(0, 0, 0, 335);
    g.addColorStop(0, "#252c61");
    g.addColorStop(0.42, "#46467e");
    g.addColorStop(0.72, "#96729e");
    g.addColorStop(1, "#d79fba");
    c.fillStyle = g;
    c.fillRect(0, 0, 4, HEIGHT);
    this.skies = [this.sky];
    for (const colors of [
      ["#474b78", "#a07d9f", "#c3a5b0"],
      ["#53688c", "#8795b4", "#b3b2c5"],
      ["#453d6c", "#8d6485", "#b98b9c"],
    ]) {
      const sky = document.createElement("canvas");
      sky.width = 4;
      sky.height = HEIGHT;
      const ctx = sky.getContext("2d")!,
        gradient = ctx.createLinearGradient(0, 0, 0, 335);
      colors.forEach((color, i) => gradient.addColorStop(i / 2, color));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 4, HEIGHT);
      this.skies.push(sky);
    }
  }
  dispose() {
    for (const tile of this.cache.values()) {
      tile.width = 0;
      tile.height = 0;
    }
    this.cache.clear();
    this.stats.cacheSize = 0;
  }
  private sprite(
    c: CanvasRenderingContext2D,
    key: EnvironmentSprite,
    x: number,
    bottom: number,
    width: number,
    height?: number,
    flip = false,
  ) {
    const frame = ENVIRONMENT_FRAMES[key],
      h = height ?? (width * frame[4]) / frame[3];
    drawAsset(c, this.assets, key, x, bottom - h, width, h, flip);
  }
  private tile(layer: Layer, index: number) {
    const key = layer + ":" + index,
      existing = this.cache.get(key);
    if (existing) {
      this.cache.delete(key);
      this.cache.set(key, existing);
      return existing;
    }
    const canvas = document.createElement("canvas");
    // A gutter lets the cached softness cross tile boundaries without seams.
    canvas.width = TILE + 8;
    canvas.height = HEIGHT;
    const c = canvas.getContext("2d", { willReadFrequently: true })!,
      start = index * TILE - 4;
    c.imageSmoothingEnabled = false;
    const step =
      layer === "far" || layer === "ridges"
        ? 510
        : layer === "town"
          ? 384
          : 230;
    for (const cell of sceneryCells(start, TILE, step)) {
      const r = random(
        this.seed +
          cell * 313 +
          { far: 41, ridges: 83, town: 151, near: 211 }[layer],
      );
      const world = cell * step,
        x = world - start,
        section = environmentAt(world, this.seed).kind;
      if (layer === "far") {
        c.globalAlpha = 0.8;
        this.sprite(
          c,
          cell % 2 ? "mountainA" : "mountainB",
          x - 100,
          300 + r() * 15,
          760,
          180 + r() * 35,
          cell % 3 === 0,
        );
        c.globalAlpha = 1;
      } else if (layer === "ridges") {
        c.globalAlpha = 0.68;
        this.sprite(
          c,
          "forest",
          x - 40,
          322,
          620,
          155 + r() * 44,
          cell % 2 === 0,
        );
        c.globalAlpha = 1;
      } else if (layer === "town") {
        const baseline = 252 + Math.floor(r() * 3) * 13;
        if (section === 2) {
          this.sprite(c, "bridge", x - 10, 344, 400, 115);
          if (r() > 0.4) {
            this.sprite(c, "cliff", x + 12, 347, 108, 347 - baseline + 2);
            this.sprite(c, "cottage", x + 25, baseline + 3, 68);
          }
        } else if (section === 3) {
          const fall = waterfallForCell(cell, this.seed);
          if (fall)
            this.sprite(
              c,
              "waterfall",
              fall.x - start,
              fall.bottom,
              fall.width,
              fall.height,
            );
          else this.sprite(c, "bridge", x - 10, 344, 400, 115);
          this.sprite(c, "cliff", x + 8, 347, 120, 347 - baseline + 2);
          this.sprite(
            c,
            cell % 2 ? "house" : "cottage",
            x + 24,
            baseline + 3,
            65 + r() * 25,
          );
        } else if (section === 4) {
          this.sprite(c, "cliff", x - 10, 335, 260, 105);
          this.sprite(c, "tower", x + 102, 238, 38);
          this.sprite(c, "house", x + 20, 238, 65);
        } else if (section === 0) {
          this.sprite(c, "cliff", x - 8, 345, 312, 345 - baseline + 3);
          this.sprite(c, "house", x + 10, baseline, 65 + r() * 15);
          this.sprite(
            c,
            cell % 3 === 0 ? "center" : "cottage",
            x + 85,
            baseline,
            100,
          );
          this.sprite(
            c,
            "house",
            x + 195,
            baseline,
            65,
            undefined,
            cell % 2 === 0,
          );
          if (cell % 2 === 0) this.sprite(c, "tower", x + 264, baseline, 30);
          this.sprite(c, "bridge", x + 275, 334, 128, 91);
        } else {
          this.sprite(c, "cliff", x - 12, 346, 400, 47);
          for (let j = 0; j < 3; j++)
            this.sprite(c, "pines", x + j * 100, 305, 115 + r() * 30);
          if (r() > 0.4) {
            this.sprite(c, "cliff", x + 133, 347, 116, 70);
            this.sprite(c, "cottage", x + 147, 280, 80);
          }
          this.sprite(c, "bridge", x, 337, 370, 65);
        }
      } else {
        const width = 65 + r() * 40;
        if (section !== 2 || r() > 0.5) {
          c.globalAlpha = 0.94;
          this.sprite(c, cell % 2 ? "willow" : "blossom", x + 50, 335, width);
          c.globalAlpha = 1;
        }
        if (section === 5 || cell % 3 === 0)
          this.sprite(c, "lamp", x + 145, 335, 30);
        if (section === 2 || section === 3)
          this.sprite(c, "stairs", x + 150, 337, 90, 58);
        this.sprite(c, "bush", x + 20, 338, 48 + r() * 24);
      }
    }
    // Grade only while building a tile. No per-frame blur and no filter ever
    // touches characters, platforms, collectibles or collision indicators.
    const grade = {
      far: [0.68, 0.72, 0.85, 0.32],
      ridges: [0.75, 0.78, 0.55, 0.23],
      town: [0.8, 0.82, 0.28, 0.15],
      near: [0.9, 0.9, 0, 0.07],
    }[layer];
    const graded = document.createElement("canvas");
    graded.width = TILE;
    graded.height = HEIGHT;
    const gc = graded.getContext("2d", { willReadFrequently: true })!;
    gc.save();
    gc.filter = `saturate(${grade[0]}) contrast(${grade[1]}) blur(${grade[2]}px)`;
    gc.drawImage(canvas, -4, 0);
    gc.restore();
    gc.globalCompositeOperation = "source-atop";
    gc.fillStyle = `rgba(106, 108, 153, ${grade[3]})`;
    gc.fillRect(0, 0, TILE, HEIGHT);
    gc.globalCompositeOperation = "source-over";
    canvas.width = canvas.height = 0;
    this.cache.set(key, graded);
    this.stats.tilesBuilt++;
    while (this.cache.size > CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value!;
      const retired = this.cache.get(oldest)!;
      retired.width = 0;
      retired.height = 0;
      this.cache.delete(oldest);
    }
    this.stats.cacheSize = this.cache.size;
    return graded;
  }
  private layer(
    c: CanvasRenderingContext2D,
    name: Layer,
    scroll: number,
    width: number,
  ) {
    const offset = scroll * PARALLAX[name],
      first = Math.floor(offset / TILE),
      shift = Math.round(offset);
    for (let i = first; i <= Math.floor((offset + width) / TILE); i++)
      c.drawImage(this.tile(name, i), i * TILE - shift, 0);
  }
  draw(
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    scroll: number,
    time: number,
    foreground = false,
  ) {
    c.save();
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, width, height);
    const scale = height / HEIGHT,
      visible = width / scale;
    c.scale(scale, scale);
    const phase = Math.floor(time / 60000) % 4,
      blend = Math.min(1, (time % 60000) / 10000);
    c.drawImage(
      this.skies[phase === 0 && time < 60000 ? 0 : (phase + 3) % 4],
      0,
      0,
      visible,
      HEIGHT,
    );
    c.globalAlpha = blend;
    c.drawImage(this.skies[phase], 0, 0, visible, HEIGHT);
    c.globalAlpha = 1;
    for (const s of this.stars) {
      const x = wrap(s.x - scroll * PARALLAX.stars, 1500);
      c.globalAlpha =
        (phase === 2 ? 0.04 : phase === 1 ? 0.15 : 1) *
        (0.35 + 0.25 * Math.sin(time / 1900 + s.phase));
      c.fillStyle = "#ead3eb";
      c.fillRect(Math.round(x), Math.round(s.y), s.size, s.size);
      if (s.size === 2)
        c.fillRect(Math.round(x) - 2, Math.round(s.y) + 1, 6, 1);
    }
    c.globalAlpha = 1;
    const moonX =
      wrap(visible * 0.77 - 60 - scroll * PARALLAX.moon + 180, 1500) - 180;
    c.globalAlpha = phase === 2 ? 0.12 : phase === 1 ? 0.4 : 0.78;
    drawAsset(c, this.assets, "moon", moonX, 31, 104, 101);
    c.globalAlpha = 1;
    const cloudScroll = scroll * PARALLAX.clouds + time * 0.002;
    for (const cell of sceneryCells(cloudScroll, visible, 430, 430)) {
      const r = random(cell * 117 + 31),
        x = cell * 430 - cloudScroll;
      c.globalAlpha = 0.56;
      drawAsset(
        c,
        this.assets,
        cell % 2 ? "cloudA" : "cloudB",
        x,
        52 + r() * 68,
        370,
        118,
      );
    }
    c.globalAlpha = 1;
    this.layer(c, "far", scroll, visible);
    this.layer(c, "ridges", scroll, visible);
    // Decorative lake, always behind the collision platforms.
    c.fillStyle = "#474c83";
    c.fillRect(0, 303, visible, 129);
    for (let i = 0; i < 68; i++) {
      const r = random(i * 181 + 7),
        y = 306 + r() * 72,
        x = wrap(
          r() * 1700 - scroll * 0.32 + Math.sin(time / 1500 + i) * 7,
          1700,
        );
      c.globalAlpha = 0.2 + r() * 0.25;
      c.fillStyle = i % 3 ? "#a89bc4" : "#84bfe3";
      c.fillRect(Math.round(x), Math.round(y), 8 + r() * 24, 1);
    }
    for (let i = 0; i < 18; i++) {
      const x = moonX + 60 + Math.sin(i * 17 + time / 2200) * (8 + i * 2);
      c.globalAlpha = 0.15 + (i % 3) * 0.08;
      c.fillStyle = "#ffcb91";
      c.fillRect(Math.round(x), 307 + i * 3, 12 + (i % 4) * 7, 1);
    }
    c.globalAlpha = 1;
    this.layer(c, "town", scroll, visible);
    const districtOffset = scroll * PARALLAX.town;
    for (const cell of sceneryCells(districtOffset, visible, 384, 0)) {
      const fall = waterfallForCell(cell, this.seed);
      if (!fall) continue;
      const x = fall.x - districtOffset + fall.width * 0.5;
      for (let i = 0; i < 7; i++) {
        c.fillStyle = i % 2 ? "#b2e0ed" : "#8dc9e8";
        c.globalAlpha = 0.45;
        c.fillRect(
          Math.round(x + ((i % 3) - 1) * 8),
          Math.round(
            fall.bottom -
              fall.height +
              14 +
              wrap(time * 0.055 + i * 23, fall.height - 30),
          ),
          1,
          9,
        );
      }
    }
    c.globalAlpha = 1;
    this.layer(c, "near", scroll, visible);
    for (let i = 0; i < 14; i++) {
      const x = wrap(i * 131 - scroll * 0.7 - time * 0.009, visible + 60) - 30,
        y = wrap(i * 47 + time * 0.011, 320);
      c.globalAlpha = 0.28;
      c.fillStyle = i % 2 ? "#d99cc5" : "#c5b9e8";
      c.fillRect(Math.round(x), Math.round(y), 2, 1);
    }
    c.globalAlpha = 1;
    if (foreground) {
      for (let x = 0; x < visible; x += 256)
        drawAsset(
          c,
          this.assets,
          "soil",
          x,
          336,
          256,
          96,
          Math.floor(x / 256) % 2 === 1,
        );
      this.sprite(c, "blossom", 24, 337, 115);
      this.sprite(c, "lamp", 174, 337, 33);
    }
    c.restore();
  }
}
