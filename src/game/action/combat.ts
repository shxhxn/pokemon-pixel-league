import {
  FOES,
  ITEMS,
  isBoss,
  itemRoll,
  kitFor,
  multiplier,
  type CombatEvent,
  type Foe,
  type HeldItem,
  type StyleEvent,
} from "../../../shared/action";
import { sound } from "../sound";
import type { ActionHost, Actor } from "./types";

export class Combat {
  energy = 60;
  held: HeldItem | null = null;
  shieldHit = false;
  buffs: Partial<Record<HeldItem, number>> = {};
  events: CombatEvent[] = [];
  chain = 0;
  lastKill = -10000;
  style: StyleEvent[] = [];
  styleIds = new Set<string>();
  section = 0;
  sectionDamage = 0;
  rewardStyle(id: string, kind: "dodge" | "clean") {
    if (this.styleIds.has(id)) return;
    this.styleIds.add(id);
    this.style.push({ id, kind, at: Math.round(this.h.now()) });
    this.h.text(
      this.h.player.x,
      this.h.player.y - 36,
      kind === "clean" ? "CLEAN SECTION +200" : "DODGE +50",
      "#d9e3ff",
    );
  }
  dashUntil = 0;
  dashReady = 0;
  basicReady = 0;
  specialReady = 0;
  itemReady = 0;
  flameUntil = 0;
  flameAt = 0;
  comboBest = 0;
  kills = 0;
  damageTaken = 0;
  flawlessBosses = 0;
  bossDamageStart = 0;
  kit;
  upgraded = false;
  dashUnlocked = false;
  constructor(readonly h: ActionHost) {
    this.kit = kitFor(h.pokemon);
  }
  active(key: HeldItem) {
    return (this.buffs[key] || 0) > this.h.now();
  }
  get speedScale() {
    return this.active("speed") ? 1.12 : 1;
  }
  get slowScale() {
    return this.active("slow") ? 0.5 : 1;
  }
  get multiplier() {
    return multiplier(this.chain);
  }
  guard() {
    if (this.active("star") || this.h.now() < this.dashUntil) return true;
    if (this.shieldHit) {
      this.shieldHit = false;
      this.h.effect(this.h.player.x, this.h.player.y, 0x9bddff, 9);
      return true;
    }
    this.chain = 0;
    this.damageTaken++;
    return false;
  }
  projectile(
    angle: number,
    damage: number,
    special = false,
    speed = 430,
    life = 700,
  ) {
    if (this.h.bolts.countActive(true) >= 20) return;
    const now = this.h.now(),
      p = this.h.player;
    const b = this.h.bolts.create(
      p.x + this.h.facing() * 20,
      p.y,
      "bolt",
    ) as Actor;
    b.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
      .setTint(this.kit.color)
      .setDepth(7);
    b.setData({
      expires: now + life,
      damage,
      special,
      bornX: p.x,
      burn: this.upgraded && this.kit.specialMode === "flame",
      root: this.upgraded && this.kit.specialMode === "leaf",
    });
    if (special) b.setScale(1.3);
  }
  basic() {
    const now = this.h.now();
    if (now < this.basicReady) return;
    this.basicReady = now + (this.h.rapid() ? 180 : this.upgraded ? 310 : 420);
    this.h.cast(now + 160);
    const { mode, color } = this.kit,
      p = this.h.player;
    if (mode === "bolt") this.projectile(this.h.facing() > 0 ? 0 : Math.PI, 1);
    else {
      const reach = mode === "bite" ? 62 : 112;
      const slash = this.h.scene.add
        .rectangle(
          p.x + (this.h.facing() * reach) / 2,
          p.y,
          reach,
          mode === "bite" ? 18 : 5,
          color,
          0.7,
        )
        .setDepth(7);
      this.h.scene.tweens.add({
        targets: slash,
        alpha: 0,
        duration: 150,
        onComplete: () => slash.destroy(),
      });
      this.nearby(reach, 35).forEach((e) =>
        this.hit(e, mode === "bite" ? 2 : 1, false),
      );
    }
    sound("attack", this.h.pokemon);
  }
  special() {
    const now = this.h.now();
    if (now < this.specialReady || this.energy < this.kit.cost) return;
    this.energy -= this.kit.cost;
    this.specialReady = now + 850;
    this.h.cast(now + 450);
    const p = this.h.player,
      angle = this.h.facing() > 0 ? 0 : Math.PI;
    this.h.scene.cameras.main.shake(90, 0.0015);
    const mode = this.kit.specialMode;
    if (mode === "thunder") {
      const ring = this.h.scene.add
        .circle(p.x, p.y, 112, this.kit.color, 0.16)
        .setStrokeStyle(2, this.kit.color)
        .setDepth(7);
      this.h.scene.tweens.add({
        targets: ring,
        alpha: 0,
        duration: 260,
        onComplete: () => ring.destroy(),
      });
      this.nearby(115, 100, true).forEach((e) => this.hit(e, 4, true));
    } else if (mode === "guard") {
      this.h.shield(now + (this.upgraded ? 5000 : 2800));
      this.energy = Math.min(100, this.energy + 5);
    } else if (mode === "flame") {
      this.flameUntil = now + 1100;
      this.flameAt = 0;
    } else
      for (const spread of mode === "leaf" || this.upgraded
        ? [-0.2, 0, 0.2]
        : [0])
        this.projectile(angle + spread, 3, true);
    this.h.effect(p.x, p.y, this.kit.color, 10);
    sound("special", this.h.pokemon);
  }
  nearby(reach: number, height: number, both = false) {
    return (this.h.enemies.getChildren() as Actor[]).filter(
      (e) =>
        e.active &&
        Math.abs(e.x - this.h.player.x) < reach &&
        Math.abs(e.y - this.h.player.y) < height &&
        (both || Math.sign(e.x - this.h.player.x) === this.h.facing()),
    );
  }
  hit(e: Actor, amount: number, special: boolean, burn = false, root = false) {
    if (!e.active || this.h.now() < (e.getData("hitUntil") || 0)) return;
    const kind = e.getData("kind") as Foe,
      boss = isBoss(kind),
      now = this.h.now();
    if (!FOES[kind]) {
      this.h.defeat(e);
      return;
    }
    if (this.active("damage")) amount *= 2;
    if (boss && e.getData("windup")) amount *= 0.5;
    e.setData("hitUntil", now + 100);
    e.setData("hp", Math.max(0, e.getData("hp") - amount));
    e.setData("stunned", now + (root ? 1300 : special ? 450 : 160));
    e.setData("knock", this.h.facing() * (boss ? 6 : special ? 35 : 12));
    if (burn) e.setData({ burnUntil: now + 2400, burnAt: now + 800 });
    this.energy = Math.min(100, this.energy + 4);
    this.h.effect(e.x, e.y, FOES[kind].color, 4);
    sound("hit", FOES[kind].id);
    if (e.getData("hp") > 0) return;
    if (e.getData("summoned")) {
      e.destroy();
      this.energy = Math.min(100, this.energy + 5);
      return;
    }
    this.chain = now - this.lastKill <= 5000 ? this.chain + 1 : 1;
    this.lastKill = now;
    this.comboBest = Math.max(this.comboBest, this.chain);
    this.kills++;
    this.energy = Math.min(100, this.energy + (boss ? 35 : 12));
    this.dashUnlocked = true;
    this.events.push({
      id: e.getData("id"),
      at: Math.round(now),
      chain: this.chain,
      air:
        !this.h.player.body!.touching.down && !this.h.player.body!.blocked.down,
      special,
    });
    if (boss && this.damageTaken === this.bossDamageStart)
      this.flawlessBosses++;
    this.h.text(
      e.x,
      e.y - 24,
      `${FOES[kind].points * this.multiplier} ×${this.multiplier}`,
      "#ffe1a1",
    );
    this.h.defeat(e);
    // Defeated enemies leave a real pickup. The deterministic drop roll is
    // independent of the level's seeded geometry.
    const chance =
      ((Number(e.getData("baseX")) * 17 + this.h.seed) % 100) / 100;
    if (boss || chance < 0.18) this.drop(e.x, e.y, boss ? "energy" : "mystery");
  }
  drops: {
    sprite: Phaser.GameObjects.Arc;
    kind: "energy" | "mystery";
    expires: number;
  }[] = [];
  drop(x: number, y: number, kind: "energy" | "mystery") {
    if (this.drops.length >= 8) return;
    const sprite = this.h.scene.add
      .circle(x, y, 8, kind === "energy" ? 0xa9dcff : 0xffa1bb)
      .setStrokeStyle(2, 0xffefcf)
      .setDepth(4);
    this.drops.push({ sprite, kind, expires: this.h.now() + 9000 });
  }
  takeMystery(roll: number) {
    if (this.held) return false;
    this.held = itemRoll(roll);
    this.h.text(
      this.h.player.x,
      this.h.player.y - 28,
      `${ITEMS[this.held].name} · E`,
      "#d7edff",
    );
    sound("coin");
    return true;
  }
  useItem() {
    const now = this.h.now();
    if (!this.held || now < this.itemReady) return;
    const kind = this.held;
    this.held = null;
    this.itemReady = now + 800;
    if (kind === "shield") this.shieldHit = true;
    else if (kind === "berry") this.h.heal();
    else if (kind === "energy") this.energy = Math.min(100, this.energy + 50);
    else this.buffs[kind] = now + ITEMS[kind].seconds * 1000;
    if (kind === "magnet") this.h.magnet(this.buffs.magnet!);
    this.h.effect(this.h.player.x, this.h.player.y, 0xffdca0, 10);
    sound("special");
  }
  dash() {
    const now = this.h.now();
    if (!this.dashUnlocked || now < this.dashReady) return;
    this.dashUntil = now + 160;
    this.dashReady = now + 2800;
    this.h.cast(now + 160);
    sound("jump");
  }
  update(delta = 16.67) {
    const now = this.h.now();
    const section = Math.floor(this.h.distance() / 200);
    if (section > this.section) {
      if (this.damageTaken === this.sectionDamage)
        this.rewardStyle(`${section}:clean`, "clean");
      this.section = section;
      this.sectionDamage = this.damageTaken;
    }
    if (now - this.lastKill > 5000) this.chain = 0;
    if (now < this.flameUntil && now >= this.flameAt) {
      this.flameAt = now + 150;
      this.projectile(this.h.facing() > 0 ? 0 : Math.PI, 1, true, 340, 320);
    }
    for (const d of [...this.drops]) {
      if (
        now >= d.expires ||
        d.sprite.x < this.h.scene.cameras.main.scrollX - 80
      ) {
        d.sprite.destroy();
        this.drops.splice(this.drops.indexOf(d), 1);
        continue;
      }
      const floor = this.h.ground(d.sprite.x);
      if (floor !== undefined)
        d.sprite.y = Math.min(
          d.sprite.y + Math.min(delta, 50) * 0.09,
          floor - 12,
        );
      if (
        Math.hypot(d.sprite.x - this.h.player.x, d.sprite.y - this.h.player.y) <
          30 &&
        (d.kind === "energy" || !this.held)
      ) {
        if (d.kind === "energy") this.energy = Math.min(100, this.energy + 30);
        else this.takeMystery(((d.sprite.x * 7 + this.h.seed) % 100) / 100);
        d.sprite.destroy();
        this.drops.splice(this.drops.indexOf(d), 1);
      }
    }
    for (const e of this.h.enemies.getChildren() as Actor[])
      if (
        e.active &&
        e.getData("burnUntil") > now &&
        e.getData("burnAt") < now
      ) {
        e.setData("burnAt", now + 800);
        this.hit(e, 1, true);
      }
  }
  dispose() {
    this.drops.forEach((d) => d.sprite.destroy());
    this.drops = [];
  }
}
