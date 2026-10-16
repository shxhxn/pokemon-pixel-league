# Verification record

Verified locally on 2026-10-14, Node 24.19.0 / Windows. Browser QA uses a separate SQLite database; test scores are not inserted into the event/demo leaderboard.

## Automated checks

`npm.cmd test`: **40 tests passed**. The suite exercises API behavior and the deterministic game rules:

- Team-name login, shared attempts independent of roster size, one active run per team, and atomic concurrent starts.
- Four-member ArcadeDestroyer team: five attempts contribute 10,000 + 20,000 + 5,000 + 0 + 0 = **35,000 points**. A sixth start is rejected, a custom allowance is editable, retries never double count, and invalidating the 20,000-point run leaves 15,000.
- Zero-score attempts do not change the timestamp used to break a points tie.
- Existing individual records migrate once into team pools, preserving run history and recalculating frozen cumulative standings.
- Registration validation, server-authorized team ownership, cookie/origin checks, organizer authorization, tournament states, frozen results, resets, disqualification and persistent audit history.
- Result schemas, time/speed bounds, seeded event IDs, duplicate events, score arithmetic and idempotent resubmission.
- 25 concurrent teams reserve independently; duplicate starts cannot overspend their pools. SSE publishes updated standings.
- 20,000 generated chunks: connectivity, jump envelopes, safe floor/enemy clearance, seeded reproducibility, four-zone rotation and bounded chunk recycling.
- Five-level difficulty curve and matching server travel envelope, safe late-run hazards and older-world compatibility.
- Ordered day phases, reproducible boosts, rare hearts and safe floor under every sampled pickup.
- All 38 local motion sheets, animation state selection, asset geometry and source credits.

`npm.cmd run build` checks TypeScript and produces the Vite production build. Phaser is lazy-loaded; its chunk still exceeds Vite's default 500 KB uncompressed advisory.

## Current browser workflow

1. Registered **QA Pixel Squad** with four roster members and five shared attempts using ?Make it official?. The success receipt appeared in view and prefilled team-name sign-in.
2. Signed in by team name. Played an actual official keyboard run: **108 m + 7 coins = 1,255 points**, accepted by the server, four attempts left.
3. Played a second actual official run: **18 m = 180 points**. The dashboard showed **1,435 total points** and three attempts left.
4. Tried the existing team name in registration. The duplicate-name error scrolled into view beside submission controls, preserved the form values, and re-enabled submission.
5. Inspected the consolidated dashboard: all 25 demonstration teams appear. At 390 px width, document width is also 390 px, and the mobile game canvas measures 390 ? 526.5 with visible attack/jump controls.

`scripts/verify-adventure.js` is a Playwright-tool harness against the development server. It positions the player near actual enemies and drives the live scene: a turret warns and fires, its projectile costs one heart, keyboard X defeats it, shield blocks damage, rapid fire allows a second projectile sooner, magnet captures a nearby coin, and a heart restores health without exceeding three. A separate live-scene check verified that a charger warns, turns toward the player and charges within its safe floor range. It advances the scene clock to verify the 210-to-270 speed ramp; the latest visual redesign retains moonlight at every time. These are controlled mechanics checks, not a claim of manually surviving an entire expert run. This harness caught and verified a fix for Phaser's sprite/group callback argument ordering when enemy projectiles hit the player.

`scripts/verify-browser-mechanics.js` previously verified keyboard running, quick-tap and double jumps, practice pause, spike damage, solid crate blocking, springs, bridge collapse, moving platforms and four-chunk recycling. The viewport was checked at desktop, 390 ? 844 portrait and 844 ? 390 landscape. Motion sprite facing was visually corrected to the east-facing source row.

Browser screenshots are kept under ignored `artifacts/`, including `dashboard-final.png`, `adventure-official.png` and `adventure-night.png`. Reproduction instructions for the isolated QA server are in README.md. Browser harnesses run through the Playwright tool and are not part of `npm test`.

## Remaining event rehearsals

- Campus LAN/projector rehearsal and 25 simultaneous graphics clients.
- Extended hour-long gameplay soak and every route traversed manually.
- Every organizer action exercised through the UI (critical actions have API coverage).
- A modified client can still synthesize plausible results; the server validates plausibility, not an authoritative input replay.

## Moonlit asset renderer verification

- Three RGBA atlases and every source frame rectangle pass bounds checks. Visual randomness is isolated from gameplay generation.
- All six environment types appear at deterministic positions, including far beyond normal run distances.
- `scripts/verify-environment.js` exercises 60 widely separated camera positions, up to 1,121,000 world pixels. Every rendered pixel remains opaque, the cache stays at or below 28 tiles, and returning to the origin reproduces the exact same pixels at the same animation time.
- Native sprite caching fixed a browser PNG subsampling inconsistency found during the revisit check. Evicted canvas storage is explicitly released.
- The existing live-scene mechanics harness passed running, jumping, double jump, pause, spike damage, crate collisions, springs, crumbling bridges, moving platforms and bounded gameplay chunks after the art replacement. The combat harness also passed.
- Desktop and 390 x 844 mobile game screens were inspected. Mobile retains a 390 x 526.5 canvas, visible Attack and Jump controls, and no horizontal overflow.
- Renderer-only CPU submission measurements on this machine were approximately 0.2 ms at p95 for cached views, and 13-15 ms at p95 for artificial jumps that generate several new tiles. These measurements exclude GPU completion and are not a promise of 60 FPS on every device.
- Screenshots: `moonlit-districts.png`, `moonlit-game-desktop.png`, `moonlit-game-mobile.png`, `moonlit-dashboard.png` under `artifacts/`.
# Version-five expansion verification

The current suite has 47 automated tests. See `EXPANSION.md` for the new browser harnesses, requirement coverage and limitations. Existing version-four mechanics were rechecked separately. New real-scene checks cover all five featured attack kits, eleven animated enemy types, thirteen additional hazards, all three boss entry/exit paths, summons, pause, power-ups, projectile cleanup, camera progression and restart. Portrait/landscape controls were inspected and a clipped Attack label corrected.

The graded environment passed the million-pixel revisit check with a 28-tile cache. Cached renderer CPU submission measured about 0.1 ms at p95; artificial large camera jumps that rebuild multiple graded tiles measured about 37 ms at p95 on this machine. A seven-enemy crowded simulation kept projectiles and particles within their caps, with AI/hazard updates around 0.2 ms at p95. These are CPU submission measurements, not end-to-end frame-rate guarantees. Earlier renderer numbers above describe the prior ungraded version.

