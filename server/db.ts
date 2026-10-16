import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
export const id = () => randomUUID();
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const code = () => randomBytes(8).toString("hex").toUpperCase();
export function passwordHash(p: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
}
export function checkPassword(p: string, h: string) {
  const [salt, key] = h.split(":");
  return timingSafeEqual(scryptSync(p, salt, 64), Buffer.from(key, "hex"));
}
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    this.db.exec(
      readFileSync(
        new URL("./migrations/001_initial.sql", import.meta.url),
        "utf8",
      ),
    );
    if (
      !this.all("PRAGMA table_info(sessions)").some(
        (column) => column.name === "worldVersion",
      )
    ) {
      this.db.exec(
        readFileSync(
          new URL("./migrations/002_world_version.sql", import.meta.url),
          "utf8",
        ),
      );
    }
    if (
      !this.all("PRAGMA table_info(teams)").some(
        (column) => column.name === "allowance",
      )
    ) {
      this.tx(() =>
        this.db.exec(
          readFileSync(
            new URL("./migrations/003_team_pool.sql", import.meta.url),
            "utf8",
          ),
        ),
      );
      if (this.config().frozen)
        this.run(
          "UPDATE config SET frozenBoard=? WHERE id=1",
          JSON.stringify(this.board(true)),
        );
    }
  }
  get(sql: string, ...args: any[]): any {
    return this.db.prepare(sql).get(...args);
  }
  all(sql: string, ...args: any[]): any[] {
    return this.db.prepare(sql).all(...args);
  }
  run(sql: string, ...args: any[]) {
    return this.db.prepare(sql).run(...args);
  }
  tx<T>(f: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const v = f();
      this.db.exec("COMMIT");
      return v;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  config() {
    return this.get("SELECT * FROM config WHERE id=1");
  }
  audit(actor: string, action: string, target: string, detail: unknown) {
    this.run(
      "INSERT INTO audit VALUES(?,?,?,?,?,?)",
      id(),
      actor,
      action,
      target,
      JSON.stringify(detail),
      Date.now(),
    );
  }
  expire() {
    this.run(
      "UPDATE sessions SET status='expired' WHERE status='active' AND startedAt+(maxDuration+300)*1000<?",
      Date.now(),
    );
  }
  board(live = false) {
    const c = this.config();
    if (c.frozen && !live) return JSON.parse(c.frozenBoard || "[]");
    return this.all(
      `SELECT t.*, (SELECT COUNT(*) FROM players p WHERE p.teamId=t.id AND p.active=1) players,
       MAX(0,t.allowance-t.used) remaining,
       COALESCE((SELECT SUM(score) FROM runs r WHERE r.teamId=t.id AND valid=1),0) score,
       COALESCE((SELECT MAX(score) FROM runs r WHERE r.teamId=t.id AND valid=1),0) bestRun,
       (SELECT MAX(createdAt) FROM runs r WHERE r.teamId=t.id AND valid=1 AND score>0) achievedAt
       FROM teams t WHERE disqualified=0 ORDER BY score DESC,COALESCE(achievedAt,9223372036854775807),t.createdAt,t.id`,
    ).map((t, i) => ({ ...t, rank: i + 1 }));
  }
  createTeam(name: string, pokemon: number, names: string[]) {
    return this.tx(() => {
      const teamId = id(),
        c = this.config();
      this.run(
        "INSERT INTO teams(id,name,pokemon,createdAt,allowance) VALUES(?,?,?,?,?)",
        teamId,
        name,
        pokemon,
        Date.now(),
        c.attemptsPerTeam,
      );
      const players = names.map((name) => {
        const accessCode = code(),
          playerId = id();
        this.run(
          "INSERT INTO players(id,teamId,name,codeHash,allowance) VALUES(?,?,?,?,?)",
          playerId,
          teamId,
          name,
          hash(accessCode),
          c.attemptsPerPlayer,
        );
        return { id: playerId, name, accessCode };
      });
      return {
        id: teamId,
        name,
        pokemon,
        players,
        allowance: c.attemptsPerTeam,
      };
    });
  }
  bootstrap(username: string, password: string) {
    if (!this.get("SELECT id FROM admins WHERE username=?", username))
      this.run(
        "INSERT INTO admins VALUES(?,?,?)",
        id(),
        username,
        passwordHash(password),
      );
  }
}
