# WFC Hex Crawl Generator

A React + TypeScript app for running overland hex crawls. Wave Function Collapse (ported from
felixturner/hex-map-wfc) generates the overland map. Clicking into a hex opens the detail and
site generators forked from `~/dev/source/map_generator`.

**The plan, the decisions and the milestones are in `docs/PLAN.md`, which is committed.**
Read it first. Status: planning. No code has been written yet; M0 (the fork) is next.

## Key rules

- One WFC tile = one overland hex. Pointy-top hex orientation throughout.
- Revealed hexes never change: no WFC re-solve, chunk growth or recovery step may change a
  revealed hex's tile or terrain.
- `wfc/` and `world/` are pure TypeScript (no Three.js imports), so they're testable in Vitest.
- Hex game data (danger, `dangerLevel`, point of interest) is rolled at reveal, not when the
  map is generated.
- Rules carried over from map_generator's CLAUDE.md: tables are transcribed verbatim; visual
  changes start from a reference image; drawing derives from saved data; don't name any other
  game, publisher or rulebook; don't commit unless asked.
- Node 20.16 and Vite 6.4 (not 7 or 8). See map_generator's CLAUDE.md "Stack" section.
