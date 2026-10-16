import { random } from "./world";
export type PickupKind = "shield" | "magnet" | "rapid" | "heart";
export function pickupForChunk(
  seed: number,
  index: number,
): { kind: PickupKind; x: number; y: number; id: string } | null {
  const r = random(seed + index * 9173);
  if (index > 0 && index % 22 === 0 && r() < 0.35)
    return {
      kind: "heart",
      x: index * 768 + 650,
      y: 303,
      id: `${index}:p:heart`,
    };
  if (index < 2 || index % 4 !== 2) return null;
  return {
    kind: (["shield", "magnet", "rapid"] as const)[Math.floor(index / 4) % 3],
    x: index * 768 + 650,
    y: 303,
    id: `${index}:p:boost`,
  };
}
export function atmosphere(elapsedMs: number) {
  const phase = (Math.max(0, elapsedMs) / 30000) % 4;
  return { phase, name: ["Dawn", "Day", "Sunset", "Night"][Math.floor(phase)] };
}
export const POWER_SECONDS = 8;
export function attackCooldown(rapid: boolean) {
  return rapid ? 180 : 450;
}
