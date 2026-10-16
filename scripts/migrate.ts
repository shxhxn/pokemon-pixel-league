import "dotenv/config";
import { Store } from "../server/db";
const db = new Store(process.env.DATABASE_PATH || "data/league.sqlite");
db.db.close();
console.log("Database migration complete.");
