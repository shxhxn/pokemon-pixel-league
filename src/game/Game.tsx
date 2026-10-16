import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { LeagueScene, type GameOptions, type Hud } from "./LeagueScene";
import { setMuted } from "./sound";
import {
  Volume2,
  VolumeX,
  Flag,
  Heart,
  Pause,
  Play,
  Maximize,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { pokemon } from "../../shared/roster";
const tips: Record<string, string> = {
  "Warm-up trail":
    "Collect coins. Tap jump again in the air for a double jump.",
  "Spike garden": "Spike garden: jump over the pink spikes.",
  "Crate climb": "Crate climb: jump onto the blocks for the higher coin trail.",
  "Spring valley":
    "Spring valley: gold springs launch you into the high coins.",
  "Patrol crossing": "Patrol crossing: land on a mushroom to earn 50 points.",
  "Sky patrol": "Sky patrol: watch the bats above the platforms.",
  "Crumbling bridge": "Crumbling bridge: orange platforms fall after you land!",
  "Moving terraces": "Moving terraces: time your jump with the blue platforms.",
  "Crystal gauntlet":
    "Crystal gauntlet: stay low to pass the spinning crystal.",
};
export function Game({
  options,
  teamName,
  onExit,
}: {
  options: GameOptions;
  teamName: string;
  onExit: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    shell = useRef<HTMLElement>(null),
    instance = useRef<Phaser.Game | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [muted, mute] = useState(false),
    [confirm, setConfirm] = useState(false);
  const [hud, setHud] = useState<Hud>({
    score: 0,
    distance: 0,
    coins: 0,
    health: 3,
    seconds: options.maxDuration,
    biome: "Moonlit Village",
    paused: false,
    phase: "ready",
    countdown: 3,
    route: "Warm-up trail",
    airJump: true,
    power: "",
    attackReady: true,
    timeOfDay: "Moonlit",
    difficulty: 1,
    difficultyLabel: "Warm-up",
    difficultyProgress: 0,
    energy: 60,
    special: "Special",
    specialCost: 35,
    held: "Empty",
    combo: 1,
    boss: null,
    warning: "",
    dash: "Defeat a foe to unlock",
    buffs: "",
  });
  const emit = (event: string, ...args: unknown[]) =>
    instance.current?.scene.getScene("league").events.emit(event, ...args);
  useEffect(() => {
    document.body.classList.add("is-playing");
    setMuted(false);
    const scene = new LeagueScene({
      ...options,
      onHud: setHud,
      onReady: () => setLoading(false),
      onError: setError,
    });
    const gameWidth = () =>
      Math.max(
        320,
        Math.min(
          960,
          Math.round((window.innerWidth / window.innerHeight) * 432),
        ),
      );
    instance.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current!,
      width: gameWidth(),
      height: 432,
      pixelArt: true,
      roundPixels: true,
      backgroundColor: "#252b4a",
      physics: {
        default: "arcade",
        arcade: { gravity: { x: 0, y: 1000 }, debug: false },
      },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [scene],
      audio: { noAudio: true },
    });
    const resize = () => {
      const scale = instance.current?.scale;
      if (!scale || !host.current) return;
      scale.setParentSize(host.current.clientWidth, host.current.clientHeight);
      scale.setGameSize(gameWidth(), 432);
    };
    window.addEventListener("resize", resize);
    const blur = () => emit("blur-controls");
    const visibility = () => {
      if (document.hidden) blur();
    };
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      instance.current?.destroy(true);
      instance.current = null;
      document.body.classList.remove("is-playing");
    };
  }, []);
  const control = (key: "left" | "right" | "jump", label: string) => (
    <button
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        emit("controls", key, true);
      }}
      onPointerUp={() => emit("controls", key, false)}
      onPointerCancel={() => emit("controls", key, false)}
      onLostPointerCapture={() => emit("controls", key, false)}
    >
      {key === "left" ? (
        <ArrowLeft />
      ) : key === "right" ? (
        <ArrowRight />
      ) : (
        "JUMP"
      )}
    </button>
  );
  const finish = () => {
    if (options.practice && !hud.paused) emit("toggle-pause");
    setConfirm(true);
  };
  return (
    <section
      className="game-shell"
      ref={shell}
      aria-label="Pokemon Pixel League game"
    >
      <div className="game-canvas" ref={host} />
      <div className="game-top">
        <span className="eyebrow">
          {options.practice
            ? "PRACTICE • NO ATTEMPTS USED"
            : "OFFICIAL ATTEMPT"}{" "}
          · {teamName}
        </span>
        <div className="row">
          <button
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            title={muted ? "Unmute sound" : "Mute sound"}
            onClick={() => {
              mute(!muted);
              setMuted(!muted);
            }}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            aria-label="Toggle fullscreen"
            title="Toggle fullscreen"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else
                void shell.current
                  ?.requestFullscreen()
                  .catch(() =>
                    setError(
                      "Fullscreen is unavailable in this browser. The game still fills this tab.",
                    ),
                  );
            }}
          >
            <Maximize size={18} />
          </button>
          {options.practice && (
            <button
              disabled={hud.phase !== "running"}
              aria-label={hud.paused ? "Resume game" : "Pause game"}
              onClick={() => emit("toggle-pause")}
            >
              {hud.paused ? <Play size={16} /> : <Pause size={16} />}
              <span className="button-label">
                {hud.paused ? "Resume" : "Pause"}
              </span>
            </button>
          )}
          <button
            aria-label="Finish run"
            title="Finish run"
            disabled={hud.phase !== "running"}
            onClick={finish}
          >
            <Flag size={15} />
            <span className="button-label">Finish run</span>
          </button>
        </div>
      </div>
      <div className="hud" aria-label="Live run statistics">
        <div>
          <small>SCORE</small>
          <strong>{hud.score.toLocaleString().padStart(5, "0")}</strong>
        </div>
        <div>
          <small>DISTANCE</small>
          <strong>{hud.distance} m</strong>
        </div>
        <div>
          <small>COINS</small>
          <strong>{hud.coins}</strong>
        </div>
        <div>
          <small>TIME LEFT</small>
          <strong style={hud.seconds <= 10 ? { color: "#ff8499" } : undefined}>
            {Math.floor(hud.seconds / 60)}:
            {String(hud.seconds % 60).padStart(2, "0")}
          </strong>
        </div>
        <div className="hearts" aria-label={`${hud.health} hearts left`}>
          <small>HEALTH</small>
          <div>
            {[0, 1, 2].map((i) => (
              <Heart
                key={i}
                size={18}
                fill={hud.health > i ? "#ff8499" : "transparent"}
                color="#ff8499"
              />
            ))}
          </div>
        </div>
      </div>
      <div
        className="difficulty-meter"
        aria-label={`Difficulty ${hud.difficulty} of 6: ${hud.difficultyLabel}`}
      >
        <span>
          STAGE {hud.difficulty}/6 <strong>{hud.difficultyLabel}</strong>
        </span>
        <div className="difficulty-track">
          <i
            style={{ width: `${Math.max(4, hud.difficultyProgress * 100)}%` }}
          />
        </div>
      </div>
      <div className="combat-hud" aria-label="Combat and items">
        <button
          onClick={() => emit("special")}
          disabled={
            hud.energy < hud.specialCost ||
            hud.phase !== "running" ||
            hud.paused
          }
          title={`C · ${hud.specialCost} energy`}
        >
          <span>
            {hud.special} <kbd>C</kbd>
          </span>
          <meter min={0} max={100} value={hud.energy} />
          <small>
            {Math.floor(hud.energy)}/100 energy · costs {hud.specialCost}
          </small>
        </button>
        <button
          onClick={() => emit("use-item")}
          disabled={
            hud.held === "Empty" || hud.phase !== "running" || hud.paused
          }
        >
          <span>
            {hud.held === "Empty" ? "Find a mystery ball" : hud.held}{" "}
            <kbd>E</kbd>
          </span>
          <small>One held item · tap to use</small>
        </button>
        <span className="combo-label">×{hud.combo} combo</span>
      </div>
      {hud.boss && (
        <div className="boss-hud">
          <span>
            {hud.boss.name} · Attack after its warning · or take the upper path
          </span>
          <meter min={0} max={hud.boss.max} value={hud.boss.hp} />
        </div>
      )}
      {hud.phase === "running" && !hud.paused && (
        <div className="game-message">{hud.warning || tips[hud.route]}</div>
      )}
      {loading ? (
        <div className="game-loading">
          <h2>Loading your partner</h2>
          <p>{error || "Preparing the world and movement animations…"}</p>
          {error && (
            <button className="secondary" onClick={onExit}>
              Back to portal
            </button>
          )}
        </div>
      ) : hud.phase === "ready" ? (
        <div className="game-loading">
          <img
            className="partner-preview"
            src={pokemon(options.pokemon).image}
            alt={pokemon(options.pokemon).name}
          />
          <span className="eyebrow">
            {options.practice ? "FREE PRACTICE" : "OFFICIAL RUN"} ·{" "}
            {options.maxDuration} SECONDS · 3 HEARTS
          </span>
          <h2>Ready, {pokemon(options.pokemon).name}?</h2>
          <p>
            Travel through six increasingly difficult stages. Fight, jump, or
            take a safer path around enemies. Your timer starts after the
            countdown.
          </p>
          <div className="control-guide">
            <span>
              <kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd> Move left /
              right
            </span>
            <span>
              <kbd>SPACE</kbd> / <kbd>↑</kbd> / <kbd>W</kbd> Jump · press again
              for a double jump
            </span>
            <span>
              X / J attack · C special · E use item · Shift dash (unlocks on
              your first defeat).
            </span>
            <span>
              10 pts/metre · 25/coin · enemy rewards + combos up to ×5
            </span>
            <span>
              Mystery balls hold one item until you use it. Dealing damage
              restores special energy. Rare hearts restore one life.
            </span>
          </div>
          <button className="primary" onClick={() => emit("start-run")}>
            <Play size={18} /> Start {options.practice ? "practice" : "run"}
          </button>
          {options.practice && (
            <button className="text-button" onClick={onExit}>
              Back to partner selection
            </button>
          )}
          {!options.practice && (
            <small>Your attempt is reserved. Official runs cannot pause.</small>
          )}
        </div>
      ) : hud.phase === "countdown" ? (
        <div className="game-loading">
          <span className="game-countdown">{hud.countdown}</span>
          <p>Get ready to move right!</p>
        </div>
      ) : hud.paused && !confirm ? (
        <div className="game-loading">
          <h2>Take a breather.</h2>
          <p>Your practice timer is paused.</p>
          <button className="primary" onClick={() => emit("toggle-pause")}>
            <Play size={18} /> Resume game
          </button>
          <button className="secondary" onClick={() => setConfirm(true)}>
            Finish practice
          </button>
        </div>
      ) : null}
      {confirm && (
        <div
          className="game-finish-confirm"
          role="dialog"
          aria-modal="true"
          aria-label="Finish this run?"
        >
          <div>
            <h2>Finish this run?</h2>
            <p>
              {options.practice
                ? "Save this practice result and return to the results screen."
                : "Your current score will be submitted. The official timer is still running."}
            </p>
            <div className="row">
              <button
                className="secondary"
                autoFocus
                onClick={() => {
                  setConfirm(false);
                  if (hud.paused) emit("toggle-pause");
                }}
              >
                Keep playing
              </button>
              <button
                className="primary"
                onClick={() => {
                  setConfirm(false);
                  emit("end-run");
                }}
              >
                Finish &amp; view result
              </button>
            </div>
          </div>
        </div>
      )}
      {hud.phase === "running" && !hud.paused && (
        <div className="touch-controls">
          <div>
            {control("left", "Move left")}
            {control("right", "Move right")}
          </div>
          <div>
            <button
              className="attack-touch"
              aria-label="Attack"
              onPointerDown={(e) => {
                e.preventDefault();
                emit("attack");
              }}
            >
              ATTACK
            </button>
            {control("jump", "Jump")}
            <button
              aria-label="Special attack"
              disabled={hud.energy < hud.specialCost}
              onPointerDown={(e) => {
                e.preventDefault();
                emit("special");
              }}
            >
              SPECIAL
            </button>
            <button
              aria-label="Dash"
              disabled={hud.dash !== "Ready"}
              onPointerDown={(e) => {
                e.preventDefault();
                emit("dash");
              }}
            >
              DASH
            </button>
          </div>
        </div>
      )}
      <div className="game-bottom">
        <span>
          {hud.timeOfDay} / {hud.biome}
        </span>
        <span className="objective">
          {hud.buffs ||
            hud.power ||
            (hud.airJump ? "Double jump ready" : "Land to recharge jump")}
        </span>
        <span className="keyboard-hint">
          <kbd>←</kbd>
          <kbd>→</kbd> move <kbd>SPACE</kbd> jump <kbd>X</kbd> attack{" "}
          <kbd>C</kbd> special <kbd>E</kbd> item <kbd>SHIFT</kbd> dash:{" "}
          {hud.dash} {options.practice ? "· ESC pause" : "· No pause"}
        </span>
      </div>
      {error && !loading && (
        <button
          className="game-message"
          style={{ pointerEvents: "auto" }}
          onClick={() => setError("")}
        >
          {error} ×
        </button>
      )}
    </section>
  );
}
