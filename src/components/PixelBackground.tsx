import type { CSSProperties } from "react";

const companions = [
  { id: 94, x: "0%", y: "8%", size: 210, delay: -4 },
  { id: 25, x: "82%", y: "8%", size: 190, delay: -11 },
  { id: 151, x: "36%", y: "34%", size: 150, delay: -7 },
  { id: 149, x: "84%", y: "48%", size: 230, delay: -2 },
  { id: 133, x: "3%", y: "69%", size: 180, delay: -13 },
  { id: 658, x: "58%", y: "76%", size: 220, delay: -8 },
  { id: 143, x: "31%", y: "87%", size: 200, delay: -5 },
];

export function PixelBackground() {
  return (
    <div className="pixel-background" aria-hidden="true">
      <div className="pixel-starfield" />
      <span className="background-wordmark">PIXEL LEAGUE</span>
      {companions.map((p) => (
        <img
          key={p.id}
          src={`/assets/pokemon/${p.id}.png`}
          alt=""
          draggable={false}
          className="background-pokemon"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            "--drift-delay": `${p.delay}s`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
