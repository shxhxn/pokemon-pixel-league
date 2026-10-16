import { Portal } from "./pages/Portal";
import { PixelBackground } from "./components/PixelBackground";
import { Registration } from "./pages/Registration";
import { Home } from "./pages/Home";
import { savePending, clearPending, readPending } from "./pendingResult";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Gamepad2,
  Trophy,
  Shield,
  Leaf,
  ChevronRight,
  Users,
  Infinity as InfinityIcon,
  Clock,
  Check,
  LogOut,
  Copy,
  Play,
  Flag,
} from "lucide-react";
import { api, type Config, type Team, type Session } from "./api";
import { pokemon, ROSTER } from "../shared/roster";
import { Roster } from "./components/Roster";
import { Scenery } from "./components/Scenery";
import { Leaderboard } from "./components/Leaderboard";
import type { RunResult } from "../shared/world";
import { Admin } from "./components/Admin";
const Game = lazy(() =>
  import("./game/Game").then((m) => ({ default: m.Game })),
);
export type Page =
  | "home"
  | "register"
  | "roster"
  | "leaderboard"
  | "portal"
  | "admin"
  | "play"
  | "result";
export default function App() {
  const [page, setPage] = useState<Page>("home"),
    [data, setData] = useState<{ config: Config; board: Team[] } | null>(null),
    [me, setMe] = useState<any>(null),
    [selected, setSelected] = useState(25),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState(""),
    [receipt, setReceipt] = useState<any>(null),
    [session, setSession] = useState<Session | null>(null),
    [practice, setPractice] = useState(false),
    [result, setResult] = useState<RunResult | null>(null),
    [submission, setSubmission] = useState(""),
    [confirm, setConfirm] = useState(false),
    [connected, setConnected] = useState(false);
  const reload = async () => {
    try {
      setData(await api("/public"));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void reload();
    api("/me")
      .then(setMe)
      .catch(() => {});
    const es = new EventSource("/api/events");
    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      setData(JSON.parse(e.data));
      setConnected(true);
    };
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);
  const go = (p: Page) => {
    if (
      page === "play" &&
      !practice &&
      p !== "result" &&
      !window.confirm("Leave this official run? Your attempt stays consumed.")
    )
      return;
    if (p === "portal" && me)
      api("/me")
        .then(setMe)
        .catch(() => setMe(null));
    setError("");
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const work = async (f: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await f();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const startPractice = (character: number = selected) => {
    setPractice(true);
    setSession({
      id: "practice",
      pokemon: character,
      seed: (data?.config.seed || 20261013) + Math.floor(Math.random() * 10000),
      maxDuration: 600,
      startedAt: Date.now(),
    });
    setResult(null);
    setSubmission("");
    go("play");
  };
  const startOfficial = () =>
    work(async () => {
      const s = await api("/sessions", "POST");
      setSession(s);
      setPractice(false);
      setResult(null);
      setSubmission("");
      setConfirm(false);
      go("play");
      setMe(await api("/me"));
    });
  const submit = async (r: RunResult, s: Session) => {
    setSubmission("Submitting your result…");
    try {
      const response = await api(`/sessions/${s.id}/result`, "POST", r);
      setSubmission("Accepted · Your result is on the official leaderboard.");
      setMe(response.player);
      clearPending();
      await reload();
    } catch (e) {
      setSubmission("Not submitted · " + (e as Error).message);
    }
  };
  const finish = (r: RunResult) => {
    setResult(r);
    go("result");
    if (practice)
      setSubmission("Practice complete · No tournament attempt used.");
    else if (session) {
      savePending(session, r);
      void submit(r, session);
    }
  };
  const login = () =>
    work(async () => {
      const identity = await api("/login", "POST", { teamName: code });
      setMe(identity);
      setCode("");
      const pending = readPending(identity.id);
      if (pending) {
        try {
          const p = pending;
          setSession(p.session);
          setResult(p.result);
          setPractice(false);
          setSubmission("Unsubmitted result recovered. Retry to record it.");
          go("result");
          return;
        } catch {
          clearPending();
        }
      }
      go("portal");
    });
  useEffect(() => {
    if (page !== "play" || practice) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [page, practice]);
  const config = data?.config;
  return (
    <>
      <PixelBackground />
      <header className="site-header">
        <button
          className="brand"
          onClick={() => go("home")}
          aria-label="Pixel League home"
        >
          <span className="pokeball" />
          <span>
            POKÉMON<span>PIXEL LEAGUE</span>
          </span>
        </button>
        <nav aria-label="Main navigation">
          {(
            [
              ["home", "Home"],
              ["roster", "Choose partner"],
              ["leaderboard", "Leaderboard"],
            ] as [Page, string][]
          ).map(([p, label]) => (
            <button
              className={page === p ? "nav-active" : ""}
              key={p}
              onClick={() => go(p)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <span className="season">CAMPUS ARCADE / 01</span>
          <button
            className="header-portal"
            onClick={() => go(me?.role === "admin" ? "admin" : "portal")}
          >
            {me && me.role !== "admin" ? me.team.name : "Team portal"}{" "}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </header>
      <main>
        {error && (
          <div className="error global-error" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}
        {page === "home" && (
          <Home
            data={data}
            config={config}
            me={me}
            selected={selected}
            setSelected={setSelected}
            go={go}
            startPractice={startPractice}
          />
        )}
        {page === "roster" && (
          <section className="page-section">
            <div className="page-title">
              <div>
                <span className="eyebrow">THE PARTNER COLLECTION / 38</span>
                <h1>
                  Choose your <em>kind of magic.</em>
                </h1>
                <p>
                  Every partner shares the same movement, hitbox, and scoring.
                  Personality is the difference.
                </p>
              </div>
              <img
                className="selected-portrait"
                src={pokemon(selected).image}
                alt={pokemon(selected).name}
              />
            </div>
            <Roster selected={selected} onSelect={setSelected} />
            <div className="action-bar">
              <span>
                <strong>{pokemon(selected).name}</strong> is ready for the
                adventure.
              </span>
              <div className="row">
                <button className="secondary" onClick={() => startPractice()}>
                  Try in practice <Gamepad2 size={16} />
                </button>
                <button className="primary" onClick={() => go("register")}>
                  Register with this partner <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>
        )}
        {page === "register" && (
          <Registration
            setCode={setCode}
            receipt={receipt}
            setReceipt={setReceipt}
            config={config}
            selected={selected}
            setSelected={setSelected}
            go={go}
            work={work}
            reload={reload}
            busy={busy}
          />
        )}
        {page === "portal" && (
          <Portal
            me={me}
            setMe={setMe}
            config={config}
            code={code}
            setCode={setCode}
            login={login}
            busy={busy}
            go={go}
            work={work}
            setError={setError}
            setSession={setSession}
            setResult={setResult}
            setPractice={setPractice}
            setSubmission={setSubmission}
            setConfirm={setConfirm}
            setSelected={setSelected}
            startPractice={startPractice}
          />
        )}
        {page === "leaderboard" && (
          <section className="page-section">
            <span className="eyebrow">CAMPUS ARCADE / SEASON 01</span>
            <h1>
              A place among <em>legends.</em>
            </h1>
            <p className="page-description">
              Every accepted attempt adds to your team's total. Take turns using
              your shared allowance. Ties go to the team that reached its total
              first.
            </p>
            <Leaderboard
              full
              board={data?.board || []}
              frozen={!!config?.frozen}
            />
          </section>
        )}
        {page === "play" && session && (
          <section className="page-section">
            <Suspense
              fallback={<div className="empty">Loading the game engine…</div>}
            >
              <Game
                onExit={() => go(practice ? "roster" : "portal")}
                key={session.id + session.startedAt}
                teamName={practice ? "Free play" : me?.team.name || "Trainer"}
                options={{
                  ...session,
                  practice,
                  onFinish: finish,
                  onHud: () => {},
                  onReady: () => {},
                  onError: setError,
                }}
              />
            </Suspense>
          </section>
        )}
        {page === "result" && result && session && (
          <section className="page-section result-page">
            <div className="result-card">
              <span className="eyebrow">
                {practice
                  ? "A LITTLE PRACTICE. A LITTLE MAGIC."
                  : "ONE FOR THE STORYBOOKS."}
              </span>
              <img
                src={pokemon(session.pokemon).image}
                alt={pokemon(session.pokemon).name}
              />
              <h1>
                What a <em>run.</em>
              </h1>
              <div className="final-score">
                {result.score.toLocaleString()}
                <small>POINTS</small>
              </div>
              <div className="result-metrics">
                <span>
                  <strong>{result.distance} m</strong>Distance
                </span>
                <span>
                  <strong>{result.coins.length}</strong>Coins
                </span>
                <span>
                  <strong>{(result.durationMs / 1000).toFixed(1)} s</strong>Time
                  survived
                </span>
              </div>
              <div
                className={
                  "submission " +
                  (submission.startsWith("Accepted") ? "success" : "")
                }
                role="status"
              >
                {submission}
              </div>
              {!practice && !submission.startsWith("Accepted") && (
                <button
                  className="secondary"
                  onClick={() => void submit(result, session)}
                >
                  Retry submission
                </button>
              )}
              {!practice && me && (
                <p>
                  Team total: {me.best} pts · Attempts left:{" "}
                  {Math.max(0, me.allowance - me.used)}
                </p>
              )}
              <div className="row center">
                <button
                  className="primary"
                  onClick={() => (practice ? startPractice() : go("portal"))}
                >
                  {practice ? "Run it again" : "Return to your portal"}{" "}
                  <ArrowRight size={16} />
                </button>
                <button className="secondary" onClick={() => go("leaderboard")}>
                  View standings <Trophy size={16} />
                </button>
              </div>
            </div>
          </section>
        )}
        {page === "admin" && (
          <Admin
            onChange={reload}
            onLogin={() => setMe({ role: "admin" })}
            onLogout={() => setMe(null)}
          />
        )}
      </main>
      <footer>
        <div className="footer-brand">
          <span className="pokeball" />
          <strong>POKÉMON PIXEL LEAGUE</strong>
          <span>Made for the love of the game.</span>
        </div>
        <div className="row">
          <span className="connection">
            <span className={"status-dot " + (!connected ? "offline" : "")} />
            {connected ? "League connected" : "Reconnecting to league"}
          </span>
          <a href="/assets/motion/credits.txt" target="_blank" rel="noreferrer">
            Sprite credits
          </a>
          <button onClick={() => go("admin")}>
            <Shield size={14} /> Organizer
          </button>
        </div>
        <p>
          Unofficial fan project. Pokémon belongs to its respective rights
          holders.
        </p>
      </footer>
      {confirm && (
        <div className="modal-backdrop">
          <div className="modal">
            <button
              className="close"
              aria-label="Close attempt confirmation"
              onClick={() => setConfirm(false)}
            >
              ×
            </button>
            <span className="eyebrow">ONE ATTEMPT. YOUR BEST SHOT.</span>
            <h2>Ready, {me?.name}?</h2>
            <p>
              Starting consumes one of your{" "}
              {Math.max(0, (me?.allowance || 0) - (me?.used || 0))} remaining
              team attempts. Refreshing or disconnecting will not restore it.
            </p>
            <div className="control-guide">
              <span>
                <kbd>A</kbd>
                <kbd>D</kbd> or arrows to move
              </span>
              <span>
                <kbd>SPACE</kbd>
                <kbd>W</kbd>
                <kbd>↑</kbd> to jump
              </span>
            </div>
            <p>
              Collect coins (+25), defeat enemies (50–1,800 before bonuses), and
              travel further (+10/m). You have 3 hearts and{" "}
              {config?.maxDuration} seconds. Official runs cannot pause.
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void startOfficial()}
            >
              {busy ? "Reserving attempt…" : "Let’s adventure"}
              <Flag size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
