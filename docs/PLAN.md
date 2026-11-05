# Plan: WFC Hex Crawl Generator

A React web app for running overland hex crawls in OSR-style games. It combines two projects:

- **[hex-map-wfc](https://github.com/felixturner/hex-map-wfc)** (Felix Turner, MIT) generates
  the overland map with Wave Function Collapse (WFC) and draws it in 3D with Three.js/WebGPU
  and the KayKit Medieval Hexagon tiles.
- **map_generator** (`~/dev/source/map_generator`, this project's author, CC BY-SA 4.0)
  supplies everything you get by clicking into a hex: terrain, danger, encounter rollers,
  points of interest, and the generated sites (dungeons, settlements, towers, keeps, camps,
  shrines, rifts) with their maps.

Written 2026-11-04. All numbers are starting points to tune by simulation.

## Decisions (2026-11-04)

| Topic | Decision |
|---|---|
| Scale | **One WFC tile = one overland hex.** Each tile is a clickable hex, and double-clicking opens map_generator's hex detail page. |
| Rendering | **3D and 2D, with a toggle.** The 3D view is hex-map-wfc's look. The 2D view is a flat top-down map for quick GM use and printing. Both draw from the same hex data. |
| Play mode | **Generate a region, reveal it through fog of war.** WFC solves a region up front. The party reveals hexes as today; the GM can see everything. |
| Codebase | **Fork and port.** Copy map_generator's app into this repo and port hex-map-wfc's JavaScript to TypeScript. The two projects then develop separately. |
| Terrain | **WFC decides shape; biome noise decides terrain.** WFC places water, coast, rivers, roads and elevation. Seeded noise then assigns land biomes. |
| Region size | **Start small and grow by chunk.** Start with one 217-hex chunk. As the party nears an edge, WFC solves a neighboring chunk that matches the existing edges. |
| Points of interest | **Rolled as today, but aware of the map.** The 1-in-6 gate and d200 Feature table stay. Settlements prefer roads, coasts and rivers, and 3D markers show sites. |
| Danger | **The reveal-time rule stays.** A hex's `dangerLevel` is computed when it's revealed, from its revealed neighbors, exactly as today. |
| GM editing | **Edit plus local re-solve.** The GM pins a hex, and WFC re-solves the *unrevealed* hexes within about 2 to fit it. Revealed hexes never change. |
| Saving | **localStorage: world seed, solved tiles, and per-hex game data.** Mongo stays a later item. |

## Glossary

- **Hex:** one overland hex. The party moves between hexes, and each has terrain, danger,
  maybe a point of interest, and a detail page.
- **Tile:** the WFC piece in a hex: a type (e.g. `RIVER_B`, `COAST_C`), a rotation (0-5) and
  a level (0-4). Each of its six edges has a type (`grass`, `water`, `coast`, `river`, `road`),
  and touching edges must match.
- **Chunk:** a hexagonal block of 217 hexes (radius 8) solved by WFC in one pass. Called a
  "grid" in hex-map-wfc. Players never see chunks.
- **Biome:** the land terrain (Grassland, Forest/jungle, Swamp, Desert/arctic, Hills, Mountain)
  that noise assigns on top of a tile's shape.
- **Revealed:** the party has seen the hex. Revealed hexes are permanent: no re-solve, chunk
  growth or edit may change their tile or terrain (except the GM editing that hex directly).

## How it works

### 1. World generation (WFC)

- Campaign start: the GM picks a seed (or Random) and a starting terrain. WFC solves the first
  chunk around the origin, with the start hex pinned to a tile that fits the chosen terrain.
- Tiles come from hex-map-wfc's 30 active tile types × 6 rotations × 5 levels, with its
  weights and edge rules. Roads come free.
- The solve runs in a Web Worker (`wfc.worker`), with hex-map-wfc's backtracking and recovery
  (unfixing, then Local-WFC, then the mountain fallback).
- **Change from hex-map-wfc:** recovery may only unfix or re-solve *unrevealed* hexes. A
  revealed hex is always a fixed constraint. If a chunk can't be solved without touching a
  revealed hex, the mountain fallback is used at the boundary instead.

### 2. Terrain from tile and noise

Each hex's `Terrain` is worked out from its tile plus two seeded noise fields, moisture and
temperature. Elevation comes from the tile's level, not noise.

| Tile | Terrain |
|---|---|
| `WATER` | Ocean |
| `COAST_*`, `RIVER_INTO_COAST` | Coast |
| Land at level 3, or a slope up to 3 | Hills |
| Land at level 4, or a cliff with a level-4 top | Mountain |
| Other land, level 0-2 | Biome noise: high moisture near water → Swamp; high moisture → Forest/jungle; low moisture, or a temperature extreme → Desert/arctic; otherwise Grassland |

- Noise thresholds are tuned to hit roughly the base frequencies in map_generator's punch-list
  item 1a: Grassland ~28%, Forest ~25%, Coast ~17%, Hills ~12%, Swamp ~7%, Desert/arctic ~2%,
  Mountain ~2%, measured over land.
- Terrain changes, carried over from map_generator's 1a plan: **River/coast is renamed Coast**
  and **Hills is added**. Hills content already exists in map_generator but isn't wired up:
  `HILLS_ENCOUNTER_CHANCE`, `HILLS_CATEGORY_TABLE`, `HILLS` (wilderness levels and the d100
  encounters), `HILLS_CATACLYSMS`, `HILLS_NATURAL_LANDMARK` and `HILLS_COLOR`.
- **Rivers are a feature, not a terrain.** A hex records which of its edges have river and road
  edges, read straight from its tile and rotation. This gives the town map the real river
  edges it needs (map_generator's punch-list items 1b and 1c).
- **Lakes:** hex-map-wfc has no lake tile. v1 marks lakes from noise on about 5% of land hexes
  with a river end or a low basin, and draws them as features, as 1a planned. A real lake tile
  is a possible later addition.

### 3. Exploration and fog of war

- Same rules as today: the party starts on one hex and moves only to adjacent hexes. Moving
  into a hex reveals it and rolls its game data (danger, `dangerLevel`, point of interest).
- Solved but unrevealed hexes are hidden from players. The 2D and 3D views show unrevealed
  hexes next to the party as "unexplored" outlines the GM can click, as today.
- **GM view toggle:** shows the whole solved map, dimmed where unrevealed, for planning.
- Hex game data is rolled at reveal, not at generation. So danger still depends on exploration
  order, and nothing beyond the map shape is decided before it's seen.

### 4. Chunk growth

- Chunks sit on hex-map-wfc's chunk lattice: chunk centers are 17 hexes apart in cube
  coordinates. The lattice extends without limit, so the map is unbounded (hex-map-wfc caps
  its own at 19).
- When the party moves within about 3 hexes of an unsolved area, the worker solves the
  neighboring chunk in the background. Existing hexes along the shared edge are its fixed
  constraints.
- Large-scale shape: hex-map-wfc seeds ocean at the map corners. We replace that with a seeded
  continent noise field that seeds ocean tiles where the field says "sea", so coasts and oceans
  form continent-scale bodies across chunks. This replaces map_generator 1a's "world formula".

### 5. Points of interest

- On reveal, the 1-in-6 gate and the d200 Feature table run exactly as today, verbatim.
- **Settlement anchors:** at chunk-solve time, hexes at road ends or road junctions, and coast
  or river hexes with a road, are flagged as settlement anchors. hex-map-wfc already places
  buildings this way. When an anchor hex is revealed, it gets a Settlement POI and its type
  roll runs as normal. Other hexes roll as today. (Tune the anchor rate so settlements aren't
  far more common than the d200 table gives.)
- 3D markers: settlements use KayKit building decorations. Dungeon, tower, keep, camp, shrine
  and rift POIs get marker models, and the 2D view uses icons.
- The site generators are unchanged. Their water input (`waterForHex`) now reads the hex's
  real coast and river edges from its tile instead of guessing from neighbors.

### 6. GM editing

- Edit Hex keeps today's terrain, danger and POI fields. Changing the terrain pins a tile class
  (e.g. Ocean → `WATER`; Mountain → a level-4 tile).
- After a pin, WFC re-solves the unrevealed hexes within radius 2 (hex-map-wfc's Rebuild-WFC),
  with revealed hexes as fixed constraints. If no fit exists, the edit still applies as a
  label override, and the hex is flagged "tile mismatch" in GM view.
- No river or lake controls in v1, as in map_generator's 1a plan.

### 7. Saving

- One localStorage document, as today:
  `{ version, worldSeed, chunks: [chunkKey], tiles: { hexId: [type, rotation, level] }, hexes: { hexId: Hex }, partyHexId, selectedHexId }`.
- Tiles are stored, not re-derived from the seed. Solves depend on the order chunks were
  grown, so replaying the seed alone isn't reliable.
- Size check: 4,000 tiles at about 20 bytes is about 80 KB. Generated sites stay the bulk of
  the save, as today.
- Old map_generator saves aren't migrated (they're test data). A save with the wrong
  `version` starts a new map.

## Architecture

```
src/
  data/        ← from map_generator, unchanged except Terrain (Coast rename, Hills)
  engine/      ← from map_generator (sites, encounters, treasure…), unchanged
  wfc/         ← ported from hex-map-wfc, TypeScript, no Three.js imports
    tiles.ts          HexTileData: tile list, edges, levels
    core.ts           HexWFCCore: propagation, backtracking
    solver.worker.ts  wfc.worker
    manager.ts        WFCManager: chunks, fixed cells, anchors, recovery
    rng.ts            SeededRandom
  world/       ← new: the bridge between tiles and game hexes
    world.ts          chunk lattice, growth trigger, revealed-is-fixed rule
    terrain.ts        tile + noise → Terrain, river/road edges, lakes
    anchors.ts        settlement anchors
    noise.ts          continent / moisture / temperature fields
  render2d/    ← map_generator's HexGridSvg, reworked for tiles and pointy-top
  render3d/    ← ported from hex-map-wfc: HexTiles, Decorations, Water, Lighting, PostFX
    ThreeMapView.tsx  React wrapper (owns the canvas and renderer lifecycle)
  hexgrid/     ← map_generator's site map renderers (Dungeon/Settlement/…), unchanged
  state/       ← mapReducer + MapContext, extended with world/tiles
  components/, routes/  ← from map_generator
```

- `wfc/` and `world/` are pure TypeScript and testable headless in Vitest. Only `render3d/`
  imports Three.js.
- `render3d/` is imperative Three.js code inside one React component. React passes in
  `{ tiles, hexes, revealed, partyHexId, gmView }` and gets back click and double-click
  events. The routes and actions are the same as the 2D view's.
- **Hex orientation:** map_generator is flat-top and hex-map-wfc tiles are pointy-top. We
  standardize on **pointy-top** (the 3D models are built that way). The 2D map is reworked to
  match. The site generators that take a direction (settlement water side) get a mapping from
  tile edges (NE, E, SE, SW, W, NW) to their own angles, covered by tests.
- Routes: `/` (overland, 2D/3D toggle), `/hex/:hexId` (unchanged), and `/poi/:n` (unchanged).
  It gets a fake tile so the water cases still vary.

## Milestones

Each milestone ends with tests passing and, where there's UI, a browser check.

**M0 — Fork.** Copy map_generator's `src/`, `public/`, configs, `index.html`, `.nvmrc`,
`LICENSE` and README into this repo. Leave out `docs/`, `dist/`, `node_modules/` and `.claude/`.
Rename the package. All 1,012 tests pass. Add the license notices (see Licensing).

**M1 — Headless WFC in TypeScript.** Port `HexTileData`, `HexWFCCore`, `SeededRandom`, the
worker and `WFCManager` (chunks plus recovery) into `src/wfc/`, with no rendering. Tests: the
same seed gives the same chunk, every solved edge pair matches, and a 50-seed benchmark solves
100%.

**M2 — World model.** `world/`: chunk lattice, continent noise for ocean seeds, terrain from
tile and noise, river and road edges, lakes. The `Terrain` changes (Coast rename, Hills, wiring
up the Hills content). Simulation script reporting the terrain mix, ocean body sizes and the
share of land with rivers, tuned to the targets in section 2.

**M3 — State and 2D map.** `MapState` gains the world fields. `START_MAP` solves chunk 0, and
`MOVE_PARTY_TO` reveals and rolls as today. Rework `HexGridSvg` for pointy-top: terrain fill,
river and road lines along real edges, coast shapes, fog, the GM view toggle. The hex detail
page works end to end. **First playable version.**

**M4 — 3D map.** Port the renderer, decorations, water, lighting and post-processing into
`render3d/`. Add biome tinting (Swamp/Desert on grass tiles), forest trees driven by biome,
fog of war (hide or cloud unrevealed tiles; dim them in GM view), party and POI markers, and
picking. Add the 2D/3D toggle. Fall back to WebGL2 when WebGPU is missing (Three.js's
`WebGPURenderer` can do this; check the TSL effects, and turn off post-processing if needed).

**M5 — Chunk growth.** Background solve near edges, the revealed-is-fixed rule in recovery,
and growth animation in 3D. Test: grow 30 chunks along a random walk with no revealed hex ever
changing.

**M6 — Map-aware points of interest.** Settlement anchors, 3D and 2D markers, and
`waterForHex` reading real tile edges. This picks up map_generator's punch-list items 1b and 1c
(town-map rivers following their real edges, and combined water) as follow-ups.

**M7 — GM editing.** Pin a tile and re-solve locally, with the mismatch flag.

**M8 — Saving and polish.** Versioned save, an approximate size meter, new-campaign dialog
(seed, starting terrain), and a PNG export of the 2D map.

## From map_generator's punch list

- **1a (terrain that depends on its neighbors): replaced** by WFC plus biome noise (M2/M5).
  Its targets still apply: the biggest landmass at least 95% of revealed land, seas mostly 100+
  hexes, rivers on about 17% of land hexes, lakes on about 5%.
- **1b, 1c (town-map water): easier,** because rivers and coasts now have real edges. After M6.
- **2-9 (site maps, tracking, Mongo, encounter rollers, polish, content): carried over
  unchanged.** They're independent of the overland map.

## Licensing

- Project license: **CC BY-SA 4.0**, as map_generator, which is needed for the Basic Fantasy
  material.
- Ported hex-map-wfc code is **MIT**. Keep Felix Turner's copyright and MIT notice in the
  header of each ported file and in the README's Attribution section. MIT allows reuse inside a
  CC BY-SA project.
- KayKit Medieval Hexagon Pack (`hex-terrain.glb`, textures): credit Kay Lousberg. **Check the
  pack's license (believed to be CC0) before M4.**
- map_generator's rule carries over: don't name any other game, publisher or rulebook in the
  project.

## Risks

- **Revealed hexes can't be changed.** hex-map-wfc's recovery freely unfixes neighbor cells.
  Restricting it may lower the solve rate. The mountain fallback is the safety net, so measure
  how often it fires.
- **Small tile set.** It has no swamp, desert, forest or lake tiles. Biome tinting and
  decorations must make these readable in 3D, and the 2D view relies on fill color plus icons.
- **WebGPU support.** Safari and Firefox support varies. The 2D view is always available, and
  the 3D view needs a tested WebGL2 fallback.
- **Bundle size.** Three.js plus a 2.5 MB GLB plus textures. Lazy-load `render3d/` so the 2D
  view and site pages load fast.
- **Tooling limits** from map_generator: Node 20.16 and Vite 6.4 (not 7 or 8). hex-map-wfc
  uses Vite 6 and Three.js 0.183, so they should fit together. Check this in M0/M4.
  hex-map-wfc's dev server uses HTTPS (`basic-ssl`). WebGPU works on `http://localhost`, so
  this probably isn't needed.

## Open questions (decide when we get there)

1. Settlement anchor rate: should anchors replace the d200 settlement rows, or add to them? (M6)
2. Is a hex 6 miles across, as in map_generator? A 217-hex chunk is then about 100 miles
   across. (M2)
3. Should roads be game data (faster travel, more encounters along roads) or just look? (M3)
4. Fog look in 3D: hide unrevealed tiles, or show clouds/parchment? (M4; needs a reference
   image, per map_generator's rule for visual changes)
