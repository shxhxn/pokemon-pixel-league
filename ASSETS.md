# Pokémon Pixel League asset provenance


## Decision

Use the consistent Generation V Black/White pixel-art collection hosted by [PokéAPI/sprites](https://github.com/PokeAPI/sprites), with 38 recognizable Pokémon stored locally. This source provides both transparent still PNGs for the character selector and animated GIFs that can be converted to ordinary Phaser sprite sheets. The game does not need a sprite CDN or the PokéAPI service at runtime.

The Black/White set was chosen over mixed-generation artwork because it has a coherent pixel scale and genuine frame animations. Hand-drawing 38 approximations would reduce recognizability; generated sprites would need additional consistency and animation cleanup. These battle/idle loops now appear on selection and marketing screens. Gameplay uses the dedicated movement collection documented below.

## Sources and rights

- Source repository: <https://github.com/PokeAPI/sprites>
- Collection and community credits: <https://github.com/PokeAPI/sprites/blob/master/README.md>
- Repository package metadata: <https://github.com/PokeAPI/sprites/blob/master/package.json>
- Pokémon trademark attribution: <https://pokeapi.co/about>
- Static source pattern: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/{id}.png`
- Animated source pattern: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/{id}.gif`
- Prepared on 2026-10-13. Per-file source URLs and SHA-256 hashes of the fetched originals are recorded in `public/assets/pokemon/manifest.json`.

The repository package declares ISC. This project does **not** interpret that metadata as a blanket license to the underlying Pokémon artwork or trademarks. Pokémon characters and artwork remain the property of their respective rights holders, including Nintendo, Game Freak, and The Pokémon Company. This is an unofficial fan prototype; it is not affiliated with or endorsed by those companies. A fan-event context does not itself grant artwork rights. No claim of public-domain, Creative Commons, or commercial-use permission is made here.

The 37 included Generation I–IV Pokémon use the source collection's official Black/White sprites. Greninja (#658) is a **Smogon community Gen V style fan sprite**, as identified by the upstream README for the post-650 collection. Its specific individual artist was not established from the fetched files, so no individual authorship is invented. Credit goes to the Smogon sprite contributors as listed in the upstream README; both that community contribution and the underlying Pokémon rights remain relevant. The default PokéAPI Greninja pixel sprite would not eliminate this provenance issue.

## Local files and integration

Each roster ID has three files in `public/assets/pokemon/`:

- `{id}.png`: unchanged upstream static PNG, for selection cards and fallback rendering.
- `{id}.gif`: unchanged upstream animated source, useful for inspection and provenance.
- `{id}-sheet.png`: derived transparent RGBA sheet for Phaser; every cell is 96 × 96 pixels, with up to 8 columns, in row-major order. Unused trailing cells are transparent.

`manifest.json` has a `pokemon` array. Each entry records `id`, `name`, `image`, `gif`, `sheet`, `frameWidth`, `frameHeight`, `columns`, `frameCount`, `frameRate`, `frameDurationsMs`, source URLs, hashes, and rights notes. `frameRate` gives the source loop's average rate; `frameDurationsMs` preserves exact timing if the game needs variable-duration frames. Limit animation frame indices to `0` through `frameCount - 1`, because the last sheet row may have empty cells.

The converter takes the union of nontransparent bounds across each loop, preserves relative frame movement, and centers the sprite horizontally with the union's bottom at pixel 90. Sprites larger than 88 × 88 are reduced with nearest-neighbor sampling; smaller sprites retain native pixels. Physics should use explicit body sizes rather than the 96-pixel transparent canvas. Keep pixel-art texture filtering enabled and use integer display scaling where practical.

`prepare_assets.py` reproduces the download and conversion with Python and Pillow (`python public/assets/pokemon/prepare_assets.py`). It requires network access only during preparation. `roster-preview.png` is a visual contact sheet of the first animation frame for all 38 characters.

Validation: all 38 static images decode; all 38 sheets have dimensions matching their manifest; all declared animation frames contain visible pixels. The contact sheet was visually reviewed for correct recognizable characters and transparent backgrounds. There are 20–183 frames per character. The complete source images, sheets, metadata, and preview occupy approximately 3.1 MiB.

## Roster

| ID | Pokémon | ID | Pokémon |
| --- | --- | --- | --- |
| 1 | Bulbasaur | 4 | Charmander |
| 7 | Squirtle | 25 | Pikachu |
| 26 | Raichu | 39 | Jigglypuff |
| 52 | Meowth | 54 | Psyduck |
| 58 | Growlithe | 63 | Abra |
| 66 | Machop | 74 | Geodude |
| 77 | Ponyta | 79 | Slowpoke |
| 92 | Gastly | 94 | Gengar |
| 104 | Cubone | 113 | Chansey |
| 123 | Scyther | 129 | Magikarp |
| 131 | Lapras | 133 | Eevee |
| 134 | Vaporeon | 135 | Jolteon |
| 136 | Flareon | 143 | Snorlax |
| 147 | Dratini | 149 | Dragonite |
| 150 | Mewtwo | 151 | Mew |
| 152 | Chikorita | 155 | Cyndaquil |
| 158 | Totodile | 196 | Espeon |
| 197 | Umbreon | 282 | Gardevoir |
| 448 | Lucario | 658 | Greninja |


## Gameplay motion upgrade (2026-10-14)

All 38 playable partners now use side-facing motion frames from [PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab). `scripts/prepare-motion.py` downloads source XML, Walk, Idle, Hop, Hurt and Pose sheets plus character credit records. It extracts the east-facing direction, trims transparent margins per frame, applies a uniform per-character nearest-neighbor scale, aligns the feet at pixel 90 and packs 96 x 96 cells in eight columns. Falling and landing reuse subsets of Hop; they are not claimed as independently authored source animations.

`public/assets/motion/manifest.json` records animation frame lists/rates, source URLs, SHA-256 hashes, source animation names, modifications and credits. Original source images and credit files remain under `sources/{id}/`. `UPSTREAM-LICENSE.md`, `UPSTREAM-README.md` and `UPSTREAM-credit_names.txt` preserve upstream documentation. The human-readable `credits.txt` is linked from the site footer.

Upstream licenses contributed work under CC BY-NC 4.0 with attribution. Many records identify CHUNSOFT for official Mystery Dungeon artwork; Pokemon's underlying rights are separate. See the included upstream license and per-character records for the applicable provenance. This addition does not grant commercial use or ownership of Pokemon characters.

Every declared frame in all 38 converted sheets was decoded with Pillow and checked for nontransparent content. Run and jump tracks are distinct from idle; frame bounds and local credits are covered by automated tests.

## Pixel fonts

The current UI uses **Pixelify Sans** (400, 500, 600, 700) and **Press Start 2P**, downloaded from Google Fonts using `scripts/fetch-pixel-fonts.py`. Their actual font files, source URLs/CSS, and SIL OFL 1.1 texts are included under `public/assets/fonts/`. Previously bundled DM Sans and Space Mono remain available but are not the active UI fonts.

## Moonlit environment redesign (2026-10-14)

Three new RGBA atlases in `public/assets/environment/` were generated with the built-in image_gen tool using the user's Moonlit Lakeside Pixel City image as a style reference:

- `village-atlas.png`: Center-inspired building, houses, lookout tower, flowering trees, pines, lantern and shrubs.
- `parallax-atlas.png`: mountain ranges, cloud banks, distant forest/castle and full moon.
- `terrain-atlas.png`: soil, floating platform, timber bridge, waterfall, cliff and staircase.

The source reference is not shipped or used as a static background. Original generated PNGs are preserved at 1254 x 1254 with alpha. Atlas source rectangles live in `src/game/environmentAssets.ts`; each sprite is cached once at native resolution before nearest-neighbor rendering. Mountain/forest edge masks allow overlapping silhouettes without rectangular seams. Terrain uses mirrored pairs that meet on identical source columns.

`public/assets/environment/PROMPTS.md` contains the complete three generation prompts. `manifest.json` records file hashes and sizes. These assets are generated art; they are not represented as hand-drawn or sourced from a third-party game asset pack. Existing character sprite attribution is unchanged.

`MoonlitLandscape` caches at most 28 visual tiles, releases retired canvas storage, and uses a deterministic six-district plan separate from gameplay generation. Building sprites and terrain art never add or change physics bodies. The same renderer supplies the homepage preview and the actual game.
# Expansion assets

Version 5 includes eleven enemy motion sets in `public/assets/enemies/motion.json`, with attribution in `public/assets/enemies/credits.txt`. They use the established PMDCollab frame-packing pipeline. Shinx and Riolu add two practice-only playable motion sets to `public/assets/motion/manifest.json`; their credits are included in the existing public motion credits. Static enemy portraits are from the PokeAPI sprites repository. No runtime asset CDN is needed.

