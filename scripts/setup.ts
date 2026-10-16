import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) console.log(".env already exists; preserved.");
else {
  writeFileSync(
    ".env",
    `PORT=3001\nHOST=127.0.0.1\nDATABASE_PATH=data/league.sqlite\nADMIN_USERNAME=organizer\nADMIN_PASSWORD=${randomBytes(18).toString("base64url")}\nCOOKIE_SECURE=false\n`,
  );
  console.log(
    "Created private .env with an organizer password. Read it locally to sign in.",
  );
}
