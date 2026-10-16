import type { ActionHost, Actor } from "./types";
/** Boss floor attacks use the same slow-time clock as their warning and AI. */
export class BossHazards {
  pending: {
    x: number;
    ground: number;
    kind: "electric" | "rock";
    at: number;
    marker: Phaser.GameObjects.Rectangle;
    owner: Actor;
  }[] = [];
  constructor(readonly h: ActionHost) {}
  warn(
    owner: Actor,
    clock: number,
    x: number,
    kind: "electric" | "rock",
    delay: number,
  ) {
    const ground = this.h.ground(x);
    if (ground === undefined || this.pending.length >= 3) return;
    const marker = this.h.scene.add
      .rectangle(x, ground - 3, 50, 6, 0xffd892, 0.7)
      .setDepth(4);
    this.pending.push({ x, ground, kind, at: clock + delay, marker, owner });
  }
  update(clock: number) {
    for (const hit of [...this.pending]) {
      if (!hit.owner.active || hit.x < this.h.scene.cameras.main.scrollX - 80) {
        hit.marker.destroy();
        this.pending.splice(this.pending.indexOf(hit), 1);
        continue;
      }
      if (clock < hit.at) continue;
      hit.marker.destroy();
      this.pending.splice(this.pending.indexOf(hit), 1);
      if (hit.kind === "electric") {
        this.h.effect(hit.x, hit.ground - 15, 0xffdc85, 9);
        if (
          Math.abs(this.h.player.x - hit.x) < 30 &&
          this.h.player.y > hit.ground - 45
        )
          this.h.damage();
      } else if (this.h.hostile.countActive(true) < 12) {
        const b = this.h.hostile.create(
          hit.x,
          hit.ground - 165,
          "saw",
        ) as Actor;
        b.setVelocityY(180)
          .setData({ expires: this.h.now() + 1200, vx: 0, vy: 180 })
          .setDepth(5);
      }
    }
  }
}
