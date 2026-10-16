import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { Store, hash } from "../server/db";
import { createApp } from "../server/app";
import { generateChunk, calculateScore } from "../shared/world";
import { combatBonus, styleBonus, type Foe } from "../shared/action";
let db: Store,
  server: Server,
  base: string,
  admin: string,
  player: string,
  other: string,
  team: any,
  team2: any,
  dir: string;
async function req(path: string, method = "GET", body?: any, cookie?: string) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return {
    status: r.status,
    data,
    cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
const zero = { distance: 0, coins: [], enemies: [], durationMs: 0, score: 0 };

before(async () => {
  dir = mkdtempSync(resolve("test-data-"));
  db = new Store(join(dir, "league.sqlite"));
  db.bootstrap("test-organizer", "test-password-not-production");
  server = createApp(db).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  const a = await req("/admin/login", "POST", {
    username: "test-organizer",
    password: "test-password-not-production",
  });
  admin = a.cookie;
});
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  db.db.close();
  assert.ok(
    resolve(dir).startsWith(resolve("test-data-")) &&
      resolve(dir) !== resolve("."),
  );
  rmSync(dir, { recursive: true, force: true });
});
test("health check and admin authorization", async () => {
  assert.equal((await req("/health")).status, 200);
  assert.equal((await req("/admin/overview")).status, 401);
  assert.equal(
    (
      await req("/admin/login", "POST", {
        username: "test-organizer",
        password: "wrong",
      })
    ).status,
    401,
  );
  assert.equal(
    (await req("/admin/overview", "GET", undefined, admin)).status,
    200,
  );
});
test("registration binds roster to a team and selected Pokémon", async () => {
  const r = await req("/register", "POST", {
    name: "Integration Pikachus",
    pokemon: 25,
    players: ["Alice", "Bob"],
  });
  assert.equal(r.status, 201);
  team = r.data;
  assert.equal(team.players.length, 2);
  assert.equal(
    db.get("SELECT pokemon FROM teams WHERE id=?", team.id).pokemon,
    25,
  );
  assert.equal(
    db.get("SELECT teamId FROM players WHERE id=?", team.players[0].id).teamId,
    team.id,
  );
  assert.equal(db.get("SELECT used FROM teams WHERE id=?", team.id).used, 0);
  player = (await req("/login", "POST", { code: team.players[0].accessCode }))
    .cookie;
  assert.ok(player);
  const t = await req("/register", "POST", {
    name: "Integration Eevees",
    pokemon: 133,
    players: ["Charlie"],
  });
  team2 = t.data;
  other = (await req("/login", "POST", { code: team2.players[0].accessCode }))
    .cookie;
});
test("duplicate team names, invalid Pokémon, duplicate roster and oversized roster rejected", async () => {
  assert.equal(
    (
      await req("/register", "POST", {
        name: "integration pikachus",
        pokemon: 25,
        players: ["Al"],
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req("/register", "POST", {
        name: "Bad sprite",
        pokemon: 9999,
        players: ["Al"],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("/register", "POST", {
        name: "Duplicates",
        pokemon: 25,
        players: ["Al", "al"],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("/register", "POST", {
        name: "Too big",
        pokemon: 25,
        players: ["P1", "P2", "P3", "P4", "P5", "P6"],
      })
    ).status,
    400,
  );
});
test("player cannot modify team identity or grant attempts", async () => {
  assert.equal(
    (
      await req(
        `/admin/teams/${team.id}`,
        "PATCH",
        { name: "Tampered" },
        player,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await req(
        "/admin/attempts",
        "POST",
        { scope: "all", action: "grant", reason: "tamper" },
        player,
      )
    ).status,
    401,
  );
});
test("registration closed and tournament ready prevent wrong actions", async () => {
  await req(
    "/admin/config",
    "PATCH",
    { registrationOpen: false, status: "ready" },
    admin,
  );
  assert.equal(
    (
      await req("/register", "POST", {
        name: "Closed team",
        pokemon: 25,
        players: ["Al"],
      })
    ).status,
    409,
  );
  assert.equal((await req("/sessions", "POST", {}, player)).status, 409);
  await req(
    "/admin/config",
    "PATCH",
    { registrationOpen: true, status: "active" },
    admin,
  );
});
test("concurrent starts consume exactly one attempt and enforce active session uniqueness", async () => {
  const rs = await Promise.all(
    Array.from({ length: 8 }, () => req("/sessions", "POST", {}, player)),
  );
  assert.equal(rs.filter((r) => r.status === 201).length, 1);
  assert.equal(rs.filter((r) => r.status === 409).length, 7);
  assert.equal(db.get("SELECT used FROM teams WHERE id=?", team.id).used, 1);
  assert.equal(
    db.all(
      "SELECT * FROM sessions WHERE playerId=? AND status='active'",
      team.players[0].id,
    ).length,
    1,
  );
});
test("session identity, bounds, timing, duplicates, score tampering are rejected", async () => {
  const s = db.get(
    "SELECT * FROM sessions WHERE playerId=? AND status='active'",
    team.players[0].id,
  );
  assert.equal(
    (await req(`/sessions/${s.id}/result`, "POST", zero, other)).status,
    404,
  );
  assert.equal(
    (
      await req(
        `/sessions/${s.id}/result`,
        "POST",
        { ...zero, score: 999 },
        player,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await req(
        `/sessions/${s.id}/result`,
        "POST",
        { ...zero, durationMs: 120000 },
        player,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await req(
        `/sessions/${s.id}/result`,
        "POST",
        { ...zero, distance: 9999, score: 99990 },
        player,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await req(
        `/sessions/${s.id}/result`,
        "POST",
        { ...zero, coins: ["0:c:0", "0:c:0"], score: 50 },
        player,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await req(
        `/sessions/${s.id}/result`,
        "POST",
        { ...zero, coins: ["99:c:0"], score: 25 },
        player,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await req(
        `/sessions/${s.id}/result`,
        "POST",
        { ...zero, distance: -1 },
        player,
      )
    ).status,
    400,
  );
});
test("accepted result persists and identical retries are idempotent", async () => {
  const s = db.get(
    "SELECT * FROM sessions WHERE playerId=? AND status='active'",
    team.players[0].id,
  );
  const a = await req(`/sessions/${s.id}/result`, "POST", zero, player);
  assert.equal(a.status, 200);
  assert.equal(a.data.accepted, true);
  assert.equal(a.data.player.used, 1);
  const b = await req(`/sessions/${s.id}/result`, "POST", zero, player);
  assert.equal(b.data.duplicate, true);
  assert.equal(b.data.runId, a.data.runId);
  assert.equal(
    db.get("SELECT COUNT(*) n FROM runs WHERE sessionId=?", s.id).n,
    1,
  );
  assert.equal(
    (
      await req(
        `/sessions/${s.id}/result`,
        "POST",
        { ...zero, durationMs: 1 },
        player,
      )
    ).status,
    409,
  );
  assert.equal((await req("/sessions", "POST", {}, player)).status, 201);
});
test("attempt resets are authorized, audited and restore ability to play", async () => {
  assert.equal(
    (
      await req(
        "/admin/attempts",
        "POST",
        {
          scope: "player",
          id: team.players[0].id,
          action: "reset",
          reason: "Approved interrupted attempt",
        },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(db.get("SELECT used FROM teams WHERE id=?", team.id).used, 0);
  assert.equal((await req("/sessions", "POST", {}, player)).status, 201);
  assert.ok(db.get("SELECT * FROM audit WHERE action='attempts.reset'"));
});
test("team totals rank and earliest achievement breaks ties; live board updates", async () => {
  const s = db.get(
    "SELECT * FROM sessions WHERE playerId=? AND status='active'",
    team.players[0].id,
  );
  db.run("UPDATE sessions SET startedAt=? WHERE id=?", Date.now() - 6000, s.id);
  const body = {
    distance: 100,
    coins: [],
    enemies: [],
    durationMs: 5000,
    score: 1000,
  };
  assert.equal(
    (await req(`/sessions/${s.id}/result`, "POST", body, player)).status,
    200,
  );
  const s2 = (await req("/sessions", "POST", {}, other)).data;
  db.run(
    "UPDATE sessions SET startedAt=? WHERE id=?",
    Date.now() - 6000,
    s2.id,
  );
  assert.equal(
    (await req(`/sessions/${s2.id}/result`, "POST", body, other)).status,
    200,
  );
  const board = (await req("/public")).data.board;
  assert.equal(board[0].id, team.id);
  assert.equal(board[0].score, 1000);
  assert.equal(board[1].id, team2.id);
  assert.equal(db.all("SELECT * FROM runs WHERE teamId=?", team.id).length, 2);
});
test("scores and counters survive a database close and reopen", () => {
  const snapshot = db.board();
  const second = new Store(join(dir, "league.sqlite"));
  assert.deepEqual(second.board(), snapshot);
  assert.equal(
    second.get("SELECT used FROM teams WHERE id=?", team.id).used,
    1,
  );
  second.db.close();
});
test("flagging, invalidation and reinstatement recalculate scores", async () => {
  const run = db.get(
    "SELECT * FROM runs WHERE teamId=? AND score=1000",
    team.id,
  );
  assert.equal(
    (
      await req(
        `/admin/runs/${run.id}`,
        "PATCH",
        { flagged: true, reason: "Review recording" },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await req(
        `/admin/runs/${run.id}`,
        "PATCH",
        { valid: false, reason: "Confirmed invalid" },
        admin,
      )
    ).status,
    200,
  );
  assert.equal((await req("/public")).data.board[0].id, team2.id);
  await req(
    `/admin/runs/${run.id}`,
    "PATCH",
    { valid: true, reason: "Review cleared" },
    admin,
  );
  assert.equal((await req("/public")).data.board[0].id, team.id);
});
test("disqualified teams leave rankings and cannot start; reinstate restores", async () => {
  await req(
    "/admin/attempts",
    "POST",
    { scope: "team", id: team.id, action: "reset", reason: "Next round" },
    admin,
  );
  await req(`/admin/teams/${team.id}`, "PATCH", { disqualified: true }, admin);
  assert.ok(
    !(await req("/public")).data.board.some((t: any) => t.id === team.id),
  );
  assert.equal((await req("/sessions", "POST", {}, player)).status, 403);
  await req(`/admin/teams/${team.id}`, "PATCH", { disqualified: false }, admin);
  assert.equal((await req("/public")).data.board[0].id, team.id);
});
test("pause prevents starts; finish and freeze prevent submissions", async () => {
  await req("/admin/config", "PATCH", { status: "paused" }, admin);
  assert.equal((await req("/sessions", "POST", {}, player)).status, 409);
  await req("/admin/config", "PATCH", { status: "active" }, admin);
  const s = (await req("/sessions", "POST", {}, player)).data;
  await req("/admin/config", "PATCH", { frozen: true }, admin);
  assert.equal(
    (await req(`/sessions/${s.id}/result`, "POST", zero, player)).status,
    409,
  );
  await req(
    "/admin/config",
    "PATCH",
    { frozen: false, status: "finished" },
    admin,
  );
  assert.equal(
    (await req(`/sessions/${s.id}/result`, "POST", zero, player)).status,
    409,
  );
  assert.equal((await req("/sessions", "POST", {}, other)).status, 409);
  await req("/admin/config", "PATCH", { status: "active" }, admin);
});
test("refresh does not refund, abandonment consumes, expired sessions close", async () => {
  const before = db.get("SELECT used FROM teams WHERE id=?", team.id).used;
  const m = await req("/me", "GET", undefined, player);
  assert.ok(m.data.session);
  assert.equal(m.data.used, before);
  await req(`/sessions/${m.data.session.id}/abandon`, "POST", {}, player);
  assert.equal((await req("/me", "GET", undefined, player)).data.used, before);
  await req(
    "/admin/attempts",
    "POST",
    {
      scope: "player",
      id: team.players[0].id,
      action: "grant",
      reason: "Organizer replacement",
    },
    admin,
  );
  const s = (await req("/sessions", "POST", {}, player)).data;
  db.run(
    "UPDATE sessions SET startedAt=? WHERE id=?",
    Date.now() - 500000,
    s.id,
  );
  assert.equal((await req("/me", "GET", undefined, player)).data.session, null);
  assert.equal(
    (await req(`/sessions/${s.id}/result`, "POST", zero, player)).status,
    409,
  );
});
test("roster corrections and legacy code replacement retain shared team access and history", async () => {
  const added = await req(
    `/admin/teams/${team.id}/players`,
    "POST",
    { name: "New Trainer" },
    admin,
  );
  assert.equal(added.status, 200);
  await req(
    `/admin/players/${added.data.id}`,
    "PATCH",
    { name: "Corrected Trainer" },
    admin,
  );
  const logged = await req("/login", "POST", { code: added.data.accessCode });
  assert.equal(logged.status, 200);
  const rotated = await req(
    `/admin/players/${added.data.id}`,
    "PATCH",
    { rotateCode: true },
    admin,
  );
  assert.ok(rotated.data.accessCode);
  assert.equal((await req("/me", "GET", undefined, logged.cookie)).status, 200);
  assert.equal(
    (await req("/login", "POST", { code: added.data.accessCode })).status,
    401,
  );
  await req(
    `/admin/players/${added.data.id}`,
    "PATCH",
    { active: false },
    admin,
  );
  assert.equal(
    (await req("/login", "POST", { code: rotated.data.accessCode })).status,
    401,
  );
  assert.equal(db.all("SELECT * FROM runs WHERE teamId=?", team.id).length, 2);
});
test("CSV export is authenticated and neutralizes spreadsheet formulas", async () => {
  await req(
    `/admin/teams/${team2.id}`,
    "PATCH",
    { name: "=DANGEROUS()" },
    admin,
  );
  assert.equal((await req("/admin/export")).status, 401);
  const csv = await req("/admin/export", "GET", undefined, admin);
  assert.equal(csv.status, 200);
  assert.ok(csv.data.includes("'=DANGEROUS()"));
});
test("25 simultaneous players reserve independently without overspending", async () => {
  const cookies: string[] = [];
  for (let i = 0; i < 25; i++) {
    const t = db.createTeam("Load Team " + i, 25, ["Load Player"]);
    const token = "load-test-" + i;
    db.run(
      "INSERT INTO auth VALUES(?,?,?,?)",
      hash(token),
      "player",
      t.players[0].id,
      Date.now() + 60000,
    );
    cookies.push("league=" + token);
  }
  const starts = await Promise.all(
    cookies.map((c) => req("/sessions", "POST", {}, c)),
  );
  assert.equal(starts.filter((s) => s.status === 201).length, 25);
  const duplicates = await Promise.all(
    cookies.map((c) => req("/sessions", "POST", {}, c)),
  );
  assert.equal(duplicates.filter((s) => s.status === 409).length, 25);
});
test("SSE publishes changes after an authorized mutation", async () => {
  const controller = new AbortController();
  const response = await fetch(base + "/api/events", {
    signal: controller.signal,
  });
  const reader = response.body!.getReader();
  const first = await reader.read();
  assert.ok(new TextDecoder().decode(first.value).includes("retry:"));
  await req("/admin/config", "PATCH", { registrationOpen: false }, admin);
  const next = await reader.read();
  const text = new TextDecoder().decode(next.value);
  assert.ok(text.includes("data:"));
  assert.ok(text.includes('"registrationOpen":0'));
  controller.abort();
  await reader.cancel().catch(() => {});
});

test("successful shared-kiosk logins do not consume the failed-login rate limit", async () => {
  for (let i = 0; i < 75; i++) {
    const result = await req("/login", "POST", {
      code: team.players[0].accessCode,
    });
    assert.equal(result.status, 200, `login ${i + 1}`);
  }
});

test("team-name login shares five sequential attempts and accumulates 10000 + 20000 + 5000 = 35000", async () => {
  await req(
    "/admin/config",
    "PATCH",
    { registrationOpen: true, status: "active", frozen: false },
    admin,
  );
  const t = await req("/register", "POST", {
    name: "ArcadeDestroyer",
    pokemon: 25,
    players: ["Alex", "Sam", "Jo", "Lee"],
  });
  assert.equal(t.status, 201);
  assert.equal(t.data.allowance, 5);
  const a = await req("/login", "POST", { teamName: "arcadedestroyer" }),
    b = await req("/login", "POST", { teamName: "ArcadeDestroyer" });
  assert.equal(a.status, 200);
  assert.equal(a.data.roster.length, 4);
  const starts = await Promise.all([
    req("/sessions", "POST", {}, a.cookie),
    req("/sessions", "POST", {}, b.cookie),
  ]);
  assert.equal(starts.filter((r) => r.status === 201).length, 1);
  assert.equal(starts.filter((r) => r.status === 409).length, 1);
  let session = starts.find((r) => r.status === 201)!.data;
  for (const [i, score] of [10000, 20000, 5000, 0, 0].entries()) {
    if (i)
      session = (
        await req("/sessions", "POST", {}, i % 2 ? a.cookie : b.cookie)
      ).data;
    assert.equal(session.worldVersion, 5);
    db.run(
      "UPDATE sessions SET startedAt=? WHERE id=?",
      Date.now() - 101000,
      session.id,
    );
    const result = {
      distance: score / 10,
      coins: [],
      enemies: [],
      durationMs: 100000,
      score,
    };
    const r = await req(
      `/sessions/${session.id}/result`,
      "POST",
      result,
      b.cookie,
    );
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(
      (await req(`/sessions/${session.id}/result`, "POST", result, a.cookie))
        .data.duplicate,
      true,
    );
  }
  const me = (await req("/me", "GET", undefined, a.cookie)).data;
  assert.equal(me.used, 5);
  assert.equal(me.best, 35000);
  assert.equal(me.bestRun, 20000);
  assert.equal((await req("/sessions", "POST", {}, b.cookie)).status, 409);
  const row = (await req("/public")).data.board.find(
    (r: any) => r.id === t.data.id,
  );
  assert.equal(row.score, 35000);
  assert.equal(row.remaining, 0);
  assert.equal(row.players, 4);
  assert.equal(
    row.achievedAt,
    db.get(
      "SELECT createdAt FROM runs WHERE teamId=? AND score=5000",
      t.data.id,
    ).createdAt,
  );
  await req(`/admin/teams/${t.data.id}`, "PATCH", { allowance: 6 }, admin);
  assert.equal(
    (await req("/me", "GET", undefined, a.cookie)).data.allowance,
    6,
  );
  const run = db.get(
    "SELECT id FROM runs WHERE teamId=? AND score=20000",
    t.data.id,
  );
  await req(
    `/admin/runs/${run.id}`,
    "PATCH",
    { valid: false, reason: "Score correction test" },
    admin,
  );
  assert.equal((await req("/me", "GET", undefined, a.cookie)).data.best, 15000);
});

test("version-five combat and style scores are validated, accumulated and retry-safe", async () => {
  await req(
    "/admin/config",
    "PATCH",
    { registrationOpen: true, status: "active", frozen: false },
    admin,
  );
  const registered = await req("/register", "POST", {
    name: "Combat validation",
    pokemon: 25,
    players: ["Tester"],
  });
  assert.equal(registered.status, 201);
  const login = await req("/login", "POST", { teamName: "Combat validation" });
  const session = (await req("/sessions", "POST", {}, login.cookie)).data;
  db.run(
    "UPDATE sessions SET startedAt=? WHERE id=?",
    Date.now() - 31000,
    session.id,
  );
  const enemy = generateChunk(session.seed, 1, 5).enemies[0];
  assert.ok(enemy);
  const combat = [
    { id: enemy.id, at: 20000, chain: 1, air: true, special: true },
  ];
  const style = [{ id: "1:clean", at: 20000, kind: "clean" as const }];
  const body = {
    distance: 220,
    coins: [],
    enemies: [enemy.id],
    durationMs: 30000,
    combat,
    style,
    score:
      calculateScore(220, 0, 1) +
      combatBonus(combat, () => enemy.kind as Foe) +
      styleBonus(style),
  };
  assert.equal(
    (
      await req(
        `/sessions/${session.id}/result`,
        "POST",
        { ...body, combat: [{ ...combat[0], chain: 10 }] },
        login.cookie,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await req(
        `/sessions/${session.id}/result`,
        "POST",
        { ...body, style: [...style, ...style] },
        login.cookie,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await req(
        `/sessions/${session.id}/result`,
        "POST",
        { ...body, score: body.score + 1 },
        login.cookie,
      )
    ).status,
    422,
  );
  const accepted = await req(
    `/sessions/${session.id}/result`,
    "POST",
    body,
    login.cookie,
  );
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.score, body.score);
  assert.equal(
    (await req(`/sessions/${session.id}/result`, "POST", body, login.cookie))
      .data.duplicate,
    true,
  );
  assert.equal(
    (await req("/me", "GET", undefined, login.cookie)).data.best,
    body.score,
  );
});
