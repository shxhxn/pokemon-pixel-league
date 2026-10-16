import { maxTravelPixels } from "../shared/difficulty";
import {
  combatBonus,
  styleBonus,
  validCombat,
  type Foe,
} from "../shared/action";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { Store, id, hash, code, checkPassword } from "./db";
import { ROSTER } from "../shared/roster";
import {
  calculateScore,
  generateChunk,
  RULES,
  WORLD_VERSION,
} from "../shared/world";
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const requireThat = (v: unknown, status: number, m: string) => {
  if (!v) throw new HttpError(status, m);
};
const name = z.string().trim().min(2).max(40);
const teamSchema = z
  .object({
    name,
    pokemon: z
      .number()
      .int()
      .refine((n) => ROSTER.some((p) => p.id === n), "Choose a roster Pokémon"),
    players: z.array(name).min(1).max(12),
  })
  .strict();
const resultSchema = z
  .object({
    distance: z.number().int().min(0).max(1000000),
    coins: z.array(z.string().max(40)).max(25000),
    enemies: z.array(z.string().max(40)).max(6000),
    durationMs: z.number().int().min(0).max(3601000),
    score: z.number().int().min(0).max(20000000),
    combat: z
      .array(
        z
          .object({
            id: z.string().max(40),
            at: z.number().int().min(0),
            chain: z.number().int().min(1).max(6000),
            air: z.boolean(),
            special: z.boolean(),
          })
          .strict(),
      )
      .max(6000)
      .optional(),
    style: z
      .array(
        z
          .object({
            id: z.string().max(40),
            at: z.number().int().min(0),
            kind: z.enum(["dodge", "clean"]),
          })
          .strict(),
      )
      .max(8000)
      .optional(),
  })
  .strict();
export function createApp(store: Store) {
  const app = express(),
    clients = new Set<Response>();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    if (req.path.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin
    ) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host)
          throw new Error();
      } catch {
        return res
          .status(403)
          .json({ error: "Request origin is not allowed." });
      }
    }
    next();
  });
  const broadcast = () => {
    const payload = `data: ${JSON.stringify({ board: store.board(), config: store.config() })}\n\n`;
    for (const c of clients) c.write(payload);
  };
  const auth =
    (role?: string) => (req: Request, res: Response, next: NextFunction) => {
      const token = (req.headers.cookie || "")
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("league="))
        ?.slice(7);
      const a =
        token &&
        store.get(
          "SELECT * FROM auth WHERE tokenHash=? AND expires>?",
          hash(token),
          Date.now(),
        );
      if (
        !a ||
        (role && a.role !== role && !(role === "player" && a.role === "team"))
      )
        return res.status(401).json({
          error: "Sign in with your team name or organizer credentials.",
        });
      res.locals.auth = a;
      next();
    };
  const login = (res: Response, role: string, subject: string) => {
    const token = randomBytes(32).toString("hex");
    store.run("DELETE FROM auth WHERE expires<?", Date.now());
    store.run(
      "INSERT INTO auth VALUES(?,?,?,?)",
      hash(token),
      role,
      subject,
      Date.now() + 12 * 3600000,
    );
    res.cookie("league", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 12 * 3600000,
      path: "/",
    });
  };
  const me = (subject: string) => {
    store.expire();
    const legacy = store.get("SELECT teamId FROM players WHERE id=?", subject);
    const team = store.get(
      "SELECT * FROM teams WHERE id=?",
      legacy?.teamId || subject,
    );
    requireThat(team, 403, "This team is no longer available.");
    const roster = store.all(
      "SELECT id,name FROM players WHERE teamId=? AND active=1",
      team.id,
    );
    return {
      id: team.id,
      role: "team",
      name: team.name,
      teamId: team.id,
      playerId: roster[0]?.id,
      team,
      allowance: team.allowance,
      used: team.used,
      roster,
      session:
        store.get(
          "SELECT * FROM sessions WHERE teamId=? AND status='active' ORDER BY startedAt LIMIT 1",
          team.id,
        ) || null,
      best: store.get(
        "SELECT COALESCE(SUM(score),0) score FROM runs WHERE teamId=? AND valid=1",
        team.id,
      ).score,
      bestRun: store.get(
        "SELECT COALESCE(MAX(score),0) score FROM runs WHERE teamId=? AND valid=1",
        team.id,
      ).score,
      runs: store.all(
        "SELECT id,score,distance,coins,durationMs,createdAt,valid FROM runs WHERE teamId=? ORDER BY createdAt DESC LIMIT 100",
        team.id,
      ),
    };
  };
  const limited = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Try again in 15 minutes." },
  });
  // Successful logins must not exhaust a shared campus/kiosk IP's allowance.
  const loginLimited = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many unsuccessful sign-ins. Try again in 15 minutes.",
    },
  });
  app.get("/api/health", (_q, r) => {
    store.get("SELECT 1");
    r.json({ ok: true });
  });
  app.get("/api/public", (_q, r) =>
    r.json({ config: store.config(), board: store.board(), roster: ROSTER }),
  );
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write("retry: 3000\n\n");
    clients.add(res);
    const timer = setInterval(() => res.write(": heartbeat\n\n"), 20000);
    req.on("close", () => {
      clearInterval(timer);
      clients.delete(res);
    });
  });
  app.get("/api/teams/:id/runs", (req, res) =>
    res.json(
      store.all(
        "SELECT score,distance,coins,durationMs,createdAt FROM runs WHERE teamId=? AND valid=1 ORDER BY createdAt DESC",
        req.params.id,
      ),
    ),
  );
  app.post("/api/register", limited, (req, res) => {
    const d = teamSchema.parse(req.body),
      c = store.config();
    requireThat(
      c.registrationOpen,
      409,
      "Registration is closed. Contact the organizer.",
    );
    requireThat(
      d.players.length <= c.maxRoster,
      400,
      `Maximum ${c.maxRoster} players per team.`,
    );
    requireThat(
      new Set(d.players.map((x) => x.toLowerCase())).size === d.players.length,
      400,
      "Player names must be distinct within a team.",
    );
    const t = store.createTeam(d.name, d.pokemon, d.players);
    store.audit("registration", "team.create", t.id, { name: t.name });
    broadcast();
    res.status(201).json(t);
  });
  app.post("/api/login", loginLimited, (req, res) => {
    const d = z
      .object({
        teamName: z.string().trim().min(1).max(40).optional(),
        code: z.string().trim().min(1).max(100).optional(),
      })
      .parse(req.body);
    const legacy =
      d.code &&
      store.get(
        "SELECT teamId FROM players WHERE codeHash=? AND active=1",
        hash(d.code.toUpperCase()),
      );
    const team = d.teamName
      ? store.get(
          "SELECT id FROM teams WHERE name=? COLLATE NOCASE",
          d.teamName,
        )
      : legacy && { id: legacy.teamId };
    requireThat(
      team,
      401,
      "Team not found. Enter the registered team name, or register your team first.",
    );
    login(res, "team", team.id);
    res.json(me(team.id));
  });
  app.post("/api/admin/login", loginLimited, (req, res) => {
    const d = z
        .object({ username: z.string().max(80), password: z.string().max(200) })
        .parse(req.body),
      a = store.get("SELECT * FROM admins WHERE username=?", d.username);
    requireThat(
      a && checkPassword(d.password, a.passwordHash),
      401,
      "Organizer credentials are incorrect.",
    );
    login(res, "admin", a.id);
    res.json({ ok: true });
  });
  app.post("/api/logout", (req, res) => {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("league="))
      ?.slice(7);
    if (token) store.run("DELETE FROM auth WHERE tokenHash=?", hash(token));
    res.clearCookie("league", { path: "/" });
    res.json({ ok: true });
  });
  app.get("/api/me", auth(), (_req, res) =>
    res.json(
      res.locals.auth.role === "admin"
        ? { role: "admin" }
        : me(res.locals.auth.subject),
    ),
  );
  app.post("/api/sessions", auth("player"), (_req, res) => {
    const session = store.tx(() => {
      store.expire();
      const p = me(res.locals.auth.subject),
        c = store.config();
      requireThat(
        c.status === "active" && !c.frozen,
        409,
        "The tournament is not running. The organizer must start or resume it.",
      );
      requireThat(!p.team.disqualified, 403, "This team is disqualified.");
      requireThat(
        !p.session,
        409,
        "An attempt is already active. Return to your portal to resolve it.",
      );
      requireThat(
        p.used < p.allowance,
        409,
        "No attempts remaining. Contact the organizer.",
      );
      const s = {
        id: id(),
        playerId: p.playerId,
        teamId: p.teamId,
        pokemon: p.team.pokemon,
        seed: c.seed,
        maxDuration: c.maxDuration,
        startedAt: Date.now(),
        worldVersion: WORLD_VERSION,
      };
      requireThat(
        p.playerId,
        409,
        "Add at least one team member before starting.",
      );
      store.run("UPDATE teams SET used=used+1 WHERE id=?", p.teamId);
      store.run(
        "INSERT INTO sessions(id,playerId,teamId,pokemon,seed,maxDuration,startedAt,worldVersion) VALUES(?,?,?,?,?,?,?,?)",
        s.id,
        s.playerId,
        s.teamId,
        s.pokemon,
        s.seed,
        s.maxDuration,
        s.startedAt,
        s.worldVersion,
      );
      return s;
    });
    broadcast();
    res.status(201).json(session);
  });
  app.post("/api/sessions/:id/abandon", auth("player"), (req, res) => {
    const s = store.get(
      "SELECT * FROM sessions WHERE id=? AND teamId=?",
      req.params.id,
      me(res.locals.auth.subject).teamId,
    );
    requireThat(s, 404, "Session not found.");
    requireThat(s.status === "active", 409, "Session already closed.");
    store.run("UPDATE sessions SET status='abandoned' WHERE id=?", s.id);
    broadcast();
    res.json({ ok: true });
  });
  app.post("/api/sessions/:id/result", auth("player"), (req, res) => {
    const d = resultSchema.parse(req.body),
      body = JSON.stringify(d);
    const result = store.tx(() => {
      const s = store.get(
        "SELECT * FROM sessions WHERE id=? AND teamId=?",
        req.params.id,
        me(res.locals.auth.subject).teamId,
      );
      requireThat(s, 404, "Session not found.");
      const old = store.get("SELECT * FROM runs WHERE sessionId=?", s.id);
      if (old) {
        requireThat(
          old.body === body,
          409,
          "This session already has a different result.",
        );
        return {
          accepted: true,
          score: old.score,
          runId: old.id,
          duplicate: true,
        };
      }
      requireThat(s.status === "active", 409, "This attempt is closed.");
      const c = store.config();
      requireThat(
        !c.frozen && c.status !== "finished",
        409,
        "Results are closed or frozen.",
      );
      requireThat(
        !store.get("SELECT disqualified FROM teams WHERE id=?", s.teamId)
          .disqualified,
        403,
        "Team is disqualified.",
      );
      const elapsed = Date.now() - s.startedAt;
      requireThat(
        elapsed <= (s.maxDuration + 300) * 1000,
        422,
        "Submission window expired. Contact the organizer.",
      );
      requireThat(
        d.durationMs <= elapsed + 1500 &&
          d.durationMs <= s.maxDuration * 1000 + 1000,
        422,
        "Run time is not plausible.",
      );
      requireThat(
        d.distance <=
          Math.ceil((maxTravelPixels(d.durationMs, s.worldVersion) + 16) / 10),
        422,
        "Distance exceeds the movement limit.",
      );
      requireThat(
        new Set(d.coins).size === d.coins.length &&
          new Set(d.enemies).size === d.enemies.length,
        422,
        "Duplicate scoring events.",
      );
      for (const [kind, events] of [
        ["coins", d.coins],
        ["enemies", d.enemies],
      ] as const) {
        for (const event of events) {
          const idx = Number(event.split(":")[0]);
          requireThat(
            Number.isInteger(idx) &&
              idx >= 0 &&
              idx <=
                Math.ceil(
                  (d.distance * 10 +
                    (s.worldVersion >= 5
                      ? 470
                      : s.worldVersion >= 4
                        ? 360
                        : 100)) /
                    768,
                ),
            422,
            "Invalid world event.",
          );
          const item = generateChunk(s.seed, idx, s.worldVersion)[kind].find(
            (i) => i.id === event,
          );
          requireThat(
            item &&
              item.x - (item.range || 0) <=
                96 +
                  d.distance * 10 +
                  (s.worldVersion >= 4
                    ? kind === "enemies"
                      ? s.worldVersion >= 5
                        ? 440
                        : 330
                      : 100
                    : 32),
            422,
            "Unreachable scoring event.",
          );
        }
      }
      if (d.combat)
        requireThat(
          s.worldVersion >= 5 && validCombat(d.combat, d.enemies, d.durationMs),
          422,
          "Invalid combat sequence.",
        );
      if (d.combat)
        for (const event of d.combat) {
          const foe = generateChunk(
            s.seed,
            Number(event.id.split(":")[0]),
            s.worldVersion,
          ).enemies.find((e) => e.id === event.id);
          requireThat(
            foe &&
              foe.x - (foe.range || 0) <=
                96 + maxTravelPixels(event.at, s.worldVersion) + 440,
            422,
            "Combat happened before the enemy was reachable.",
          );
        }
      if (d.style) {
        requireThat(
          s.worldVersion >= 5 &&
            new Set(d.style.map((e) => e.id)).size === d.style.length,
          422,
          "Invalid style rewards.",
        );
        for (const event of d.style) {
          const index = Number(event.id.split(":")[0]);
          requireThat(
            Number.isInteger(index) && index >= 0 && event.at <= d.durationMs,
            422,
            "Invalid style event.",
          );
          if (event.kind === "clean")
            requireThat(
              index > 0 &&
                event.id === `${index}:clean` &&
                index * 200 <= d.distance &&
                index * 2000 <= maxTravelPixels(event.at, s.worldVersion) + 16,
              422,
              "Unreachable clean section.",
            );
          else {
            const foe = generateChunk(
              s.seed,
              index,
              s.worldVersion,
            ).enemies.find((e) => e.id === event.id);
            requireThat(
              foe &&
                foe.x <= 96 + d.distance * 10 + 440 &&
                foe.x <= 96 + maxTravelPixels(event.at, s.worldVersion) + 440,
              422,
              "Unreachable dodge event.",
            );
          }
        }
      }
      const bonus =
        (d.style ? styleBonus(d.style) : 0) +
        (d.combat
          ? combatBonus(
              d.combat,
              (id) =>
                generateChunk(
                  s.seed,
                  Number(id.split(":")[0]),
                  s.worldVersion,
                ).enemies.find((e) => e.id === id)?.kind as Foe,
            )
          : 0);
      const score =
        bonus + calculateScore(d.distance, d.coins.length, d.enemies.length);
      requireThat(
        score === d.score,
        422,
        "Score does not match the scoring rules.",
      );
      const rid = id();
      store.run(
        "INSERT INTO runs(id,sessionId,teamId,playerId,score,distance,coins,enemies,durationMs,createdAt,body) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        rid,
        s.id,
        s.teamId,
        s.playerId,
        score,
        d.distance,
        d.coins.length,
        d.enemies.length,
        d.durationMs,
        Date.now(),
        body,
      );
      store.run("UPDATE sessions SET status='completed' WHERE id=?", s.id);
      return { accepted: true, score, runId: rid, duplicate: false };
    });
    broadcast();
    res.json({ ...result, player: me(res.locals.auth.subject) });
  });
  app.use("/api/admin", auth("admin"));
  app.get("/api/admin/teams/:id/runs", (req, res) =>
    res.json(
      store.all(
        "SELECT r.*,CASE WHEN s.worldVersion>=4 THEN 'Shared team attempt' ELSE p.name END playerName,t.name teamName FROM runs r JOIN sessions s ON s.id=r.sessionId JOIN players p ON p.id=r.playerId JOIN teams t ON t.id=r.teamId WHERE r.teamId=? ORDER BY r.createdAt DESC",
        req.params.id,
      ),
    ),
  );
  app.get("/api/admin/overview", (_req, res) => {
    store.expire();
    res.json({
      config: store.config(),
      teams: store.all("SELECT * FROM teams ORDER BY createdAt"),
      players: store.all(
        "SELECT id,teamId,name,allowance,used,active FROM players",
      ),
      runs: store.all(
        "SELECT r.*,CASE WHEN s.worldVersion>=4 THEN 'Shared team attempt' ELSE p.name END playerName,t.name teamName FROM runs r JOIN sessions s ON s.id=r.sessionId JOIN players p ON p.id=r.playerId JOIN teams t ON t.id=r.teamId ORDER BY r.createdAt DESC LIMIT 500",
      ),
      sessions: store.all(
        "SELECT * FROM sessions ORDER BY startedAt DESC LIMIT 100",
      ),
      audit: store.all("SELECT * FROM audit ORDER BY createdAt DESC LIMIT 100"),
      board: store.board(true),
    });
  });
  app.patch("/api/admin/config", (req, res) => {
    const d = z
      .object({
        status: z
          .enum(["registration", "ready", "active", "paused", "finished"])
          .optional(),
        registrationOpen: z.boolean().optional(),
        attemptsPerPlayer: z.number().int().min(1).max(20).optional(),
        attemptsPerTeam: z.number().int().min(1).max(100).optional(),
        maxDuration: z.number().int().min(15).max(3600).optional(),
        maxRoster: z.number().int().min(1).max(12).optional(),
        seed: z.number().int().min(1).max(2147483647).optional(),
        frozen: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    store.tx(() => {
      const c = store.config();
      if (
        (d.seed !== undefined || d.maxDuration !== undefined) &&
        store.get("SELECT id FROM sessions WHERE status='active'")
      )
        throw new HttpError(
          409,
          "Wait for active sessions before changing gameplay settings.",
        );
      if (d.frozen === true && !c.frozen)
        store.run(
          "UPDATE config SET frozenBoard=? WHERE id=1",
          JSON.stringify(store.board(true)),
        );
      for (const [key, v] of Object.entries(d))
        store.run(
          `UPDATE config SET ${key}=? WHERE id=1`,
          typeof v === "boolean" ? Number(v) : v,
        );
      store.audit(res.locals.auth.subject, "config.update", "tournament", d);
    });
    broadcast();
    res.json(store.config());
  });
  app.post("/api/admin/teams", (req, res) => {
    const d = teamSchema.parse(req.body);
    requireThat(
      d.players.length <= store.config().maxRoster,
      400,
      "Roster limit exceeded.",
    );
    const t = store.createTeam(d.name, d.pokemon, d.players);
    store.audit(res.locals.auth.subject, "team.create", t.id, { name: t.name });
    broadcast();
    res.status(201).json(t);
  });
  app.patch("/api/admin/teams/:id", (req, res) => {
    const d = z
      .object({
        name: name.optional(),
        pokemon: teamSchema.shape.pokemon.optional(),
        disqualified: z.boolean().optional(),
        allowance: z.number().int().min(0).max(100).optional(),
      })
      .strict()
      .parse(req.body);
    requireThat(
      store.get("SELECT id FROM teams WHERE id=?", req.params.id),
      404,
      "Team not found.",
    );
    store.tx(() => {
      for (const [key, v] of Object.entries(d))
        store.run(
          `UPDATE teams SET ${key}=? WHERE id=?`,
          typeof v === "boolean" ? Number(v) : v,
          req.params.id,
        );
      store.audit(
        res.locals.auth.subject,
        "team.update",
        String(req.params.id),
        d,
      );
    });
    broadcast();
    res.json({ ok: true });
  });
  app.post("/api/admin/teams/:id/players", (req, res) => {
    const d = z.object({ name }).parse(req.body),
      accessCode = code(),
      pid = id();
    store.tx(() => {
      requireThat(
        store.get("SELECT id FROM teams WHERE id=?", req.params.id),
        404,
        "Team not found.",
      );
      requireThat(
        store.get(
          "SELECT COUNT(*) n FROM players WHERE teamId=? AND active=1",
          req.params.id,
        ).n < store.config().maxRoster,
        409,
        "Roster is full.",
      );
      store.run(
        "INSERT INTO players(id,teamId,name,codeHash,allowance) VALUES(?,?,?,?,?)",
        pid,
        req.params.id,
        d.name,
        hash(accessCode),
        store.config().attemptsPerPlayer,
      );
      store.audit(res.locals.auth.subject, "player.add", pid, {
        team: req.params.id,
        name: d.name,
      });
    });
    broadcast();
    res.json({ id: pid, accessCode });
  });
  app.patch("/api/admin/players/:id", (req, res) => {
    const d = z
      .object({
        name: name.optional(),
        active: z.boolean().optional(),
        rotateCode: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    let accessCode: string | undefined;
    store.tx(() => {
      requireThat(
        store.get("SELECT id FROM players WHERE id=?", req.params.id),
        404,
        "Player not found.",
      );
      if (d.name)
        store.run(
          "UPDATE players SET name=? WHERE id=?",
          d.name,
          req.params.id,
        );
      if (d.active !== undefined)
        store.run(
          "UPDATE players SET active=? WHERE id=?",
          Number(d.active),
          req.params.id,
        );
      if (d.rotateCode) {
        accessCode = code();
        store.run(
          "UPDATE players SET codeHash=? WHERE id=?",
          hash(accessCode),
          req.params.id,
        );
      }
      if (d.rotateCode || d.active === false) {
        store.run("DELETE FROM auth WHERE subject=?", req.params.id);
        store.run(
          "UPDATE sessions SET status='abandoned' WHERE playerId=? AND status='active'",
          req.params.id,
        );
      }
      store.audit(
        res.locals.auth.subject,
        "player.update",
        String(req.params.id),
        d,
      );
    });
    broadcast();
    res.json({ ok: true, accessCode });
  });
  app.post("/api/admin/attempts", (req, res) => {
    const d = z
      .object({
        scope: z.enum(["player", "team", "all"]),
        id: z.string().optional(),
        action: z.enum(["reset", "grant"]),
        amount: z.number().int().min(1).max(20).default(1),
        reason: z.string().trim().min(3).max(200),
      })
      .strict()
      .parse(req.body);
    requireThat(d.scope === "all" || d.id, 400, "Choose a player or team.");
    store.tx(() => {
      const teamId =
        d.scope === "player"
          ? store.get("SELECT teamId FROM players WHERE id=?", d.id)?.teamId
          : d.id;
      const teams =
        d.scope === "all"
          ? store.all("SELECT id FROM teams")
          : store.all("SELECT id FROM teams WHERE id=?", teamId || "");
      requireThat(teams.length, 404, "No matching teams.");
      for (const team of teams) {
        if (d.action === "reset") {
          store.run(
            "UPDATE sessions SET status='abandoned' WHERE teamId=? AND status='active'",
            team.id,
          );
          store.run(
            "UPDATE teams SET used=0,allowance=? WHERE id=?",
            store.config().attemptsPerTeam,
            team.id,
          );
        } else
          store.run(
            "UPDATE teams SET allowance=allowance+? WHERE id=?",
            d.amount,
            team.id,
          );
      }
      store.audit(
        res.locals.auth.subject,
        `attempts.${d.action}`,
        d.id || "all",
        d,
      );
    });
    broadcast();
    res.json({ ok: true });
  });
  app.patch("/api/admin/runs/:id", (req, res) => {
    const d = z
      .object({
        valid: z.boolean().optional(),
        flagged: z.boolean().optional(),
        reason: z.string().trim().min(3).max(300),
      })
      .strict()
      .parse(req.body);
    requireThat(
      !store.config().frozen,
      409,
      "Unfreeze the leaderboard before correcting scores.",
    );
    requireThat(
      store.get("SELECT id FROM runs WHERE id=?", req.params.id),
      404,
      "Run not found.",
    );
    store.tx(() => {
      if (d.valid !== undefined)
        store.run(
          "UPDATE runs SET valid=? WHERE id=?",
          Number(d.valid),
          req.params.id,
        );
      if (d.flagged !== undefined)
        store.run(
          "UPDATE runs SET flagged=? WHERE id=?",
          Number(d.flagged),
          req.params.id,
        );
      store.run("UPDATE runs SET reason=? WHERE id=?", d.reason, req.params.id);
      store.audit(
        res.locals.auth.subject,
        "run.review",
        String(req.params.id),
        d,
      );
    });
    broadcast();
    res.json({ ok: true });
  });
  app.get("/api/admin/export", (_req, res) => {
    const csv = (x: unknown) =>
      '"' +
      String(x ?? "")
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    res
      .type("text/csv")
      .attachment("pixel-league-results.csv")
      .send(
        [
          "Rank,Team,Pokemon,Score,Players,Used,Remaining",
          ...store
            .board()
            .map((t: any) =>
              [
                t.rank,
                t.name,
                ROSTER.find((p) => p.id === t.pokemon)?.name,
                t.score,
                t.players,
                t.used,
                t.remaining,
              ]
                .map(csv)
                .join(","),
            ),
        ].join("\r\n"),
      );
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  app.use(express.static(resolve("dist")));
  app.get("/{*splat}", (_req, res) => res.sendFile(resolve("dist/index.html")));
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError)
      return res
        .status(400)
        .json({ error: err.issues.map((i) => i.message).join(" ") });
    if (String(err.message).includes("UNIQUE constraint failed: teams.name"))
      return res
        .status(409)
        .json({ error: "That team name is already registered." });
    const status =
      err instanceof HttpError ? err.status : 400 === err.status ? 400 : 500;
    if (status === 500) console.error(err);
    res.status(status).json({
      error:
        status === 500
          ? "Server error. Please retry or contact the organizer."
          : err.message,
    });
  });
  return app;
}
