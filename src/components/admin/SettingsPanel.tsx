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
  config: (body: unknown) => Promise<void>;
  busy: boolean;
  attempts: (scope: string, id: string, action: string) => void;
};
export function SettingsPanel({ data, config, busy, attempts }: Props) {
  return (
    <div className="registration-grid">
      <form
        className="panel"
        key={JSON.stringify(data.config)}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void config({
            attemptsPerTeam: Number(f.get("attemptsPerTeam")),
            maxDuration: Number(f.get("maxDuration")),
            maxRoster: Number(f.get("maxRoster")),
            seed: Number(f.get("seed")),
          });
        }}
      >
        <h2>Fair play settings</h2>
        <label>
          Default shared attempts per team (new teams and resets)
          <input
            type="number"
            name="attemptsPerTeam"
            min={1}
            max={100}
            defaultValue={data.config.attemptsPerTeam}
            required
          />
        </label>
        <label>
          Maximum run duration (seconds)
          <input
            type="number"
            name="maxDuration"
            min={15}
            max={3600}
            defaultValue={data.config.maxDuration}
            required
          />
        </label>
        <label>
          Maximum team roster
          <input
            type="number"
            name="maxRoster"
            min={1}
            max={12}
            defaultValue={data.config.maxRoster}
            required
          />
        </label>
        <label>
          Shared world seed
          <input
            type="number"
            name="seed"
            min={1}
            max={2147483647}
            defaultValue={data.config.seed}
            required
          />
        </label>
        <p className="hint">
          Existing sessions keep their settings. Change duration or seed only
          between rounds, when no sessions are active.
        </p>
        <button className="primary" disabled={busy}>
          Save tournament settings <Check size={16} />
        </button>
      </form>
      <div>
        <div className="panel">
          <h2>Registration & results</h2>
          <p>
            Registration is currently{" "}
            <strong>{data.config.registrationOpen ? "open" : "closed"}</strong>.
          </p>
          <button
            className="secondary"
            onClick={() =>
              void config({
                registrationOpen: !data.config.registrationOpen,
              })
            }
          >
            {data.config.registrationOpen
              ? "Close registration"
              : "Open registration"}
          </button>
          <p>
            The public leaderboard is{" "}
            <strong>{data.config.frozen ? "frozen" : "live"}</strong>.
          </p>
          <button
            className="secondary"
            onClick={() => {
              if (
                window.confirm(
                  data.config.frozen
                    ? "Unfreeze results?"
                    : "Freeze the current standings and block new score submissions?",
                )
              )
                void config({ frozen: !data.config.frozen });
            }}
          >
            {data.config.frozen
              ? "Unfreeze leaderboard"
              : "Freeze official leaderboard"}
          </button>
        </div>
        <div className="panel">
          <h2>Attempt management</h2>
          <p>
            Resetting closes active sessions and restores the configured
            allowance. Scores and audit history remain intact.
          </p>
          <button
            className="danger"
            onClick={() => attempts("all", "", "reset")}
          >
            <RotateCcw size={16} /> Reset all attempts
          </button>
        </div>
      </div>
    </div>
  );
}
