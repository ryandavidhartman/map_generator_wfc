# History: how the WFC Hex Crawl Generator was built

The build log for milestones M0-M8, moved out of `docs/PLAN.md` on 2026-11-05 so the plan
describes only the system as it is and the open work, followed by punch-list work since. Nothing here is current spec: where this
log and PLAN.md disagree, PLAN.md wins. Code comments that cite "PLAN.md M5" and the like mean
the entries below.

Each milestone ended with tests passing and, where there was UI, a browser check.

## Original decisions (2026-11-04)

The decisions the plan started from, as written. PLAN.md's Decisions table has them as built,
with the later decisions added.

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

## Milestones

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
town-map water read from real tile edges (`waterForEdges`). The rest of the town-map water work (river bends,
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

## After M8: punch-list work

### Item 2, town-map rivers (2026-11-06, branch `town-map-rivers`)

- **Ported from map_generator's PR #1** (its punch-list 1b, still open there when ported):
  `riverCourse.ts` (the course through a notional hex, the cubic bend, distance helpers), the
  curved block cutting in settlementPlan.ts (`riverShape`, `cutCellByRiver`, `weldCells`, the
  bridge spots and the wall-gap walk), `RiverArt` in SettlementMapSvg.tsx, and its test helpers
  (`settlementRiverChecks.ts`). Changes: pointy-top edges named by `HexDir`, and
  `riverCourseFromEdges` (new) to turn a tile's undirected river edges into an entry and exit.
  map_generator's 1a code (world formula, neighbor-weighted terrain, per-hex river records)
  wasn't taken: WFC already does that job here.
- **Baseline:** before any edit, 288 coast-only, island and no-water towns (24 seeds × 4 sizes ×
  3 cases) were hashed from main at 5275db4 into `settlementPlanBaseline.test.ts`; all came out
  identical after the port. The hashes match map_generator's own pre-1b baseline, so the two
  settlement plans hadn't drifted.
- **Junctions** (RIVER_D/E/F) are drawn as two arms meeting at the exit, which reads as two
  rivers joining; RIVER_D's even split gives its exit to the first edge in NE…NW order.
- **The no-tile river** (`waterForHex` on the /poi page) snaps the Coast neighbor's direction
  to the nearest edge and stays straight; with no direction, the plan picks a straight pair
  from the seed.
- Tests: 1,497 in about 30 s; the river sweep runs in its own file.
  Screenshots of a straight river, a bend, a river end, two junctions and a village bend were
  checked by Claude and approved by the user (2026-11-06), junctions included.

### Handoff gaps (2026-11-06, branch `handoff-gaps`)

So another agent with only this repo can take punch-list items 1-5: `npm run town-maps`
(scripts/townMaps.ts) renders the town map for every water tile and screenshots it; CLAUDE.md
gained the headless-Chromium technique (previously only in Claude's session memory) and a
"Working with the user" section; PLAN.md item 2 got a self-contained spec for the /poi water
picker in place of a pointer to map_generator's `poiReviewRiver.ts`.

### Town baseline hashes on arm64 (2026-11-06, branch `baseline-float-hash`, merged as PR #5)

On another machine (an Ubuntu instance under OrbStack on a Mac), `npm test` failed 161 of the
288 cases in `settlementPlanBaseline.test.ts`, and nothing else. The test hashed the plan's
JSON with raw floats, and the last bit of `Math.sin`/`cos`/`atan2` results can differ between
x86 and arm64 (and between Node versions). Claude's diagnosis, not checked on the arm64 machine
at the time of writing. The hash now rounds every number to 6 decimals first (`planHash`). The
table was re-captured on x86, where the unrounded hashes still matched the pre-item-2 ones, so
it pins the same plans. The regenerate command in the file's header was also fixed: under
vitest 4, `--silent=false` alone prints nothing; it needs `--silent false --reporter=verbose`.

On the same branch (2026-11-10), with the baseline passing, a full `npm test` still failed 1-5
other tests at random by timeout (campPlan, settlementPlan, settlementWater): cases that loop
over seeds take 2-4 s alone but up to ~7.5 s when every file runs in parallel, past vitest's 5 s
default. Each passed when run alone. Instead of raising one more per-test timeout, `vite.config.ts`
now sets `test.testTimeout: 30_000` for the whole suite. Two full runs in a row then passed
(1497 tests, about 60 s on this machine).

### Item 1, fewer roads (2026-11-10, pushed straight to main as 262426a at the user's request)

Roads covered about 24% of land; the target was about 10% (user, 2026-11-05). `ROAD_WEIGHT`
in world/solve.ts scales every road tile's weight in `getWorldRules`, the way `RIVER_WEIGHT`
does for rivers. `npm run sim` now also prints settlement anchors as a share of land
(`anchorShareOfLand` in stats.ts), since road ends, junctions and river crossings are anchors.

Measured with `npm run sim -- --seeds 30` (19 chunks each; every run 0 failed, 0 dropped cells
except where noted):

| ROAD_WEIGHT | roads / land | anchors / land | rivers / land | lakes / land | note |
|---|---|---|---|---|---|
| 1 (before) | 23.6% | 6.4% | 16.2% | 5.1% | |
| 0.5 | 18.1% | 4.7% | 16.7% | not recorded | 10 worlds; 1 dropped cell |
| 0.3 | 15.4% | 3.8% | 17.4% | not recorded | 10 worlds |
| 0.2 | 13.2% | 3.5% | 21.1% | not recorded | 10 worlds |
| **0.12** | **9.6%** | **2.2%** | **19.0%** | **6.2%** | chosen |
| 0.1 | 8.5% | 1.9% | 19.3% | 6.2% | |

Two alternatives were tried to keep more anchors. Scaling only the plain road pieces (straights,
bends, slopes) and leaving ends, junctions and crossings at full weight didn't cut roads (about
18% at every weight from 0.2 to 0.07) and pushed rivers to 23-26%. Scaling plain pieces ×0.08
and anchor tiles ×0.25 gave roads 9.6% and anchors 3.7%, but rivers 22.1% and roads ranging
1.7-17.9% between worlds. Claude asked; the user chose the plain option (every road tile ×0.12),
accepting about 22 anchored settlements per 1,000 land hexes instead of 64.

Settlements overall, measured afterwards by running `generateHexDetails` 20 times on every hex
of 10 worlds: 8.0% of land hexes get one when revealed (7.3% counting Ocean), against about 12%
before. The d200 alone gives 5.9% (1-in-6 gate × 71 settlement rows of 200), so anchors now add
about 2 points instead of 6.

Claude showed the user before/after 2D renders of seeds 3 and 11 (roads 22.6% → 4.8% and
25.3% → 14.5%: the remaining roads are long routes rather than a mesh). Every weight change
reshuffles the whole generated map, not only its roads, but never anything already solved.
Tests: 1,497 passed; `tsc -b` and the scripts' typecheck clean.

Side effects, left as they are: rivers rose to about 19% (target ~17%) and lakes to about 6%
(~5%). Lakes rose because more hexes have only grass edges. `lakeChance` was not lowered to
compensate: lakes are derived from the tile and `BIOME_TUNING` each time a hex is shown, so
changing it would add or remove lakes on revealed hexes in saved games. `RIVER_WEIGHT` 1.4 and
1.3 still gave about 19% rivers (the spread between worlds swamps the effect), so it stays 1.6.

CLAUDE.md said tuning changes never alter solved hexes. Claude found that true only for the
solve weights: `deriveHexGeo` reads `WORLD_TUNING` and `BIOME_TUNING` each time a hex is shown,
so changing them can move lakes on revealed hexes (whose terrain is saved) and terrain on
unrevealed solved ones. The user asked for the line to be corrected.

### Item 2 finished: river mouths, lakes, the /poi water picker (2026-11-10, pushed straight to main at the user's request)

With the rivers done on 2026-11-06, item 2 had three parts left. Its spec, as it stood:

| Shape | Draw it as | Status before |
|---|---|---|
| River end (RIVER_END) with a lake | Into a lakeshore | Done without the lake |
| River mouth (RIVER_INTO_COAST) | Coast and river together (the river was lost) | Open |
| Lake on a plain grass hex | A lakeshore on one side, reusing the coast drawing, side from the seed | Open |

plus a water picker on the /poi review page (a Water select and a Rotation select, the tile's
edges sent through `waterForEdges`, kept out of saves, the map labeled with tile and rotation).

- **Lake look:** Claude asked; the user chose a curved lakeshore with the sand strip and no
  piers (2026-11-10), over reusing the sea's straight shore and piers. Built so the layout code
  didn't change: the town is still cut straight on its lake side, exactly like a coast, so it
  stays convex, and the lake is a disc (1.6 × the town's radius) touching that cut. The first
  version let the shore's wobble push into the town (Village blocks in the lake, caught by the
  new test); the wobble now only pulls the shore away from the town.
- **Which water:** `waterForEdges` now reads `lake`. A river mouth is a coast that keeps its
  river edge (the tile's sea lies exactly across from it). A river end with a lake is a lake
  across from its river edge, with the river; a grass-only hex's lake side comes from the seed.
- **River into water:** given its edge and the opposite one, so the existing course, block
  cutting, wall gaps and bridges all apply; the drawn arm stops a little past the shore, under
  the water's fill. The river uses its own seeded stream and plain coasts gain no new keys, so
  all 288 baseline towns still hash the same.
- **/poi picker:** `ReviewWaterContext` (state/) carries the picked tile's edges to
  `SettlementView`, as a React context rather than a map-state field, so it can't reach a save.
  21 water options: From terrain, the 18 tiles with a sea, shoreline or river edge, RIVER_END
  ending in a lake, and a lake on a grass-only hex. `tileWaterEdges` (world/terrain.ts) gives a
  tile's water edges at a rotation; a test checks it against `deriveHexGeo` for every tile and
  rotation, and the town-maps script uses it too (it had its own copy).
- **Checks:** `checkRiverTown` accepts a river ending in water. New settlementWaterBodies.test.ts
  (8 tests: the water choices, lake plans for 4 sizes × 6 seeds, mouth and lake rivers at every
  rotation through `checkRiverTown`, no block or gate in the water). 1,506 tests pass; the suite
  ran in 29 s, so the 60 s seen earlier the same day was a busy machine. Browser check: /poi/180
  (a Town) in Chromium, driven over the DevTools protocol through six picker cases; the layout
  line named the right water and direction for each. Screenshots of the town-maps cases and the
  /poi cases were shown to the user, who tested it and approved ("looks good!", 2026-11-10).
- The spec's "Later: a true island drawing for towns on Ocean hexes" became punch-list item 14
  (user, 2026-11-10).

## Risks, as written during the build

PLAN.md's Risks section has them as they stand now.

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
