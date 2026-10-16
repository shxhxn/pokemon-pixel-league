import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { api, type Config } from "../api";
import type { Page } from "../App";
import { Roster } from "../components/Roster";

type Props = {
  setCode: (v: string) => void;
  receipt: any;
  setReceipt: (v: any) => void;
  config?: Config;
  selected: number;
  setSelected: (v: number) => void;
  go: (p: Page) => void;
  work: (f: () => Promise<void>) => Promise<void>;
  reload: () => Promise<void>;
  busy: boolean;
};
export function Registration({
  setCode,
  receipt,
  setReceipt,
  config,
  selected,
  setSelected,
  go,
  work,
  reload,
  busy,
}: Props) {
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  const success = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = receipt
      ? success.current
      : submitError
        ? feedback.current
        : null;
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [receipt, submitError]);
  return (
    <section className="page-section">
      <span className="eyebrow">YOUR STORY STARTS HERE</span>
      <h1>
        A team worth <em>cheering for.</em>
      </h1>
      {receipt ? (
        <div
          className="registration-success panel"
          ref={success}
          tabIndex={-1}
          role="status"
        >
          <span className="success-icon">
            <Check />
          </span>
          <h2>Welcome, {receipt.name}.</h2>
          <p>
            Your team is registered. Everyone plays under{" "}
            <strong>{receipt.name}</strong>, one person at a time.
          </p>
          <div className="team-receipt">
            <strong>
              {receipt.allowance || config?.attemptsPerTeam || 5} shared
              attempts
            </strong>
            <p>
              Every valid run adds to your team total. Team size and attempts
              are managed separately.
            </p>
            <span>{receipt.players.map((p: any) => p.name).join(" / ")}</span>
          </div>
          <button
            className="primary"
            onClick={() => {
              setCode(receipt.name);
              setReceipt(null);
              go("portal");
            }}
          >
            Continue to team sign in <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <form
          noValidate
          aria-busy={submitting}
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting) return;
            setSubmitError("");
            const f = new FormData(e.currentTarget);
            const name = String(f.get("team") || "").trim();
            const players = String(f.get("players") || "")
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
            const limit = config?.maxRoster || 5;
            const problem =
              name.length < 2 || name.length > 40
                ? "Enter a team name between 2 and 40 characters."
                : !players.length
                  ? "Add at least one player, with each name on its own line."
                  : players.length > limit
                    ? `This league allows up to ${limit} players per team. You entered ${players.length}.`
                    : players.some((p) => p.length < 2 || p.length > 40)
                      ? "Each player name must be between 2 and 40 characters."
                      : new Set(players.map((p) => p.toLowerCase())).size !==
                          players.length
                        ? "Each player needs a different name. Remove duplicate names from the roster."
                        : "";
            if (problem) {
              setSubmitError(problem);
              return;
            }
            setSubmitting(true);
            try {
              const result = await api("/register", "POST", {
                name,
                pokemon: selected,
                players,
              });
              setReceipt(result);
              void reload();
            } catch (error) {
              setSubmitError((error as Error).message);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <div className="registration-grid">
            <div className="panel">
              <span className="step-label">01 / THE CREW</span>
              <label>
                Team name
                <input
                  name="team"
                  required
                  minLength={2}
                  maxLength={40}
                  placeholder="e.g. The Trailblazers"
                />
              </label>
              <label>
                Player roster
                <textarea
                  name="players"
                  required
                  rows={5}
                  placeholder={"One player per line\nAlex\nSam\nJordan"}
                />
              </label>
              <p className="hint">
                1–{config?.maxRoster || 5} players ·{" "}
                {config?.attemptsPerTeam || 5} shared attempts per team. The
                organizer manages roster changes after registration.
              </p>
            </div>
            <div className="panel">
              <span className="step-label">02 / YOUR PARTNER</span>
              <Roster selected={selected} onSelect={setSelected} compact />
            </div>
          </div>
          <div className="registration-feedback" ref={feedback} tabIndex={-1}>
            {submitError && (
              <div className="error" role="alert">
                <strong>Team not registered yet.</strong> {submitError} Your
                entries are still here; correct them and try again.
              </div>
            )}
            {submitting && (
              <p role="status">Creating your team and shared attempt pool...</p>
            )}
            {!config && (
              <p role="status">
                Connecting to the league. Registration will be available when
                the connection is ready.
              </p>
            )}
            {config && !config.registrationOpen && (
              <p role="status">
                Registration is closed. Ask your organizer to reopen it, or use
                an registered team name.
              </p>
            )}
          </div>
          <div className="action-bar">
            <p>
              One team, one shared attempt pool. Every accepted run adds to your
              team total.
            </p>
            <button
              className="primary"
              type="submit"
              disabled={submitting || !config?.registrationOpen}
            >
              {submitting
                ? "Registering…"
                : config?.registrationOpen
                  ? "Make it official"
                  : "Registration closed"}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
