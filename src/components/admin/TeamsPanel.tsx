import {
  Search,
  Plus,
  Users,
  ArrowRight,
  Check,
  RotateCcw,
} from "lucide-react";
import { api } from "../../api";
import { pokemon, ROSTER } from "../../../shared/roster";
import type { ReactNode } from "react";

type Props = {
  data: any;
  search: string;
  setSearch: (v: string) => void;
  setCreating: (v: boolean) => void;
  teamId: string;
  setTeamId: (v: string) => void;
  team: any;
  work: (f: () => Promise<void>) => Promise<void>;
  busy: boolean;
  attempts: (scope: string, id: string, action: string) => void;
  setIssued: (v: any) => void;
  teamRuns: any[];
  runTable: (runs: any[]) => ReactNode;
};
export function TeamsPanel({
  data,
  search,
  setSearch,
  setCreating,
  teamId,
  setTeamId,
  team,
  work,
  busy,
  attempts,
  setIssued,
  teamRuns,
  runTable,
}: Props) {
  return (
    <>
      <div className="action-bar">
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Search teams"
            placeholder="Find a team…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button className="primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Register a team
        </button>
      </div>
      <div className="admin-teams">
        <div className="team-list">
          {data.teams
            .filter((t: any) =>
              t.name.toLowerCase().includes(search.toLowerCase()),
            )
            .map((t: any) => (
              <button
                className={teamId === t.id ? "active" : ""}
                key={t.id}
                onClick={() => setTeamId(t.id)}
              >
                <img src={pokemon(t.pokemon).image} alt="" />
                <span>
                  <strong>{t.name}</strong>
                  <small>
                    {t.disqualified ? "Disqualified" : pokemon(t.pokemon).name}
                  </small>
                </span>
              </button>
            ))}
        </div>
        <div className="panel team-detail">
          {team ? (
            <>
              <form
                key={team.id + team.name + team.pokemon}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void work(async () => {
                    await api(`/admin/teams/${team.id}`, "PATCH", {
                      name: f.get("name"),
                      pokemon: Number(f.get("pokemon")),
                      allowance: Number(f.get("allowance")),
                    });
                  });
                }}
              >
                <h2>Team details</h2>
                <label>
                  Team name
                  <input
                    name="name"
                    defaultValue={team.name}
                    required
                    minLength={2}
                    maxLength={40}
                  />
                </label>
                <label>
                  Partner
                  <select name="pokemon" defaultValue={team.pokemon}>
                    {ROSTER.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Shared attempt allowance
                  <input
                    name="allowance"
                    type="number"
                    min={team.used}
                    max={100}
                    defaultValue={team.allowance}
                    required
                  />
                </label>
                <p>
                  {team.used} shared attempts used. Total points include every
                  valid run.
                </p>
                <div className="row wrap">
                  <button className="primary small" disabled={busy}>
                    Save changes
                  </button>
                  <button
                    type="button"
                    className="danger small"
                    onClick={() => {
                      if (
                        window.confirm(
                          `${team.disqualified ? "Reinstate" : "Disqualify"} ${team.name}?`,
                        )
                      )
                        void work(async () => {
                          await api(`/admin/teams/${team.id}`, "PATCH", {
                            disqualified: !team.disqualified,
                          });
                        });
                    }}
                  >
                    {team.disqualified ? "Reinstate team" : "Disqualify team"}
                  </button>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => attempts("team", team.id, "reset")}
                  >
                    Reset team attempts
                  </button>
                </div>
              </form>
              <h3 className="spaced">Player roster</h3>
              {data.players
                .filter((p: any) => p.teamId === team.id && p.active)
                .map((p: any) => (
                  <div className="player-admin" key={p.id}>
                    <div>
                      <strong>{p.name}</strong>
                      <small>Team member</small>
                    </div>
                    <div className="row wrap">
                      <button
                        className="small secondary"
                        onClick={() => {
                          const name = window.prompt(
                            "Correct player name:",
                            p.name,
                          );
                          if (name)
                            void work(async () => {
                              await api(`/admin/players/${p.id}`, "PATCH", {
                                name,
                              });
                            });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="small danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remove ${p.name} from the active roster? History is retained.`,
                            )
                          )
                            void work(async () => {
                              await api(`/admin/players/${p.id}`, "PATCH", {
                                active: false,
                              });
                            });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    f = new FormData(form);
                  void work(async () => {
                    const r = await api(
                      `/admin/teams/${team.id}/players`,
                      "POST",
                      { name: f.get("name") },
                    );
                    form.reset();
                  });
                }}
              >
                <input
                  aria-label="New player name"
                  name="name"
                  required
                  placeholder="New player name"
                  minLength={2}
                  maxLength={40}
                />
                <button className="secondary small" disabled={busy}>
                  <Plus size={14} /> Add player
                </button>
              </form>
              <h3 className="spaced">Full team run history</h3>
              {runTable(teamRuns)}
            </>
          ) : (
            <p className="empty">
              <Users size={28} />
              <br />
              Choose a team to manage its roster, attempts, and run history.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
