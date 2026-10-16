import { RULES } from "./world";

export const DIFFICULTY_RAMP_MS = 80000;
const LABELS = ["Warm-up", "Picking up", "Challenging", "Intense", "Expert"];
export function difficultyAt(elapsedMs: number, worldVersion = 3) {
  const progress =
    worldVersion < 3
      ? 0
      : Math.min(1, Math.max(0, elapsedMs) / DIFFICULTY_RAMP_MS);
  const level = Math.min(5, Math.floor(progress * 4) + 1);
  return {
    progress,
    level,
    label: LABELS[level - 1],
    speed: RULES.speed + 60 * progress,
    crumbleMs: Math.round(650 - 300 * progress),
  };
}

// Integral of a smoothly increasing rate. Unlike elapsed * rate, this keeps
// patrol/platform positions continuous when difficulty rises or reaches its cap.
export function progressiveClock(
  elapsedMs: number,
  increase: number,
  worldVersion = 3,
) {
  const elapsed = Math.max(0, elapsedMs);
  if (worldVersion < 3) return elapsed;
  const ramp = Math.min(elapsed, DIFFICULTY_RAMP_MS);
  return (
    elapsed +
    increase *
      ((ramp * ramp) / (2 * DIFFICULTY_RAMP_MS) +
        Math.max(0, elapsed - DIFFICULTY_RAMP_MS))
  );
}
export function maxTravelPixels(durationMs: number, worldVersion = 3): number {
  // Version 5's capped speed feather plus 160 ms / 2.8 s dash. This
  // conservative integral allows legal boosts without allowing teleportation.
  if (worldVersion >= 5)
    return (
      maxTravelPixels(durationMs, 4) * 1.12 + Math.ceil(durationMs / 2800) * 38
    );
  return (
    (RULES.speed *
      progressiveClock(durationMs, 60 / RULES.speed, worldVersion)) /
    1000
  );
}
