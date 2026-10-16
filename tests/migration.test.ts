import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { Store } from "../server/db";

test("existing individual records migrate once into a shared pool and cumulative frozen standings", () => {
  const root = resolve("."),
    dir = mkdtempSync(join(root, "test-migration-")),
    path = join(dir, "league.sqlite");
  try {
    const old = new DatabaseSync(path);
    old.exec(
      readFileSync(
        new URL("../server/migrations/001_initial.sql", import.meta.url),
        "utf8",
      ),
    );
    old.exec(`INSERT INTO teams VALUES('team','Existing team',25,0,1);
      INSERT INTO players VALUES('player','team','Alex','hash',4,3,1);
      INSERT INTO sessions VALUES('s1','player','team',25,8,120,1,'completed');
      INSERT INTO sessions VALUES('s2','player','team',25,8,120,2,'completed');
      INSERT INTO runs VALUES('r1','s1','team','player',10000,1000,0,0,100000,10,1,0,NULL,'{}');
      INSERT INTO runs VALUES('r2','s2','team','player',20000,2000,0,0,100000,20,1,0,NULL,'{}');
      UPDATE config SET frozen=1,frozenBoard='[]';`);
    old.close();
    const migrated = new Store(path);
    assert.equal(migrated.board()[0].score, 30000);
    assert.equal(migrated.board()[0].used, 3);
    assert.equal(migrated.board()[0].remaining, 2);
    migrated.run("UPDATE teams SET allowance=7,used=4");
    migrated.db.close();
    const reopened = new Store(path);
    assert.equal(reopened.board(true)[0].remaining, 3);
    assert.equal(reopened.get("SELECT COUNT(*) n FROM runs").n, 2);
    reopened.db.close();
  } finally {
    assert.ok(dir.startsWith(join(root, "test-migration-")));
    rmSync(dir, { recursive: true, force: true });
  }
});
