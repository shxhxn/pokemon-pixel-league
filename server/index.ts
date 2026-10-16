import "dotenv/config";
import { Store } from "./db";
import { createApp } from "./app";
const store = new Store(process.env.DATABASE_PATH || "data/league.sqlite");
if (process.env.ADMIN_PASSWORD)
  store.bootstrap(
    process.env.ADMIN_USERNAME || "organizer",
    process.env.ADMIN_PASSWORD,
  );
else console.warn("Organizer not configured. Run npm run setup, then restart.");
const host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT || 3001);
const server = createApp(store).listen(port, host, () =>
  console.log(`Pixel League API ready at http://${host}:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      store.db.close();
      process.exit(0);
    }),
  );
