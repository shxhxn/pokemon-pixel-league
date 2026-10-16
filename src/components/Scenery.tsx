import { useEffect, useRef, useState } from "react";
import { MoonlitLandscape } from "../game/landscape";
import { loadEnvironmentAssets } from "../game/environmentAssets";
export function Scenery({ biome = 0 }: { biome?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let frame = 0,
      disposed = false,
      renderer: MoonlitLandscape | undefined,
      last = 0,
      start = 0,
      visible = true;
    const target = canvas.current!,
      c = target.getContext("2d")!;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(target);
    loadEnvironmentAssets()
      .then((assets) => {
        if (disposed) return;
        renderer = new MoonlitLandscape(assets);
        const loop = (t: number) => {
          if (!start) start = t;
          if (still || (visible && t - last > 32)) {
            const elapsed = still ? 0 : t - start;
            renderer!.draw(
              c,
              768,
              384,
              biome * 1152 + elapsed * 0.004,
              elapsed,
              true,
            );
            last = t;
          }
          if (!still) frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
      })
      .catch((e) => {
        if (!disposed) setError(e.message);
      });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer?.dispose();
    };
  }, [biome]);
  return (
    <>
      <canvas
        aria-label="Moonlit pixel village with flowering trees, glowing windows, mountains and a reflective lake"
        ref={canvas}
        width={768}
        height={384}
      />
      {error && <span role="status">{error}</span>}
    </>
  );
}
