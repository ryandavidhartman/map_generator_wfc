# WFC Hex Crawl Generator

A React + TypeScript app for running overland hex crawls. Wave Function Collapse (ported from
felixturner/hex-map-wfc) generates the overland map. Clicking into a hex opens the detail and
site generators forked from `~/dev/source/map_generator`.

**The plan, the decisions and the milestones are in `docs/PLAN.md`, which is committed.**
Read it first. Status (2026-11-05): **M0-M3 done.**
- M0: map_generator forked in. The save key is renamed to `wfc-hex-crawl:map`, so this
  app's saves stay separate from map_generator's on localhost:5173.
- M1: the WFC solver is ported to TypeScript in `src/wfc/` (see PLAN.md's M1 entry for what
  changed from hex-map-wfc).
- M2: the world layer in `src/world/` (fields, zone masks, world solver, terrain derivation).
  Terrain is now 8 types (Coast, Hills). PLAN.md section 2 has the design and the measured
  numbers.
- M3: `MapState` holds the solved world (`world`, `chunks`, `tiles`, `version`). The start
  dialog builds it with `createStartingWorld` (7 chunks, in the worker) and the reducer reveals
  hexes from their tiles. The 2D map in `src/render2d/` is pointy-top with rivers, roads, lakes,
  coast shapes and a GM view.

M4 (3D map) is next; M5 (chunk growth) lets the party leave the starting 7 chunks. The suite
takes about 25-30 s, mostly the WFC and world tests.

`docs/reference/map_generator-CLAUDE.md` is a snapshot of map_generator's CLAUDE.md as of the
fork: its architecture notes for the site generators, state and tables still apply here. Its
punch list is superseded by `docs/PLAN.md`, and it refers to `docs/` files that weren't
copied.

## Key rules

- One WFC tile = one overland hex. Pointy-top hex orientation throughout.
- Revealed hexes never change: no WFC re-solve, chunk growth or recovery step may change a
  revealed hex's tile or terrain.
- `wfc/` and `world/` are pure TypeScript (no Three.js imports), so they're testable in Vitest.
- Ported hex-map-wfc files keep Felix Turner's MIT notice in their header, along with a list
  of what changed. Keep both up to date when editing them.
- Saved maps store tile type ids, which are indexes into `TILE_LIST`. Reordering or removing
  tiles breaks saves.
- The tsconfig isn't `strict`, so TypeScript can't narrow a union on a boolean flag. Use one
  object shape instead (see `AttemptResult` in `recovery.ts`).
- Hex game data (danger, `dangerLevel`, point of interest) is rolled at reveal, not when the
  map is generated. Terrain comes from the tile (`geoAt`); `hexes` holds only revealed hexes.
- The reducer is synchronous: WFC solves run in the worker first (e.g. `createStartingWorld`)
  and the result is dispatched. Tests solve with `handleSolveChunkRequest` directly
  (`startWorld.test.ts`) or use the fixture world in `src/state/testWorld.ts`.
- Rules carried over from map_generator's CLAUDE.md: tables are transcribed verbatim; visual
  changes start from a reference image; drawing derives from saved data; don't name any other
  game, publisher or rulebook; don't commit unless asked.
- Node 20.16 and Vite 6.4 (not 7 or 8). Run `source ~/.nvm/nvm.sh && nvm use` before npm.
  See the "Stack" section of `docs/reference/map_generator-CLAUDE.md`.
- **Tuning the world:** `npm run sim -- --seeds N --rings R` grows N worlds and prints the
  terrain mix against the targets. The tuning constants are `WORLD_TUNING` (fields.ts),
  `BIOME_TUNING` (terrain.ts) and `RIVER_WEIGHT` / `LOOKAHEAD_RINGS` (world/solve.ts). Any
  tuning change must keep "0 failed, 0 dropped cells". Changing tuning alters how unsolved
  parts of existing worlds come out, but never solved hexes.
- `scripts/` is bundled with esbuild and run with node (there's no tsx). It's typechecked by
  `tsconfig.scripts.json`.
