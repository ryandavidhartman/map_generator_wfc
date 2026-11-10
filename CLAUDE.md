# WFC Hex Crawl Generator

A React + TypeScript app for running overland hex crawls. Wave Function Collapse (ported from
felixturner/hex-map-wfc) generates the overland map. Clicking into a hex opens the detail and
site generators forked from `~/dev/source/map_generator`.

**Read `docs/PLAN.md` first.** It has the punch list (all open work), the decisions, how the
system works, and its architecture and data flow. `docs/HISTORY.md` is the M0-M8 build log,
then punch-list work since, with the measurements and bug fixes; code comments citing "PLAN.md M5" and the like mean
entries there. `docs/ARCHITECTURE-CHECKLIST.md` ties every claim in PLAN.md's Architecture
section to code; when a change makes one untrue, update both.

**Status (2026-11-10):** milestones M0-M8 are done and merged; open work is PLAN.md's punch
list. The suite takes about 25-30 s, mostly the WFC and world tests.

`docs/reference/map_generator-CLAUDE.md` is a snapshot of map_generator's CLAUDE.md as of the
fork: its architecture notes for the site generators, state and tables still apply here. Its
punch list is superseded by PLAN.md's, and it refers to `docs/` files that weren't copied.
Code comments citing "punch-list 1a" mean that old punch list.

## Invariants

- One WFC tile = one overland hex, 6 miles across (user, 2026-11-05). Pointy-top hex
  orientation throughout.
- Revealed hexes never change: no WFC re-solve, chunk growth or recovery step may change a
  revealed hex's tile or terrain. The one exception is the GM editing that hex directly (the
  Edit form pins its tile); its revealed neighbors still never change.
- Hex game data (danger, `dangerLevel`, point of interest) is rolled at reveal, not when the
  map is generated. Terrain comes from the tile (`geoAt`); `hexes` holds only revealed hexes.
- Saved maps store tile type ids, which are indexes into `TILE_LIST`. Reordering or removing
  tiles breaks saves. The save key is `wfc-hex-crawl:map`, separate from map_generator's on
  localhost:5173.

## Code

- `wfc/` and `world/` are pure TypeScript (no Three.js imports), so they're testable in Vitest.
  In `render3d/`, only `MapScene.ts`, `tileMaterial.ts`, `water.ts`, `wavesMask.ts` and
  `postFX.ts` import Three.js; `layout.ts` and `scenery.ts` stay pure and tested. Keep Three.js
  out of the main bundle (`ThreeMapView.tsx` is lazy-loaded).
- The reducer is synchronous. Starting a map and chunk growth solve in the worker first
  (`createStartingWorld`, `useChunkGrowth`) and dispatch the result. GM edits are the
  exception: `EDIT_HEX` runs `pinHex` in the reducer on the main thread (see PLAN.md's Data
  flow).
- Ported hex-map-wfc files keep Felix Turner's MIT notice in their header, along with a list
  of what changed. Keep both up to date when editing them.
- The tsconfig isn't `strict`, so TypeScript can't narrow a union on a boolean flag. Use one
  object shape instead (see `AttemptResult` in `recovery.ts`).
- `scripts/` is bundled with esbuild and run with node (there's no tsx). It's typechecked by
  `tsconfig.scripts.json`.

## Testing and checks

- Tests solve with `handleSolveChunkRequest` directly (`startWorld.test.ts`) or use the
  fixture world in `src/state/testWorld.ts`.
- **Tuning the world:** `npm run sim -- --seeds N --rings R` grows N worlds and prints the
  terrain mix against the targets. The tuning constants are `WORLD_TUNING` (fields.ts),
  `BIOME_TUNING` (terrain.ts) and `RIVER_WEIGHT` / `ROAD_WEIGHT` / `LOOKAHEAD_RINGS` (world/solve.ts). Any
  tuning change must keep "0 failed, 0 dropped cells". The solve weights (`RIVER_WEIGHT`,
  `ROAD_WEIGHT`, `LOOKAHEAD_RINGS`) change only the unsolved parts of existing worlds.
  `WORLD_TUNING` and `BIOME_TUNING` also change solved hexes, because `deriveHexGeo` reads
  them every time a hex is shown: a revealed hex keeps its saved terrain but can gain or
  lose its lake, and an unrevealed solved hex can change terrain too. That breaks the
  revealed-hexes invariant for saved games, so don't retune those two without asking the user.
- **Town-map checks:** `npm run town-maps -- [--type Town] [--seed 7] [--rotation 0]
  [--tiles RIVER_B,COAST_A] [--png]` (scripts/townMaps.ts) renders the real `SettlementMapSvg`
  for no water, an Ocean hex and every water tile in `TILE_LIST`, the same town in each, into
  `node_modules/.tmp/town-maps/town-maps.html`; `--png` screenshots it to `town-maps.png`.
  Look at the PNG (and show it to the user) after any settlement-map change; the user approves
  visual changes from screenshots.
- **Headless Chromium:** there's no playwright package, but Playwright's browser cache has the
  binaries, e.g. `~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell`
  (`npx playwright install chromium-headless-shell` if it's missing; the town-maps script
  also takes `CHROME=<path>`).
  - A static page or SVG: `chrome-headless-shell --no-sandbox --disable-gpu --hide-scrollbars
    --window-size=W,H --screenshot=out.png file:///abs/path.html`.
  - The running app, or anything async (the WFC worker): launch with
    `--remote-debugging-port=9333` and drive it from a Node script over the DevTools protocol,
    run with `node --experimental-websocket` (Node 20.16 has no global WebSocket otherwise).
    Open a tab with `PUT /json/new?<url>` and wait on `Runtime.evaluate` with
    `awaitPromise: true`. `--dump-dom` won't do: it dumps at page load.
  - A one-off page: `vite build --config <plain-object .mjs config>` (a config outside the
    repo can't `import 'vite'`), serve it with `vite preview`, and delete the temp files after.
- **3D browser checks:**
  - Headless Chromium has no WebGPU: launch it with
    `--use-angle=swiftshader --enable-unsafe-swiftshader` (the WebGL2 fallback).
  - Emulate "reduce motion" (`Emulation.setEmulatedMedia`, `prefers-reduced-motion: reduce`)
    so the map draws on demand. With the animated water on, software rendering is too slow for
    scripted screenshots.
  - Close each tab after use; open tabs keep rendering and slow everything down.

## Content and workflow

- Rules carried over from map_generator: tables are transcribed verbatim; visual changes
  start from a reference image; drawing derives from saved data; don't name any other game,
  publisher or rulebook, except where a license requires attribution (Basic Fantasy).
- Don't commit unless asked.

## Working with the user

- One punch-list item at a time: plan it, ask the questions only the user can answer, build
  it, then stop and report (with screenshots for anything visual) before starting the next.
  The user approves each commit, push and PR explicitly.
- Explain jargon in plain words before asking the user to choose between options (WFC terms
  such as cell, tile and chunk, in particular).
- Only write "user decided" (or "user, <date>") in docs and comments for something the user
  actually said. Things Claude noticed or proposed, and questions the user hasn't answered,
  are labeled as such.
- When an item finishes, update PLAN.md (the punch list and the sections it changes),
  HISTORY.md (what was done and measured), ARCHITECTURE-CHECKLIST.md (any claim it touches)
  and this file, in the same branch.
- Node 20.16 and Vite 6.4 (not 7 or 8). Run `source ~/.nvm/nvm.sh && nvm use` before npm.
  See the "Stack" section of `docs/reference/map_generator-CLAUDE.md`.
