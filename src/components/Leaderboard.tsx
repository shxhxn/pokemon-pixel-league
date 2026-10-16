import { useState } from "react";
import { Trophy, ArrowUpRight, Users } from "lucide-react";
import { pokemon } from "../../shared/roster";
import { api, type Team } from "../api";
export function Leaderboard({
  board,
  full = false,
  frozen = false,
  dashboard = false,
}: {
  board: Team[];
  full?: boolean;
  frozen?: boolean;
  dashboard?: boolean;
}) {
  const [runs, setRuns] = useState<any[] | null>(null),
    [name, setName] = useState(""),
    [error, setError] = useState("");
  const hasScores = board.some((t) => t.score > 0);
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE CHASE IS ON</span>
          <h2>{full ? "League standings" : "The leaderboard"}</h2>
        </div>
        <span className="live">
          <span className="status-dot" />
          {frozen ? "FROZEN RESULTS" : "LIVE STANDINGS"}
        </span>
      </div>
      {full && !dashboard && hasScores && (
        <div className="podium">
          {board.slice(0, 3).map((t, i) => (
            <div className={"podium-card place-" + i} key={t.id}>
              <span className="eyebrow">
                {i === 0 ? "LEAGUE LEADER" : `RANK 0${i + 1}`}
              </span>
              <img
                src={pokemon(t.pokemon).image}
                alt={pokemon(t.pokemon).name}
              />
              <h3>{t.name}</h3>
              <strong>{t.score.toLocaleString()}</strong>
              <small>POINTS</small>
            </div>
          ))}
        </div>
      )}
      <div className="leaderboard-table">
        <div className="table-row table-head">
          <span>RANK</span>
          <span>TEAM / PARTNER</span>
          <span>PLAYERS</span>
          <span>ATTEMPTS</span>
          <span>TEAM TOTAL</span>
        </div>
        {(full ? board : board.slice(0, 5)).map((t, i) => (
          <button
            className="table-row"
            key={t.id}
            onClick={async () => {
              setName(t.name);
              try {
                setRuns(await api(`/teams/${t.id}/runs`));
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <span className={"rank rank-" + i}>
              {i === 0 && t.score > 0 ? (
                <Trophy size={19} />
              ) : (
                String(i + 1).padStart(2, "0")
              )}
            </span>
            <span className="team-cell">
              <img src={pokemon(t.pokemon).image} alt="" />
              <span>
                <strong>{t.name}</strong>
                <small>{pokemon(t.pokemon).name}</small>
              </span>
            </span>
            <span className="muted">
              <Users size={14} /> {t.players}
            </span>
            <span className="muted">
              {t.used} used · {t.remaining} left
            </span>
            <strong className="table-score">
              {t.score ? t.score.toLocaleString() : "—"}{" "}
              <ArrowUpRight size={14} />
            </strong>
          </button>
        ))}
        {!board.length && (
          <div className="empty">
            The league is waiting for its first team. Register to claim your
            place.
          </div>
        )}
        {board.length > 0 && !hasScores && (
          <p className="table-foot">
            A fresh starting line. Rankings take shape after the first accepted
            run.
          </p>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {runs && (
        <div className="modal-backdrop">
          <div className="modal">
            <button
              className="close"
              onClick={() => setRuns(null)}
              aria-label="Close run history"
            >
              ×
            </button>
            <span className="eyebrow">ACCEPTED RUNS / ALL SCORES COUNT</span>
            <h2>{name}</h2>
            {runs.length ? (
              runs.map((r, i) => (
                <div className="history-row" key={i}>
                  <span>{new Date(r.createdAt).toLocaleString()}</span>
                  <span>
                    {r.distance} m · {r.coins} coins
                  </span>
                  <strong>{r.score.toLocaleString()} pts</strong>
                </div>
              ))
            ) : (
              <p className="empty">
                No accepted runs yet. Your first adventure starts here.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
