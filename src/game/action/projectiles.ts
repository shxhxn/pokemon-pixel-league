import type Phaser from "phaser";
import type { Actor } from "./types";
/** Lifetime/camera cleanup and slow-time are shared by every projectile source. */
export function updateProjectiles(
  groups: Phaser.Physics.Arcade.Group[],
  now: number,
  scroll: number,
  width: number,
  slow = 1,
) {
  for (const group of groups)
    for (const item of group.getChildren()) {
      const bolt = item as Actor;
      if (
        now > bolt.getData("expires") ||
        bolt.x < scroll - 350 ||
        bolt.x > scroll + width + 400 ||
        bolt.y < -100 ||
        bolt.y > 500
      ) {
        bolt.destroy();
        continue;
      }
      if (bolt.getData("vx") !== undefined)
        bolt.setVelocity(bolt.getData("vx") * slow, bolt.getData("vy") * slow);
    }
}
