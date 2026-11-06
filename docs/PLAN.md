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
| Hex scale | **6 miles per hex** (decided 2026-11-05). A 217-hex chunk is about 100 miles across. A future regional overview map would use 24 miles per hex (4 hexes across). |

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

This section describes the system as built (M0-M8). The milestone entries below record
how it got there and what was measured.

### 1. World generation (WFC)

- Campaign start: the GM picks a seed (or Random) and a starting terrain. `placeWorld` puts
  the start hex inland or at sea to match (section 4), and WFC solves the first chunk around
  it. For a specific land terrain (e.g. Forest), the start is the hex nearest the origin in
  chunk 0 whose derived terrain matches, so it isn't always (0, 0); if chunk 0 has none, a new
  seed is tried (`src/world/startWorld.ts`, built in M3).
- Tiles come from hex-map-wfc's 34 active tile types × 6 rotations × up to 5 levels (about
  900 states), with its edge rules and weights (river tiles ×1.6, section 2). Roads are part of
  the same tiles, not a separate pass.
- The solve runs in a Web Worker (`src/world/solver.worker.ts`), with hex-map-wfc's
  backtracking and recovery (unfixing, then Local-WFC, then dropping cells), steered by the
  world's masks (section 2).
- **Change from hex-map-wfc:** recovery may only unfix or re-solve *unrevealed* hexes. A
  revealed hex is always a fixed constraint (`isLocked`). If a chunk can't be solved without
  touching a revealed hex, recovery's last resort drops a cell: it keeps the cell's tile and
  accepts an edge that doesn't match. Growing chunks early (section 4) makes this rare: one
  drop in 360 measured chunk solves.

### 2. Terrain from tile and noise (built in M2)

The world fields (`src/world/fields.ts`) are seeded noise sampled at each hex: **continent**
(sea or land), **elevation** (a target tile level, rising inland, with ridges for ranges),
**moisture** and **temperature**. They do two jobs.

**They steer WFC** through per-cell masks of allowed tiles (`src/world/masks.ts`). Each cell
gets a zone from the continent value at it and its six neighbors:

| Zone | Where | Allowed |
|---|---|---|
| sea | cell and all neighbors are sea | open water only (level 0) |
| wetShore | sea cell with 2+ sea neighbors, next to land | anything at base level 0-1 |
| dryShore | land next to sea (or a speck of sea) | land at base level 0-1, coast tiles included |
| land | cell and all neighbors are land | no open water; tile levels overlapping elevation ±1 |

Zoning by neighbors guarantees free shore cells wherever sea meets land, so thin features in
the noise can always be resolved. Without that, a one-hex isthmus needs a tile with two separate
water edges, which doesn't exist. Elevation steering is what makes hills and mountains form
ranges instead of random patches.

**They label the result** (`src/world/terrain.ts`, `deriveHexGeo`). Terrain is a pure function
of the tile and the fields at its hex, so it's worked out when needed, not saved:

| Tile | Terrain |
|---|---|
| `WATER` | Ocean |
| any tile with a water edge (coasts, river mouth) | Coast |
| highest edge level 4, or a steep tile (rising 2 levels) topping out at 3 | Mountain |
| highest edge level 3, or a steep tile topping out at 2 | Hills |
| other land | wet at level 0 → Swamp; very dry, or very hot or cold → Desert/arctic; moist → Forest/jungle; else Grassland |

- **Steepness stands in for height.** Steering WFC higher to get more level-3+ land brought back
  failed solves, slowed solving and cut rivers (they can't cross high ground). Counting steep
  tiles one class higher hits the targets without that cost.
- **River tiles are weighted ×1.6** over hex-map-wfc's weights, in the world's own rules
  (`getWorldRules`). Tile ids are unchanged, so saves aren't affected.
- **River loops are broken** after every chunk solve (`src/world/rivers.ts`). WFC happily closes
  rivers into rings (about 7 per 4,100-hex world). A small patch on each ring is re-solved with
  river tiles banned in one cell. Measured result: 0.1 loops per world.
- **Rivers and roads are features, not terrain.** `deriveHexGeo` also gives each hex's river,
  road and sea edges, read from its tile and rotation. This is the real edge data the town map
  needs (punch-list item 2).
- **Lakes** are a feature: half of inland river ends, and 9.5% of hexes with only grass edges,
  picked by a hash of the seed and hex (stable, no noise needed). hex-map-wfc has no lake tile.
- **Terrain changes done:** River/coast is renamed Coast, and Hills is added, with all its
  existing content wired into the seven terrain-keyed tables. `ALL_TERRAINS` (8 terrains) drives
  the pickers and legend. M3 retired the old 2d6 reveal rules (`TERRAIN_ORDER`, the Hex Terrain
  and New Hex tables); the start dialog's Random button rolls map_generator 1a's 3d6 table
  (`terrainFor3d6`).

**Measured** with `npm run sim -- --seeds 40` (40 worlds of 19 chunks, about 4,100 hexes each;
0 failed solves, 0 dropped cells, about 73 ms per chunk):

| | Mean [min-max] | Target (map_generator's 1a) |
|---|---|---|
| Coast | 15.8% [7.4-29.3] | 18.0% (set by WFC's coastline, not directly tunable) |
| Swamp | 7.6% [3.6-13.8] | 8.0% |
| Grassland | 29.4% [16.2-43.2] | 30.5% |
| Forest/jungle | 28.9% [18.1-40.1] | 27.0% |
| Desert/arctic | 2.5% [0-14.2] | 2.1% |
| Hills | 12.0% [4.6-24.8] | 12.5% |
| Mountain | 3.8% [0.7-10.7] | 2.1% |
| biggest landmass / land | 96.0% [78.7-100] | ≥ 95% (some worlds have a large second island) |
| rivers / land | 15.5% [9.1-25.3] | ~17% |
| lakes / land | 5.2% [4.0-6.1] | ~5% |
| one-hex ponds / inland water bodies | 1.3% | ≤ 5% |
| roads / land | 23.8% | ~10% (user, 2026-11-05; punch-list item 1) |

Terrain shares are of land (everything but Ocean); open water is about 32% of the map. The
spread between worlds is wide by design: some are wetter, colder or more mountainous.

### 3. Exploration and fog of war

- Same rules as today: the party starts on one hex and moves only to adjacent hexes. Moving
  into a hex reveals it and rolls its game data (danger, `dangerLevel`, point of interest).
- Solved but unrevealed hexes are hidden from players. The 2D and 3D views show unrevealed
  hexes next to the party as "unexplored" outlines the GM can click, as today.
- **GM view toggle:** shows the whole solved map, dimmed where unrevealed, for planning.
- Hex game data is rolled at reveal, not at generation. So danger still depends on exploration
  order, and nothing beyond the map shape is decided before it's seen.

### 4. Chunk growth

- Chunks sit on an exact lattice in cube coordinates (`src/wfc/chunks.ts`): chunk centers
  are 17 hexes apart, and every hex belongs to exactly one chunk. The lattice extends without
  limit, so the map is unbounded. (hex-map-wfc instead positions its 19 grids with a
  world-space walk.)
- The worker solves a neighboring chunk in the background **before any revealed hex touches
  unsolved ground**. Built in M5 (`src/world/growth.ts`): every hex within 8 of the party
  (`GROW_RADIUS`) must be solved, so after any step the nearest unsolved hex is at least 8
  away. (The first plan said 4; 8 costs nothing measurable and keeps revealed hexes well clear
  of the cells a new chunk's recovery may change.) They can't be boundary cells,
  so the revealed-is-fixed rule rarely restricts recovery. (M1 measured why this matters:
  with every earlier tile locked, 16% of chunk solves needed drops. With nothing locked,
  none did.) Existing hexes along the shared edge are the new chunk's fixed constraints.
- Large-scale shape comes from the continent field, through the masks (section 2), not from
  seed tiles. hex-map-wfc's corner ocean seeds and first-chunk seeds aren't used by the world
  solver. This replaces map_generator 1a's "world formula".
- `placeWorld(seed, wantSea)` shifts the noise so every hex within 3 of the start hex is on the
  chosen side of sea level. Checking only the start hex itself left starts on the coast.
- **Lookahead:** each chunk solve also solves the 2 unsolved rings around it, and then throws
  them away. Masks only apply to cells being solved, so without this a chunk could leave an edge
  its unsolved neighbors' masks can't match. Measured: 1 ring left 4 dropped cells over 760
  chunk solves, and 2 rings left none (65 vs 80 ms per chunk). The worker's context radius is
  R + 6.

### 5. Points of interest

- On reveal, the 1-in-6 gate and the d200 Feature table run exactly as today, verbatim.
- **Settlement anchors** (`src/world/anchors.ts`): a hex whose tile is a road end, a road
  junction (3+ roads) or a river crossing is an anchor, about 6.4% of land hexes. It's read
  from the tile when the hex is revealed, so nothing is saved. An anchor hex becomes a
  settlement, its type re-rolled on the d200 until it lands on a settlement row; other hexes
  roll as today. Anchors add to the d200's settlements (user, M6). Coast tiles never carry
  roads, so there are no coast anchors.
- 3D markers: settlements use KayKit buildings sized by type; tower, keep, dungeon and shrine
  POIs get KayKit models, and camps and rifts simple built models. The 2D view uses a glyph
  per kind.
- The site generators are unchanged except the settlement's water: `waterForEdges` reads the
  hex's real coast and river edges from its tile. `waterForHex`, the old guess from revealed
  neighbors, is used only when a hex has no tile.

### 6. GM editing

- Edit Hex keeps today's terrain, danger and POI fields, for revealed hexes. Changing the
  terrain to another shape class (Ocean, Coast, Hills, Mountain or flat land) pins the hex's
  tile to that class; a change between flat-land biomes is a label only (`src/world/pin.ts`).
- After a pin, WFC re-solves the unrevealed hexes within radius 2 (hex-map-wfc's Rebuild-WFC),
  widening to 3 and then 4 if nothing fits, with revealed hexes as fixed constraints. If the
  shape still can't fit, the closest one that does is used (Ocean → shore, Mountain → Hills,
  flat land → shore or Hills). Either way the GM's terrain applies as a label, and a hex whose
  tile doesn't match it is flagged "tile mismatch" in GM view.
- No river or lake controls in v1, as in map_generator's 1a plan.

### 7. Saving

- One localStorage document, as today:
  `{ version, world: { seed, offsetX, offsetY }, chunks: [chunkKey], tiles: { hexId: [type, rotation, level] }, hexes: { hexId: Hex }, partyHexId, selectedHexId }`.
  The Campaign menu also saves it to a JSON file and loads it back (M8).
- Tiles are stored, not re-derived from the seed. Solves depend on the order chunks were
  grown, so replaying the seed alone isn't reliable.
- Size: a 7-chunk campaign (1,519 tiles) saves as about 26 kB of the ~5 MB localStorage
  allows. Generated sites stay the bulk of the save, as today.
- Old saves aren't migrated (they're test data). A save with the wrong `version` starts a new
  map, with a notice on the start screen.

## Architecture

```
src/
  data/        ← from map_generator: tables (Terrain gained Coast and Hills; 3d6 start table)
  engine/      ← from map_generator: sites, encounters, treasure; anchor settlements in
                 generateHex.ts, tile-edge water in settlementPlan.ts
  wfc/         ← ported from hex-map-wfc, TypeScript, no Three.js imports (M1)
    tiles.ts          HexTileData: the 34 active tiles, edges, levels
    cube.ts           cube-coordinate helpers
    rules.ts          edge levels, bitset adjacency lookups, findMismatches
    solver.ts         HexWFCSolver: propagation, backtracking, unfixing
    recovery.ts       solveRegion: Local-WFC and drop recovery, with isLocked
    chunks.ts         chunk lattice, solveChunk, first-chunk seeds
    rng.ts            Mulberry32, per-chunk seeds
  world/       ← the bridge between tiles and game hexes (M2 on)
    noise.ts          seeded simplex noise, fBm
    fields.ts         continent / elevation / moisture / temperature, placeWorld
    masks.ts          zones and per-cell allowed tiles
    solve.ts          solveWorldChunk (masks, lookahead, river loops), world rules
    rivers.ts         river-loop detection and breaking
    terrain.ts        tile + fields → Terrain, river/road/sea edges, lakes (deriveHexGeo)
    stats.ts          measureWorld, growWorld (for tests and `npm run sim`)
    protocol.ts       worker request/response
    solver.worker.ts  the Web Worker (just calls protocol.ts)
    client.ts         WfcClient: promise wrapper around the worker
    hexTiles.ts       saved tiles ([type, rotation, level] by hex id) <-> TileStore, geoAt (M3)
    startWorld.ts     createStartingWorld: place, solve 7 chunks, find the start hex (M3)
    workerSolver.ts   the app's ChunkSolver, backed by one shared worker (M3)
    growth.ts         chunksToGrow, lockedKeys, applyChunkResult (M5)
    anchors.ts        settlement anchors (M6)
    pin.ts            GM terrain edits: pin a tile, re-solve around it (M7)
  render2d/    ← the overland 2D map, pointy-top (M3)
    HexGridSvg.tsx    pan/zoom map; player view or GM view
    HexTile.tsx       one hex: fill, coast water, lake, river, road, fog/dimming, markers
    tileShapes.ts     river/road/coast SVG paths from the tile's edges
    mapData.ts        shared map geometry (hex size, per-hex geo, coordinates)
    poiIcons.ts       POI glyphs (M6)
    MapExportSvg.tsx, exportPng.tsx   player and GM PNG exports (M8)
  render3d/    ← the overland 3D map, lazy-loaded (M4)
    layout.ts         pure: placement, looks, instance-color encoding, tileDraws
    scenery.ts        pure: decorations and POI models per hex
    tileMaterial.ts   TSL tile material (palette blend, tints, fog, render modes)
    MapScene.ts       renderer, camera, controls, meshes, markers, picking
    water.ts, wavesMask.ts, postFX.ts   water, coastal waves, screen effects
    ThreeMapView.tsx  React wrapper (owns the canvas and the scene's lifecycle)
  hexgrid/     ← map_generator's site map renderers (Dungeon/Settlement/…), colors.ts, and
                 hexMath.ts (switched to pointy-top in M3)
  state/       ← mapReducer + MapContext, extended with world/tiles; useChunkGrowth (M5)
  components/, routes/  ← from map_generator, plus the Campaign menu and start dialog (M8)
```

- `wfc/` and `world/` are pure TypeScript and testable headless in Vitest. Only `render3d/`
  imports Three.js, and only lazily.
- `render3d/` is imperative Three.js code inside one React component. `ThreeMapView` takes
  only `gmView`, reads the map state from context, and dispatches the same actions and routes
  as the 2D view on click and double-click.
- **Hex orientation:** map_generator is flat-top and hex-map-wfc tiles are pointy-top. We
  standardize on **pointy-top** (the 3D models are built that way). The 2D map is reworked to
  match. The site generators that take a direction (settlement water side) get a mapping from
  tile edges (NE, E, SE, SW, W, NW) to their own angles, covered by tests.
- Routes: `/` (overland, 2D/3D toggle), `/hex/:hexId` (unchanged), and `/poi/:n` (the POI
  review page, unchanged). That page has no map hex, so an Ocean or Coast settlement there gets
  a random water side (punch-list item 2).

## Milestones

Each milestone ends with tests passing and, where there's UI, a browser check.

**M0 — Fork. ✅ Done 2026-11-04.** Copy map_generator's `src/`, `public/`, configs, `index.html`,
`.nvmrc`, `LICENSE` and README into this repo. Leave out `docs/`, `dist/`, `node_modules/` and
`.claude/`. Rename the package. All 1,012 tests pass. Add the license notices (see Licensing).

**M1 — Headless WFC in TypeScript. ✅ Done 2026-11-04.** Ported `HexTileData`,
`HexWFCCore`, `SeededRandom`, the worker solver, `WFCManager` and the recovery loop from
`HexMap.js` into `src/wfc/`, with no rendering. 30 tests, including a 50-seed benchmark
(`benchmark.test.ts`): 100% solved, with and without locking, and no edge mismatch that
isn't explained by a dropped cell. A production build was also checked in headless Chromium:
the real module worker solved two chunks (434 tiles, no mismatches, 118 ms). What changed
from hex-map-wfc, and why (each file's header has the details):
- **Bitsets instead of string-keyed Sets** for each cell's possible states: about 1.6 s per
  chunk down to about 57 ms. Same algorithm.
- **Injected per-chunk Rng** (from the world seed and the chunk) instead of one global
  stream, so a chunk's result doesn't depend on how many solves ran before it.
- **`isLocked`** for revealed hexes: never unfixed, never re-solved by Local-WFC; dropped
  if necessary, which leaves their tile unchanged.
- **The recovery loop runs inside the worker** as one synchronous call. A request carries
  only the tiles within 12 hexes of the chunk center (14 since M2's lookahead), so the worker
  keeps no state.
- **Chaining prunes are on the backtracking trail**, so backtracking restores them.
  hex-map-wfc loses them for the rest of the try.
- **Grass edges must match in level.** That's what hex-map-wfc's solver actually enforces;
  its looser `edgesCompatible` is only used by its renderer and isn't ported.
- The first chunk is seeded as in hex-map-wfc (grass at the center, water at a random edge),
  until M2's continent noise replaces it. hex-map-wfc's map-corner ocean seeds aren't ported
  (they assume its fixed 19-grid map).
Recovery stats over 350 solves (50 seeds × 7 chunks): unfixing in 15% of solves, Local-WFC
5 times, 0 drops. With every earlier tile locked: 68 drops in 55 solves (16%). See section 4
for how M5 avoids that.

**M2 — World model. ✅ Done 2026-11-04.** `src/world/`: noise fields, zone masks that steer
WFC, the world chunk solver (lookahead, river-loop breaking), and `deriveHexGeo` (terrain,
river/road/sea edges, lakes). The Terrain changes (Coast rename, Hills wired in). `npm run sim`
reports the terrain mix and the 1a targets (section 2 has the numbers). 36 new tests (1,077 in
all). A production build was checked in headless Chromium: the module worker built the masks
and solved 3 chunks (651 tiles, no mismatches or drops). Changes to M1's `wfc/` code:
- The solver takes `maskFor` (allowed states per cell), and `solveRegion` and `solveChunk` take
  `lookahead` (rings) and `rules`. `AdjacencyRules` takes optional weight overrides.
- **Bug fix, inherited from hex-map-wfc:** in the drop phase, failed attempts kept their
  unfixed cells. The next attempt re-added those cells' anchors as fixed constraints that can
  never be dropped, so a conflict could survive every drop. In one world, all 28 boundary
  cells were dropped and the chunk still failed. Now unfixed cells are cleared before every
  drop attempt.
- The worker protocol moved to `world/`, because the worker now needs the world fields. A
  request carries `WorldParams` instead of a bare seed.

**M3 — State and 2D map. ✅ Done 2026-11-05.** The first playable version.
- **State:** `MapState` gains `version` (1), `world` (WorldParams), `chunks` and `tiles`
  (`{ hexId: [type, rotation, level] }`). A save with another version, or none (map_generator
  style), starts a new map. Solved isn't revealed: `hexes` are still only the revealed hexes.
- **Start:** the reducer can't wait on the worker, so the start dialog calls
  `createStartingWorld` (seed, terrain, solver) and dispatches `START_MAP` with the solved
  world. It solves chunk 0, picks the start hex (section 1), then solves the six chunks around
  it: 7 chunks, 1,519 hexes, at least 9 hexes past chunk 0's edge. Measured in the browser:
  0.46-1.06 s (the slow case is a second seed for Desert/arctic).
- **Reveal:** `MOVE_PARTY_TO` reads the new hex's terrain from its tile (`geoAt`), then rolls
  danger and the POI as before (`generateHexDetails`). An unsolved hex can't be revealed, so
  until M5 the party can't leave the 7 chunks.
- **2D map** (`src/render2d/`): pointy-top (`hexMath.ts` switched, so the settlement map's
  coast direction now uses pointy-top angles too). Revealed hexes draw their terrain fill,
  danger border, and from the tile: rivers (curves edge to edge), roads (dashed), lakes (oval)
  and the water side of coast hexes. The GM view toggle (toolbar, remembered per browser) draws
  every solved hex, dimmed where unrevealed, with its terrain in a tooltip. The view opens 16
  hexes wide on the party and zooms from 4 to 80 hexes.
- `fieldsFor` moved from `world/solve.ts` to `world/fields.ts`, so the reducer doesn't import
  the solver. `HexGeo` gained `coastEdges`.
- Roads were drawn only at this point; M6 made road ends, junctions and river crossings
  settlement anchors. Road density is punch-list item 1.
- 12 new tests (1,089 in all). Three older heavy tests (chunk lattice, adjacency masks, zones)
  got explicit 30 s timeouts: on a loaded machine they ran up to ~9 s and hit Vitest's 5 s
  default, on the committed M2 code too. Browser check (production build, headless Chromium):
  starts on Forest/jungle, Desert/arctic, Mountain and Ocean; walking reveals hexes with tile
  terrain; GM view draws all 1,519 tiles; double-click opens the hex detail page.

**M4 — 3D map.** Split in two (user, 2026-11-05):

**M4a — Playable 3D map. ✅ Done 2026-11-05.** Port the tile renderer (models from the GLB,
placed per hex), lighting and camera into `render3d/`, lazy-loaded. Biome tinting (Swamp,
Desert/arctic, Forest… on grass tiles), party and POI markers, picking (click moves the party,
double-click opens the hex), and the 2D/3D toggle. Decisions (2026-11-05):
- **Fog: grey silhouettes.** In player view, unrevealed solved tiles are drawn as flat, unlit
  grey shapes (the land's outline shows, no color or detail); the clickable frontier is
  highlighted. GM view draws them in full color, dimmed, as in 2D.
- **Camera:** hex-map-wfc's orbit controls (pan, zoom, rotate and tilt, tilt limited).
- **View choice:** remembered per browser, starting with 2D, like the GM view toggle.
- Fall back to WebGL2 when WebGPU is missing (Three.js's `WebGPURenderer` does this).
- KayKit Medieval Hexagon Pack license checked 2026-11-05: **CC0** ("free for personal and
  commercial use, no attribution required"; don't resell unmodified copies). Credited anyway.

Built (`src/render3d/`): `layout.ts` (pure: placement, looks, the instance-color encoding,
`tileDraws`), `tileMaterial.ts` (TSL), `MapScene.ts` (Three.js), `ThreeMapView.tsx` (React,
lazy). Three.js 0.183.2, as hex-map-wfc. The 3D chunk is 930 kB (258 kB gzipped) and loads
only when the 3D view opens; the main bundle didn't grow. What's worth knowing:
- One BatchedMesh for the whole map (1,519 tiles plus fills under raised tiles).
- **Palette blend starts at level 2** (hex-map-wfc blends from level 0). This world sits higher
  (most land at levels 1-3), and blending from 0 washed ordinary land toward the snowy palette.
  Now Hills (level 3) are half snow and Mountains (level 4) full.
- **Biome tints** recolor only the palette's grass swatch (UV column 0, row 2), so roads,
  rivers, sand and water keep their colors. Desert/arctic is sand when the temperature field is
  warm and snow when it's cold.
- **Fog silhouettes** are unlit: land mid grey, sea dark grey. Rivers aren't shown (only tiles
  with open-water edges darken their water), so the silhouette gives away coastlines and
  relief but not rivers. The party's unrevealed neighbors are a lighter grey.
- Markers: a white pawn for the party, a yellow gem per POI, danger-colored hex rings on
  revealed hexes and a white ring on the selected one. Left-drag pans, right-drag rotates,
  wheel zooms. A click that doesn't drag moves the party; a double click opens the hex.
- The scene draws only when something changed (camera, data, size). Drawing every frame kept
  the main thread busy enough under software rendering that clicks were handled late.
- **Bug fix (M3's start search):** solving the six ring chunks can re-solve cells inside
  chunk 0, so a start hex chosen right after chunk 0 could change terrain (seen: Hills became
  Swamp). The start is now picked from the finished tiles. Regression test with that seed.
- 11 new tests (1,100 in all). Browser check (production build, headless Chromium, which has no
  WebGPU here, so on the WebGL2 fallback with software rendering): the 3D view opens in
  0.6-5 s; player view, GM view, a tilted close-up; click moves the party, double-click opens
  the hex page, drag pans without moving it; Hills and Desert/arctic starts.
- Not checked here: a real WebGPU browser (the headless one has none). The user checked it in
  Chrome on 2026-11-05.

**M4b — 3D polish. ✅ Done 2026-11-05.** Animated water (caustics, coastal waves), decorations,
post-processing.
Decisions (user, 2026-11-05):
- **No buildings until M6.** hex-map-wfc scatters houses and windmills along roads; here a
  building would suggest a settlement the game doesn't have. M6 puts buildings on POI hexes.
- **Scenery follows terrain:** Forest/jungle dense trees, Grassland a few clumps, Swamp sparse
  trees with water lilies and flowers, Desert/arctic rocks only, Hills and Mountains their hill
  and mountain models, bridges where roads cross rivers. None on fog silhouettes.
- **All four screen effects, as hex-map-wfc:** ambient occlusion, vignette, depth of field and
  film grain (off if the WebGL2 fallback can't run them).

Built (`src/render3d/`): `scenery.ts` (pure: what decorations go on each hex), `water.ts`,
`wavesMask.ts`, `postFX.ts`, and a render-mode uniform in `tileMaterial.ts`. What's worth
knowing:
- **Scenery is deterministic per hex** (world seed + hex), so revealing or re-solving never
  reshuffles a hex's trees. Forest/jungle: one dense tree group on every flat hex, and trees
  beside its rivers and roads (toward grass edges, off the water). Grassland ~22% clumps. Swamp:
  sparse trees, water plants, lilies on rivers. Desert/arctic: rocks. Hills/Mountain: hill and
  mountain models; cliffs sometimes get one too. Bridges on every river crossing. River ends
  without a lake get a hill. Chances are in `SCENERY_TUNING`. Decorations are hidden on fog
  silhouettes and dimmed with their hex in GM view.
- **Water and masks cover the map's bounds** (centered on the tiles, at hex-map-wfc's
  2048-texels-per-180-units scale), not a fixed square at the origin, ready for M5's growth.
- **The coast masks are drawn 3 frames after the tiles change.** Drawn right away (before the
  scene's first render) they came out empty, so there were no waves.
- **One material, three modes** (normal, true color for the coast mask, water mask), switched by
  a uniform. The water layer only shows where water is visible: none under fog, dimmed in GM
  view.
- Markers are an overlay drawn after AO and blur, alpha-blended (hex-map-wfc adds it).
- **Animation:** the water moves, so the map draws every frame, except with the OS "reduce
  motion" setting, where it draws only when something changes (and the water stands still).
- 7 new tests (1,107 in all). Browser check (production build, headless Chromium on the WebGL2
  fallback with software rendering, "reduce motion" emulated): AO, depth of field, vignette,
  grain, sparkles and coastal waves all render; scenery per terrain; click, double-click and
  drag still work. With animation on, software rendering is too slow for scripted screenshots.
  **Not checked here on real WebGPU; the user checked the view in Chrome on 2026-11-05.**

**M5 — Chunk growth. ✅ Done 2026-11-05.** Background solve near edges, triggered early enough
that revealed hexes never border an unsolved chunk (section 4). `isLocked` from M1 enforces the
revealed-is-fixed rule.
- `src/world/growth.ts` (pure): `chunksToGrow` (unsolved chunks within `GROW_RADIUS` = 8 of
  the party, nearest first), `lockedKeys` (revealed hexes), `applyChunkResult` (applies a
  solve's updates but never changes a revealed hex: a second guard behind `isLocked`).
- `ADD_CHUNK` in the reducer; `src/state/useChunkGrowth.ts` drives it from the overland screen:
  one worker solve at a time, each from the latest tiles, after every move and every landed
  chunk. A failed chunk is skipped for the session (logged). The toolbar shows "Extending the
  map…" while a chunk solves.
- 3D: tiles new since the last build drop into place, rippling out from the middle of the new
  area, and their scenery appears when they land (not with "reduce motion"). The camera only
  centers on the party on the first build, so growth doesn't move the view. The water and coast
  masks follow the new bounds.
- **Measured** (`growth.test.ts`, the PLAN's test, two seeds): 30 chunks grown along random
  walks of 511 and 802 steps (479 and 743 hexes revealed, 8,029 tiles): **0 dropped cells, 0
  edge mismatches, no revealed hex ever changed**, and the party was never closer than 8 hexes
  to unsolved ground. About 0.15 s per chunk.
- 6 new tests (1,113 in all). Browser check (production build, WebGL2 fallback): walking 30
  hexes east grew the map from 7 to 10 chunks with no stop; the 2D GM view and the 3D view show
  the new chunks joining the old seamlessly. The drop animation wasn't watched (it only runs
  with animation on, too slow in software rendering).

**M6 — Map-aware points of interest. ✅ Done 2026-11-05.** Settlement anchors, 3D and 2D markers, and
`waterForHex` reading real tile edges. The rest of the town-map water work (river bends,
junctions, mouths and lakes) is punch-list item 2.
Decisions (user, 2026-11-05), answering the open question of whether anchors replace or add
to the d200's settlements:
- **Add:** settlement anchors become settlements, and the d200 still gives settlements anywhere
  as today. Anchors are road ends, road junctions (3+ roads) and river crossings: about 6.4% of
  land hexes, so roughly 12% of revealed hexes end up settlements (6% before). An anchor's
  Village/Town/City/Metropolis comes from re-rolling the d200 until it lands on a settlement
  row, so the type odds stay the table's. (No coast anchors: coast tiles never carry roads.)
- **Markers:** 3D models per kind (settlement buildings sized by type, tower, fort for keeps,
  mine for dungeons, standing stones for shrines) and new models for camps (tents and a fire)
  and rifts (glowing shards). 2D icons per kind instead of the yellow dot.


Built:
- `src/world/anchors.ts`: `isSettlementAnchor(tileType)` (road end, 3+ roads, river crossing).
  Read from the tile at reveal, so nothing is saved. `rollAnchorSettlement` (generateHex.ts)
  re-rolls the d200 until a settlement row. Applies on reveal, on the starting hex and on
  Reroll (an anchor stays a settlement; which one is re-rolled).
- **Town-map water from tile edges** (`waterForEdges`, settlementPlan.ts): the coast faces the
  hex's sea edges (shoreline edges count half, so a tile touching water only at a corner faces
  that corner); otherwise a river leaves through the hex's first river edge; an Ocean hex keeps
  its random-side coast. Used whenever the hex has a tile (the /poi review page has none, so
  its Ocean and Coast settlements get a random side). The isthmus problem from map_generator's 1a can't happen: a tile's water
  edges are contiguous. River bends and lakes are punch-list item 2.
- **3D:** POI models from `planPoiModels` (scenery.ts) in spots clear of the hex's road, river
  or water (`poiSlots`): Village 2 houses and a well, Town 3 houses, church, market, City town
  hall, church, market, tower, 2 houses, Metropolis adds a smithy and a house (buildings scaled
  0.5 down to 0.38); Tower the tower with its roof; Keep the fort; Dungeon the mine; Shrine the
  standing stones. Camps (two tents and a fire) and rifts (a dark scar with glowing violet
  shards) are built from simple shapes. A POI's models replace the hex's trees (a bridge
  stays). Landmarks, cataclysms, hand-edited POIs and anything on open water keep the gem.
- **2D:** a glyph per kind inside the yellow badge (house, tower, keep, cave mouth, standing
  stones, tent, rift), listed in the legend. The party dot moves aside on a POI hex.
- **Bug fix, river-loop breaking (from M2):** a loop through a new chunk can close far outside
  it, and the breaker patched at the closing edge even near the edge of the tiles a worker
  request carries, where the patch can't see its outer neighbors. That left edge mismatches
  (10 in one 30-chunk walk). The patch now goes on a loop cell inside the new chunk
  (`loopCells`, `canBreakAt`). `npm run sim` (20 seeds): 0 failed, 0 dropped, river loops 0.15
  per world (0.1 in M2). Twelve 30-chunk walks: 0 dropped cells, 0 edge mismatches. The growth
  test now allows a rare drop as long as every mismatch is at a dropped cell (one drop was
  seen in 360 solves before the fix).
- 16 new tests (1,129 in all). Browser check (production build, WebGL2 fallback): a save
  seeded with one POI of every kind shows every glyph in 2D and every model in 3D. Not seen in
  normal play yet, nor on real WebGPU.

**M7 — GM editing. ✅ Done 2026-11-05.** Pin a tile and re-solve locally, with the mismatch flag.
Decision (user, 2026-11-05): revealed hexes only (from the hex page's Edit form); editing
unrevealed hexes ahead of the party from GM view can come later.
- `src/world/pin.ts`: terrains fall into shape classes (Ocean, Coast, Hills, Mountain, and
  flat land). A change between flat-land biomes is a label only (the biome comes from the
  world's moisture and temperature; 2D color, 3D tint and scenery follow the hex's terrain).
  Otherwise the hex's tile is pinned to the wanted class and the unrevealed hexes within 2 are
  re-solved, widening to 3 and then 4 when nothing fits; everything else is locked, so
  revealed neighbors never change. If nothing fits, nothing changes and the hex gets
  `tileMismatch` (its terrain is a label over another shape): a red dashed hex in 2D GM view, a
  red ring in 3D GM view, and a note on the hex page. Editing back to a fitting terrain clears it.
- Runs in the reducer on the main thread (the WFC solver is now in the main bundle too): up to
  ~0.7 s for a big edit.
- **Measured** (40 hexes in 2 worlds): with only the edited hex revealed, every shape fits
  (Mountain, Hills, Ocean, Coast: 100%). With one revealed neighbor, Coast fits 29/36, Hills
  24/35, Mountain 13/40, **Ocean 2/40**: open water needs water or shoreline on all six sides,
  and a Mountain can't rise from a revealed neighbor's level in one step.
- **Fallback** (user, 2026-11-05): when the exact shape can't fit, the closest one that does
  is used, still flagged as a mismatch: Ocean → a shore tile with 3+ water edges, then any
  shore tile; Mountain → Hills; flat land → shore, then Hills. Same 40 hexes with one revealed
  neighbor: Ocean now reshapes 33/40 (2 exact, 31 fallback), Mountain 35/40 (13 exact, 22
  Hills); Coast and Hills have no near shape (9 and 11 stay label-only).
- 11 new tests (1,139 in all). Browser check through the Edit form: an Ocean edit inside
  revealed land and a Mountain edit beside it both ended as mismatches with the note, the 2D
  dashed hex and the 3D ring; no revealed tile changed.

**M8 — Saving and polish. ✅ Done 2026-11-05.** Versioned save, an approximate size meter,
new-campaign dialog (seed, starting terrain), and a PNG export of the 2D map.
Decisions (user, 2026-11-05): PNG export in two versions (player and GM); add saving the
campaign to a file and loading it back.
- The save was already versioned (M3). New: a notice on the start screen when a save from an
  older format couldn't be loaded, instead of silently starting fresh.
- **Campaign menu** (toolbar): world seed; a save meter (characters stored against the ~5
  million browsers allow; amber from 70%, and a warning if a save fails); Save to file (the
  save as JSON, named `hex-crawl-<seed>-<date>.json`); Load from file (checked: valid JSON, a
  campaign, this format, complete; confirms before replacing a campaign; `LOAD_MAP`); the two
  PNG exports; New map. Load from file is on the start screen too.
- **New-campaign dialog:** an optional seed, a whole number or any word (hashed), blank for
  random (`seedFromText`).
- **PNG export** (`render2d/MapExportSvg.tsx`, `exportPng.tsx`): the 2D map drawn with the same
  HexTile, cropped to its content, at 2x for printing (capped at 8,000 px a side). Player map:
  revealed hexes and their frontier; GM map: every solved hex, unrevealed dimmed.
- A 7-chunk campaign saves as about 26 kB, so storage is far from a limit in normal play.
- 9 new tests (1,147 in all). Browser check: a word seed, the menu, save to file, both PNGs
  (746 x 672 and 6,012 x 6,192 px), New map, and loading the file back (identical campaign).

## Punch list (updated 2026-11-05)

All open work, in one suggested order. **Waiting on** says who moves next: the user (a
decision, a reference image or table content) or Claude (ready to build). Sizes are rough:
S a few hours, M a day or two, L several days.

| # | Item | Area | Waiting on | Depends on | Size |
|---|---|---|---|---|---|
| 1 | Fewer roads: about 10% of land hexes | Overland map | Claude: ready | | S-M |
| 2 | Town-map water from tile shapes | Overland map | Claude: ready | | L |
| 3 | GM editing of unrevealed hexes | Overland map | Claude: ready (a few design questions) | | M |
| 4 | Encounter rollers for dungeons, and the Tavern table | Sites | Claude: ready | | S |
| 5 | No repeated room text within one dungeon | Sites | Claude: ready | | S |
| 6 | Site maps for Tombs, Ruins and Temples | Sites | User: a reference image per kind | | L |
| 7 | Site-interaction tracking | Sites | User: answer the scope questions | 6 (map markers only) | L |
| 8 | Mongo backend and multiple campaigns | App | User: choose hosting | 6, 7 | L |
| 9 | 2D Coast color | 2D map | User: a reference image | | S |
| 10 | Encounter tables for Tower, Shrine, Rift, Keep, Camp | Sites | User: the tables | | M |
| 11 | Road encounter tables | Overland map | User: the tables | | S-M |
| 12 | Camp central-feature table | Sites | User: the table | | S |
| 13 | NPC activity that fits the profession | Sites | User: only if it bothers them in play | | S |

### Details

**1. Fewer roads.** WFC puts roads on about 24% of land hexes, a lot for 6-mile wilderness
hexes. Target (user, 2026-11-05): about 10%, by lowering the road tile weights in the world
rules, measured with `npm run sim`. Roads are not drawing only: since M6, road ends, road
junctions and river crossings are settlement anchors (about 6.4% of land), so fewer roads
means fewer anchored settlements; measure the anchor share alongside and check it with the
user. The change affects unsolved ground only, never solved hexes, and must keep "0 failed, 0
dropped cells". Travel rates on roads are out of scope for now (user, 2026-11-05).

**2. Town-map water from tile shapes.** The town map draws one straight river or one coast:
`waterForEdges` (settlementPlan.ts) uses only the first river edge, and the river is a
straight band cut out with convex half-plane clipping, so this replaces that code. A layout
change that keeps the current look: no reference image, the user checks screenshots.

| Shape | Draw it as |
|---|---|
| Straight river (RIVER_A, river crossings) | Drawn right today |
| Bend (RIVER_B, in NE and out W; one of the two commonest river tiles) | Following the bend |
| River end (RIVER_END) | From the town's middle out to its one edge; with a lake, into a lakeshore |
| Junction (RIVER_D/E/F, three river edges) | Two rivers joining |
| River mouth (RIVER_INTO_COAST) | Coast and river together (today the river is lost) |
| Lake on a plain grass hex | A lakeshore on one side, reusing the coast drawing, side from the seed |

Also: the /poi review page has no map hex, so its Ocean and Coast settlements get a random
water side; give it a way to pick a tile shape, so every water case can be reviewed there.
Later: a true island drawing for towns on Ocean hexes.

**3. GM editing of unrevealed hexes.** M7 edits revealed hexes only (the hex page's Edit
form). This adds editing hexes ahead of the party from the GM view. To settle first: how the
GM picks a hex and terrain there, and whether edited unrevealed hexes are protected from
later re-solves.

**4. Encounter rollers for dungeons, and the Tavern table.** The Cave, Deep Tunnels, Ruins and
Tavern d100 tables exist, but no screen uses them. `DungeonSiteView` has no encounter roller;
`SITE_TYPE_TO_ENCOUNTER_KEY` (encounterTables.ts; Tomb uses Ruins, since the book has no Tomb
table) is referenced only by its test. Reuse `EncounterRoller`.

**5. No repeated room text.** Reroll once on an exact match. The book allows repeats; this is
only for variety.

**6. Site maps for Tombs, Ruins and Temples.** Tower, Keep, Settlement and Camp are done. Tomb
and Ruins are dungeon types drawn by `DungeonMapSvg.tsx` in the shared classic-blue style.
"Temple" is both `Temple (oracle)` (d200 84-87, a Shrine, which has no map today, so it needs a
new one) and `Ruins (temple)` (a Ruins dungeon); user: both (2026-11-01). Confirm style-only
vs. layout per kind. Before tracking, whose map markers would otherwise be built twice, and
before Mongo, since a layout change alters generated data.

**7. Site-interaction tracking.** A typed per-site event log at room or feature level (monster
defeated, treasure looted, NPC killed/recruited/talked to, door forced), not freeform notes,
so a revisited site reflects what the party did. Triggered by party actions, not a GM
"advance time" button. Scope questions: which event types; which site kinds (dungeons
first?); how events show (contents marked cleared, or a per-room log); undo; what Reroll Site
does to a log. Everything but the map markers can be built before item 6. Before Mongo,
because it changes the saved schema.

**8. Mongo backend and multiple campaigns.** Reuses the user's Atlas cluster with a new
database. Open: sharing TypeScript types between client and server (two tsconfigs,
unverified), and hosting with an SPA route fallback. Less urgent than it was: a 7-chunk
campaign saves as about 26 kB of the ~5 MB localStorage, and M8's Save to file moves a
campaign between browsers. Moves up if multi-device play is needed.

**9. 2D Coast color.** The land part of a shore hex is filled with Coast's blue (`#4a90c4`,
`hexgrid/colors.ts`), so up close it reads like shallow water beside the drawn sea. Noticed by
Claude in the M3 browser check; the user kept it as an item on 2026-11-05. A land color, or the
neighboring biome's, would separate land from water.

**11. Road encounter tables.** When the party is on a road hex, roll on road encounter
tables instead of the terrain's (user, 2026-11-05). Waits on the tables from the user, since
tables are transcribed verbatim. To settle when they arrive: what counts as "on a road" (any
hex with a road edge?), and whether road tables vary by terrain.

**13. NPC activity tier.** `npcTables.ts`'s 1d5 tier ignores profession (e.g. "Dwarf Labourer
— Infirm").

### Closed, and not planned

Closed: the 3D view on real WebGPU (checked by the user in Chrome, 2026-11-05), hex
scale (6 miles per hex, user, 2026-11-05; see Decisions),
map_generator's 1a (replaced by WFC and biome noise; its targets hold, see section 2),
the open question of whether anchors replace or add to the d200 (add, M6), and the fog look
in 3D (grey silhouettes, M4).
Map_generator's 1b and 1c became item 2.

Not planned: a turn-clock state machine, a full procedural dungeon crawler, NPC adventuring
parties, combat stat blocks (name and flavor only), undo.

## Licensing

- Project license: **CC BY-SA 4.0**, as map_generator, which is needed for the Basic Fantasy
  material.
- Ported hex-map-wfc code is **MIT**. Keep Felix Turner's copyright and MIT notice in the
  header of each ported file and in the README's Attribution section. MIT allows reuse inside a
  CC BY-SA project.
- KayKit Medieval Hexagon Pack (`hex-terrain.glb`, textures) by Kay Lousberg: **CC0**
  (checked in M4a). Credited in the README anyway.
- The "Venice Sunset" HDRI from Poly Haven (`venice_sunset_1k.hdr`, the 3D sky lighting):
  **CC0**. Credited in the README.
- map_generator's rule carries over: don't name any other game, publisher or rulebook in the
  project, except where a license requires attribution (Basic Fantasy, above and in the
  README).

## Risks

- **Revealed hexes can't be changed.** hex-map-wfc's recovery freely unfixes neighbor cells.
  M1 measured the cost: solves still always succeed, but with every boundary tile locked, 16%
  need drops, which leave an edge that doesn't match. Mitigation, built in M5: grow chunks
  early (section 4); measured since, one drop in 360 chunk solves. M7's local re-solves near
  revealed hexes face the same limit, which is why M7 has the fallback and mismatch flag.
- **Small tile set.** It has no swamp, desert, forest or lake tiles. Biome tinting and
  decorations must make these readable in 3D, and the 2D view relies on fill color plus icons.
- **WebGPU support.** Safari and Firefox support varies. The 2D view is always available. The
  WebGL2 fallback was tested headless (M4), and the user checked WebGPU in Chrome
  (2026-11-05).
- **Bundle size.** Three.js plus a 2.5 MB GLB plus textures. `render3d/` is lazy-loaded: the 3D
  chunk is 930 kB (258 kB gzipped), and the main bundle didn't grow (M4a).
- **Tooling limits** from map_generator: Node 20.16 and Vite 6.4 (not 7 or 8). Confirmed
  working with Three.js 0.183.2 (M4). hex-map-wfc's HTTPS dev server isn't needed: WebGPU works
  on `http://localhost`.
