# Pokémon Pixel League implementation

Current expansion coverage and verification are recorded in [EXPANSION.md](EXPANSION.md). World version 5 supersedes the earlier gameplay milestones below while preserving reserved older sessions.

- [x] A: React/Vite/TypeScript, Express, persistent database, setup
- [x] B: Original procedural pixel environments, responsive Phaser platformer
- [x] C: 38 local identifiable Pokémon sprites with source manifest
- [x] D: Registration, team-name sign-in, atomic shared attempts, session validation
- [x] E: Live leaderboard, organizer controls, audit and CSV
- [x] F: Integrated portal → session → results → leaderboard
- [x] G: Animation, sound, responsive UI, errors and retries
- [x] H: Automated rules/API tests and browser workflow verification

Architecture decision: use Node 24's built-in SQLite with WAL and transactional SQL for a self-contained single-server college event. PostgreSQL/Prisma are preferences, not prerequisites; neither PostgreSQL nor Docker is installed here. Do not claim PostgreSQL compatibility. Database migrations live in server/migrations. No external database account is needed.

Event-readiness limits, verification details, and remaining rehearsals are documented in README.md and TESTING.md. This checklist records implemented local MVP stages, not a claim of completed public deployment or rights clearance.


## Theme and gameplay upgrade - 2026-10-14

- [x] Midnight/coral/gold pixel theme and locally bundled pixel fonts.
- [x] Decorative translucent Pokemon background with reduced-motion support.
- [x] Viewport-sized gameplay, responsive orientation changes and fullscreen control.
- [x] 38 attributed motion sheets: idle, run, jump, fall, land, hurt, celebrate.
- [x] Double jump, springs, moving enemies, spikes, crates, crumbling and moving platforms, spinning crystals.
- [x] Ready screen, countdown, route hints, touch controls and finish confirmation.
- [x] Clear practice/tournament choices, portal explanations, organizer guidance and safe overview refresh.
- [x] Versioned session worlds preserve existing reserved-attempt scoring events.
- [x] Automated tests, browser collision checks, mobile controls/rotation and accepted official result.

## Shared teams and adventure upgrade

- [x] Five shared attempts by default; organizer-configurable roster size and team allowance.
- [x] One active run per team; every valid attempt adds to the team total.
- [x] All-team standings, cumulative portal totals and team attempt history.
- [x] Existing record migration, frozen-board recalculation and idempotent result retries.
- [x] Registration success/error feedback stays visible near the action.
- [x] Consolidated home dashboard with practice, team entry and standings.
- [x] Five difficulty levels, accelerating enemies/platforms and late-run hazards.
- [x] Player projectiles, aimed enemy shots, reactive charges and diving bats.
- [x] Eight-second shield, magnet and rapid-fire powerups; very rare extra hearts.
- [x] Six moonlit districts with reusable assets and continuous parallax; replaces the earlier day/night palette cycle.
- [x] Controlled live-scene combat checks and two accepted cumulative team runs.

- [x] Three local transparent environment atlases, detailed stone terrain, independent parallax layers and bounded texture caching.
- [x] Exact-pixel scenery revisit check beyond one million world pixels; existing physics and combat checks still pass.
