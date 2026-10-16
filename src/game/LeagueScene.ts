import {
  pickupForChunk,
  attackCooldown,
  POWER_SECONDS,
  type PickupKind,
} from "../../shared/adventure";
import { difficultyAt, progressiveClock } from "../../shared/difficulty";
import Phaser from "phaser";
import {
  generateChunk,
  validateChunk,
  chunkWindow,
  calculateScore,
  RULES,
  ROUTES,
  WORLD_VERSION,
  pressureHazards,
  type RunResult,
} from "../../shared/world";
import { MoonlitLandscape } from "./landscape";
import {
  ENVIRONMENT_URLS,
  drawAsset,
  paintTerrain,
  type AssetSources,
} from "./environmentAssets";
import { environmentAt } from "./environmentPlan";
import { characterState } from "./characterAnimation";
import { sound } from "./sound";
import {
  FOES,
  ITEMS,
  combatBonus,
  styleBonus,
  stageAt,
  type Foe,
} from "../../shared/action";
import { Combat } from "./action/combat";
import { EnemyDirector } from "./action/enemies";
import { HazardDirector } from "./action/hazards";
import type { ActionHost, Actor } from "./action/types";
import { readSave, recordRun } from "./action/progression";
import { dayAt, drawWeather, weatherAt } from "./action/weather";
import { updateProjectiles } from "./action/projectiles";
export type GameOptions = {
  pokemon: number;
  worldVersion?: number;
  seed: number;
  maxDuration: number;
  practice: boolean;
  onFinish: (result: RunResult) => void;
  onHud: (hud: Hud) => void;
  onReady: () => void;
  onError: (error: string) => void;
};
export type Hud = {
  score: number;
  distance: number;
  coins: number;
  health: number;
  seconds: number;
  biome: string;
  paused: boolean;
  phase: "ready" | "countdown" | "running" | "finished";
  countdown: number;
  route: string;
  airJump: boolean;
  difficulty: number;
  power: string;
  attackReady: boolean;
  timeOfDay: string;
  difficultyLabel: string;
  difficultyProgress: number;
  energy: number;
  special: string;
  specialCost: number;
  held: string;
  combo: number;
  boss: { name: string; hp: number; max: number } | null;
  warning: string;
  dash: string;
  buffs: string;
};
export class LeagueScene extends Phaser.Scene {
  constructor(private options: GameOptions) {
    super("league");
  }
  private player!: Phaser.Physics.Arcade.Sprite;
  private visual!: Phaser.GameObjects.Sprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private coins!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.StaticGroup;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private chunks = new Map<number, Phaser.GameObjects.GameObject[]>();
  private collected = new Set<string>();
  private defeated = new Set<string>();
  private furthest = 96;
  private health = 3;
  private hurtUntil = 0;
  private started = 0;
  private finished = false;
  private groundedAt = 0;
  private jumpAt = -1000;
  private paused = false;
  private pausedAt = 0;
  private pausedTotal = 0;
  private previousGrounded = false;
  private biome = 0;
  private scenery!: MoonlitLandscape;
  private background!: Phaser.Textures.CanvasTexture;
  private lastHud = 0;
  private touch = { left: false, right: false, jump: false };
  private spriteMeta: any;
  private lastBackground = 0;
  private phase: Hud["phase"] = "ready";
  private countdown = 3;
  private airJump = true;
  private landedUntil = 0;
  private lastDust = 0;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private springs!: Phaser.Physics.Arcade.StaticGroup;
  private springAt = -1000;
  private queuedJump = false;
  private animation = "";
  private pickups!: Phaser.Physics.Arcade.StaticGroup;
  private bolts!: Phaser.Physics.Arcade.Group;
  private enemyBolts!: Phaser.Physics.Arcade.Group;
  private attackAt = -1000;
  private facing = 1;
  private shieldUntil = 0;
  private magnetUntil = 0;
  private rapidUntil = 0;
  private claimed = new Set<string>();
  private castUntil = 0;
  private wild: Phaser.GameObjects.Image[] = [];
  private swarm: Phaser.GameObjects.Image[] = [];
  private combat?: Combat;
  private particles = 0;
  private appearance = readSave();
  private director?: EnemyDirector;
  private traps?: HazardDirector;
  private actionVersion() {
    return (this.options.worldVersion ?? WORLD_VERSION) >= 5;
  }
  private floorAt(x: number) {
    const c = generateChunk(
      this.options.seed,
      Math.max(0, Math.floor(x / 768)),
      this.options.worldVersion,
    );
    return c.platforms.find(
      (p) => p.ground && x >= p.x + 15 && x <= p.x + p.width - 15,
    )?.y;
  }
  private bonus() {
    return this.combat
      ? styleBonus(this.combat.style) +
          combatBonus(
            this.combat.events,
            (id) =>
              generateChunk(
                this.options.seed,
                Number(id.split(":")[0]),
                this.options.worldVersion,
              ).enemies.find((e) => e.id === id)?.kind as Foe,
          )
      : 0;
  }
  private defeat(enemy: Phaser.Physics.Arcade.Sprite) {
    const key = enemy.getData("id");
    if (this.defeated.has(key)) return;
    this.defeated.add(key);
    enemy.disableBody(true, true);
    this.burst(enemy.x, enemy.y, 0xffb7d5, 9);
    if (!this.combat) this.floatText(enemy.x, enemy.y, "+50", "#ffe8a0");
    sound("coin");
  }
  private attack() {
    if (
      this.phase !== "running" ||
      this.paused ||
      (this.options.worldVersion ?? WORLD_VERSION) < 4
    )
      return;
    const now = this.elapsed();
    if (this.combat) {
      this.combat.basic();
      return;
    }
    if (now - this.attackAt < attackCooldown(now < this.rapidUntil)) return;
    this.attackAt = now;
    this.castUntil = now + 160;
    const bolt = this.bolts.create(
      this.player.x + this.facing * 18,
      this.player.y,
      "bolt",
    ) as Phaser.Physics.Arcade.Sprite;
    bolt
      .setVelocityX(this.facing * 430)
      .setData("expires", now + 700)
      .setDepth(7);
    this.burst(this.player.x + this.facing * 15, this.player.y, 0xaadfff, 3);
  }
  private collectPower(item: Phaser.Physics.Arcade.Sprite) {
    const id = item.getData("id");
    if (this.claimed.has(id)) return;
    if (item.getData("kind") === "rare" && this.combat) {
      this.claimed.add(id);
      this.combat.energy = 100;
      this.floatText(item.x, item.y, "MEW'S GIFT · ENERGY RESTORED", "#ecd2ff");
      this.burst(item.x, item.y, 0xe9b9ed, 10);
      item.disableBody(true, true);
      sound("special", 151);
      return;
    }
    if (item.getData("kind") === "mystery" && this.combat) {
      if (
        !this.combat.takeMystery(
          ((item.x * 11 + Math.abs(this.options.seed)) % 100) / 100,
        )
      )
        return;
      this.claimed.add(id);
      item.disableBody(true, true);
      return;
    }
    this.claimed.add(id);
    const kind = item.getData("kind") as PickupKind,
      now = this.elapsed();
    if (kind === "heart") this.health = Math.min(3, this.health + 1);
    if (kind === "shield") this.shieldUntil = now + POWER_SECONDS * 1000;
    if (kind === "magnet") this.magnetUntil = now + POWER_SECONDS * 1000;
    if (kind === "rapid") this.rapidUntil = now + POWER_SECONDS * 1000;
    this.floatText(
      item.x,
      item.y,
      kind === "heart" ? "+1 HEART" : kind.toUpperCase() + " 8s",
      "#d7f0ff",
    );
    this.burst(item.x, item.y, 0xbadfff, 10);
    item.disableBody(true, true);
    sound("coin");
  }
  private animate(state: string) {
    if (this.animation === state) return;
    this.animation = state;
    this.visual.play(state);
  }
  private burst(x: number, y: number, color = 0xffd166, count = 6) {
    for (let i = 0; i < count && this.particles < 120; i++) {
      this.particles++;
      const dot = this.add.rectangle(x, y, 3, 3, color).setDepth(8);
      this.tweens.add({
        targets: dot,
        x: x + (i - count / 2) * 9,
        y: y - 8 - (i % 3) * 8,
        alpha: 0,
        duration: 320,
        onComplete: () => {
          dot.destroy();
          this.particles--;
        },
      });
    }
  }
  private startRun() {
    if (this.phase !== "ready") return;
    this.phase = "countdown";
    this.pushHud();
    this.time.addEvent({
      delay: 800,
      repeat: 2,
      callback: () => {
        this.countdown--;
        if (!this.countdown) {
          this.phase = "running";
          this.started = performance.now();
          this.physics.resume();
          this.input.keyboard?.resetKeys();
          this.queuedJump = false;
        }
        this.pushHud();
      },
    });
  }
  preload() {
    if (this.actionVersion())
      this.load.json("enemy-motion", "/assets/enemies/motion.json");
    if (this.actionVersion())
      for (const [key, foe] of Object.entries(FOES))
        this.load.image(`raw-${key}`, `/assets/enemies/${foe.id}.png`);
    for (const [key, url] of Object.entries(ENVIRONMENT_URLS))
      this.load.image(`env-${key}`, url);
    for (const id of [131, 149, 151])
      this.load.image(`wild-${id}`, `/assets/pokemon/${id}.png`);
    this.load.json("manifest", "/assets/motion/manifest.json");
    this.load.image("portrait", `/assets/pokemon/${this.options.pokemon}.png`);
    this.load.on("loaderror", () =>
      this.options.onError(
        "A game asset could not load. Reload to retry; your attempt is recoverable through the organizer.",
      ),
    );
  }
  create() {
    if (this.actionVersion())
      for (const foe of this.cache.json.get("enemy-motion"))
        this.load.spritesheet(`motion-${foe.name}`, foe.sheet, {
          frameWidth: 96,
          frameHeight: 96,
          endFrame: foe.frameCount - 1,
        });
    this.spriteMeta = this.cache.json
      .get("manifest")
      .pokemon.find((p: any) => p.id === this.options.pokemon);
    this.load.spritesheet("partner", this.spriteMeta.sheet, {
      frameWidth: 96,
      frameHeight: 96,
      endFrame: this.spriteMeta.frameCount - 1,
    });
    this.load.once("complete", () => this.begin());
    this.load.start();
  }
  private begin() {
    const assets = Object.fromEntries(
      Object.keys(ENVIRONMENT_URLS).map((key) => [
        key,
        this.textures.get(`env-${key}`).getSourceImage(),
      ]),
    ) as AssetSources;
    this.scenery = new MoonlitLandscape(assets, this.options.seed);
    const cave = this.textures.createCanvas("secret-cave", 192, 108)!;
    drawAsset(cave.context, assets, "cliff", 0, 0, 192, 108);
    cave.context.globalCompositeOperation = "destination-out";
    cave.context.fillRect(58, 32, 76, 76);
    cave.context.globalCompositeOperation = "source-over";
    cave.refresh();
    const room = this.textures.createCanvas("reward-room", 192, 108)!;
    drawAsset(room.context, assets, "center", 0, 0, 192, 108);
    room.refresh();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scenery.dispose(),
    );
    this.background = this.textures.createCanvas("landscape", 960, 432)!;
    this.add
      .image(0, 0, "landscape")
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(-10);
    for (let b = 0; b < 4; b++) {
      const ground = this.textures.createCanvas(`ground-${b}`, 768, 128)!;
      paintTerrain(ground.context, assets, 768, 128);
      ground.refresh();
      const platform = this.textures.createCanvas(`platform-${b}`, 256, 24)!;
      paintTerrain(platform.context, assets, 256, 24, true);
      platform.refresh();
      const tree = this.textures.createCanvas(`tree-${b}`, 128, 132)!;
      drawAsset(
        tree.context,
        assets,
        b % 2 ? "willow" : "blossom",
        0,
        19,
        128,
        113,
      );
      tree.refresh();
      const bush = this.textures.createCanvas(`bush-${b}`, 54, 22)!;
      drawAsset(bush.context, assets, "bush", 0, 0, 54, 22);
      bush.refresh();
    }
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xf1b953);
    g.fillRect(4, 0, 8, 16);
    g.fillRect(0, 4, 16, 8);
    g.fillStyle(0xffed95);
    g.fillRect(4, 3, 4, 8);
    g.generateTexture("coin", 16, 16);
    g.clear();
    g.fillStyle(0x314b3d);
    g.fillRect(2, 7, 24, 17);
    g.fillStyle(0xd28a69);
    g.fillRect(0, 4, 28, 10);
    g.fillRect(5, 0, 18, 6);
    g.fillStyle(0xffdfb2);
    g.fillRect(5, 5, 4, 3);
    g.fillRect(18, 2, 4, 3);
    g.fillStyle(0xf4ead2);
    g.fillRect(6, 15, 5, 5);
    g.fillRect(17, 15, 5, 5);
    g.fillStyle(0x293b32);
    g.fillRect(8, 16, 2, 3);
    g.fillRect(19, 16, 2, 3);
    g.generateTexture("enemy", 28, 24);
    g.clear();
    g.fillStyle(0xffffff, 0);
    g.fillRect(0, 0, 24, 32);
    g.generateTexture("body", 24, 32);
    g.clear();
    g.fillStyle(0x6c537b);
    g.fillRect(0, 0, 24, 24);
    g.fillStyle(0xb8a0bc);
    g.fillRect(0, 0, 24, 3);
    g.fillRect(0, 0, 3, 24);
    g.fillRect(21, 0, 3, 24);
    g.fillRect(0, 21, 24, 3);
    g.fillStyle(0x947ba1);
    for (let i = 3; i < 21; i += 3) g.fillRect(i, i, 3, 3);
    g.generateTexture("crate", 24, 24);
    g.clear();
    g.fillStyle(0xff7897);
    for (let i = 0; i < 3; i++) {
      g.fillRect(i * 16, 14, 16, 4);
      g.fillRect(i * 16 + 3, 8, 10, 6);
      g.fillRect(i * 16 + 6, 1, 4, 7);
    }
    g.fillStyle(0xffd1df);
    for (let i = 0; i < 3; i++) g.fillRect(i * 16 + 6, 1, 3, 9);
    g.generateTexture("spikes", 48, 18);
    g.clear();
    g.fillStyle(0xb3c4ef);
    g.fillRect(4, 4, 24, 24);
    g.fillRect(12, 0, 8, 32);
    g.fillRect(0, 12, 32, 8);
    g.fillStyle(0x687aa6);
    g.fillRect(8, 8, 16, 16);
    g.fillStyle(0xffd166);
    g.fillRect(13, 13, 6, 6);
    g.generateTexture("saw", 32, 32);
    g.clear();
    g.fillStyle(0xa486df);
    g.fillRect(0, 0, 8, 8);
    g.fillRect(24, 0, 8, 8);
    g.fillRect(4, 4, 24, 8);
    g.fillRect(10, 6, 12, 14);
    g.fillStyle(0xffedb7);
    g.fillRect(12, 9, 3, 3);
    g.fillRect(18, 9, 3, 3);
    g.generateTexture("bat", 32, 20);
    g.clear();
    g.fillStyle(0xffd166);
    g.fillRect(0, 0, 32, 5);
    g.fillRect(0, 14, 32, 2);
    g.fillStyle(0xd38c89);
    g.fillRect(9, 5, 14, 3);
    g.fillRect(6, 8, 20, 3);
    g.fillRect(9, 11, 14, 3);
    g.generateTexture("spring", 32, 16);
    g.clear();
    g.fillStyle(0xa7e4ff);
    g.fillRect(0, 3, 16, 6);
    g.fillStyle(0xf0edff);
    g.fillRect(4, 1, 8, 10);
    g.generateTexture("bolt", 16, 12);
    g.clear();
    g.fillStyle(0xfa829c);
    g.fillRect(1, 1, 10, 10);
    g.fillStyle(0xffd29b);
    g.fillRect(3, 3, 6, 6);
    g.generateTexture("enemy-bolt", 12, 12);
    g.clear();
    g.fillStyle(0xb485bd);
    g.fillRect(2, 7, 24, 17);
    g.fillStyle(0xead4ed);
    g.fillRect(0, 1, 7, 10);
    g.fillRect(21, 1, 7, 10);
    g.fillStyle(0xffc579);
    g.fillRect(7, 10, 4, 4);
    g.fillRect(18, 10, 4, 4);
    g.generateTexture("charger", 28, 24);
    g.clear();
    g.fillStyle(0x6686a8);
    g.fillRect(2, 5, 24, 19);
    g.fillStyle(0xb4d3df);
    g.fillRect(4, 1, 20, 7);
    g.fillStyle(0xf0bc84);
    g.fillRect(10, 8, 8, 8);
    g.fillStyle(0x38415d);
    g.fillRect(12, 10, 4, 4);
    g.generateTexture("turret", 28, 24);
    for (const [key, color] of [
      ["shield", 0xa6dcff],
      ["magnet", 0xd7a5ef],
      ["rapid", 0xffce7d],
      ["heart", 0xff8fb8],
    ] as const) {
      g.clear();
      g.fillStyle(0x303750);
      g.fillRect(0, 0, 24, 24);
      g.fillStyle(color);
      g.fillRect(2, 2, 20, 20);
      g.fillStyle(0x303750);
      g.fillRect(5, 5, 14, 14);
      g.fillStyle(color);
      if (key === "heart") {
        g.fillRect(6, 7, 5, 7);
        g.fillRect(13, 7, 5, 7);
        g.fillRect(8, 11, 8, 6);
        g.fillRect(10, 17, 4, 2);
      } else if (key === "magnet") {
        g.fillRect(7, 6, 3, 10);
        g.fillRect(14, 6, 3, 10);
        g.fillRect(9, 14, 6, 4);
      } else if (key === "rapid") {
        g.fillRect(12, 5, 4, 6);
        g.fillRect(8, 10, 7, 4);
        g.fillRect(8, 14, 4, 5);
      } else {
        g.fillRect(7, 6, 10, 9);
        g.fillRect(9, 15, 6, 3);
        g.fillRect(11, 18, 2, 2);
      }
      g.generateTexture(key, 24, 24);
    }
    g.destroy();
    this.platforms = this.physics.add.staticGroup();
    this.coins = this.physics.add.staticGroup();
    this.enemies = this.physics.add.staticGroup();
    this.hazards = this.physics.add.staticGroup();
    this.springs = this.physics.add.staticGroup();
    this.pickups = this.physics.add.staticGroup();
    this.bolts = this.physics.add.group({ allowGravity: false });
    this.enemyBolts = this.physics.add.group({ allowGravity: false });
    this.wild = [
      this.add
        .image(600, 307, "wild-131")
        .setScale(0.45)
        .setAlpha(0.65)
        .setDepth(-5)
        .setScrollFactor(0),
      this.add
        .image(380, 150, "wild-149")
        .setScale(0.4)
        .setAlpha(0.55)
        .setDepth(-5)
        .setScrollFactor(0),
    ];
    this.player = this.physics.add
      .sprite(96, 300, "body")
      .setSize(24, 30)
      .setMaxVelocity(RULES.speed, 700);
    this.visual = this.add
      .sprite(96, 300, "partner")
      .setOrigin(0.5, 90 / 96)
      .setScale(0.85)
      .setDepth(5);
    if (this.actionVersion()) {
      const host: ActionHost = {
        scene: this,
        player: this.player,
        enemies: this.enemies,
        bolts: this.bolts,
        hostile: this.enemyBolts,
        now: () => this.elapsed(),
        distance: () => Math.max(0, (this.furthest - 96) / 10),
        facing: () => this.facing,
        pokemon: this.options.pokemon,
        seed: this.options.seed,
        damage: () => this.damage(),
        heal: () => {
          this.health = Math.min(3, this.health + 1);
        },
        defeat: (e) => this.defeat(e),
        effect: (x, y, c, n) => this.burst(x, y, c, n),
        text: (x, y, t, c) => this.floatText(x, y, t, c),
        shield: (until) => {
          this.shieldUntil = until;
        },
        magnet: (until) => {
          this.magnetUntil = until;
        },
        cast: (until) => {
          this.castUntil = until;
        },
        ground: (x) => this.floorAt(x),
        rapid: () => this.elapsed() < this.rapidUntil,
      };
      this.combat = new Combat(host);
      this.director = new EnemyDirector(host, this.combat);
      this.traps = new HazardDirector(host, this.combat);
      if (
        this.appearance.trail === "effect-prism" &&
        this.appearance.owned.includes("effect-prism")
      )
        this.combat.kit.color = 0xd6acff;
      if (this.options.practice) {
        this.combat.upgraded = this.appearance.upgrades.includes(
          this.options.pokemon,
        );
        if (
          this.appearance.bonus === "start-energy" &&
          this.appearance.owned.includes("start-energy")
        )
          this.combat.energy = 80;
        if (
          this.appearance.bonus === "start-dash" &&
          this.appearance.owned.includes("start-dash")
        )
          this.combat.dashUnlocked = true;
      }
      this.traps.createTextures();
      for (const foe of this.cache.json.get("enemy-motion"))
        for (const state of ["idle", "run", "jump", "hurt", "celebrate"]) {
          const data = foe.states[state];
          this.anims.create({
            key: `foe-${foe.name}-${state}`,
            frames: data.frames.map((frame: number) => ({
              key: `motion-${foe.name}`,
              frame,
            })),
            frameRate: data.frameRate,
            repeat: state === "run" || state === "idle" ? -1 : 0,
          });
        }
      for (const kind of Object.keys(FOES)) {
        const image = this.textures
          .get(`raw-${kind}`)
          .getSourceImage() as HTMLImageElement;
        const texture = this.textures.createCanvas(`foe-${kind}`, 48, 48)!;
        const scratch = document.createElement("canvas");
        scratch.width = image.width;
        scratch.height = image.height;
        const ctx = scratch.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, image.width, image.height).data;
        let l = image.width,
          r = 0,
          t = image.height,
          b = 0;
        for (let y = 0; y < image.height; y++)
          for (let x = 0; x < image.width; x++)
            if (data[(y * image.width + x) * 4 + 3] > 80) {
              l = Math.min(l, x);
              r = Math.max(r, x);
              t = Math.min(t, y);
              b = Math.max(b, y);
            }
        texture.context.imageSmoothingEnabled = false;
        texture.context.drawImage(
          image,
          l,
          t,
          r - l + 1,
          b - t + 1,
          3,
          3,
          42,
          42,
        );
        texture.refresh();
      }
      for (let i = 0; i < 5; i++)
        this.swarm.push(
          this.add
            .image(0, 0, "foe-pidgey")
            .setDisplaySize(20, 20)
            .setAlpha(0.24)
            .setScrollFactor(0)
            .setDepth(-6),
        );
      const ball = this.textures.createCanvas("mystery", 24, 24)!;
      const c = ball.context;
      c.fillStyle = "#fff1d0";
      c.fillRect(3, 3, 18, 18);
      c.fillStyle = "#f483a8";
      c.fillRect(3, 3, 18, 8);
      c.fillStyle = "#292442";
      c.fillRect(2, 10, 20, 4);
      c.fillRect(9, 8, 6, 8);
      c.fillStyle = "#fff1d0";
      c.fillRect(11, 10, 2, 4);
      ball.refresh();
      for (const [key, event] of [
        ["C", "special"],
        ["SHIFT", "dash"],
        ["E", "use-item"],
      ])
        this.input.keyboard!.on(`keydown-${key}`, (e: KeyboardEvent) => {
          if (!e.repeat) this.events.emit(event);
        });
      for (const [event, action] of [
        ["special", () => this.combat!.special()],
        ["dash", () => this.combat!.dash()],
        ["use-item", () => this.combat!.useItem()],
      ] as const)
        this.events.on(event, () => {
          if (this.phase === "running" && !this.paused) action();
        });
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        this.combat?.dispose(),
      );
    }
    for (const [key, value] of Object.entries(this.spriteMeta.states)) {
      const state = value as { frames: number[]; frameRate: number };
      this.anims.create({
        key,
        frames: state.frames.map((frame) => ({ key: "partner", frame })),
        frameRate: state.frameRate,
        repeat: ["idle", "run", "fall"].includes(key) ? -1 : 0,
      });
    }
    this.animate("idle");
    this.physics.add.collider(
      this.player,
      this.platforms,
      (_p, platform) => {
        const b = platform as Phaser.Physics.Arcade.Sprite;
        if (
          b.getData("crumble") &&
          !b.getData("triggered") &&
          this.player.body!.touching.down
        ) {
          b.setData("triggered", true);
          const art = b.getData("art") as Phaser.GameObjects.TileSprite;
          this.tweens.add({
            targets: art,
            alpha: 0.35,
            duration: 100,
            yoyo: true,
            repeat: 2,
          });
          this.time.delayedCall(
            difficultyAt(this.elapsed(), this.options.worldVersion).crumbleMs,
            () => {
              if (!b.active) return;
              if (this.paused) {
                b.setData("triggered", false);
                art.alpha = 1;
                return;
              }
              b.disableBody(true, true);
              this.tweens.add({
                targets: art,
                y: art.y + 60,
                alpha: 0,
                duration: 250,
              });
            },
          );
        }
      },
      (_p, platform) => {
        const b = (platform as Phaser.Physics.Arcade.Sprite)
          .body as Phaser.Physics.Arcade.StaticBody;
        if ((platform as Phaser.Physics.Arcade.Sprite).getData("solid"))
          return true;
        return (
          this.player.body!.velocity.y >= 0 &&
          (this.player.body as Phaser.Physics.Arcade.Body).prev.y +
            this.player.body!.height <=
            b.y + 10
        );
      },
    );
    this.physics.add.overlap(this.player, this.coins, (_p, c) => {
      const coin = c as Phaser.Physics.Arcade.Sprite,
        key = coin.getData("id");
      if (this.collected.has(key)) return;
      this.collected.add(key);
      coin.disableBody(true, true);
      sound("coin");
      this.burst(coin.x, coin.y);
      this.floatText(coin.x, coin.y, "+25", "#ffe8a0");
    });
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const enemy = e as Phaser.Physics.Arcade.Sprite,
        key = enemy.getData("id");
      if (enemy.getData("passive")) return;
      if (this.defeated.has(key)) return;
      if (this.player.body!.velocity.y > 70 && this.player.y + 4 < enemy.y) {
        if (this.combat) this.combat.hit(enemy, 2, false);
        else this.defeat(enemy);
        this.player.setVelocityY(-290);
      } else if (
        this.combat?.active("star") ||
        this.elapsed() < (this.combat?.dashUntil || 0)
      )
        this.combat!.hit(enemy, 3, true);
      else this.damage();
    });
    this.physics.add.overlap(this.player, this.hazards, (_p, hazard) => {
      if ((hazard as Actor).getData("danger") !== false) this.damage();
    });
    this.physics.add.overlap(this.player, this.springs, (_p, s) => {
      if (
        this.elapsed() - this.springAt < 400 ||
        this.player.body!.velocity.y < 0
      )
        return;
      this.springAt = this.elapsed();
      this.player.setVelocityY(-600);
      this.airJump = true;
      this.groundedAt = -1000;
      this.burst(this.player.x, this.player.y + 16, 0xffd166, 10);
      sound("jump");
      this.tweens.add({ targets: s, scaleY: 0.45, duration: 100, yoyo: true });
    });
    this.physics.add.overlap(this.player, this.pickups, (_p, item) =>
      this.collectPower(item as Phaser.Physics.Arcade.Sprite),
    );
    this.physics.add.overlap(this.bolts, this.enemies, (b, e) => {
      if (!(e as Phaser.Physics.Arcade.Sprite).active) return;
      if (this.combat) {
        const bolt = b as Actor;
        this.combat.hit(
          e as Actor,
          bolt.getData("damage") || 1,
          !!bolt.getData("special"),
          !!bolt.getData("burn"),
          !!bolt.getData("root"),
        );
        b.destroy();
        return;
      }
      b.destroy();
      this.defeat(e as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.player, this.enemyBolts, (_player, bolt) => {
      bolt.destroy();
      this.damage();
    });
    this.physics.add.collider(this.bolts, this.platforms, (b) => b.destroy());
    this.physics.add.collider(this.enemyBolts, this.platforms, (b) =>
      b.destroy(),
    );
    this.events.on("attack", () => this.attack());
    for (const key of ["X", "J"])
      this.input.keyboard!.on(`keydown-${key}`, (e: KeyboardEvent) => {
        if (!e.repeat) this.attack();
      });
    this.keys = this.input.keyboard!.addKeys(
      "A,D,W,LEFT,RIGHT,UP,SPACE,ESC",
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-ESC", (event: KeyboardEvent) => {
      if (!event.repeat) this.togglePause();
    });
    for (const key of ["SPACE", "W", "UP"])
      this.input.keyboard!.on(`keydown-${key}`, (event: KeyboardEvent) => {
        if (!event.repeat && this.phase === "running" && !this.paused)
          this.queuedJump = true;
      });
    this.events.on(
      "controls",
      (control: "left" | "right" | "jump", pressed: boolean) => {
        this.touch[control] = pressed;
        if (control === "jump" && pressed) this.queuedJump = true;
      },
    );
    this.events.on("start-run", () => this.startRun());
    this.events.on("blur-controls", () => {
      this.touch = { left: false, right: false, jump: false };
      this.input.keyboard?.resetKeys();
      if (this.options.practice && this.phase === "running" && !this.paused)
        this.togglePause();
    });
    this.events.on("toggle-pause", () => this.togglePause());
    this.events.on("end-run", () => this.finish());
    this.cameras.main.setBounds(0, 0, Number.MAX_SAFE_INTEGER, 432);
    this.syncWorld();
    this.physics.pause();
    this.visual.setPosition(96, 336);
    this.scenery.draw(
      this.background.context,
      this.cameras.main.width,
      432,
      0,
      0,
    );
    this.background.refresh();
    this.pushHud();
    this.options.onReady();
  }
  private floatText(x: number, y: number, text: string, color: string) {
    const t = this.add
      .text(x, y, text, {
        fontFamily: "Pixelify Sans",
        fontSize: "14px",
        color,
        stroke: "#254635",
        strokeThickness: 3,
      })
      .setDepth(20);
    this.tweens.add({
      targets: t,
      y: y - 30,
      alpha: 0,
      duration: 600,
      onComplete: () => t.destroy(),
    });
  }
  private damage() {
    if (
      this.phase !== "running" ||
      this.paused ||
      this.elapsed() < this.hurtUntil
    )
      return;
    if (this.elapsed() < this.shieldUntil) {
      this.burst(this.player.x, this.player.y, 0xa6dcff, 5);
      this.hurtUntil = this.elapsed() + 150;
      return;
    }
    if (this.combat?.guard()) {
      this.hurtUntil = this.elapsed() + 250;
      return;
    }
    this.health--;
    this.burst(this.player.x, this.player.y, 0xff6a85, 8);
    this.hurtUntil = this.elapsed() + 1500;
    this.cameras.main.shake(150, 0.005);
    sound("hit");
    if (this.health <= 0) this.finish();
  }
  private syncWorld() {
    const w = chunkWindow(this.furthest);
    for (let i = w.min; i <= w.max; i++) {
      if (this.chunks.has(i)) continue;
      let c = generateChunk(this.options.seed, i, this.options.worldVersion);
      if (!validateChunk(c)) {
        c = {
          ...c,
          platforms: [{ x: c.start, y: 336, width: 768, ground: true }],
          enemies: [],
          coins: [],
          hazards: [],
          springs: [],
        };
      }
      if (
        (this.options.worldVersion ?? WORLD_VERSION) >= 3 &&
        !this.actionVersion()
      ) {
        c.hazards.push(
          ...pressureHazards(c, difficultyAt(this.elapsed()).level),
        );
      }
      const objects: Phaser.GameObjects.GameObject[] = [];
      for (const p of c.platforms) {
        const art = this.add
          .tileSprite(
            p.x,
            p.y,
            p.width,
            p.ground ? 120 : p.solid ? 336 - p.y : 24,
            p.solid
              ? "crate"
              : p.ground
                ? `ground-${c.biome}`
                : `platform-${c.biome}`,
          )
          .setOrigin(0);
        if (p.crumble) art.setTint(0xf2b181);
        if (p.motion) art.setTint(0xa6cdff);
        objects.push(art);
        const body = this.platforms.create(
          p.x + p.width / 2,
          p.y + 8,
          "body",
        ) as Phaser.Physics.Arcade.Sprite;
        const height = p.solid ? 336 - p.y : 16;
        body
          .setVisible(false)
          .setDisplaySize(p.width, height)
          .setY(p.y + height / 2)
          .refreshBody();
        body.setData({
          solid: p.solid,
          crumble: p.crumble,
          motion: p.motion,
          baseY: body.y,
          art,
        });
        objects.push(body);
        if (p.ground && p.width > 250) {
          const t = this.add
            .image(p.x + 90, p.y, `tree-${c.biome}`)
            .setOrigin(0.5, 1)
            .setTint(0xc8bbd8)
            .setDepth(-1);
          objects.push(t);
          const shrub = this.add
            .image(p.x + 180, p.y, `bush-${c.biome}`)
            .setOrigin(0.5, 1)
            .setDepth(-1);
          objects.push(shrub);
        }
      }
      for (const item of c.coins) {
        if (this.collected.has(item.id)) continue;
        const s = this.coins.create(
          item.x,
          item.y,
          "coin",
        ) as Phaser.Physics.Arcade.Sprite;
        s.setData("id", item.id);
        objects.push(s);
      }
      for (const item of c.enemies) {
        if (this.defeated.has(item.id)) continue;
        const s = this.enemies.create(
          item.x,
          item.y,
          item.kind === "bat"
            ? "bat"
            : item.kind === "charger"
              ? "charger"
              : item.kind === "turret"
                ? "turret"
                : "enemy",
        ) as Phaser.Physics.Arcade.Sprite;
        s.setData({
          id: item.id,
          baseX: item.x,
          baseY: item.y,
          range: item.range || 0,
          kind: item.kind,
        });
        if (this.director && item.kind && item.kind in FOES)
          this.director.init(s, item.kind as Foe);
        objects.push(s);
      }
      for (const h of c.hazards) {
        const s = this.hazards.create(
          h.x,
          h.y,
          this.traps && !["spikes", "saw"].includes(h.kind)
            ? `trap-${h.kind}`
            : h.kind,
        ) as Phaser.Physics.Arcade.Sprite;
        s.setData({
          kind: h.kind,
          baseX: h.x,
          baseY: h.y,
          range: h.range || 0,
        });
        if (this.traps && !["spikes", "saw"].includes(h.kind)) {
          s.setDisplaySize(
            h.width,
            [
              "thorns",
              "retract",
              "electric",
              "poison",
              "ice",
              "current",
            ].includes(h.kind)
              ? 18
              : 36,
          ).refreshBody();
          if (h.kind === "laser") s.setDisplaySize(14, 54).refreshBody();
          const warning = this.add
            .text(h.x, 307, "", {
              fontFamily: "Pixelify Sans",
              fontSize: "18px",
              color: "#ffe3a2",
            })
            .setDepth(6);
          s.setData("warning", warning);
          objects.push(warning, s);
          continue;
        }
        if (h.kind === "spikes") s.setSize(42, 12).setOffset(3, 6);
        else s.setCircle(12, 4, 4);
        objects.push(s);
      }
      for (const item of c.springs) {
        const s = this.springs.create(
          item.x,
          item.y,
          "spring",
        ) as Phaser.Physics.Arcade.Sprite;
        objects.push(s);
      }
      if ((this.options.worldVersion ?? WORLD_VERSION) >= 4) {
        const pickup = pickupForChunk(this.options.seed, i);
        if (pickup && !this.claimed.has(pickup.id)) {
          const item = this.pickups.create(
            pickup.x,
            pickup.y,
            pickup.kind,
          ) as Phaser.Physics.Arcade.Sprite;
          item.setData(pickup).setDepth(3);
          objects.push(item);
        }
      }
      if (this.combat && (i % 3 === 1 || c.secret)) {
        const id = `${i}:mystery`;
        if (!this.claimed.has(id)) {
          const item = this.pickups.create(
            c.start + (c.secret ? 600 : 220),
            c.secret ? 236 : 304,
            "mystery",
          ) as Actor;
          item.setData({ id, kind: "mystery" }).setDepth(4);
          objects.push(item);
        }
        if (c.secret) {
          const variant = i % 3;
          const decor = this.add
            .image(
              c.start + 604,
              264,
              variant === 1 ? "secret-cave" : "reward-room",
            )
            .setOrigin(0.5, 1)
            .setDepth(-2)
            .setAlpha(0.65)
            .setTint(0xaaa3c7);
          objects.push(decor);
          const sign = this.add
            .text(
              c.start + 500,
              146,
              variant === 1
                ? "MOONSTONE CAVE ↑"
                : variant === 2
                  ? "LANTERN REWARD ROOM ↑"
                  : "CRUMBLING SECRET GROVE ↑",
              {
                fontFamily: "Pixelify Sans",
                fontSize: "10px",
                color: "#ffe2ac",
              },
            )
            .setDepth(3);
          objects.push(sign);
          if (i % 2 === 0 && !this.claimed.has(`${i}:rare`)) {
            const rare = this.pickups.create(
              c.start + 650,
              230,
              "wild-151",
            ) as Actor;
            rare
              .setDisplaySize(55, 55)
              .refreshBody()
              .setData({ id: `${i}:rare`, kind: "rare" })
              .setDepth(4);
            objects.push(rare);
          }
        }
      }
      this.chunks.set(i, objects);
    }
    for (const [i, objs] of this.chunks) {
      if (i < w.min || i > w.max) {
        for (const o of objs) o.destroy();
        this.chunks.delete(i);
      }
    }
  }
  private togglePause() {
    if (!this.options.practice || this.finished || this.phase !== "running")
      return;
    this.paused = !this.paused;
    this.time.paused = this.paused;
    if (this.paused) {
      for (const enemy of this.enemies.getChildren() as Actor[])
        enemy.getData("visual")?.anims.pause();
      this.tweens.pauseAll();
      this.pausedAt = performance.now();
      this.physics.pause();
      this.visual.anims.pause();
    } else {
      for (const enemy of this.enemies.getChildren() as Actor[])
        enemy.getData("visual")?.anims.resume();
      this.tweens.resumeAll();
      this.pausedTotal += performance.now() - this.pausedAt;
      this.physics.resume();
      this.visual.anims.resume();
    }
    this.pushHud();
  }
  private elapsed() {
    if (this.phase === "ready" || this.phase === "countdown") return 0;
    return Math.max(
      0,
      (this.paused ? this.pausedAt : performance.now()) -
        this.started -
        this.pausedTotal,
    );
  }
  private pushHud() {
    const distance = Math.max(0, Math.floor((this.furthest - 96) / 10));
    this.options.onHud({
      score:
        calculateScore(distance, this.collected.size, this.defeated.size) +
        this.bonus(),
      distance,
      coins: this.collected.size,
      health: this.health,
      seconds: Math.max(
        0,
        Math.ceil(this.options.maxDuration - this.elapsed() / 1000),
      ),
      biome: environmentAt(
        this.cameras.main.scrollX * 0.4 + this.cameras.main.width / 2,
        this.options.seed,
      ).name,
      paused: this.paused,
      phase: this.phase,
      countdown: this.countdown,
      airJump: this.airJump,
      power: [
        this.elapsed() < this.shieldUntil
          ? "Shield " +
            Math.ceil((this.shieldUntil - this.elapsed()) / 1000) +
            "s"
          : "",
        this.elapsed() < this.magnetUntil
          ? "Magnet " +
            Math.ceil((this.magnetUntil - this.elapsed()) / 1000) +
            "s"
          : "",
        this.elapsed() < this.rapidUntil
          ? "Rapid fire " +
            Math.ceil((this.rapidUntil - this.elapsed()) / 1000) +
            "s"
          : "",
      ]
        .filter(Boolean)
        .join(" / "),
      attackReady:
        this.elapsed() - this.attackAt >=
        attackCooldown(this.elapsed() < this.rapidUntil),
      timeOfDay: this.combat
        ? `${dayAt(this.elapsed())} · ${weatherAt(this.elapsed(), this.options.seed)}`
        : "Moonlit",
      difficulty: this.combat
        ? stageAt(distance).level
        : difficultyAt(this.elapsed(), this.options.worldVersion).level,
      difficultyLabel: this.combat
        ? stageAt(distance).name
        : difficultyAt(this.elapsed(), this.options.worldVersion).label,
      difficultyProgress: this.combat
        ? stageAt(distance).progress
        : difficultyAt(this.elapsed(), this.options.worldVersion).progress,
      energy: this.combat?.energy || 0,
      special: this.combat?.kit.special || "",
      specialCost: this.combat?.kit.cost || 0,
      held: this.combat?.held ? ITEMS[this.combat.held].name : "Empty",
      combo: this.combat?.multiplier || 1,
      boss: this.director?.bossHud || null,
      warning: this.director?.warning || this.traps?.warning || "",
      dash: this.combat?.dashUnlocked
        ? this.elapsed() >= this.combat.dashReady
          ? "Ready"
          : `${Math.ceil((this.combat.dashReady - this.elapsed()) / 1000)}s`
        : "Defeat a foe to unlock",
      buffs: this.combat
        ? [
            this.combat.shieldHit ? "Guard: 1 hit" : "",
            ...Object.entries(this.combat.buffs)
              .filter(([, until]) => until > this.elapsed())
              .map(
                ([key, until]) =>
                  `${ITEMS[key as keyof typeof ITEMS].name} ${Math.ceil((until - this.elapsed()) / 1000)}s`,
              ),
          ]
            .filter(Boolean)
            .join(" · ")
        : "",
      route:
        ROUTES[
          generateChunk(
            this.options.seed,
            Math.floor(this.furthest / 768),
            this.options.worldVersion,
          ).route
        ],
    });
  }
  private finish() {
    if (this.finished || this.phase !== "running") return;
    const elapsed = this.elapsed();
    this.finished = true;
    this.phase = "finished";
    this.time.paused = false;
    this.tweens.resumeAll();
    this.visual.anims.resume();
    this.physics.pause();
    sound("end");
    const distance = Math.max(0, Math.floor((this.furthest - 96) / 10)),
      durationMs = Math.min(
        Math.round(elapsed),
        this.options.maxDuration * 1000,
      );
    this.animate(this.health > 0 ? "celebrate" : "hurt");
    if (this.combat)
      recordRun({
        coins: this.collected.size,
        kills: this.combat.kills,
        seconds: durationMs / 1000,
        distance,
        combo: this.combat.comboBest,
        bosses: this.combat.flawlessBosses,
      });
    this.pushHud();
    this.time.delayedCall(700, () =>
      this.options.onFinish({
        distance,
        coins: [...this.collected],
        enemies: [...this.defeated],
        durationMs,
        ...(this.combat
          ? { combat: this.combat.events, style: this.combat.style }
          : {}),
        score:
          calculateScore(distance, this.collected.size, this.defeated.size) +
          this.bonus(),
      }),
    );
  }
  update(time: number, delta: number) {
    if (!this.player || this.finished || this.phase !== "running") return;
    if (this.elapsed() >= this.options.maxDuration * 1000) {
      this.finish();
      return;
    }
    if (this.paused) return;
    const now = performance.now(),
      body = this.player.body as Phaser.Physics.Arcade.Body,
      grounded = body.blocked.down || body.touching.down;
    if (grounded) {
      this.groundedAt = now;
      this.airJump = true;
      if (!this.previousGrounded) {
        this.landedUntil = now + 140;
        this.burst(this.player.x, this.player.y + 15, 0xc2a5d0, 4);
      }
    }
    const jump = this.queuedJump;
    this.queuedJump = false;
    if (jump) this.jumpAt = now;
    if (
      now - this.jumpAt < 130 &&
      (now - this.groundedAt < 110 || (jump && this.airJump))
    ) {
      const airborne = now - this.groundedAt >= 110;
      if (airborne) {
        this.airJump = false;
        this.burst(this.player.x, this.player.y + 15, 0xabcfff, 10);
      }
      this.player.setVelocityY(-RULES.jump);
      this.jumpAt = -1000;
      this.groundedAt = -1000;
      this.landedUntil = 0;
      this.animate("jump");
      sound("jump");
    }
    const direction =
      (this.keys.D.isDown || this.keys.RIGHT.isDown || this.touch.right
        ? 1
        : 0) -
      (this.keys.A.isDown || this.keys.LEFT.isDown || this.touch.left ? 1 : 0);
    const challenge = difficultyAt(this.elapsed(), this.options.worldVersion);
    const dash = this.elapsed() < (this.combat?.dashUntil || 0);
    const speed = challenge.speed * (this.combat?.speedScale || 1);
    this.player.setMaxVelocity(dash ? 430 : speed, 700);
    const targetSpeed = dash
      ? this.facing * 430
      : direction * speed + (this.traps?.current || 0);
    this.player.setVelocityX(
      this.traps?.ice && !direction
        ? body.velocity.x * Math.pow(0.97, delta / 16.67)
        : targetSpeed,
    );
    if (dash) this.burst(this.player.x, this.player.y, 0xc6dbff, 1);
    this.player.x = Math.max(this.furthest - 560, 12, this.player.x);
    this.furthest = Math.max(this.furthest, this.player.x);
    const nextBiome = Math.floor(Math.floor(this.furthest / 768) / 6) % 4;
    if (nextBiome !== this.biome) {
      this.biome = nextBiome;
    }
    if (this.player.y > 460) {
      this.damage();
      if (this.finished) return;
      const c = generateChunk(
        this.options.seed,
        Math.floor(this.furthest / 768),
        this.options.worldVersion,
      );
      const floor = c.platforms
        .filter((p) => p.ground && p.x < this.furthest - 24)
        .at(-1)!;
      this.player.setPosition(
        Math.max(
          floor.x + 28,
          Math.min(this.furthest - 80, floor.x + floor.width - 28),
        ),
        260,
      );
      this.player.setVelocity(0, 0);
    }
    this.visual.setPosition(this.player.x, this.player.y + 16);
    if (direction) {
      this.facing = direction;
      this.visual.setFlipX(direction < 0);
    }
    this.visual.setTint(
      this.elapsed() < this.shieldUntil
        ? 0xb1e3ff
        : this.appearance.skin === "skin-moon"
          ? 0xc5c9ff
          : this.appearance.skin === "skin-sunset"
            ? 0xffc4bd
            : 0xffffff,
    );
    this.animate(
      this.elapsed() < this.castUntil
        ? "celebrate"
        : characterState({
            finished: false,
            hurt: this.elapsed() < this.hurtUntil - 1150,
            grounded: grounded && body.velocity.y >= 0,
            landing: now < this.landedUntil,
            velocityX: body.velocity.x,
            velocityY: body.velocity.y,
          }),
    );
    this.visual.setAlpha(
      this.elapsed() < this.hurtUntil
        ? Math.floor(now / 90) % 2
          ? 0.35
          : 1
        : 1,
    );
    if (grounded && direction && time - this.lastDust > 130) {
      this.burst(
        this.player.x - direction * 10,
        this.player.y + 14,
        this.appearance.trail === "trail-star" ? 0xffd88a : 0xb2a1c4,
        2,
      );
      this.lastDust = time;
    }
    this.previousGrounded = grounded;
    this.cameras.main.scrollX = Math.max(
      0,
      this.furthest - Math.min(220, this.cameras.main.width * 0.3),
    );
    if (time - this.lastBackground >= 15) {
      this.scenery.draw(
        this.background.context,
        this.cameras.main.width,
        432,
        this.cameras.main.scrollX,
        this.elapsed(),
      );
      if (this.combat)
        drawWeather(
          this.background.context,
          this.cameras.main.width,
          this.elapsed(),
          this.options.seed,
        );
      this.background.refresh();
      this.lastBackground = time;
    }
    this.syncWorld();
    const elapsed = this.elapsed();
    this.combat?.update(delta);
    this.director?.update(delta);
    this.swarm.forEach((bird, i) =>
      bird
        .setVisible(
          weatherAt(elapsed, this.options.seed) === "Pokémon migration",
        )
        .setPosition(
          ((elapsed * 0.035 + i * 47) % (this.cameras.main.width + 200)) - 100,
          112 + Math.sin(elapsed / 500 + i) * 8 + i * 5,
        ),
    );
    if (this.traps)
      this.traps.update(this.hazards, delta, !!this.director?.boss?.active);
    this.wild[0].setVisible(this.biome === 0 || this.biome === 1);
    this.wild[1].setVisible(this.biome !== 2);
    this.wild[0].setPosition(
      ((((630 - this.cameras.main.scrollX * 0.22) % 1100) + 1100) % 1100) - 50,
      307 + Math.sin(time / 900) * 2,
    );
    this.wild[1].setPosition(
      ((((420 + elapsed * 0.013 - this.cameras.main.scrollX * 0.08) % 1100) +
        1100) %
        1100) -
        50,
      150 + Math.sin(time / 1200) * 7,
    );
    updateProjectiles(
      [this.bolts, this.enemyBolts],
      elapsed,
      this.cameras.main.scrollX,
      this.cameras.main.width,
      this.combat?.slowScale || 1,
    );
    for (const item of this.coins.getChildren()) {
      const coin = item as Phaser.GameObjects.Sprite;
      if (
        coin.active &&
        elapsed < this.magnetUntil &&
        Phaser.Math.Distance.Between(
          coin.x,
          coin.y,
          this.player.x,
          this.player.y,
        ) < 90
      ) {
        const key = coin.getData("id");
        if (!this.collected.has(key)) {
          this.collected.add(key);
          (coin as Phaser.Physics.Arcade.Sprite).disableBody(true, true);
          this.burst(coin.x, coin.y);
          sound("coin");
        }
      }
      coin.scaleX = 0.55 + Math.abs(Math.sin(time / 260 + coin.x)) * 0.45;
    }
    for (const item of this.enemies.getChildren()) {
      const enemy = item as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) continue;
      if (this.director) continue;
      const phase =
        progressiveClock(this.elapsed(), 0.85, this.options.worldVersion) /
          520 +
        enemy.getData("baseX");
      enemy.x =
        enemy.getData("baseX") + Math.sin(phase) * enemy.getData("range");
      enemy.y =
        enemy.getData("baseY") +
        (enemy.getData("kind") === "bat" ? Math.sin(phase * 2) * 8 : 0);
      const kind = enemy.getData("kind"),
        near = Math.abs(this.player.x - enemy.x) < 300;
      if (kind === "charger" || kind === "turret") {
        const ready = enemy.getData("readyAt") || 0;
        if (
          near &&
          enemy.x > this.cameras.main.scrollX + 20 &&
          enemy.x < this.cameras.main.scrollX + this.cameras.main.width - 20 &&
          elapsed >= ready &&
          !enemy.getData("windup")
        ) {
          enemy.setData("windup", elapsed + 550);
          this.floatText(enemy.x, enemy.y - 30, "!", "#ffb3bf");
        }
        const fire = enemy.getData("windup");
        enemy.setTint(fire ? 0xffa1bc : 0xffffff);
        if (fire && elapsed >= fire) {
          enemy.setData({
            windup: 0,
            readyAt: elapsed + Math.max(1400, 2600 - challenge.progress * 1000),
          });
          if (kind === "turret") {
            const shot = this.enemyBolts.create(
              enemy.x,
              enemy.y - 5,
              "enemy-bolt",
            ) as Phaser.Physics.Arcade.Sprite;
            const angle = Phaser.Math.Angle.Between(
              enemy.x,
              enemy.y,
              this.player.x,
              this.player.y,
            );
            shot
              .setVelocity(
                Math.cos(angle) * (140 + challenge.progress * 55),
                Math.sin(angle) * (140 + challenge.progress * 55),
              )
              .setData("expires", elapsed + 2200)
              .setDepth(6);
          } else
            enemy.setData({
              chargeUntil: elapsed + 550,
              chargeDirection: Math.sign(this.player.x - enemy.x),
              chargeX: enemy.x,
            });
        }
        if (
          kind === "charger" &&
          elapsed < (enemy.getData("chargeUntil") || 0)
        ) {
          enemy.x = Phaser.Math.Clamp(
            enemy.getData("chargeX") +
              (enemy.getData("chargeDirection") *
                (160 + challenge.progress * 70) *
                delta) /
                1000,
            enemy.getData("baseX") - 48,
            enemy.getData("baseX") + 48,
          );
          enemy.setData("chargeX", enemy.x);
        }
      }
      if (kind === "bat" && near) {
        const dive = Math.max(0, Math.sin(phase * 0.65));
        enemy.y += dive * 48;
      }
      enemy.setFlipX(Math.cos(phase) < 0);
      enemy.setScale(1, 1 + Math.sin(phase * 4) * 0.08).refreshBody();
    }
    for (const item of this.hazards.getChildren()) {
      const h = item as Phaser.Physics.Arcade.Sprite;
      if (h.getData("kind") === "saw") {
        h.y =
          h.getData("baseY") +
          Math.sin(
            progressiveClock(this.elapsed(), 0.8, this.options.worldVersion) /
              500,
          ) *
            h.getData("range");
        h.rotation += 0.06;
        h.refreshBody();
        h.setCircle(12, 4, 4);
      }
    }
    for (const item of this.platforms.getChildren()) {
      const p = item as Phaser.Physics.Arcade.Sprite;
      if (!p.getData("motion")) continue;
      p.y =
        p.getData("baseY") +
        Math.sin(
          progressiveClock(this.elapsed(), 0.6, this.options.worldVersion) /
            700 +
            p.x,
        ) *
          p.getData("motion");
      p.refreshBody();
      (p.getData("art") as Phaser.GameObjects.TileSprite).y = p.y - 8;
    }
    if (time - this.lastHud > 100) {
      this.pushHud();
      this.lastHud = time;
    }
  }
}
