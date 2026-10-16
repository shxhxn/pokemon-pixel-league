import { SettingsPanel } from "./admin/SettingsPanel";
import { TeamsPanel } from "./admin/TeamsPanel";
import { useEffect, useState } from "react";
import {
  Shield,
  ArrowRight,
  Download,
  Search,
  Plus,
  RotateCcw,
  Flag,
  Users,
  Check,
  LogOut,
} from "lucide-react";
import { api } from "../api";
import { ROSTER, pokemon } from "../../shared/roster";
export function Admin({
  onChange,
  onLogin,
  onLogout,
}: {
  onChange: () => void;
  onLogin: () => void;
  onLogout: () => void;
}) {
  const [authorized, setAuthorized] = useState(false),
    [data, setData] = useState<any>(null),
    [tab, setTab] = useState("overview"),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [teamId, setTeamId] = useState(""),
    [issued, setIssued] = useState<any>(null),
    [creating, setCreating] = useState(false),
    [teamRuns, setTeamRuns] = useState<any[]>([]);
  const refresh = async () => {
    const d = await api("/admin/overview");
    setData(d);
    setAuthorized(true);
  };
  useEffect(() => {
    refresh().catch(() => {});
  }, []);
  useEffect(() => {
    if (teamId)
      api(`/admin/teams/${teamId}/runs`)
        .then(setTeamRuns)
        .catch((e) => setError(e.message));
  }, [teamId, data]);
  const work = async (f: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await f();
      await refresh();
      onChange();
      setSuccess("Changes saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!authorized || tab !== "overview" || busy) return;
    const timer = window.setInterval(
      () => refresh().catch((e) => setError(e.message)),
      10000,
    );
    return () => window.clearInterval(timer);
  }, [authorized, tab, busy]);
  const config = (body: unknown) =>
    work(async () => {
      await api("/admin/config", "PATCH", body);
    });
  const attempts = (scope: string, id: string, action: string) => {
    const reason = window.prompt(
      `Reason for ${action === "reset" ? "resetting" : "granting"} attempts (required):`,
    );
    if (!reason) return;
    if (
      action === "reset" &&
      !window.confirm(
        "Reset attempt counters and close active sessions for this selection? Historical scores will be retained.",
      )
    )
      return;
    void work(async () => {
      await api("/admin/attempts", "POST", {
        scope,
        id,
        action,
        amount: 1,
        reason,
      });
    });
  };
  const team = data?.teams.find((t: any) => t.id === teamId);
  const review = (r: any, kind: "flagged" | "valid") => {
    const reason = window.prompt("Record a reason for this score review:");
    if (!reason) return;
    if (
      kind === "valid" &&
      r.valid &&
      !window.confirm("Invalidate this score and recalculate the standings?")
    )
      return;
    void work(async () => {
      await api(`/admin/runs/${r.id}`, "PATCH", { [kind]: !r[kind], reason });
    });
  };
  const runTable = (runs: any[]) => (
    <div className="admin-table-scroll">
      <table>
        <thead>
          <tr>
            <th>Team / player</th>
            <th>Score</th>
            <th>Run</th>
            <th>Status</th>
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.teamName}</strong>
                <small>
                  {r.playerName} · {new Date(r.createdAt).toLocaleString()}
                </small>
              </td>
              <td>{r.score}</td>
              <td>
                {r.distance} m / {r.coins} coins /{" "}
                {(r.durationMs / 1000).toFixed(1)} s
              </td>
              <td>
                {r.valid ? "Valid" : "Invalid"}
                {r.flagged ? " · Flagged" : ""}
                <small>{r.reason}</small>
              </td>
              <td>
                <div className="row">
                  <button
                    className="small secondary"
                    onClick={() => review(r, "flagged")}
                  >
                    {r.flagged ? "Unflag" : "Flag"}
                  </button>
                  <button
                    className="small danger"
                    onClick={() => review(r, "valid")}
                  >
                    {r.valid ? "Invalidate" : "Restore"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!runs.length && <p className="empty">No submitted runs yet.</p>}
    </div>
  );
  return (
    <section className="page-section admin-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            <Shield size={14} /> ORGANIZER’S DESK
          </span>
          <h1>
            Behind the <em>adventure.</em>
          </h1>
        </div>
        {authorized && (
          <button
            className="text-button"
            onClick={() =>
              void api("/logout", "POST")
                .then(() => {
                  setAuthorized(false);
                  setData(null);
                  setSuccess("");
                  onLogout();
                })
                .catch((e) => setError(e.message))
            }
          >
            <LogOut size={16} /> Sign out
          </button>
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="success" role="status">
          {success}
        </div>
      )}
      {!authorized ? (
        <form
          className="panel admin-login"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void work(async () => {
              await api("/admin/login", "POST", Object.fromEntries(f));
              setAuthorized(true);
              onLogin();
            });
          }}
        >
          <h2>Organizer sign in</h2>
          <p>Use the server-side credentials configured during setup.</p>
          <label>
            Username
            <input
              name="username"
              required
              autoComplete="username"
              defaultValue="organizer"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              required
              type="password"
              autoComplete="current-password"
            />
          </label>
          <button className="primary" disabled={busy}>
            Open the desk <ArrowRight size={16} />
          </button>
        </form>
      ) : (
        data && (
          <>
            <div className="admin-tabs">
              {["overview", "teams", "runs", "settings", "audit"].map((t) => (
                <button
                  className={tab === t ? "active" : ""}
                  onClick={() => setTab(t)}
                  key={t}
                >
                  {
                    {
                      overview: "Overview",
                      teams: "Teams & players",
                      runs: "Score review",
                      settings: "Settings",
                      audit: "Audit log",
                    }[t]
                  }
                </button>
              ))}
              <a className="text-button" href="/api/admin/export">
                <Download size={16} /> Export CSV
              </a>
              <button
                className="text-button"
                onClick={() => void work(refresh)}
              >
                <RotateCcw size={14} /> Refresh
              </button>
            </div>
            {tab === "overview" && (
              <>
                <div className="admin-status-banner">
                  <Flag size={28} />
                  <div>
                    <strong>
                      {data.config.frozen
                        ? "League frozen"
                        : data.config.status === "active"
                          ? "Tournament is live"
                          : data.config.status === "finished"
                            ? "Tournament finished"
                            : "Prepare the starting line"}
                    </strong>
                    <p>
                      {data.config.frozen
                        ? "New attempts and submissions are blocked. Unfreeze in Settings to continue."
                        : data.config.status === "active"
                          ? "Players can start official attempts. This overview refreshes every 10 seconds."
                          : data.config.status === "finished"
                            ? "Review the scores, then export the final standings below."
                            : "Check your teams and run duration, then use Start / resume to open official attempts."}
                    </p>
                  </div>
                </div>
                <div className="portal-stats four">
                  <div className="panel">
                    <small>TEAMS / PLAYERS</small>
                    <strong>
                      {data.teams.length}
                      <span>
                        {" "}
                        / {data.players.filter((p: any) => p.active).length}
                      </span>
                    </strong>
                  </div>
                  <div className="panel">
                    <small>ATTEMPTS USED / ALLOCATED</small>
                    <strong>
                      {data.teams.reduce((a: number, p: any) => a + p.used, 0)}
                      <span>
                        {" "}
                        /{" "}
                        {data.teams.reduce(
                          (a: number, p: any) => a + p.allowance,
                          0,
                        )}
                      </span>
                    </strong>
                  </div>
                  <div className="panel">
                    <small>TOURNAMENT</small>
                    <strong className="status-text">
                      {data.config.status}
                    </strong>
                  </div>
                  <div className="panel">
                    <small>LEADING TEAM</small>
                    <strong className="leader-name">
                      {data.board[0]?.score
                        ? data.board[0].name
                        : "Awaiting first run"}
                    </strong>
                  </div>
                </div>
                <div className="panel">
                  <h2>Race control</h2>
                  <p>
                    Pausing prevents new starts. Existing runs continue on their
                    original clock. Finishing closes submissions.
                  </p>
                  <div className="row wrap">
                    {["ready", "active", "paused", "finished"].map((s) => (
                      <button
                        className={
                          data.config.status === s ? "primary" : "secondary"
                        }
                        key={s}
                        disabled={busy || data.config.status === s}
                        onClick={() => {
                          if (
                            s !== "finished" ||
                            window.confirm(
                              "Finish tournament? Pending results will be blocked.",
                            )
                          )
                            void config({ status: s });
                        }}
                      >
                        {s === "active"
                          ? "Start / resume"
                          : s === "paused"
                            ? "Pause"
                            : s === "finished"
                              ? "Finish tournament"
                              : "Mark ready"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="panel">
                  <h2>Recent game sessions</h2>
                  {data.sessions.slice(0, 15).map((s: any) => (
                    <div className="history-row" key={s.id}>
                      <span>
                        {data.players.find((p: any) => p.id === s.playerId)
                          ?.name || s.playerId}
                        <small>
                          {s.id.slice(0, 8)} ·{" "}
                          {new Date(s.startedAt).toLocaleString()}
                        </small>
                      </span>
                      <span className="badge">{s.status}</span>
                    </div>
                  ))}
                  {!data.sessions.length && (
                    <p className="empty">No sessions started yet.</p>
                  )}
                </div>
              </>
            )}
            {tab === "teams" && (
              <TeamsPanel
                data={data}
                search={search}
                setSearch={setSearch}
                setCreating={setCreating}
                teamId={teamId}
                setTeamId={setTeamId}
                team={team}
                work={work}
                busy={busy}
                attempts={attempts}
                setIssued={setIssued}
                teamRuns={teamRuns}
                runTable={runTable}
              />
            )}
            {tab === "runs" && (
              <div className="panel">
                <h2>Score review</h2>
                <p>
                  Flag unusual scores for investigation. Invalidation requires a
                  reason and updates live rankings. Showing the latest 500 runs;
                  use team management for full histories.
                </p>
                {runTable(data.runs)}
              </div>
            )}
            {tab === "settings" && (
              <SettingsPanel
                data={data}
                config={config}
                busy={busy}
                attempts={attempts}
              />
            )}
            {tab === "audit" && (
              <div className="panel">
                <h2>Audit trail</h2>
                <p>
                  The latest 100 actions. The full history is retained in the
                  database.
                </p>
                {data.audit.map((a: any) => (
                  <div className="audit-row" key={a.id}>
                    <span>
                      {new Date(a.createdAt).toLocaleString()}
                      <small>Actor: {a.actor}</small>
                    </span>
                    <strong>{a.action}</strong>
                    <code>{a.detail}</code>
                  </div>
                ))}
              </div>
            )}
          </>
        )
      )}
      {issued && (
        <div className="modal-backdrop">
          <div className="modal">
            <button
              className="close"
              onClick={() => setIssued(null)}
              aria-label="Close team receipt"
            >
              ×
            </button>
            <h2>Team registered</h2>
            <p>
              Sign in with <strong>{issued.name}</strong>. The team shares{" "}
              {issued.allowance} attempts; any member can take the next turn.
            </p>
            {issued.players.map((p: any, i: number) => (
              <div className="code-row" key={i}>
                <strong>{p.name}</strong>
                <span>Team member</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {creating && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void work(async () => {
                const r = await api("/admin/teams", "POST", {
                  name: f.get("name"),
                  pokemon: Number(f.get("pokemon")),
                  players: String(f.get("players"))
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                });
                setIssued(r);
                setCreating(false);
                setTeamId(r.id);
              });
            }}
          >
            <button
              className="close"
              type="button"
              onClick={() => setCreating(false)}
              aria-label="Close registration"
            >
              ×
            </button>
            <h2>Register a team</h2>
            <label>
              Team name
              <input name="name" required minLength={2} maxLength={40} />
            </label>
            <label>
              Partner
              <select name="pokemon">
                {ROSTER.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Players (one per line)
              <textarea name="players" rows={4} required />
            </label>
            <button className="primary" disabled={busy}>
              Create team <ArrowRight size={16} />
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
