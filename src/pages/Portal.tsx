import {
  ArrowRight,
  ArrowUpRight,
  Gamepad2,
  Trophy,
  Leaf,
  ChevronRight,
  Infinity as InfinityIcon,
  Clock,
  Check,
  LogOut,
  Copy,
  Play,
} from "lucide-react";
import { api, type Config, type Team, type Session } from "../api";
import type { Page } from "../App";
import type { RunResult } from "../../shared/world";
import { pokemon, ROSTER } from "../../shared/roster";
import { Roster } from "../components/Roster";
import { Scenery } from "../components/Scenery";
import { Leaderboard } from "../components/Leaderboard";
import { readPending } from "../pendingResult";

type Props = {
  me: any;
  setMe: (v: any) => void;
  config?: Config;
  code: string;
  setCode: (v: string) => void;
  login: () => Promise<void>;
  busy: boolean;
  go: (p: Page) => void;
  work: (f: () => Promise<void>) => Promise<void>;
  setError: (v: string) => void;
  setSession: (v: Session) => void;
  setResult: (v: RunResult) => void;
  setPractice: (v: boolean) => void;
  setSubmission: (v: string) => void;
  setConfirm: (v: boolean) => void;
  setSelected: (v: number) => void;
  startPractice: (character?: number) => void;
};
export function Portal({
  me,
  setMe,
  config,
  code,
  setCode,
  login,
  busy,
  go,
  work,
  setError,
  setSession,
  setResult,
  setPractice,
  setSubmission,
  setConfirm,
  setSelected,
  startPractice,
}: Props) {
  const blockedReason = me?.team?.disqualified
    ? "Your team is disqualified. Contact the organizer."
    : config?.frozen
      ? "The organizer has frozen the league. Official attempts are unavailable."
      : config?.status !== "active"
        ? `The tournament is ${config?.status || "loading"}. Official attempts open when the organizer starts it.`
        : me?.used >= me?.allowance
          ? "All your official attempts are used. You can keep practicing."
          : "";
  return (
    <section className="page-section portal-page">
      {!me || me.role === "admin" ? (
        <div className="login-layout">
          <div className="login-art">
            <Scenery />
            <img src="/assets/pokemon/133.gif" alt="Eevee" />
          </div>
          <form
            className="panel login-panel"
            onSubmit={(e) => {
              e.preventDefault();
              void login();
            }}
          >
            <span className="eyebrow">WELCOME BACK, TRAINER</span>
            <h1>
              Your next
              <br />
              <em>great run.</em>
            </h1>
            <p>
              Enter your registered team name. Any member can take the next
              turn; only one team run can be active at a time.
            </p>
            <label>
              Registered team name
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                placeholder="e.g. ArcadeDestroyer"
                autoComplete="off"
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Signing in…" : "Enter team portal"}
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => go("register")}
            >
              New around here? Register your team.
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="portal-heading">
            <img
              src={pokemon(me.team.pokemon).image}
              alt={pokemon(me.team.pokemon).name}
            />
            <div>
              <span className="eyebrow">TEAM PORTAL · {me.name}</span>
              <h1>{me.team.name}</h1>
              <p>{pokemon(me.team.pokemon).name} is ready when you are.</p>
            </div>
            <button
              className="text-button"
              onClick={() =>
                void work(async () => {
                  await api("/logout", "POST");
                  setMe(null);
                })
              }
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
          <div className="portal-guide">
            <Gamepad2 size={28} />
            <div>
              <strong>
                {me.session
                  ? "Finish recovering your open attempt first"
                  : blockedReason
                    ? "Practice is always available"
                    : "You are ready for an official run"}
              </strong>
              <p>
                {blockedReason ||
                  (me.session
                    ? "Use the recovery controls below before starting again."
                    : "An official run uses one attempt. Every accepted score adds to the team total.")}
              </p>
            </div>
          </div>
          <div className="portal-stats">
            <div className="panel">
              <small>TEAM ATTEMPTS LEFT</small>
              <strong>
                {Math.max(0, me.allowance - me.used)}
                <span> / {me.allowance}</span>
              </strong>
            </div>
            <div className="panel">
              <small>TOTAL TEAM SCORE</small>
              <strong>
                {me.best.toLocaleString()}
                <span> pts</span>
              </strong>
            </div>
            <div className="panel">
              <small>TOURNAMENT</small>
              <strong className="status-text">{config?.status}</strong>
            </div>
          </div>
          {me.team.disqualified ? (
            <div className="error">
              Your team is disqualified. Contact the organizer.
            </div>
          ) : null}
          {me.session ? (
            <div className="panel">
              <h2>An attempt is still open</h2>
              <p>
                Refreshing does not restore an attempt. If you have a saved
                result, recover it below. Otherwise close this run and ask the
                organizer about a replacement.
              </p>
              <div className="row">
                <button
                  className="secondary"
                  onClick={() => {
                    const saved = readPending(me.id);
                    if (saved) {
                      const p = saved;
                      setSession(p.session);
                      setResult(p.result);
                      setPractice(false);
                      setSubmission(
                        "Recovered result · Retry submission below.",
                      );
                      go("result");
                    } else
                      setError(
                        "No completed result was saved in this browser.",
                      );
                  }}
                >
                  Recover saved result
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    if (
                      window.confirm("Close this attempt? It remains consumed.")
                    )
                      void work(async () => {
                        await api(`/sessions/${me.session.id}/abandon`, "POST");
                        setMe(await api("/me"));
                      });
                  }}
                >
                  Close interrupted attempt
                </button>
              </div>
            </div>
          ) : (
            <div className="portal-start">
              <div>
                <span className="eyebrow">YOUR NEXT OFFICIAL RUN</span>
                <h2>Make this one count.</h2>
                <p>
                  {blockedReason
                    ? blockedReason
                    : `${config?.maxDuration} seconds · 3 hearts · Endless possibilities`}
                </p>
              </div>
              <button
                className="primary"
                disabled={
                  me.used >= me.allowance ||
                  config?.status !== "active" ||
                  !!config?.frozen ||
                  !!me.team.disqualified
                }
                onClick={() => setConfirm(true)}
              >
                Start official attempt <ArrowRight size={16} />
              </button>
            </div>
          )}
          <div className="registration-grid">
            <div className="panel">
              <h2>The team</h2>
              {me.roster.map((p: any) => (
                <div className="history-row" key={p.id}>
                  <strong>
                    {p.name}
                    {p.id === me.id ? " (you)" : ""}
                  </strong>
                  <span>Team member</span>
                </div>
              ))}
            </div>
            <div className="panel">
              <h2>Team attempt history</h2>
              {me.runs.length ? (
                me.runs.map((r: any) => (
                  <div className="history-row" key={r.id}>
                    <span>
                      {r.distance} m · {r.coins} coins
                      {!r.valid ? " · invalidated" : ""}
                    </span>
                    <strong>{r.score} pts</strong>
                  </div>
                ))
              ) : (
                <p className="empty">No team attempts submitted yet.</p>
              )}
              <button
                className="text-button"
                onClick={() => {
                  setSelected(me.team.pokemon);
                  startPractice(me.team.pokemon);
                }}
              >
                Warm up with a practice run <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
