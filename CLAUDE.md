# WFC Hex Crawl Generator

A React + TypeScript app for running overland hex crawls. Wave Function Collapse (ported from
felixturner/hex-map-wfc) generates the overland map. Clicking into a hex opens the detail and
site generators forked from `~/dev/source/map_generator`.

**Read `docs/PLAN.md` first.** It has the punch list (all open work), the decisions, how the
system works, and its architecture and data flow. `docs/HISTORY.md` is the M0-M8 build log,
with the measurements and bug fixes; code comments citing "PLAN.md M5" and the like mean
entries there.

**Status (2026-11-05):** milestones M0-M8 are done and merged; open work is PLAN.md's punch
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
  `BIOME_TUNING` (terrain.ts) and `RIVER_WEIGHT` / `LOOKAHEAD_RINGS` (world/solve.ts). Any
  tuning change must keep "0 failed, 0 dropped cells". Changing tuning alters how unsolved
  parts of existing worlds come out, but never solved hexes.
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
- Node 20.16 and Vite 6.4 (not 7 or 8). Run `source ~/.nvm/nvm.sh && nvm use` before npm.
  See the "Stack" section of `docs/reference/map_generator-CLAUDE.md`.
