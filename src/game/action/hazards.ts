import type { ActionHost, Actor } from "./types";
import type { Combat } from "./combat";
import type { Trap } from "../../../shared/action";

export const TRAP_LABELS: Record<Trap, string> = {
  thorns: "Thorns · jump",
  poison: "Poison pool · jump",
  electric: "Electric floor · wait for the dark interval",
  boulder: "Rolling boulder · jump",
  pendulum: "Pendulum · pass underneath",
  barrier: "Spike barrier · wait or jump",
  retract: "Retracting spikes · watch the warning",
  rocks: "Falling rocks · leave the marked area",
  current: "Water current · keep moving",
  ice: "Ice · allow room to stop",
  icicle: "Icicle · move away from the warning",
  fog: "Mist pocket · follow the platform edge",
  laser: "Electric gate · wait for the open interval",
};
export class HazardDirector {
  clock = 0;
  warning = "";
  ice = false;
  current = 0;
  constructor(
    readonly h: ActionHost,
    readonly combat: Combat,
  ) {}
  update(
    group: Phaser.Physics.Arcade.StaticGroup,
    delta: number,
    boss: boolean,
  ) {
    this.clock += Math.min(delta, 50) * this.combat.slowScale;
    this.ice = false;
    this.current = 0;
    this.warning = "";
    for (const s of group.getChildren() as Actor[]) {
      if (!s.active) continue;
      const kind = s.getData("kind") as Trap;
      if (!TRAP_LABELS[kind]) {
        s.setData("danger", !boss);
        continue;
      }
      const baseX = s.getData("baseX"),
        baseY = s.getData("baseY"),
        t = (this.clock + baseX * 3) % 3400;
      const timed = [
        "electric",
        "retract",
        "rocks",
        "icicle",
        "laser",
      ].includes(kind);
      const warn = timed && t > 1250 && t < 2100,
        danger = !timed || (t >= 2100 && t < 2850);
      const harmless = ["ice", "current", "fog"].includes(kind);
      s.setData("danger", !boss && danger && !harmless);
      s.setAlpha(
        boss
          ? 0.16
          : warn
            ? 0.55 + Math.sin(t / 60) * 0.25
            : danger || harmless
              ? 1
              : 0.22,
      );
      if (Math.abs(this.h.player.x - baseX) < 200 && !boss)
        this.warning = (warn ? "! " : "") + TRAP_LABELS[kind];
      s.x = baseX;
      s.y = baseY;
      if (kind === "boulder") {
        s.x += Math.sin(this.clock / 800) * 28;
        s.rotation = this.clock / 180;
      }
      if (kind === "laser") s.x += Math.sin(this.clock / 850) * 20;
      if (
        [
          "boulder",
          "thorns",
          "poison",
          "electric",
          "retract",
          "current",
          "ice",
          "laser",
        ].includes(kind)
      )
        s.y = 336 - s.displayHeight / 2;
      if (kind === "pendulum") {
        s.x += Math.sin(this.clock / 700) * 28;
        s.y += Math.abs(Math.cos(this.clock / 700)) * 14;
      }
      if (kind === "barrier") s.y += Math.sin(this.clock / 800) * 20;
      if (kind === "rocks" || kind === "icicle")
        s.y = danger ? 244 + Math.min(80, (t - 2100) * 0.18) : 244;
      const close =
        Math.abs(this.h.player.x - s.x) < 38 && this.h.player.y > 290;
      if (close && kind === "ice") this.ice = true;
      if (close && kind === "current") this.current = -30;
      if (kind === "fog") s.setAlpha(close ? 0.3 : 0.1);
      const warning = s.getData("warning") as
        Phaser.GameObjects.Text | undefined;
      if (warning)
        warning
          .setPosition(baseX, 307)
          .setText(warn ? "!" : timed && danger ? "▼" : "")
          .setVisible(!boss);
      s.refreshBody();
    }
  }
  createTextures() {
    const scene = this.h.scene;
    for (const kind of Object.keys(TRAP_LABELS) as Trap[]) {
      const texture = scene.textures.createCanvas(`trap-${kind}`, 48, 40)!;
      const c = texture.context;
      c.imageSmoothingEnabled = false;
      c.fillStyle = "#f6b5d2";
      if (["thorns", "retract", "barrier", "icicle"].includes(kind)) {
        for (let i = 0; i < 3; i++) {
          c.fillRect(i * 16 + 4, 15, 8, 25);
          c.fillRect(i * 16 + 7, 6, 3, 10);
        }
      } else if (["boulder", "rocks", "pendulum"].includes(kind)) {
        c.fillStyle = "#c5b5cf";
        c.fillRect(8, 10, 32, 26);
        c.fillRect(14, 5, 20, 34);
        c.fillStyle = "#706780";
        c.fillRect(15, 12, 7, 5);
        c.fillRect(27, 24, 8, 6);
        if (kind === "pendulum") {
          c.fillStyle = "#d9c8dd";
          c.fillRect(22, 0, 4, 12);
        }
      } else if (kind === "laser") {
        c.fillStyle = "#ffe2a0";
        for (let i = 0; i < 7; i++) c.fillRect(17 + (i % 2) * 8, i * 6, 12, 7);
      } else if (kind === "electric") {
        c.fillStyle = "#ffda89";
        for (let i = 0; i < 6; i++) c.fillRect(i * 8, 18 + (i % 2) * 8, 9, 5);
        c.fillStyle = "#b5c8ff";
        c.fillRect(0, 34, 48, 6);
      } else {
        c.fillStyle =
          kind === "poison"
            ? "#bd8bd9"
            : kind === "ice"
              ? "#c3edff"
              : "#afbedf";
        c.fillRect(0, kind === "fog" ? 2 : 30, 48, kind === "fog" ? 38 : 10);
        c.fillStyle = "#f1e8ff";
        for (let i = 0; i < 4; i++)
          c.fillRect(i * 12 + 3, 32 + (i % 2) * 3, 7, 2);
      }
      texture.refresh();
    }
  }
}
