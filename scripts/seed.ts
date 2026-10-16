import "dotenv/config";
import { Store, hash } from "../server/db";
import { ROSTER } from "../shared/roster";
const db = new Store(process.env.DATABASE_PATH || "data/league.sqlite");
const names = [
  "Thunder Squad",
  "Ember Collective",
  "Moss & Magic",
  "The Wave Riders",
  "Lavender Ghosts",
  "Eevee Society",
  "Midnight Umbreon",
  "Dragon Dispatch",
  "Team Starfall",
  "Sleepy Snorlax",
  "Clover Crew",
  "Crystal Current",
  "Jolt Junction",
  "The Moonwalkers",
  "Firefly Club",
  "Route 01 Runners",
  "Team Daybreak",
  "Lucky Magikarp",
  "Silver Scythers",
  "Dream Dispatch",
  "The Trailblazers",
  "Solar Sparks",
  "Mystic Meadow",
  "Frostbound Friends",
  "Pixel Pioneers",
];
for (let i = 0; i < 25; i++) {
  if (db.get("SELECT id FROM teams WHERE name=?", names[i])) continue;
  const t = db.createTeam(names[i], ROSTER[i].id, [
    "Trainer One",
    "Trainer Two",
    "Trainer Three",
  ]);
  if (i === 0)
    db.run(
      "UPDATE players SET codeHash=? WHERE id=?",
      hash("DEMO-PIKACHU"),
      t.players[0].id,
    );
}
db.db.close();
console.log(
  "25 demonstration teams, 75 players. No fabricated scores. Sign in with a registered team name, such as Thunder Squad. Each team shares five attempts by default. Tournament status is unchanged. Use a separate database for the real event.",
);
