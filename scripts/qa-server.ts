// Dedicated local QA database and credentials. Never use this server for an event.
import { Store } from "../server/db";
import { createApp } from "../server/app";
const db = new Store(process.env.QA_DATABASE_PATH || "data/browser-qa.sqlite");
db.bootstrap("qa-organizer", "qa-only-password");
if (!db.get("SELECT id FROM teams LIMIT 1"))
  db.run("UPDATE config SET status='active',maxDuration=30 WHERE id=1");
const port = Number(process.env.QA_PORT || 3002);
createApp(db).listen(port, "127.0.0.1", () =>
  console.log(`Isolated browser QA: http://127.0.0.1:${port}`),
);
