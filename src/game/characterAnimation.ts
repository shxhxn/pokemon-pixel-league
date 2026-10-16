export type CharacterState =
  "idle" | "run" | "jump" | "fall" | "land" | "hurt" | "celebrate";
export function characterState(input: {
  finished: boolean;
  hurt: boolean;
  grounded: boolean;
  landing: boolean;
  velocityX: number;
  velocityY: number;
}): CharacterState {
  if (input.finished) return "celebrate";
  if (input.hurt) return "hurt";
  if (!input.grounded) return input.velocityY < 0 ? "jump" : "fall";
  if (input.landing) return "land";
  return Math.abs(input.velocityX) > 5 ? "run" : "idle";
}
