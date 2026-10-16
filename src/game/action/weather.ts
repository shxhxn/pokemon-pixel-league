export const WEATHER = [
  "Petal drift",
  "Light rain",
  "Lantern glow",
  "Pokémon migration",
  "Valley mist",
  "Meteor shower",
  "Strong wind",
  "Thunderstorm",
] as const;
export function weatherAt(elapsed: number, seed: number) {
  return WEATHER[
    (Math.floor(elapsed / 18000) + (Math.abs(seed) % WEATHER.length)) %
      WEATHER.length
  ];
}
export function dayAt(elapsed: number) {
  return ["Moonlit", "Dawn", "Daylight", "Sunset"][
    Math.floor(elapsed / 60000) % 4
  ];
}
/** Low-opacity weather behind gameplay; no visibility-obscuring screen effects. */
export function drawWeather(
  c: CanvasRenderingContext2D,
  width: number,
  elapsed: number,
  seed: number,
) {
  const event = weatherAt(elapsed, seed);
  c.save();
  if (event === "Light rain" || event === "Thunderstorm") {
    c.strokeStyle = "#b8c3eb";
    c.globalAlpha = 0.18;
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < 32; i++) {
      const x = (i * 97 + elapsed * 0.02) % width,
        y = (i * 43 + elapsed * 0.16) % 330;
      c.moveTo(x, y);
      c.lineTo(x - 3, y + 9);
    }
    c.stroke();
  }
  if (event === "Valley mist") {
    c.fillStyle = "#a9a7cb";
    c.globalAlpha = 0.09;
    c.fillRect(0, 260, width, 70);
  }
  if (event === "Meteor shower") {
    c.fillStyle = "#ead5bf";
    c.globalAlpha = 0.35;
    for (let i = 0; i < 3; i++) {
      const x = ((elapsed * 0.08 + i * 241) % (width + 100)) - 50,
        y = (elapsed * 0.025 + i * 51) % 130;
      c.fillRect(x, y, 12, 1);
    }
  }
  if (event === "Lantern glow") {
    c.fillStyle = "#ffd39e";
    c.globalAlpha = 0.12;
    for (let i = 0; i < 8; i++)
      c.fillRect(
        (i * 151 + elapsed * 0.004) % width,
        170 + Math.sin(elapsed / 2000 + i) * 12,
        3,
        5,
      );
  }
  if (event === "Thunderstorm" && elapsed % 9000 < 160) {
    c.fillStyle = "#c6c8e1";
    c.globalAlpha = 0.04;
    c.fillRect(0, 0, width, 300);
  }
  if (event === "Strong wind" || event === "Petal drift") {
    c.fillStyle = "#d2b1dd";
    c.globalAlpha = 0.3;
    for (let i = 0; i < 18; i++)
      c.fillRect(
        (i * 97 +
          width -
          ((elapsed * (event === "Strong wind" ? 0.06 : 0.015)) % width)) %
          width,
        (i * 31 + elapsed * 0.012) % 320,
        3,
        1,
      );
  }
  c.restore();
  return event;
}
