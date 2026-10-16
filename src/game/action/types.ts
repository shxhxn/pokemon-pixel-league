import type Phaser from "phaser";
export type Actor = Phaser.Physics.Arcade.Sprite;
export interface ActionHost {
  scene: Phaser.Scene;
  player: Actor;
  enemies: Phaser.Physics.Arcade.StaticGroup;
  bolts: Phaser.Physics.Arcade.Group;
  hostile: Phaser.Physics.Arcade.Group;
  now(): number;
  distance(): number;
  facing(): number;
  pokemon: number;
  seed: number;
  damage(): void;
  heal(): void;
  defeat(enemy: Actor): void;
  effect(x: number, y: number, color: number, count?: number): void;
  text(x: number, y: number, text: string, color: string): void;
  shield(until: number): void;
  magnet(until: number): void;
  cast(until: number): void;
  ground(x: number): number | undefined;
  rapid(): boolean;
}
