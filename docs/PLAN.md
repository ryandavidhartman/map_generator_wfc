# Plan: WFC Hex Crawl Generator

A React web app for running overland hex crawls in OSR-style games. It combines two projects:

- **[hex-map-wfc](https://github.com/felixturner/hex-map-wfc)** (Felix Turner, MIT) generates
  the overland map with Wave Function Collapse (WFC) and draws it in 3D with Three.js/WebGPU
  and the KayKit Medieval Hexagon tiles.
- **map_generator** (`~/dev/source/map_generator`, this project's author, CC BY-SA 4.0)
  supplies everything you get by clicking into a hex: terrain, danger, encounter rollers,
  points of interest, and the generated sites (dungeons, settlements, towers, keeps, camps,
  shrines, rifts) with their maps.

**Status (2026-11-05):** milestones M0-M8 are done; all open work is in the Punch list below.
This file describes the system as it is. How it was built, with the measurements and bug
fixes along the way, is in [`HISTORY.md`](HISTORY.md). All numbers are starting points to tune
by simulation.

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
rules, measured with `npm run sim`. Roads are not drawing only: road ends, road junctions and
river crossings are settlement anchors (about 6.4% of land, section 5), so fewer roads means
fewer anchored settlements; measure the anchor share alongside and check it with the user.
The change affects unsolved ground only, never solved hexes, and must keep "0 failed, 0
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

**3. GM editing of unrevealed hexes.** GM editing (section 6) covers revealed hexes only, from
the hex page's Edit form. This adds editing hexes ahead of the party from the GM view. To
settle first: how the GM picks a hex and terrain there, and whether edited unrevealed hexes
are protected from later re-solves.

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
campaign saves as about 26 kB of the ~5 MB localStorage, and Save to file moves a campaign
between browsers. Moves up if multi-device play is needed.

**9. 2D Coast color.** The land part of a shore hex is filled with Coast's blue (`#4a90c4`,
`hexgrid/colors.ts`), so up close it reads like shallow water beside the drawn sea. Noticed by
Claude in the M3 browser check; the user kept it as an item on 2026-11-05. A land color, or the
neighboring biome's, would separate land from water.

**10. Encounter tables for Tower, Shrine, Rift, Keep and Camp.** None exist yet. Waits on the
tables from the user (transcribed verbatim); then give each site view an `EncounterRoller`, as
item 4 does for dungeons.

**11. Road encounter tables.** When the party is on a road hex, roll on road encounter
tables instead of the terrain's (user, 2026-11-05). Waits on the tables from the user, since
tables are transcribed verbatim. To settle when they arrive: what counts as "on a road" (any
hex with a road edge?), and whether road tables vary by terrain.

**12. Camp central-feature table.** The camp's central feature is a generic placeholder; its
identity (campfire, war tent, totem…) is left open in `generateCamp.ts`. Waits on the table
from the user (transcribed verbatim).

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

## Decisions

As built. The original 2026-11-04 table is in HISTORY.md; the dates say when each was made.

| Topic | Decision |
|---|---|
| Scale | **One WFC tile = one overland hex, 6 miles across** (2026-11-04; miles 2026-11-05). Each tile is a clickable hex, and double-clicking opens the hex detail page. A 217-hex chunk is about 100 miles across. A future regional overview map would use 24 miles per hex (4 hexes across). |
| Rendering | **3D and 2D, with a toggle** (2026-11-04). The 3D view is hex-map-wfc's look; the 2D view is a flat top-down map for quick GM use and printing. Both draw from the same hex data. The choice is remembered per browser, starting with 2D (2026-11-05). |
| Play mode | **Solve ahead, reveal through fog of war** (2026-11-04). The party reveals hexes as in map_generator; the GM view shows everything. |
| Codebase | **Fork and port** (2026-11-04). map_generator's app was copied in and hex-map-wfc's JavaScript ported to TypeScript. The two projects develop separately. |
| Terrain | **WFC decides shape; noise decides biome** (2026-11-04). WFC places water, coast, rivers, roads and elevation; seeded noise assigns land biomes. |
| Region size | **Start with 7 chunks (1,519 hexes) and grow by chunk** (2026-11-04; 7 chunks since M3). Everything within 8 hexes of the party is kept solved. |
| Points of interest | **Rolled as in map_generator, plus settlement anchors** (2026-11-04; anchors add, 2026-11-05). The 1-in-6 gate and d200 Feature table stay; road ends, road junctions and river crossings become settlements too. |
| Danger | **The reveal-time rule stays** (2026-11-04). A hex's `dangerLevel` is computed when it's revealed, from its revealed neighbors. |
| GM editing | **Edit plus local re-solve, revealed hexes only** (2026-11-04; scope and fallback 2026-11-05). The GM changes a hex's terrain; WFC re-solves the *unrevealed* hexes within 2-4 to fit it, else the nearest shape that fits is used and the hex is flagged. Unrevealed hexes are punch-list item 3. |
| 3D look | **Grey fog silhouettes; scenery follows terrain; buildings only on POI hexes; all four screen effects** (2026-11-05). Camera: hex-map-wfc's orbit controls, tilt limited. |
| Saving | **localStorage: world seed, solved tiles, per-hex game data** (2026-11-04), plus save to / load from a file and player and GM PNG exports (2026-11-05). Mongo is punch-list item 8. |
| Roads | **About 10% of land hexes** (2026-11-05; punch-list item 1). Travel rates on roads are out of scope. |

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

- Campaign start: the GM picks a seed (or Random) and a starting terrain. `placeWorld` puts
  the start hex inland or at sea to match (section 4), and WFC solves 7 chunks: chunk 0 and
  the six around it (1,519 hexes). For a specific land terrain (e.g. Forest), the start is the
  hex nearest the origin in chunk 0 whose derived terrain matches, picked from the finished
  tiles, so it isn't always (0, 0); if chunk 0 has none, a new seed is tried
  (`src/world/startWorld.ts`). From there the map grows by chunk (section 4).
- Tiles come from hex-map-wfc's 34 active tile types × 6 rotations × up to 5 levels (about
  900 states), with its edge rules and weights (river tiles ×1.6, section 2). Roads are part of
  the same tiles, not a separate pass.
- The solve runs in a Web Worker (`src/world/solver.worker.ts`), with hex-map-wfc's
  backtracking and recovery (unfixing, then Local-WFC, then dropping cells), steered by the
  world's masks (section 2).
- **Revealed hexes are locked.** Recovery may only unfix or re-solve *unrevealed* hexes; a
  revealed hex is always a fixed constraint (`isLocked`). If a chunk can't be solved without
  touching a revealed hex, recovery's last resort drops a cell: it keeps the cell's tile and
  accepts an edge that doesn't match. Growing chunks early (section 4) makes this rare: one
  drop in 360 measured chunk solves.
- **Other changes from hex-map-wfc** (each ported file's header lists them): bitsets instead
  of string-keyed Sets for each cell's states (about 57 ms per chunk instead of 1.6 s); an
  injected per-chunk Rng from the world seed and the chunk, so a chunk's result doesn't depend
  on how many solves ran before it; chaining prunes kept on the backtracking trail; grass edges
  must match in level (what hex-map-wfc's solver enforces; its looser `edgesCompatible` isn't
  ported); unfixed cells cleared before every drop attempt (a bug fix); and no corner ocean
  seeds or first-chunk seeds in the world solver (the continent field does that job).

### 2. Terrain from tile and noise

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
  river tiles banned in one cell. The patch always goes on a loop cell inside the new chunk
  (`loopCells`, `canBreakAt`): a loop can close far outside it, near the edge of the tiles the
  worker request carries, where a patch can't see its outer neighbors and leaves mismatches.
  Result: about 0.15 loops per world.
- **Rivers and roads are features, not terrain.** `deriveHexGeo` also gives each hex's river,
  road, coast and sea edges, read from its tile and rotation. The town map uses them (section 5).
- **Lakes** are a feature: half of inland river ends, and 9.5% of hexes with only grass edges,
  picked by a hash of the seed and hex (stable, no noise needed). hex-map-wfc has no lake tile.
- **Eight terrains** (`ALL_TERRAINS`, which drives the pickers and legend): map_generator's
  River/coast is Coast here, and Hills is wired into the seven terrain-keyed tables. The start
  dialog's Random button rolls map_generator's 3d6 table (`terrainFor3d6`).

**Measured** in M2 with `npm run sim -- --seeds 40` (40 worlds of 19 chunks, about 4,100 hexes
each; 0 failed solves, 0 dropped cells, about 73 ms per chunk):

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

- Same rules as map_generator: the party starts on one hex and moves only to adjacent hexes.
  Moving into a hex reveals it and rolls its game data (danger, `dangerLevel`, point of
  interest).
- Solved but unrevealed hexes are hidden from players. The 2D and 3D views show unrevealed
  hexes next to the party as "unexplored" outlines the GM can click.
- **GM view toggle:** shows the whole solved map, dimmed where unrevealed, for planning.
- Hex game data is rolled at reveal, not at generation. So danger still depends on exploration
  order, and nothing beyond the map shape is decided before it's seen.

### 4. Chunk growth

- Chunks sit on an exact lattice in cube coordinates (`src/wfc/chunks.ts`): chunk centers
  are 17 hexes apart, and every hex belongs to exactly one chunk. The lattice extends without
  limit, so the map is unbounded. (hex-map-wfc instead positions its 19 grids with a
  world-space walk.)
- The worker solves a neighboring chunk in the background **before any revealed hex touches
  unsolved ground** (`src/world/growth.ts`): every hex within 8 of the party (`GROW_RADIUS`)
  must be solved, so after any step the nearest unsolved hex is at least 8 away. Revealed hexes
  then sit well clear of the cells a new chunk's recovery may change, so the revealed-is-fixed
  rule rarely restricts recovery. This matters: with every earlier tile locked, 16% of chunk
  solves needed drops; with nothing locked, none did (M1). Existing hexes along the shared edge
  are the new chunk's fixed constraints.
- Large-scale shape comes from the continent field, through the masks (section 2), not from
  seed tiles. This replaces map_generator 1a's "world formula".
- `placeWorld(seed, wantSea)` shifts the noise so every hex within 3 of the start hex is on the
  chosen side of sea level. Checking only the start hex itself left starts on the coast.
- **Lookahead:** each chunk solve also solves the 2 unsolved rings around it
  (`LOOKAHEAD_RINGS`), and then throws them away. Masks only apply to cells being solved, so
  without this a chunk could leave an edge its unsolved neighbors' masks can't match (1 ring
  left 4 dropped cells over 760 chunk solves; 2 rings left none, at 80 ms instead of 65 ms per
  chunk). The worker's context radius is R + 6.
- Measured over 30-chunk random walks: 0 dropped cells, 0 edge mismatches, no revealed hex ever
  changed, about 0.15 s per chunk (`growth.test.ts`).

### 5. Points of interest

- On reveal, the 1-in-6 gate and the d200 Feature table run exactly as in map_generator,
  verbatim.
- **Settlement anchors** (`src/world/anchors.ts`): a hex whose tile is a road end, a road
  junction (3+ roads) or a river crossing is an anchor, about 6.4% of land hexes. It's read
  from the tile when the hex is revealed, so nothing is saved. An anchor hex becomes a
  settlement, its type re-rolled on the d200 until it lands on a settlement row
  (`rollAnchorSettlement`, generateHex.ts), so the type odds stay the table's. This applies on
  reveal, on the starting hex and on Reroll. Other hexes roll as before, so the d200 still gives
  settlements anywhere: roughly 12% of revealed hexes end up settlements (6% without anchors).
  Coast tiles never carry roads, so there are no coast anchors.
- **3D markers** (`planPoiModels` in scenery.ts), placed in spots clear of the hex's road, river
  or water (`poiSlots`): settlements get KayKit buildings sized by type (Village 2 houses and a
  well, up to a Metropolis with a town hall, church, market, tower, smithy and houses); Tower
  the tower with its roof; Keep the fort; Dungeon the mine; Shrine the standing stones. Camps
  (two tents and a fire) and rifts (a dark scar with glowing violet shards) are built from
  simple shapes. A POI's models replace the hex's trees (a bridge stays). Landmarks,
  cataclysms, hand-edited POIs and anything on open water keep a yellow gem.
- **2D markers** (`poiIcons.ts`): a glyph per kind inside the yellow badge (house, tower, keep,
  cave mouth, standing stones, tent, rift), listed in the legend. The party dot moves aside on a
  POI hex.
- The site generators are unchanged except the settlement's water: `waterForEdges` reads the
  hex's real coast and river edges from its tile. The coast faces the sea edges (shoreline
  edges count half); otherwise a river leaves through the first river edge; an Ocean hex keeps
  a random-side coast. A tile's water edges are contiguous, so map_generator's isthmus problem
  can't happen. `waterForMapHex` (which calls `waterForHex`), the old guess from revealed
  neighbors, is used only when a hex has no tile, such as on the /poi review page. Bends,
  junctions, mouths and lakes are punch-list item 2.

### 6. GM editing

- Edit Hex keeps map_generator's terrain, danger and POI fields, for revealed hexes. Terrains
  fall into shape classes (Ocean, Coast, Hills, Mountain, flat land). A change between
  flat-land biomes is a label only: the biome comes from moisture and temperature, and the 2D
  color, 3D tint and scenery follow the hex's terrain. A change of class pins the hex's tile to
  that class (`src/world/pin.ts`).
- After a pin, WFC re-solves the unrevealed hexes within radius 2 (hex-map-wfc's Rebuild-WFC),
  widening to 3 and then 4 if nothing fits, with everything else locked, so revealed neighbors
  never change. If the shape still can't fit, the closest one that does is used: Ocean → a
  shore tile with 3+ water edges, then any shore tile; Mountain → Hills; flat land → shore,
  then Hills. Coast and Hills have no near shape, so they stay label-only.
- Either way the GM's terrain applies as a label, and a hex whose tile doesn't match it gets
  `tileMismatch`: a red dashed hex in 2D GM view, a red ring in 3D GM view, and a note on the
  hex page. Editing back to a fitting terrain clears it.
- Next to revealed ground, exact shapes often don't fit (measured with one revealed neighbor:
  Ocean 2/40, Mountain 13/40); with the fallback, Ocean reshapes 33/40 and Mountain 35/40.
  Open water needs water or shoreline on all six sides, and a Mountain can't rise from a
  revealed neighbor's level in one step.
- No river or lake controls, as in map_generator's 1a plan.

### 7. Saving

- One localStorage document, `wfc-hex-crawl:map`, written after every state change:
  `{ version, world: { seed, offsetX, offsetY }, chunks: [chunkKey], tiles: { hexId: [type, rotation, level] }, hexes: { hexId: Hex }, partyHexId, selectedHexId }`.
  `hexes` holds only revealed hexes. Two more keys hold per-browser view choices:
  `wfc-hex-crawl:gmView` (GM view) and `wfc-hex-crawl:view3d` (3D view).
- Tiles are stored, not re-derived from the seed. Solves depend on the order chunks were
  grown, so replaying the seed alone isn't reliable. Tile type ids are indexes into
  `TILE_LIST`, so reordering or removing tiles breaks saves.
- Size: a 7-chunk campaign (1,519 tiles) saves as about 26 kB of the ~5 MB localStorage
  allows. Generated sites stay the bulk of the save.
- **Campaign menu** (toolbar): the world seed; a save meter (characters stored against the ~5
  million browsers allow, amber from 70%, a warning if a save fails); Save to file (the save as
  JSON, `hex-crawl-<seed>-<date>.json`); Load from file (checked: valid JSON, a campaign, this
  format, complete; confirms before replacing a campaign), also on the start screen; the player
  and GM PNG exports; New map. Seeds can be a whole number or any word (hashed,
  `seedFromText`), blank for random.
- **PNG export** (`render2d/MapExportSvg.tsx`, `exportPng.tsx`): the 2D map drawn with the same
  `HexTile`, cropped to its content, at 2x for printing (capped at 8,000 px a side). Player map:
  revealed hexes and their frontier; GM map: every solved hex, unrevealed dimmed.
- Old saves aren't migrated (they're test data). A save with the wrong `version` starts a new
  map, with a notice on the start screen.

## Architecture

This section covers structure and flow: what lives where, how data moves, and how the views
draw. Tuning values, sizes and visual details live in the code (constants and file headers)
and in HISTORY.md. Every claim here is checked against the code in
[`ARCHITECTURE-CHECKLIST.md`](ARCHITECTURE-CHECKLIST.md); update both together.

```
src/
  data/        ← from map_generator: tables (Terrain gained Coast and Hills; 3d6 start table)
  engine/      ← from map_generator: sites, encounters, treasure; anchor settlements in
                 generateHex.ts, tile-edge water in settlementPlan.ts
  wfc/         ← ported from hex-map-wfc
    tiles.ts          the tile set (TILE_LIST): edges and levels per tile
    cube.ts           cube-coordinate helpers
    rules.ts          edge matching and adjacency lookups, findMismatches
    solver.ts         HexWFCSolver: propagation, backtracking, unfixing
    recovery.ts       solveRegion: recovery (Local-WFC, drops), with isLocked
    chunks.ts         the chunk lattice, solveChunk, per-chunk Rng
    rng.ts            the seeded generator
  world/       ← the bridge between tiles and game hexes
    noise.ts          seeded noise
    fields.ts         continent / elevation / moisture / temperature fields, placeWorld
    masks.ts          zones and per-cell allowed tiles
    solve.ts          solveWorldChunk (masks, lookahead, river loops), the world's rules
    rivers.ts         river-loop detection and breaking
    terrain.ts        deriveHexGeo: tile + fields → terrain, edges, lake
    stats.ts          world measurements (for tests and `npm run sim`)
    protocol.ts       worker request and response
    solver.worker.ts  the Web Worker
    client.ts         WfcClient: promise wrapper around the worker
    workerSolver.ts   the app's ChunkSolver, backed by one shared worker
    hexTiles.ts       saved tiles by hex id, geoAt
    startWorld.ts     createStartingWorld
    growth.ts         chunksToGrow, applyChunkResult
    anchors.ts        settlement anchors
    pin.ts            GM terrain edits (pinHex)
  render2d/    ← the overland 2D map (SVG)
    HexGridSvg.tsx    the pan/zoom map, player or GM view
    HexTile.tsx       one hex, drawn from saved data
    tileShapes.ts     river, road and coast paths from a tile's edges
    mapData.ts        shared map geometry
    poiIcons.ts       POI glyphs
    MapExportSvg.tsx, exportPng.tsx   PNG exports
  render3d/    ← the overland 3D map (Three.js), lazy-loaded
    layout.ts         pure: tile placement and looks (tileDraws)
    scenery.ts        pure: decorations and POI models per hex
    tileMaterial.ts   the tile material
    MapScene.ts       renderer, camera, controls, meshes, markers, picking
    water.ts, wavesMask.ts, postFX.ts   water, coastal waves, screen effects
    ThreeMapView.tsx  React wrapper: owns the canvas and the MapScene
  hexgrid/     ← map_generator's site map renderers, colors.ts, hexMath.ts
  state/       ← mapReducer, MapContext, useChunkGrowth, testWorld (test fixture)
  persistence/ ← localStorage.ts: the save and campaign files
  components/, routes/  ← from map_generator, plus the Campaign menu and start dialog
  App.tsx      ← routes, the 2D/3D and GM view toggles, lazy-loads the 3D view
```

- **Layering:** `wfc/` knows nothing about the world; `world/` builds on it. Both are plain
  TypeScript with no Three.js or React, tested headless in Vitest. Only `render3d/` imports
  Three.js (CLAUDE.md lists the files), and it's lazy-loaded, so Three.js stays out of the
  main bundle.
- **Hex orientation:** pointy-top throughout, as hex-map-wfc's models are built. map_generator
  was flat-top; the settlement map's water side maps tile edges to its own angles.
- **Routes:** `/` (the overland map), `/hex/:hexId` (the hex detail page) and `/poi/:n` (the
  POI review page, which has no map hex).

### Data flow

`MapState` lives in `mapReducer.ts`. `MapContext.tsx` provides it and writes the save after
every change (section 7). The reducer is synchronous, so it can't wait on the worker.

**Two solve paths:**
- **In the worker,** for the starting world and chunk growth. The worker keeps no state: each
  request carries the world params and the tiles near the chunk, and the whole solve runs
  inside it. The caller then dispatches the result.
- **In the reducer, on the main thread,** for GM edits: `EDIT_HEX` calls `pinHex`. So the WFC
  solver is in the main bundle too.

| Action | Dispatched by | What it does |
|---|---|---|
| `START_MAP` | the start dialog, after `createStartingWorld` | sets the solved world and reveals the start hex |
| `MOVE_PARTY_TO` | a map click, or the hex page | moves the party; into an unrevealed hex, reveals it and rolls its game data |
| `ADD_CHUNK` | `useChunkGrowth` | applies a grown chunk's tiles |
| `EDIT_HEX` | the hex page's Edit form | edits a hex; a terrain change may reshape its tile (`pinHex`) |
| `REROLL_HEX` | the hex page | re-rolls danger and the POI; an anchor hex stays a settlement |
| `LOAD_MAP` | the Campaign menu and start screen | replaces the campaign with a checked file |
| `SELECT_HEX`, `GENERATE_SITE`, `REROLL_SITE`, `NEW_MAP` | as in map_generator | |

- **Chunk growth** (`useChunkGrowth`, on the overland screen): whenever the state changes, the
  nearest unsolved chunk near the party is solved in the worker and dispatched. One solve at a
  time, so each starts from the latest tiles. A chunk that fails is skipped for the session.
- **Revealed hexes are guarded twice:** `isLocked` inside the solver (section 1), then
  `applyChunkResult`, which drops any update to a revealed hex before it reaches the state.
  `ADD_CHUNK` and `EDIT_HEX` both go through it (`EDIT_HEX` exempts the edited hex).
- **Saved versus derived:** edges, lakes and anchors are derived from the tile when needed,
  never saved. Terrain is derived too, except that a revealed hex saves its terrain with its
  game data, since a GM edit can make it a label over another tile shape (section 6). Section 7
  lists what the save holds.
- **Deterministic:** a grown chunk's solve depends only on the world params, the chunk and the
  tiles around it (per-chunk Rng from the world seed), and a hex's scenery only on the world
  seed and the hex, so revealing or redrawing never reshuffles a hex's trees. GM edits re-solve
  with an ordinary random roll.

### Rendering

- **2D:** `HexTile` draws one hex from saved data. The map, the GM view and both PNG exports
  all draw with it, so they always match.
- **3D:** `ThreeMapView` is a thin React wrapper; `MapScene` is imperative Three.js that owns
  the renderer, camera, controls, meshes and picking. The wrapper reads the map state from
  context and dispatches the same actions as the 2D map. Three.js's `WebGPURenderer` falls back
  to WebGL2 on its own.
- **Meshes and material:** the tiles are one BatchedMesh and the decorations (with the POI
  models) another; one tile material serves the normal view and the two masks the water needs,
  switched by a uniform. Fog and GM dimming are per-tile looks set in `layout.ts`.
- **Each frame:** the scene, then post-processing (`postFX.ts`). The markers are rendered
  separately and blended in after ambient occlusion, depth of field and the water, so those
  don't touch them; the vignette and grain still apply over them.
- **When it draws:** every frame, for the moving water, unless the OS "reduce motion" setting
  is on; then only when something changes.

## Licensing

- Project license: **CC BY-SA 4.0**, as map_generator, which is needed for the Basic Fantasy
  material.
- Ported hex-map-wfc code is **MIT**. Keep Felix Turner's copyright and MIT notice in the
  header of each ported file and in the README's Attribution section. MIT allows reuse inside a
  CC BY-SA project.
- KayKit Medieval Hexagon Pack (`hex-terrain.glb`, textures) by Kay Lousberg: **CC0**
  (checked 2026-11-05). Credited in the README anyway.
- The "Venice Sunset" HDRI from Poly Haven (`venice_sunset_1k.hdr`, the 3D sky lighting):
  **CC0**. Credited in the README.
- map_generator's rule carries over: don't name any other game, publisher or rulebook in the
  project, except where a license requires attribution (Basic Fantasy, above and in the
  README).

## Risks

- **Revealed hexes can't be changed.** Re-solves next to revealed ground have little room:
  chunk growth avoids it by growing early (section 4), and GM edits fall back to the nearest
  shape and flag a mismatch (section 6). Editing unrevealed hexes (punch-list item 3) will face
  the same limit.
- **Small tile set.** It has no swamp, desert, forest or lake tiles. Biome tinting and
  decorations make these readable in 3D, and the 2D view relies on fill color plus icons.
- **WebGPU support.** Safari and Firefox support varies. The 2D view is always available, and
  the WebGL2 fallback works (tested headless); the user checked WebGPU in Chrome.
- **Bundle size.** Three.js plus a 2.5 MB GLB plus textures, kept out of the main bundle by
  lazy-loading `render3d/`.
- **Tooling limits** from map_generator: Node 20.16 and Vite 6.4 (not 7 or 8), confirmed
  working with Three.js 0.183.2. hex-map-wfc's HTTPS dev server isn't needed: WebGPU works on
  `http://localhost`.
