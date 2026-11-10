# Architecture checklist

Every concrete claim in `docs/PLAN.md`'s Architecture section, with the code that proves it.
Re-run it after code changes that touch the files below, or before relying on the section:
check each row against its evidence, fix PLAN.md (or this file's evidence) where they've
drifted, and update the date and the result line. A claim that can't be tied to code gets
fixed or cut from PLAN.md. Line numbers drift; the named symbol is what counts.

Last full run: 2026-11-10 (see "Full audit" below); before that, 2026-11-05:
Result: 58 claims; 55 held, and 3 errors from the trim itself were found and fixed (marked FIXED).
Partial re-run 2026-11-06 (town-map rivers, punch-list item 2): rows 4 and 39 re-checked and
their evidence updated, rows 4a and 39a added; both hold.
Partial re-run 2026-11-10 (fewer roads, punch-list item 1): rows 15 and 18 re-checked after
`ROAD_WEIGHT` went into `getWorldRules` and `anchorShareOfLand` into stats.ts; both hold.
Partial re-run 2026-11-10 (town-map lakes, river mouths and the /poi water picker, punch-list
item 2): rows 4, 17, 32 and 40 re-checked and updated, rows 39b and 40a added; all hold.
Partial re-run 2026-11-10 (GM planning of unrevealed hexes, punch-list item 3): rows 34, 40,
44-47, 51, 53 and 55 re-checked, their line numbers updated (the reducer grew); rows 45a, 46a
and 51a added; all hold.
Full audit 2026-11-10 (after items 1-3): every row re-checked against the code; rows 30, 45a,
50, 51 and 53 had drifted line numbers (updated); all hold.

## File tree

| # | Claim | Evidence | OK |
|---|---|---|---|
| 1 | data/: Terrain includes Coast and Hills | data/tables.ts:12,14 | ✓ |
| 2 | data/: the 3d6 start table | data/tables.ts:32 `terrainFor3d6` | ✓ |
| 3 | engine/generateHex.ts: anchor settlements | generateHex.ts:78 `rollAnchorSettlement` | ✓ |
| 4 | engine/settlementPlan.ts: tile-edge water (rivers, coasts, lakes, river mouths) | settlementPlan.ts:269 `waterForEdges` (reads `lake` and keeps a mouth's `riverEdges`) | ✓ |
| 4a | engine/riverCourse.ts: town-map river courses | riverCourse.ts:97 `riverCourseFromEdges`, :150 `riverCourseInHex` | ✓ |
| 5 | wfc/tiles.ts: the tile set, edges and levels | exports `TILE_LIST`, `TileDef`, `LEVELS_COUNT` | ✓ |
| 6 | wfc/cube.ts: cube helpers | exports `cubeKey`, `cubeDistance`, `cubeNeighbor`… | ✓ |
| 7 | wfc/rules.ts: edge matching, adjacency, findMismatches | exports `edgesMatch`, `AdjacencyRules`, `findMismatches` | ✓ |
| 8 | wfc/solver.ts: HexWFCSolver, propagation, backtracking, unfixing | solver.ts header lines 9, 25; `propagate()` :145 | ✓ |
| 9 | wfc/recovery.ts: solveRegion, Local-WFC, drops, isLocked | recovery.ts header lines 3-17 | ✓ |
| 10 | wfc/chunks.ts: lattice, solveChunk, per-chunk Rng | chunks.ts:101 `chunkRng`, `solveChunk`, `chunkOf` | ✓ |
| 11 | wfc/rng.ts: the seeded generator | rng.ts:11 `mulberry32` | ✓ |
| 12 | world/noise.ts: seeded noise | exports `simplex2D`, `fbm` | ✓ |
| 13 | world/fields.ts: the four fields, placeWorld | exports `createWorldFields`, `placeWorld` | ✓ |
| 14 | world/masks.ts: zones and allowed tiles | exports `zoneOf`, `createMaskFor` | ✓ |
| 15 | world/solve.ts: solveWorldChunk with masks, lookahead, river loops; world rules | solve.ts:14-15 imports, :57-60, `getWorldRules` | ✓ |
| 16 | world/rivers.ts: loop detection and breaking | exports `findRiverLoops`, `breakRiverLoops` | ✓ |
| 17 | world/terrain.ts: deriveHexGeo → terrain, edges, lake; tileWaterEdges | terrain.ts:55 return value; :82 `tileWaterEdges` (equal to deriveHexGeo's edges for every tile and rotation: terrain.test.ts) | ✓ |
| 18 | world/stats.ts: used by tests and `npm run sim` | scripts/simulate.ts:7 imports it | ✓ |
| 19 | world/protocol.ts: request and response | exports `SolveChunkRequest/Response`, `handleSolveChunkRequest` | ✓ |
| 20 | world/solver.worker.ts: the Web Worker | solver.worker.ts:6-7 | ✓ |
| 21 | world/client.ts: promise wrapper | client.ts:22 `WfcClient`, :50 `new Promise` | ✓ |
| 22 | world/workerSolver.ts: one shared worker | workerSolver.ts:6-9 `client ??= new WfcClient()` | ✓ |
| 23 | world/hexTiles.ts: saved tiles, geoAt | exports `SavedTiles`, `geoAt` | ✓ |
| 24 | world/startWorld.ts: createStartingWorld | export | ✓ |
| 25 | world/growth.ts: chunksToGrow, applyChunkResult | exports | ✓ |
| 26 | world/anchors.ts, pin.ts (pinHex) | exports `isSettlementAnchor`, `pinHex` | ✓ |
| 27 | render2d files and roles | HexGridSvg (`gmView` prop), HexTile, tileShapes (`linePath`, `coastWaterPath`), mapData, poiIcons, MapExportSvg/exportPng | ✓ |
| 28 | render3d: layout and scenery pure | neither imports `three` (only MapScene, tileMaterial, water, wavesMask, postFX do) | ✓ |
| 29 | render3d/MapScene: renderer, camera, controls, meshes, markers, picking | MapScene.ts:206, 228, 316, 481, 585-648, 385 `pick` | ✓ |
| 30 | render3d/ThreeMapView: owns canvas and MapScene | ThreeMapView.tsx:16 `canvasRef`, 29 `new MapScene`, 61 `scene.dispose()` | ✓ |
| 31 | hexgrid/: site renderers, colors.ts, hexMath.ts | directory listing | ✓ |
| 32 | state/: mapReducer, MapContext, useChunkGrowth, testWorld, ReviewWaterContext | directory listing | ✓ |
| 33 | persistence/localStorage.ts: the save and campaign files | `saveMapState`, `campaignToJson`, `campaignFromJson` | ✓ |
| 34 | components/: Campaign menu, start dialog, planning view | CampaignMenu.tsx, StartMapDialog.tsx, hexdetail/PlannedHexView.tsx (and featureOptions.ts, the Feature table pick list it shares with the Edit form) | ✓ |
| 35 | App.tsx: routes, the two toggles, lazy 3D view | App.tsx:14, 41-42, 79-81 | ✓ |

## Layering, orientation, routes

| # | Claim | Evidence | OK |
|---|---|---|---|
| 36 | wfc/ knows nothing about the world | no `../world` import in src/wfc | ✓ |
| 37 | wfc/ and world/ have no Three.js or React | no `three` or `react` import in either | ✓ |
| 38 | only render3d/ imports Three.js, and it's lazy-loaded | grep; App.tsx:14 `lazy(import(...))`; no static import of render3d elsewhere; build: main bundle has no `WebGPURenderer` | ✓ |
| 39 | pointy-top; settlement water maps tile edges to angles | hexMath.ts:1; riverCourse.ts:54 `EDGE_ANGLE_DEG` (used by `waterForEdges`); settlementWater.test.ts:125 | ✓ |
| 39a | town-map rivers: crossings at the river edges' midpoints; one edge ends in town, two run through, three join; blocks cut around the band, wall gapped, bridged on main roads | riverCourse.ts `riverCourseFromEdges`, `hexEdgeMidpoint`; settlementPlan.ts `cutCellByRiver`, `weldCells`, the bridges and wall loops in `computeSettlementPlan`; settlementRiverChecks.ts `checkRiverTown` (items 1-6), riverCourse.test.ts | ✓ |
| 39b | town-map lakes and river mouths: a lake is a disc touching the straight waterfront cut, shore wobbling only away from town, no piers; a river end's lake across from its edge; a mouth's river runs from its edge, drawn up to the shore; plain coasts have no `lake`/`river` key | settlementPlan.ts:141 `LAKE_RADIUS`, :926 `lake`, :941 `coastRiverEdges`, :1387 `riverPlan`, :1397 the lake shore; settlementWaterBodies.test.ts; settlementPlanBaseline.test.ts unchanged | ✓ |
| 40 | the three routes; /hex/:hexId shows the planning view for a solved, unrevealed hex | App.tsx:79-81; HexDetailPage.tsx:21 `isPlannable` | ✓ |
| 40a | /poi: the water picker passes a tile's water edges to SettlementView through ReviewWaterContext, outside the map state | PoiReviewPage.tsx:32 `WATER_OPTIONS`, :163 `ReviewWaterProvider`; SettlementView.tsx:63-65 reads it before `geoAt`; MapState has no such field (mapReducer.ts:41) | ✓ |

## Data flow

| # | Claim | Evidence | OK |
|---|---|---|---|
| 41 | MapContext provides the state and saves after every change | MapContext.tsx:28, 32-34 | ✓ |
| 42 | the reducer is synchronous | no async/await/Promise in mapReducer.ts | ✓ |
| 43 | the worker keeps no state; a request carries world params and nearby tiles | protocol.ts:32-36 (fresh store per request); client.ts:52 | ✓ |
| 44 | EDIT_HEX and PLAN_HEX call pinHex; the solver is in the main bundle | mapReducer.ts:289, 318; build: main bundle contains `HexWFCSolver` | ✓ |
| 45 | dispatchers: START_MAP, MOVE_PARTY_TO, ADD_CHUNK, EDIT_HEX, REROLL_HEX, LOAD_MAP | StartMapDialog:30; HexGridSvg:125, ThreeMapView:30, HexBaseInfo:74; useChunkGrowth:36; HexBaseInfo:113, :78; useCampaignFile:25 (used by CampaignMenu and StartMapDialog) | ✓ |
| 45a | PLAN_HEX and CLEAR_PLAN come from the planning view, opened by double-clicking an unrevealed hex in GM view (2D and 3D) | PlannedHexView.tsx:109, :68; HexGridSvg.tsx:133-135; ThreeMapView.tsx:36 | ✓ |
| 46 | MOVE_PARTY_TO reveals and rolls only into an unrevealed hex | mapReducer.ts:210-213 | ✓ |
| 46a | the reveal uses the GM's plan where there is one, then drops it | mapReducer.ts:217-240 (a planned Feature row through `pointOfInterestForFeatureRoll`); plannedHexes.test.ts | ✓ |
| 47 | REROLL_HEX: an anchor hex stays a settlement | mapReducer.ts:267 | ✓ |
| 48 | LOAD_MAP takes a checked file | localStorage.ts:48 `campaignFromJson`; reducer comment :135 | ✓ |
| 49 | SELECT_HEX, GENERATE_SITE, REROLL_SITE, NEW_MAP as in map_generator | line-for-line match with ~/dev/source/map_generator's reducer | ✓ |
| 50 | growth: runs on state change, one at a time, failures skipped, on the overland screen | useChunkGrowth.ts:19-20, 24-27, 51; App.tsx:43 inside `OverlandMapScreen` | ✓ |
| 51 | two guards; ADD_CHUNK, EDIT_HEX and PLAN_HEX use applyChunkResult; the edited or planned hex exempt | growth.ts:56-67; mapReducer.ts:253, 291, 319 | ✓ |
| 51a | revealed and planned hexes are both locked: in the worker solve and in applyChunkResult | mapReducer.ts:143 `isLockedHex`, :147 `lockedHexIds`; useChunkGrowth.ts:32; plannedHexes.test.ts ("planned hexes are locked") | ✓ |
| 52 | saved vs derived | was: "terrain … never saved". A revealed hex saves `terrain` (mapReducer.ts:23) | FIXED |
| 53 | determinism | was: "re-solving never reshuffles anything". GM edits re-solve with `Math.random` (mapReducer.ts:289, 318). Chunk solves: solve.ts:66 → chunks.ts:114 `chunkRng` | FIXED |

## Rendering

| # | Claim | Evidence | OK |
|---|---|---|---|
| 54 | HexTile draws the map, GM view and both PNG exports | used only by HexGridSvg.tsx and MapExportSvg.tsx | ✓ |
| 55 | 3D wrapper reads context, dispatches the same actions as 2D; WebGPURenderer falls back to WebGL2 | ThreeMapView.tsx:29-43 vs HexGridSvg.tsx:121-139 (both open the planning view in GM view); MapScene.ts:17, 206 | ✓ |
| 56 | two BatchedMeshes (tiles; decorations with POI models); one material, three modes via a uniform; fog and dimming as looks in layout.ts | MapScene.ts:316, 471-481; tileMaterial.ts:76-84, 98, 160; layout.ts:63-64, 87-89 | ✓ |
| 57 | frame order | was: markers "so the screen effects don't touch them". Vignette and grain apply over the markers (postFX.ts:80-90) | FIXED |
| 58 | every frame unless reduce motion | MapScene.ts:173, 680 | ✓ |
