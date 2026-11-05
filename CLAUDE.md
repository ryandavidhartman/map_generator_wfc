# WFC Hex Crawl Generator

A React + TypeScript app for running overland hex crawls. Wave Function Collapse (ported from
felixturner/hex-map-wfc) generates the overland map. Clicking into a hex opens the detail and
site generators forked from `~/dev/source/map_generator`.

**The plan, the decisions and the milestones are in `docs/PLAN.md`, which is committed.**
Read it first. Status (2026-11-04): **M0 and M1 done.**
- M0: map_generator forked in. The save key is renamed to `wfc-hex-crawl:map`, so this
  app's saves stay separate from map_generator's on localhost:5173.
- M1: the WFC solver is ported to TypeScript in `src/wfc/` (see PLAN.md's M1 entry for what
  changed from hex-map-wfc).

M2 (world model: terrain from tiles and noise) is next. The suite takes about 20 s, mostly
`src/wfc/benchmark.test.ts`.

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
  map is generated.
- Rules carried over from map_generator's CLAUDE.md: tables are transcribed verbatim; visual
  changes start from a reference image; drawing derives from saved data; don't name any other
  game, publisher or rulebook; don't commit unless asked.
- Node 20.16 and Vite 6.4 (not 7 or 8). Run `source ~/.nvm/nvm.sh && nvm use` before npm.
  See the "Stack" section of `docs/reference/map_generator-CLAUDE.md`.
