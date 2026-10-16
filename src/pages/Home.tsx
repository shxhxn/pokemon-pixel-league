import { ArrowRight, Gamepad2, Trophy, Users, Play } from "lucide-react";
import type { Config, Team } from "../api";
import type { Page } from "../App";
import { pokemon } from "../../shared/roster";
import { Scenery } from "../components/Scenery";
import { Leaderboard } from "../components/Leaderboard";
import { AdventureWorkshop } from "../components/AdventureWorkshop";
type Props = {
  data: { config: Config; board: Team[] } | null;
  config?: Config;
  me: any;
  selected: number;
  setSelected: (v: number) => void;
  go: (p: Page) => void;
  startPractice: (character?: number) => void;
};
export function Home({ data, config, me, selected, go, startPractice }: Props) {
  const partner = pokemon(selected),
    teams = data?.board || [];
  return (
    <div className="league-dashboard">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">POKÉMON PIXEL LEAGUE</span>
          <h1>Your team's next adventure.</h1>
        </div>
        <span className="league-state">
          <i />{" "}
          {config?.status === "active"
            ? "Tournament live"
            : config?.status === "finished"
              ? "Final standings"
              : "Practice is open"}
        </span>
      </div>
      <div className="dashboard-grid">
        <section className="adventure-card">
          <div className="adventure-scene">
            <Scenery />
            <div className="scene-chapter">
              <span>MOONLIT VILLAGE / ROUTE 01</span>
              <strong>One moonlit world. Endless adventure.</strong>
            </div>
            <img
              className="dashboard-partner"
              src={partner.image}
              alt={partner.name}
            />
            <div className="scene-caption-bottom">
              VILLAGES · LAKES · LANTERN WOODLANDS
            </div>
          </div>
          <div className="adventure-controls">
            <div className="selected-partner">
              <img src={partner.image} alt="" />
              <div>
                <strong>{partner.name}</strong>
                <button className="text-button" onClick={() => go("roster")}>
                  Change partner
                </button>
              </div>
            </div>
            <button className="primary" onClick={() => startPractice()}>
              <Play size={17} /> Play practice
            </button>
          </div>
          <div className="adventure-description">
            <span>
              <kbd>←</kbd>
              <kbd>→</kbd> Move
            </span>
            <span>
              <kbd>SPACE</kbd> Double jump
            </span>
            <span>
              <kbd>X</kbd> Attack
            </span>
            <span>Unlimited practice · No attempt used</span>
          </div>
        </section>
        <aside className="team-launch-card">
          <div className="launch-icon">
            <Trophy size={27} />
          </div>
          <span className="eyebrow">THE TEAM CHALLENGE</span>
          <h2>
            Every run <br />
            adds up.
          </h2>
          <p>
            Take turns under your team name. Each accepted score adds to your
            team's total.
          </p>
          <div className="team-rules">
            <div>
              <Users size={18} />
              <span>
                <strong>
                  {teams.length} {teams.length === 1 ? "team" : "teams"}
                </strong>{" "}
                on the leaderboard
              </span>
            </div>
            <div>
              <Gamepad2 size={18} />
              <span>
                <strong>{config?.attemptsPerTeam || 5} shared attempts</strong>{" "}
                per team by default
              </span>
            </div>
            <div>
              <Trophy size={18} />
              <span>
                <strong>10,000 + 20,000 + 5,000</strong> = 35,000 team points
              </span>
            </div>
          </div>
          <button className="primary" onClick={() => go("portal")}>
            {me?.role === "team"
              ? "Open team dashboard"
              : "Enter with team name"}
            <ArrowRight size={17} />
          </button>
          <button className="secondary" onClick={() => go("register")}>
            Register a new team
          </button>
          <small>
            One person plays at a time. The organizer controls roster size and
            attempt allowances.
          </small>
        </aside>
      </div>
      <AdventureWorkshop selected={selected} play={startPractice} />
      <section className="dashboard-standings">
        <div className="standings-explanation">
          <span>
            {teams.length} {teams.length === 1 ? "TEAM" : "TEAMS"} · ALL
            ACCEPTED RUNS COUNT
          </span>
          <span>Click a team to see its attempt history.</span>
        </div>
        <Leaderboard board={teams} full dashboard frozen={!!config?.frozen} />
      </section>
    </div>
  );
}
