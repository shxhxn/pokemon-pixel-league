export const ENVIRONMENT_URLS = {
  village: "/assets/environment/village-atlas.png",
  parallax: "/assets/environment/parallax-atlas.png",
  terrain: "/assets/environment/terrain-atlas.png",
} as const;
type Sheet = keyof typeof ENVIRONMENT_URLS;
export type AssetSources = Record<Sheet, CanvasImageSource>;
type Frame = readonly [Sheet, number, number, number, number];
// Hand-inspected atlas rectangles. Source PNGs remain intact.
export const ENVIRONMENT_FRAMES = {
  center: ["village", 20, 198, 445, 288],
  house: ["village", 492, 78, 414, 408],
  tower: ["village", 976, 0, 230, 486],
  blossom: ["village", 8, 488, 430, 379],
  willow: ["village", 441, 494, 428, 374],
  pines: ["village", 861, 491, 380, 379],
  lamp: ["village", 116, 870, 232, 342],
  bush: ["village", 398, 1046, 426, 170],
  cottage: ["village", 861, 873, 385, 343],
  mountainA: ["parallax", 8, 122, 620, 350],
  mountainB: ["parallax", 630, 153, 614, 320],
  cloudA: ["parallax", 16, 574, 611, 247],
  cloudB: ["parallax", 633, 544, 608, 279],
  forest: ["parallax", 16, 924, 799, 264],
  moon: ["parallax", 834, 862, 355, 345],
  soil: ["terrain", 24, 163, 666, 234],
  platform: ["terrain", 717, 224, 513, 103],
  bridge: ["terrain", 18, 468, 686, 328],
  waterfall: ["terrain", 708, 419, 536, 411],
  cliff: ["terrain", 24, 873, 669, 302],
  stairs: ["terrain", 749, 880, 494, 306],
} as const satisfies Record<string, Frame>;
export type EnvironmentSprite = keyof typeof ENVIRONMENT_FRAMES;
const edgeCache = new WeakMap<AssetSources, Map<string, HTMLCanvasElement>>();
export function drawAsset(
  c: CanvasRenderingContext2D,
  assets: AssetSources,
  key: EnvironmentSprite,
  x: number,
  y: number,
  w: number,
  h?: number,
  flip = false,
) {
  const [sheet, sx, sy, sw, sh] = ENVIRONMENT_FRAMES[key];
  let cache = edgeCache.get(assets);
  if (!cache) {
    cache = new Map();
    edgeCache.set(assets, cache);
  }
  let sprite = cache.get(key);
  if (!sprite) {
    // Decode each sprite once at native size. This also avoids browser image
    // subsampling changing fine pixel detail after the same PNG is reused.
    sprite = document.createElement("canvas");
    sprite.width = sw;
    sprite.height = sh;
    const ctx = sprite.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(assets[sheet], sx, sy, sw, sh, 0, 0, sw, sh);
    // Trim empty atlas margins once. The bottom of a placed object is now its
    // visible footing, rather than an invisible rectangle below the artwork.
    if (
      ![
        "mountainA",
        "mountainB",
        "forest",
        "cloudA",
        "cloudB",
        "moon",
        "soil",
        "platform",
      ].includes(key)
    ) {
      const pixels = ctx.getImageData(0, 0, sw, sh).data;
      let bottom = sh - 1;
      while (bottom > 0) {
        let visible = 0;
        for (let col = 0; col < sw; col++)
          if (pixels[(bottom * sw + col) * 4 + 3] > 80) visible++;
        if (visible > sw * 0.03) break;
        bottom--;
      }
      if (bottom < sh - 1) {
        const trimmed = document.createElement("canvas");
        trimmed.width = sw;
        trimmed.height = bottom + 1;
        trimmed.getContext("2d")!.drawImage(sprite, 0, 0);
        sprite = trimmed;
      }
    }
    if (key === "mountainA" || key === "mountainB" || key === "forest") {
      const mask = ctx.createLinearGradient(0, 0, sw, 0);
      mask.addColorStop(0, "transparent");
      mask.addColorStop(0.06, "#fff");
      mask.addColorStop(0.94, "#fff");
      mask.addColorStop(1, "transparent");
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = mask;
      ctx.fillRect(0, 0, sw, sh);
    }
    cache.set(key, sprite);
  }
  c.save();
  c.imageSmoothingEnabled = false;
  c.translate(Math.round(x) + (flip ? Math.round(w) : 0), Math.round(y));
  if (flip) c.scale(-1, 1);
  c.drawImage(sprite, 0, 0, Math.round(w), Math.round(h ?? (w * sh) / sw));
  c.restore();
}
let pending: Promise<AssetSources> | undefined;
export function loadEnvironmentAssets() {
  if (!pending)
    pending = Promise.all(
      Object.entries(ENVIRONMENT_URLS).map(
        ([key, url]) =>
          new Promise<readonly [Sheet, HTMLImageElement]>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve([key as Sheet, image]);
            image.onerror = () =>
              reject(
                Error("The moonlit scenery could not load. Please reload."),
              );
            image.src = url;
          }),
      ),
    )
      .then((entries) => Object.fromEntries(entries) as AssetSources)
      .catch((error) => {
        pending = undefined;
        throw error;
      });
  return pending;
}
export function paintTerrain(
  c: CanvasRenderingContext2D,
  assets: AssetSources,
  width: number,
  height: number,
  floating = false,
) {
  c.imageSmoothingEnabled = false;
  // Mirrored pairs meet on identical source columns, avoiding repeat seams.
  const step = floating ? 128 : 384;
  for (let x = 0; x < width; x += step)
    drawAsset(
      c,
      assets,
      floating ? "platform" : "soil",
      x,
      0,
      step,
      height,
      Math.floor(x / step) % 2 === 1,
    );
}
