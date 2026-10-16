import { FOES, isBoss, stageAt, type Foe } from "../../../shared/action";
import { sound } from "../sound";
import type { ActionHost, Actor } from "./types";
import type { Combat } from "./combat";
import { BossHazards } from "./bosses";

/** Per-enemy state machines; all timers use a pause-aware, slow-time clock. */
export class EnemyDirector {
  clock = 0;
  boss: Actor | null = null;
  warning = "";
  warningUntil = 0;
  readonly floorAttacks: BossHazards;
  constructor(
    readonly h: ActionHost,
    readonly combat: Combat,
  ) {
    this.floorAttacks = new BossHazards(h);
  }
  init(e: Actor, kind: Foe) {
    const definition = FOES[kind];
    e.setTexture(`foe-${kind}`)
      .setDisplaySize(isBoss(kind) ? 66 : 34, isBoss(kind) ? 66 : 34)
      .refreshBody();
    e.setData({
      hp: definition.hp,
      maxHp: definition.hp,
      ready: this.clock + 1500,
      windup: 0,
      mode: "patrol",
      kind,
      seen: false,
      knock: 0,
      spawnX: e.x,
    });
    e.setDepth(3);
    if (!definition.fly) {
      e.y = (this.h.ground(e.x) ?? 336) - e.displayHeight / 2;
      e.setData("baseY", e.y);
      e.refreshBody();
    }
    if (this.h.scene.textures.exists(`motion-${kind}`)) {
      const visual = this.h.scene.add
        .sprite(e.x, e.y + e.displayHeight / 2, `motion-${kind}`)
        .setOrigin(0.5, 90 / 96)
        .setScale(isBoss(kind) ? 0.9 : 0.48)
        .setDepth(3);
      visual.play(`foe-${kind}-run`);
      e.setData("visual", visual);
      e.setVisible(false);
      e.once("destroy", () => visual.destroy());
    }
    if (kind === "ekans") {
      const cover = this.h.scene.add
        .image(e.x, e.y + e.displayHeight / 2, "bush-0")
        .setOrigin(0.5, 1)
        .setDepth(4);
      e.setData("cover", cover);
      e.once("destroy", () => cover.destroy());
    }
    if (!isBoss(kind)) {
      const track = this.h.scene.add
        .rectangle(e.x, e.y - 27, 28, 3, 0x29233d)
        .setDepth(6)
        .setVisible(false);
      const fill = this.h.scene.add
        .rectangle(e.x - 14, e.y - 27, 28, 3, 0xe8b1d6)
        .setOrigin(0, 0.5)
        .setDepth(7)
        .setVisible(false);
      e.setData({ hpTrack: track, hpFill: fill });
      e.once("destroy", () => {
        track.destroy();
        fill.destroy();
      });
    }
  }
  get bossHud() {
    const b = this.boss;
    return b?.active
      ? {
          name: String(b.getData("kind")).toUpperCase(),
          hp: b.getData("hp") as number,
          max: b.getData("maxHp") as number,
        }
      : null;
  }
  notice(text: string, x: number, y: number) {
    this.warning = text;
    this.warningUntil = this.h.now() + 1900;
    this.h.text(x, y - 32, "!", "#ffe6ac");
  }
  shot(e: Actor, angle: number, speed: number, offset = 0) {
    if (
      this.h.hostile.countActive(true) >= stageAt(this.h.distance()).projectiles
    )
      return;
    const b = this.h.hostile.create(e.x, e.y, "enemy-bolt") as Actor;
    b.setVelocity(
      Math.cos(angle + offset) * speed,
      Math.sin(angle + offset) * speed,
    )
      .setDepth(6)
      .setData({
        expires: this.h.now() + 2600,
        vx: Math.cos(angle + offset) * speed,
        vy: Math.sin(angle + offset) * speed,
      });
    b.setTint(FOES[e.getData("kind") as Foe].color);
  }
  update(delta: number) {
    const dt = Math.min(delta, 50) / 1000,
      slow = this.combat.slowScale;
    this.clock += Math.min(delta, 50) * slow;
    this.floorAttacks.update(this.clock);
    const now = this.clock,
      stage = stageAt(this.h.distance()),
      camera = this.h.scene.cameras.main;
    if (this.warningUntil < this.h.now()) this.warning = "";
    if (this.boss && (!this.boss.active || this.boss.x < camera.scrollX - 90))
      this.boss = null;
    let engaged = 0;
    for (const e of this.h.enemies.getChildren() as Actor[]) {
      const visual = e.getData("visual") as
        Phaser.GameObjects.Sprite | undefined;
      const cover = e.getData("cover") as Phaser.GameObjects.Image | undefined;
      cover?.setVisible(e.active);
      const track = e.getData("hpTrack") as
          Phaser.GameObjects.Rectangle | undefined,
        fill = e.getData("hpFill") as Phaser.GameObjects.Rectangle | undefined;
      const damaged = e.active && e.getData("hp") < e.getData("maxHp");
      track?.setVisible(damaged).setPosition(e.x, e.y - 27);
      fill
        ?.setVisible(damaged)
        .setPosition(e.x - 14, e.y - 27)
        .setSize((28 * e.getData("hp")) / e.getData("maxHp"), 3);
      if (visual) visual.setVisible(e.active);
      if (!e.active) continue;
      const kind = e.getData("kind") as Foe,
        def = FOES[kind];
      if (!def) continue;
      if (
        e.getData("summoned") &&
        (!this.boss?.active || this.h.now() > e.getData("summonExpires"))
      ) {
        e.destroy();
        continue;
      }
      const visible =
        e.x > camera.scrollX + 10 && e.x < camera.scrollX + camera.width - 10;
      const boss = isBoss(kind);
      if (boss && visible && !this.boss) {
        this.boss = e;
        this.combat.bossDamageStart = this.combat.damageTaken;
        this.h.hostile.clear(true, true);
        this.notice(
          `${kind.toUpperCase()} approaches · fight or pass above`,
          e.x,
          e.y,
        );
      }
      e.setData(
        "passive",
        !!this.boss?.active && !boss && !e.getData("summoned"),
      );
      if (e.getData("passive")) {
        e.setAlpha(0.35);
        visual?.setAlpha(0.35);
        continue;
      }
      if (!visible || engaged++ >= stage.cap) continue;
      if (!e.getData("seen")) {
        e.setData({ seen: true, ready: now + 1300 });
      }
      const baseX = e.getData("baseX") as number,
        baseY = e.getData("baseY") as number;
      const phase = now / (boss ? 700 : 500) + baseX;
      const stunned = this.h.now() < (e.getData("stunned") || 0);
      const knocked = e.getData("knock") || 0;
      const range = boss ? 80 : e.getData("range") || 26;
      let x = baseX + Math.sin(phase) * range,
        y = baseY;
      if (def.fly)
        y +=
          Math.sin(phase * (kind === "zubat" ? 2.3 : 1)) *
          (kind === "zubat" ? 22 : 12);
      if (stunned) {
        x = e.x + knocked * dt * 3;
        e.setData("knock", knocked * 0.85);
      }
      const near = Math.abs(this.h.player.x - e.x) < 310;
      if (
        !stunned &&
        !e.getData("windup") &&
        near &&
        now >= e.getData("ready")
      ) {
        e.setData({
          windup: now + stage.telegraph + (boss ? 350 : 0),
          targetX: this.h.player.x,
          targetY: this.h.player.y,
          originX: e.x,
          originY: e.y,
          attackDamage: this.combat.damageTaken,
        });
        this.notice(
          kind === "voltorb"
            ? "Voltorb is flashing! Leave the ring."
            : kind === "ekans"
              ? "Rustling bush! Ekans is about to lunge."
              : `${kind.toUpperCase()} · attack incoming`,
          e.x,
          e.y,
        );
        if (kind === "voltorb") {
          const ring = this.h.scene.add
            .circle(e.x, e.y, 65, 0xffb2c3, 0.07)
            .setStrokeStyle(2, 0xffd5aa)
            .setDepth(2);
          e.setData("ring", ring);
          this.h.scene.time.delayedCall(stage.telegraph + 500, () =>
            ring.destroy(),
          );
        }
      }
      const fire = e.getData("windup") as number;
      if (e.getData("dodgeAt") && now > e.getData("dodgeAt")) {
        if (
          this.combat.damageTaken === e.getData("attackDamage") &&
          !e.getData("summoned")
        )
          this.combat.rewardStyle(e.getData("id"), "dodge");
        e.setData("dodgeAt", 0);
      }
      if (fire && now >= fire && !stunned) {
        e.setData({
          windup: 0,
          ready:
            now +
            stage.cooldown * (boss && e.getData("hp") < def.hp / 2 ? 0.7 : 1),
          attackUntil: now + 650,
          attackFrom: now,
          dodgeAt: now + 2700,
        });
        const angle = Math.atan2(
          e.getData("targetY") - e.y,
          e.getData("targetX") - e.x,
        );
        if (["gastly", "haunter", "gengar", "electabuzz"].includes(kind)) {
          for (const offset of ["haunter", "gengar", "electabuzz"].includes(
            kind,
          )
            ? [-0.23, 0, 0.23]
            : [0])
            this.shot(e, angle, 125 + stage.level * 9, offset);
          if (kind === "haunter" || kind === "gengar") {
            this.h.effect(e.x, e.y, def.color, 8);
            // Teleport between fixed perches. Never appear on the player's body.
            const target =
              e.getData("spawnX") + (e.x < e.getData("spawnX") ? 75 : -75);
            if (Math.abs(target - this.h.player.x) > 90) {
              e.setData("baseX", target);
              x = target;
            }
          }
          if (kind === "gengar" && e.getData("hp") < def.hp / 2) {
            const summons = (this.h.enemies.getChildren() as Actor[]).filter(
              (s) => s.active && s.getData("summoned"),
            );
            if (summons.length < 2) {
              const x = e.x + (e.x < this.h.player.x ? -100 : 100);
              const summon = this.h.enemies.create(
                x,
                220,
                "foe-gastly",
              ) as Actor;
              summon.setData({
                id: `${e.getData("id")}:summon`,
                baseX: x,
                baseY: 220,
                range: 25,
                summoned: true,
                summonExpires: this.h.now() + 12000,
              });
              this.init(summon, "gastly");
              this.h.effect(x, 220, 0xc89fdf, 8);
            }
          }
          if (kind === "electabuzz") {
            const x = e.getData("targetX");
            this.groundWarning(x, "electric", 800);
          }
        } else if (kind === "voltorb") {
          const ring = e.getData("ring") as Phaser.GameObjects.Arc | undefined;
          ring?.destroy();
          this.h.effect(e.x, e.y, def.color, 14);
          if (Math.hypot(this.h.player.x - e.x, this.h.player.y - e.y) < 65)
            this.h.damage();
          e.setData("ready", now + 4000);
        } else if (kind === "onix") {
          this.groundWarning(e.getData("targetX"), "rock", 1000);
        }
        sound("attack", def.id);
      }
      if (!stunned && now < (e.getData("attackUntil") || 0)) {
        const t = Math.min(1, (now - e.getData("attackFrom")) / 650);
        if (["rattata", "geodude", "ekans", "onix"].includes(kind))
          x =
            e.getData("originX") +
            Math.sign(e.getData("targetX") - e.getData("originX")) *
              Math.sin(t * Math.PI) *
              (boss ? 110 : 40 + stage.level * 5);
        if (kind === "pidgey") y = baseY + Math.sin(t * Math.PI) * 70;
        if (kind === "geodude" || kind === "voltorb") e.rotation += dt * 10;
      } else e.rotation = 0;
      if (!def.fly) {
        const floor = this.h.ground(x);
        if (floor === undefined) x = baseX;
        y = (this.h.ground(x) ?? 336) - e.displayHeight / 2;
      }
      e.setPosition(x, y)
        .setFlipX(this.h.player.x < x)
        .setTint(stunned ? 0xffffff : fire ? 0xffdaa0 : def.color);
      e.setAlpha(
        kind === "ekans" && !fire && now > (e.getData("attackUntil") || 0)
          ? 0.45
          : kind === "gastly" && !fire
            ? 0.65 + 0.2 * Math.sin(phase)
            : 1,
      );
      e.refreshBody();
      if (visual) {
        visual
          .setPosition(e.x, e.y + e.displayHeight / 2)
          .setFlipX(e.flipX)
          .setTint(e.tintTopLeft)
          .setAlpha(e.alpha)
          .setRotation(e.rotation);
        const state = stunned
          ? "hurt"
          : fire
            ? "celebrate"
            : now < (e.getData("attackUntil") || 0)
              ? "jump"
              : "run";
        visual.play(`foe-${kind}-${state}`, true);
        e.setVisible(false);
      }
      if (e.getData("ring")?.active) e.getData("ring").setPosition(e.x, e.y);
      cover
        ?.setPosition(e.x, e.y + e.displayHeight / 2)
        .setAlpha(fire || now < (e.getData("attackUntil") || 0) ? 0.25 : 0.85);
    }
  }
  groundWarning(x: number, kind: "electric" | "rock", delay: number) {
    if (this.boss?.active)
      this.floorAttacks.warn(this.boss, this.clock, x, kind, delay);
  }
}
