# Action-platformer expansion — version 5

This maps the supplied gameplay and atmospheric-depth prompts to the implementation. Earlier tournament, registration, shared-attempt, leaderboard and environment work remains in place.

| Requirement | Implementation |
| --- | --- |
| Rattata, Pidgey, Zubat, Geodude, Gastly, Voltorb, Ekans, Haunter | `shared/action.ts`, `action/enemies.ts`: multi-hit health, terrain-supported patrols, charges, dives, sinusoidal flight, armor, ranged shadows, explosion rings, concealment, teleports and multishot. All have local motion frames and credited sources. |
| Character combat | `action/combat.ts`: Thunder Shock/Thunderbolt, Bite/Water Gun, Ember/Flamethrower, Water Burst/Withdraw, Vine Whip/Razor Leaf. Movement and jumping continue during attacks. Damage restores energy; projectiles have lifetime/range bounds. |
| Upgrades and dash | First defeat unlocks Shift dash during any run. Practice mastery adds water multishot, burn, longer defense, root/stun or faster basic attacks. |
| Hazards | `action/hazards.ts`: thorns, poison, electric floors, boulders, pendulums, oscillating barriers, retracting spikes, warned falling rocks/icicles, currents, ice, localized mist and moving electric gates. Springs, crates, spikes, saws and moving/crumbling platforms remain available. |
| Mystery balls | Eight weighted rewards; one held item; E or touch to activate; cooldown and expiry; rare healing/invincibility. Enemy drops, heart pickups, rapid fire and magnets remain functional. |
| Difficulty and fairness | Six distance gates: 0/200/500/900/1,400/2,000 m. Generation enforces supported patrols, safe gaps/rises, hazard separation, bounded enemy counts, warning durations and projectile caps. Invalid encounters fall back to safe geometry. |
| Waves | Sequential ground runners, Pidgey formations, Zubat groups, Geodude plus Rattata and Gastly around moving platforms. |
| Boss encounters | Gengar teleports and summons temporary Gastly; Onix charges and drops rocks; Electabuzz fires spreads and warns electric floor attacks. Health bars, tougher second phases, vulnerable periods, rewards and open bypass routes. Incompatible threats suspend while bosses are active. |
| Skill scoring | Species rewards, x1/x2/x3/x5 chains, airborne and special multi-kill bonuses, one dodge reward per enemy, clean 200 m sections. Damage/inactivity end chains. Server verifies IDs, timing bounds, chains, uniqueness and totals. |
| World events | Rain, petals, fog, meteors, Pokémon migration, wind, thunder and lantern changes. Mostly cosmetic, behind sharp gameplay; ordered moonlight/dawn/daylight/sunset cycle. |
| Progression | Browser-local coins, six achievements, skins, attack/trail cosmetics, optional practice starts, partner mastery; two additional playable practice unlocks, Shinx and Riolu. All original partners remain available. Official starting stats ignore purchased upgrades. |
| Secrets | Rare elevated coin routes, mystery balls, cave and reward-room dressing, crumbling optional platforms and a rare Mew encounter that restores energy. The main floor remains playable. |
| HUD and controls | Energy/cost, held item, active durations, combo, boss health, stage and warnings. Keyboard and touch specials/items/dash; compact mobile controls and restart flow. |
| Feedback | Real motion frames, hit reactions, health indicators, bounded defeat/landing/dash particles, attack effects, coin feedback, subtle shake and species-varied sound cues. |
| Architecture | Shared definitions/generation; separate combat, enemy AI, boss floor attacks, projectile cleanup, hazard, weather and persistence modules. Pause-aware clocks and slow-time boss warnings; bounded active objects. |
| Floating scenery | Atlas bottom-padding correction, supporting cliffs under houses, bridge feet extending into the lake, terrain-aligned decorations and ground hazards. |
| Atmospheric depth | Cached contrast/saturation reduction, lavender haze and subpixel softness with tile gutters. Far layers soften most; foreground art, characters, hazards, coins and collision surfaces remain sharp. No per-frame fullscreen blur. |

## Verification

- `npm.cmd test`: 47 tests, including generation coverage for every new enemy/hazard, item rarity, combat chains, workshop purchases, assets, official score acceptance/tampering/retry handling, and the existing team/attempt/API regressions.
- `scripts/verify-action.js`: live Phaser movement, double jump, multi-hit enemies, basic/special attacks, dash, shield, damage immunity, healing, slow-time expiry, warning-before-projectile, pause, three boss entry/exit paths, hazard suspension and bounded chunks.
- `scripts/verify-action-advanced.js`: five attack kits, all eleven animated enemy types and ground anchors, thirteen hazard configurations, real Gengar summons and their cleanup, projectile expiry and camera progression.
- `scripts/verify-browser-mechanics.js`: reserved version-four movement/collision compatibility, crates, springs, crumbling and moving platforms.
- `scripts/verify-environment.js`: deterministic redraw and opaque coverage through 1,121,000 world pixels; cache capped at 28 tiles.
- Actual app screens inspected at 1440×900, 390×844 and 844×390. Practice finish/result/restart exercised through the UI.

The test harnesses deliberately position characters and advance selected mechanics; they do not claim a human completed every route. Tournament validation remains plausibility validation, not a server-authoritative physics replay. Browser-local progression does not sync between devices. Deployment and a campus hardware/LAN rehearsal remain separate from this local implementation.
