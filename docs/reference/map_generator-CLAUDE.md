# OSR Hex Crawl Generator

A React web app implementing the overland hex-crawl generation system for OSR-style TTRPGs,
extended with house rules and OSR content. A GM starts a map on one hex and
clicks into adjacent unrevealed hexes to reveal them one at a time, rolling terrain, danger and
points of interest live. Points of interest open into generated sites (dungeons, settlements,
towers, keeps, camps, shrines, rifts), each with its own map, contents and on-demand rollers.

This file is the **current-state reference**. The dated build history (how each feature was
scoped, revised and verified) lives in `docs/history.md` — an archive of the old CLAUDE.md,
partly stale. Design docs, each the single source of truth for its area:

- `docs/plan-sites-settlements-mongo.md` — sites, settlements, encounters, Location Generator
  (its locked d200 Feature table is the source of truth for `locationTables.ts` — edit the doc
  first if that data changes), Mongo backend plan. Its neighbor-weighted terrain sketch is
  superseded by punch-list item 1a.
- `docs/plan-osr-integration.md` — OSR content integration (rounds 1-2 + fixes).
- `docs/osr-appendix-cde-source.txt` — extracted OSR Appendix C/D/E source text.
- `docs/original-text-encounters.md` — the 21 core d100 encounter tables (original text).
- `docs/plan-settlement-map-overhaul.md`, `docs/plan-camp-map-overhaul.md` — the settlement and
  camp map overhauls (references, user decisions, water rules).

**`docs/` is local-only (gitignored since 2026-11-01) — a fresh clone won't have it.** Nothing
in the app, tests or build reads it; it's the maintainer's design notes. Every `docs/...`
reference in this file and in code comments is background, not a requirement. Without the
folder, treat the code as the source of truth: edit the tables in `src/data/` directly (the
"edit the doc first" rules apply only where `docs/` exists), and record any new spec or
decision in code comments or this file rather than creating `docs/` files that won't be
committed.

## Status and roadmap

Done: overland hex crawl (unbounded map), 7 site kinds (dungeons in 4 types) with dedicated
views and maps (Shrine/Rift have no map), dungeon + settlement monster/NPC population, OSR
tables (treasure, traps, dressing, tricks, castles, equipment prices, civic amenities,
OSR dungeon monsters for room contents, wilderness + urban encounter rollers).

The faction system (and the propagation-rules plan built on it) was removed entirely on
2026-10-31 at the user's request — don't reintroduce factions without a fresh explicit ask.

### Punch list, in agreed order (updated 2026-10-31)

All campaigns/saves are test data — no migration or save-compatibility work is needed for the
user's own data.

**Core roadmap**

1a. **Neighbor-weighted terrain**
   - **Problem:** terrain doesn't hang together geographically. The clearest case is Ocean.
     In 20 simulated campaigns of 300 revealed hexes each, 13.6% of hexes are Ocean, but they
     form puddles averaging 3.4 hexes. 41% of ocean bodies are a single hex, and the largest
     body on each map is only 7-24 hexes.
   - **Cause:** a new hex's terrain is rolled only from the hex the party just left (the New
     Hex 2d6 table in `generateHex.ts`). The hex's other revealed neighbors are never
     consulted, so no terrain forms coherent regions.
   - **Goals:**
     - New-hex terrain is influenced by all of the hex's revealed neighbors.
     - Every terrain type has its own rules for how it relates to its neighbors.
     - Ocean, islands and coastlines get the most detailed rules:
       - Oceans form large, contiguous bodies.
       - Islands are possible.
       - Coastlines read sensibly where land meets Ocean.
   - **Isthmus coasts:** `waterForHex` averages the directions of a settlement's Ocean
     neighbors. When Ocean sits on opposite sides, the directions cancel, and the town map's
     coast can face land. Today 6% of land hexes next to the sea have Ocean on opposite sides.
     With large oceans this should become rare. Fix: work out the coast direction from the
     formula's sea on all six sides, revealed or not; if seas on opposite sides cancel out,
     face the coast toward one real sea neighbor, picked from the seed so it's the same every
     visit. Replaces the `it.todo` in `settlementWater.test.ts`.
   - **Terrains:** Ocean, Coast (renamed from River/coast), Swamp, Grassland, Forest/jungle,
     Desert/arctic (kept as one), Hills (new) and Mountain.
     - Hills content is all in the code already, exported but not yet wired up (Hills isn't
       in the `Terrain` type until this item is built). Wire each into its `Record<Terrain>`:
       - OSR wilderness rows, transcribed verbatim: `HILLS_ENCOUNTER_CHANCE` and
         `HILLS_CATEGORY_TABLE` (`encounterFrequencyTables.ts`), and `HILLS`
         (`wildernessMonsterLevelTables.ts`).
       - The d100 encounter table, original text: `HILLS`
         (`encounterTables.ts`).
       - Cataclysm and Natural landmark rows: `HILLS_CATACLYSMS` and
         `HILLS_NATURAL_LANDMARK` (`locationTables.ts`).
       - The map color: `HILLS_COLOR` (`hexgrid/colors.ts`).
   - **Approach: a seeded world formula decides sea vs. land.** Each campaign gets a random
     seed. A noise formula, given the seed and a hex's position, says whether that spot is sea
     or land. Nothing is generated up front: the formula is only asked about hexes as they're
     revealed (and their neighbors), so the map stays unbounded, and the same hex always gets
     the same answer whichever way the party approaches it.
   - **How a new hex is generated:**
     1. **Sea or land.** The formula decides. Sea → Ocean, and the remaining steps are skipped.
     2. **Land terrain.** Each land terrain's base frequency is multiplied by the pair weight
        for each revealed neighbor, and one terrain is picked in proportion to the results.
        Ocean is never picked here. Pair weights are never 0. The only terrains ever left out
        are those excluded by the "never uphill" river rule, and Coast and Swamp (elevation 1)
        are always low enough, so some terrain is always available. A Coast hex not next to
        the formula's sea gets an extra ×0.05.
     3. **Coast conversion.** If the hex is next to the formula's sea (revealed or not), it
        becomes Coast at its terrain's coast rate.
     4. **River.** A river flowing in from a revealed neighbor's river edge continues into the
        hex. Otherwise a land hex rolls the river chance.
     5. **Lake.** A land hex rolls the lake chance.
   - **Base frequencies (3d6)** for the land-terrain roll (the Ocean row is unused, since Ocean
     comes only from the formula):

     | 3d6 | Terrain | Chance |
     |---|---|---|
     | 3-4 | Desert/arctic | 1.9% |
     | 5-6 | Swamp | 7.4% |
     | 7-9 | Grassland | 28.2% |
     | 10-11 | Forest/jungle | 25.0% |
     | 12 | Hills | 11.6% |
     | 13-14 | Coast | 16.7% |
     | 15-16 | Ocean | 7.4% |
     | 17-18 | Mountain | 1.9% |

   - **Pair weights** (symmetric; elevations Ocean 0, Coast and Swamp 1, Grassland,
     Forest/jungle and Desert/arctic 2, Hills 3, Mountain 4):

     | | Ocean | Coast | Swamp | Grass | Forest | Desert | Hills | Mount. |
     |---|---|---|---|---|---|---|---|---|
     | **Ocean** | **20** | 6 | 1 | 1 | 1 | 1 | 0.5 | 0.3 |
     | **Coast** | 6 | **3** | 2 | 2 | 2 | 1.5 | 1 | 0.5 |
     | **Swamp** | 1 | 2 | **4** | 1.5 | 1.5 | 0.5 | 0.2 | 0.02 |
     | **Grassland** | 1 | 2 | 1.5 | **4** | 2 | 1 | 2 | 0.2 |
     | **Forest/jungle** | 1 | 2 | 1.5 | 2 | **4** | 1 | 2 | 0.3 |
     | **Desert/arctic** | 1 | 1.5 | 0.5 | 1 | 1 | **4** | 1 | 0.2 |
     | **Hills** | 0.5 | 1 | 0.2 | 2 | 2 | 1 | **3** | 3 |
     | **Mountain** | 0.3 | 0.5 | 0.02 | 0.2 | 0.3 | 0.2 | 3 | **4** |

   - **Coast rates** (the chance that land next to Ocean becomes Coast): Grassland 85%,
     Forest/jungle 80%, Desert/arctic 75%, Hills 70%, Swamp 60%, Mountain 50%.
   - **Rivers:** a feature, not a terrain.
     - A hex with a river records the edges where it enters and leaves.
     - Rivers can run through Grassland, Forest/jungle, Swamp, Hills, Mountain and Coast, and
       rarely through Desert/arctic.
     - About 17% of land hexes have a river, counting every hex a river flows through.
     - **Start:** a land hex that rolls the river chance gets a spring and an exit edge.
     - **Flow:** an exit edge always points downhill or level, never toward a higher neighbor
       (elevations as in the pair-weights table).
     - **Where the river goes next:**
       - Into Ocean or Coast: the river ends at the sea.
       - Into Swamp or a lake hex: the river ends there, or occasionally continues out the
         other side.
       - Into another river: the two merge, as a tributary.
       - Anywhere else: the river continues, with a new downhill-or-level exit.
     - **Rule: never uphill.** When a hex a river flows into is revealed, terrains higher than
       the river's current elevation are excluded from its terrain roll.
     - **Rule: revealed hexes don't change.** An exit can only point at an unrevealed hex, or
       at a revealed hex that can take the water (Ocean, Coast, a lake, Swamp, or another
       river). If no valid exit exists, the river ends in a new lake on its current hex.
     - **What's saved:** each hex saves only where its river leaves (its exit edge, or none if
       the river ends there). Where rivers come in is worked out when drawing, from the
       neighbors' exits, so a river merging into a revealed hex never changes that hex.
     - **Unexplored ends stay open.** A river flowing into unexplored land continues off into
       the unknown until the party reveals more.
   - **Lakes:** a feature on a land hex, about 5% of land hexes.
   - **Scale:** set by the formula's continent size and sea level. The party usually explores
     one big landmass with sea along some edges. Islands (small land in the formula's sea)
     are possible but uncommon.
   - **Sites on Ocean hexes:**
     - Settlement, Tower, Keep, Camp, Shrine, Rift and Tomb sit on a small island inside the
       Ocean hex.
     - Ruins, Deep tunnels and Caves are underwater: sunken ruins, sea caves, and tunnels
       below the seabed.
     - For now this is text only (a line on the site page saying "on a small island" or
       "underwater"). The site maps don't change.
   - **Overland map drawing:** a river is a simple blue line from edge to edge, and a lake a
     small blue oval.
   - **Edit Hex:** a hand edit keeps the hex's river and lake as
     they are, the river rules aren't enforced on edits, and the form gets no river or lake
     controls for now. Town maps count a revealed Ocean hex as sea as well as the formula's
     sea, so a hex hand-edited to Ocean still gives a neighboring town a coast.
   - **`/poi/:n` review page:** gets a fresh world seed each time Reroll POI is pressed, so it
     shows varied coast and river cases.
   - **Leftover River/coast content:** Coast keeps the old River/coast Cataclysm and landmark
     rows as they are (river mouths are on coasts). The encounter table's label "River and
     Coast" becomes "Coast". River hexes on other terrains get no extra encounter table for now.
   - **Old saves:** a save that still uses River/coast resets cleanly to a new map instead of
     crashing. All saves are test data, so nothing is migrated.
   - **Tuning targets:**
     - Biggest landmass: at least 95% of the revealed land.
     - Seas the party reaches: mostly 100 hexes or bigger.
     - One-hex ponds: 5% or fewer.
     - Rivers: about 17% of land hexes. Lakes: about 5% of land hexes.
   - **Open questions:** none.
   - **Starting hex:** the world is placed so the starting hex agrees with the chosen terrain
     (sea for Ocean, land otherwise). The start dialog's Random button rolls the new 3d6 table,
     Ocean row included, for this one roll.
   - **Save-format impact:** the map gains a world seed; each hex gains river and lake data.
   - **All numbers are starting points,** to be tuned by simulation before anything ships.
1b. **Town-map rivers that follow their real edges** — builds on 1a's river, lake and
   world-formula data. Today the town map's river is one straight band through the town, cut
   out with convex half-plane clipping (`settlementPlan.ts`); bent rivers mean replacing that,
   not adjusting it. This is the core rewrite that 1c builds on.
   - A layout change that keeps the current look, so no reference image; the user checks
     screenshots.
   - A town's river follows its hex's actual river edges, in one side and out the other.
   - A river that starts or ends inside the hex runs from the town's middle out to its one
     edge.
   - A coast faces the sea: the formula's sea plus any revealed Ocean hex (see 1a's
     isthmus fix and Edit Hex rule).
   - A Coast hex with no sea next to it (rare) draws no water.
   - A town on an Ocean hex (the small-island case) is drawn as today: a coastal town facing
     the sea, its side chosen by 1a's isthmus fix. A true island drawing can come later.
1c. **Town-map water combinations** — builds on 1b: towns with more than one kind of water.
   - A layout change that keeps the current look, so no reference image; the user checks
     screenshots.
   - Where a river meets the sea, draw the coast and the river together.
   - Two rivers merging are drawn as two rivers joining.
   - A lake hex draws its town with a lakeshore on one side, reusing the coast drawing. The
     lakeshore goes opposite where a river flows in; with no inflowing river, its side is
     picked from the seed.
   - A river that ends in a lake on the same hex runs from its entry edge into the lakeshore.
   - A lake hex that's also next to the sea shows only the coast (the lake still shows on the
     overland map).
2. **Site map overhaul — Tower, Keep, Settlement, Camp done; Tombs/Ruins/Temples remain**
   (see the ⬜ entry below). Moved to the top 2026-10-31; the user judged the feature-site maps
   as needing a lot of improvement. Absorbs the old "classic-blue renderer rewrite for
   Settlement/Keep/Tower/Camp" item (Dungeon's classic-blue rewrite is done: blue-field /
   white-room two-tone). Each kind needs its own reference image (project rule: no visual
   revision without one; don't assume another kind's scheme carries over), and style-only vs.
   layout changes must be confirmed per kind. Placed ahead of tracking because tracking's
   planned map markers (cleared/looted rooms) would otherwise be built twice, and any layout
   change alters generated data (do it before Mongo). While the remaining kinds are blocked,
   tracking can proceed without its map-marker part.
   ✅ **Tower — done 2026-10-31, browser-verified.** Reference:
   https://i.pinimg.com/1200x/d5/12/40/d5124032d9495aa2a26f8881308a7a5c.jpg (side-view tower
   beside stacked top-down plans). Decisions: side view + per-floor plans; black line art on
   white (deliberately not the dungeon's blue/white); schematic, not illustrated, side view; no
   furniture icons (possible later polish); all floors shown at once, click a floor to
   highlight it; no basement/gatehouse plan. The Feature table's "Small tower" rows were
   renamed "Tower" (user chose size variety over the book's "small"). Details in the
   Architecture section's Tower notes.
   ✅ **Keep — done 2026-10-31, browser-verified.** Reference: the "abandoned keep" image by
   arnnormand on DeviantArt (wixmp URL in this session's history; also used for the July
   walled-compound revision) — walled compound with square towers and a gatehouse, a keep
   building of rooms sharing walls, plus its upper floor and cellar. Decisions: match the
   tower's black-on-white style; include upper floors and a cellar (user asked for both).
   Details in the Architecture section's Keep notes.
   ✅ **Settlement — done 2026-10-31, browser-verified** (step 1, shape variety, sea/river
   edges, suburbs). Full spec, user decisions and both references:
   `docs/plan-settlement-map-overhaul.md`. Unlike Tower/Keep it's a **color** map (user's
   choice). **User rule for water: it must make sense for the hex the settlement is in** —
   implemented as `settlementPlan.ts`'s `waterForHex`, fed from the overland map by
   `waterForMapHex` (rules table in the plan doc and in `settlementWater.test.ts`'s header): coast
   toward Ocean neighbors (or a random side for an Ocean hex with none revealed), a river for a
   River/coast hex with no Ocean neighbor, otherwise nothing.
   ✅ **Camp — done 2026-10-31, browser-verified.** Color, painted forest-clearing style;
   reference and decisions in `docs/plan-camp-map-overhaul.md`. Drawing-only: generateCamp.ts
   and its stored positions are untouched.
   ⬜ **Tombs, Ruins, Temples — visual style updates needed** (user ask 2026-11-01). Tomb and
   Ruins are dungeon types drawn by `DungeonMapSvg.tsx` (currently the shared classic-blue
   rect style). "Temple" in the Feature table is either `Temple (oracle)` (d200 84-87 → Shrine,
   which has **no map** today) or `Ruins (temple)` (→ Ruins dungeon) — **user: both**
   (2026-11-01). So the Temple (oracle) Shrine needs a brand-new map, not just a restyle.
   Blocked on a reference image per kind; confirm style-only vs. layout too.
3. **Site-interaction tracking** — A typed
   per-site event log at room/feature level (monster defeated, treasure looted, NPC
   killed/recruited/talked to, door forced), not freeform notes, so a revisited site reflects
   what the party did there. Event-triggered by party interaction, not a GM "advance time"
   button. Scope questions to confirm first: which
   event types (core set + "room explored"/"trap triggered"/GM note?), which site kinds
   (dungeon-shaped first?), how events show (mark contents cleared/looted vs. a per-room log),
   undo, and what Reroll Site does to an existing log. Kept ahead of Mongo deliberately: it
   changes the saved schema, and this project sequences schema changes before Mongo; the whole
   `MapState` is one JSON document, so moving it to Mongo later is cheap.
4. **Mongo backend + multi-campaign persistence** — reuses the user's existing Atlas cluster
   with a new database (plan doc's "Reuse note"). Open questions: client/server TypeScript
   type sharing across two tsconfigs (unverified), and hosting / SPA route fallback (no deploy
   target chosen). Would jump the queue if multi-campaign/multi-device play is needed soon or
   localStorage (~5 MB) fills up.

**Polish (can slot in anywhere)**

5. **Encounter rollers for dungeon sites + the Tavern table** — the Cave/Deep
   Tunnels/Ruins d100 tables and the Tavern d100 table exist but are reachable from no UI.
   `DungeonSiteView` has no encounter roller at all; `SITE_TYPE_TO_ENCOUNTER_KEY`
   (`encounterTables.ts`, Tomb → Ruins since the book has no Tomb table) exists but is only
   referenced by its test. Reuse `EncounterRoller`.
6. **Avoid duplicate room detail text within one dungeon** — reroll once on an exact match
   (book RAW allows duplicates; pure variety improvement).
7. **Profession-aware NPC activity tier** — `npcTables.ts`'s 1d5 tier is independent of
   profession (e.g. "Dwarf Labourer — Infirm"). Only if it bothers the user in play.

**Blocked on content from the user** (item 2 is also blocked on reference images)

8. **Encounter tables for Tower/Shrine/Rift/Keep/Camp** — none exist yet.
9. **Camp central-feature table** — currently a generic placeholder.

Deliberately not built: a turn-clock state machine; OSR's full procedural dungeon crawler; NPC
adventuring parties; combat stat blocks (name/flavor only — real stats are a future Mongo
feature); map export; undo.

## Working rules for this project

- **Verbatim tables.** Book/OSR/user-supplied tables are transcribed verbatim. Any non-verbatim
  addition (e.g. a selector die the source doesn't give) is called out in that file's header
  comment. When the user pastes table/spec content, save it to a file in `docs/` immediately.
- **Visual revisions start from a reference image** the user supplies, fetched and actually
  viewed, with scope confirmed against it before code. Look critically at your own screenshots —
  several real rendering bugs were only caught that way.
- **Rendering derives from persisted data.** Visual-only changes (cave blobs, keep walls, door
  placement) compute shapes at render time from existing generated data (`rect`, connections),
  never by adding persisted fields or changing a generator's rng stream.
- **Cross-axis validity.** When a model has independent rolled axes, check that combinations
  make sense, not just that each field type-checks (e.g. a Boss Monster that rolls a giant
  ferret, or an NPC's activity tier clashing with their profession).
- **Schema growth.** `mapReducer.ts`'s `withMapStateDefaults` (called by `MapContext.tsx`'s
  `initMapState`; tested in `persistence/localStorage.test.ts`) merges a loaded save over
  `EMPTY_MAP_STATE`, so new top-level `MapState` fields get defaults. A field that's present but
  needs content needs an explicit backfill there. Per-hex fields aren't covered by the merge.
- Don't commit unless asked.
- **License: CC BY-SA 4.0** (`LICENSE`, README "License" section), chosen 2026-11-01 to match
  Basic Fantasy RPG 4th Edition. Credit any newly adapted Basic Fantasy material in the README's
  Attribution section. The "OSR" tables (`docs/osr-appendix-cde-source.txt`,
  `combined-monsters.pdf/.md`) are a local compilation of the Basic Fantasy RPG core rules and
  Basic Fantasy Field Guide (user, 2026-11-01), credited in the README. The `combined-monsters`
  files live outside the repo (not in `docs/` either). Don't name any other game, publisher or
  rulebook anywhere in the project — say "core rules" or "OSR" instead (user rule, 2026-11-01).

## Stack and environment gotchas

- **Node 20.16.0** (`.nvmrc`). Run `source ~/.nvm/nvm.sh && nvm use` before npm commands.
  Node 18 can't run current Vite tooling.
- **Vite 6.4 + Vitest 4.1, Rollup-based — don't jump to Vite 8.** Vite 8 defaults to the
  Rolldown bundler whose native binding fails to load here. Vite 7 needs Node >= 20.19.
- React 18, `react-router-dom` 7 (`BrowserRouter` in `main.tsx`). No linter configured.
  `npm audit` clean as of 2026-10-29.
- Geometry dep: `d3-delaunay` (Voronoi). `polygon-clipping` was removed 2026-10-31 with the
  settlement overhaul (all clipping is now convex half-plane clipping in `settlementPlan.ts`).
  If it's ever re-added: its `.d.ts` declares named exports but the ESM bundle only has a
  default export, so named imports typecheck but are `undefined` at runtime.

## Commands

```bash
source ~/.nvm/nvm.sh && nvm use   # Node 20.16.0
npm install
npm run dev        # http://localhost:5173
npm run test       # Vitest (1012 tests + 1 todo in 46 files as of 2026-11-02)
npm run build      # tsc -b && vite build
npx tsc -b         # typecheck only
```

## Architecture

Layering: `data/` = single tables and lookups (pure; book/OSR/user-supplied tables are
verbatim); `engine/` = assembling a whole generated thing; `hexgrid/` = SVG geometry and
renderers; `state/` = reducer and context; `components/` and `routes/` = UI. Every roll takes
an injectable `Rng` (`engine/dice.ts`), so generators are seed-testable.

### Routes (`App.tsx`)

- `/` — overland map.
- `/hex/:hexId` — full view of one hex (`HexDetailPage` → `HexSiteContent`).
- `/poi/:n` (n = 1-200) — GM review tool: force-generates Feature-table row *n* in a throwaway,
  non-persisting `MapProvider`. Has terrain + danger-level selectors, Reroll POI, Prev/Next.
  The fastest way to browser-check any site kind (e.g. `/poi/25` = Tomb, `/poi/88` = Ruins,
  `/poi/14`-`19` = Keep, `/poi/150` = Village, `/poi/200` = Metropolis).

### State (`state/`)

- `mapReducer.ts` — `MapState = { hexes, partyHexId, selectedHexId }`. Actions:
  `START_MAP`, `MOVE_PARTY_TO`, `SELECT_HEX`, `REROLL_HEX`, `EDIT_HEX`, `GENERATE_SITE`,
  `REROLL_SITE`, `NEW_MAP`.
  - `Hex` has qualitative `danger` (book roll) plus numeric **`dangerLevel`** (house rule:
    rounded average of revealed neighbors' `dangerLevel`, shifted by this hex's own `danger`,
    floor 1; the starting hex is 1 — `computeHexDangerLevel`). This replaced the old
    campaign-wide `partyLevel`. It drives wilderness/urban encounter gating and, via
    `dungeonTables.ts`'s `effectiveDungeonLevel`, dungeon-shaped site contents.
  - `MOVE_PARTY_TO` only succeeds into a hex adjacent to the party (no map bound). New hexes
    roll fresh; revealed ones just relocate the party.
  - `GENERATE_SITE` is idempotent; `REROLL_SITE` regenerates unconditionally. `REROLL_HEX` and
    `EDIT_HEX` (when touching `poi`) clear the now-stale `site`.
- `MapContext.tsx` — context + `useReducer`; lazy-inits from localStorage with the merge
  described in "Working rules". Optional `initialState`/`persist` props let
  `/poi/:n` run an isolated reducer.
- `persistence/localStorage.ts` — single save under `osr-hex-crawl:map`; fails silently.

### Overland (`data/tables.ts`, `data/locationTables.ts`, `engine/generateHex.ts`)

- `tables.ts`: terrain order + circular stepping, Hex Terrain 2d6, New Hex 2d6, Danger d6,
  Settlement Name d20 × 3 columns (City and Metropolis share a name pool via
  `settlementNameColumnFor`), and `SETTLEMENT_LOCATIONS` (legacy dispatch for manually-edited
  POIs).
- `locationTables.ts`: house-rule **Location Generator** — d200 Feature table
  (`locationFeatureForD200`) plus terrain-keyed Cataclysm and Natural Landmark tables. Each row
  yields a `siteKind` (or `'none'` for cataclysm/landmark flavor) and optional `forcedType`
  (e.g. a Metropolis POI forces the Settlement Type roll).
- `generateHex.ts`: `rollPointOfInterest` (1-in-6 gate, then d200, reusing the hex's own
  terrain) and `pointOfInterestForFeatureRoll` (no gate — used by `/poi/:n`).
- `engine/generateSite.ts`: `generateSiteForHex` switches on `poi.siteKind` and passes
  `forcedType` through. `siteKind === undefined` falls back to the `SETTLEMENT_LOCATIONS`
  heuristic; `'none'` → no site (and `HexSiteContent` never dispatches `GENERATE_SITE`).

### Site kinds

| Kind | Generator | Layout | Renderer / view |
|---|---|---|---|
| Dungeon (Cave/Tomb/Deep tunnels/Ruins) | `generateDungeon.ts` | `dungeonLayout.ts` (BSP) | `DungeonMapSvg.tsx` |
| Settlement (Village/Town/City/Metropolis) | `generateSettlement.ts` | `settlementPlan.ts` (render-time) | `SettlementMapSvg.tsx` (color) |
| Tower | `generateTower.ts` | `towerPlan.ts` (render-time) | `TowerMapSvg.tsx` (side view + floor plans) |
| Keep | `generateKeep.ts` | `keepPlan.ts` (render-time) | `KeepMapSvg.tsx` (compound + floor plans) |
| Camp | `generateCamp.ts` | `campLayout.ts` + `campPlan.ts` (render-time) | `CampMapSvg.tsx` (color) |
| Shrine | `generateShrine.ts` | none | `ShrineSiteView` (scene cards) |
| Rift | `generateRift.ts` | none | `RiftSiteView` (one block) |

Views live in `components/hexdetail/*SiteView.tsx` (plus `WildernessView`), selected by
`HexSiteContent.tsx`. Key rules per kind:

- **Dungeon.** Site Type/Size are rolled fresh, never derived from POI text (unless forced by
  the POI row). `dungeonLayout.ts` splits a rectangle into exactly `roomCount` rects
  (`MIN_ROOM_DIM = 4`, `roomCount - 1` rng calls); connections = rects sharing an axis-aligned
  boundary segment (a graph, not a tree). Objective room = highest Room Type roll, first wins
  ties. Also rolls a `dungeonLevel` from the site's danger, and a d10 Scenario line.
- **Shared room contents** (`roomContent.ts`): `rollRoomContent(rng, effectiveDungeonLevel)` —
  Room Type d10 + detail sub-tables + attachments. Monster room types roll a real OSR creature
  via `generateDungeonEncounter.ts` → `dungeonMonsterLevelTables.ts` (Monster Sub-table Matrix:
  dungeon level → Monster Level → d% creature) with a Treasure Type from
  `monsterTreasureTypes.ts`/`treasureTypeTables.ts`. Treasure rooms use `generateTreasure.ts`
  (OSR Tables 9-12; the guarded result, "Watched by a monster", rolls Amount twice). Trap rooms use `trapTables.ts`
  with a severity derived from dungeon level. NPC rooms use `monsterTables.ts` (now only NPC
  archetypes — the old invented monster/category system is gone).
  `rollBiasedRoomContent` gives one extra roll toward desired types (Keep's Armory and Lord's
  Quarters). Tower and Keep reuse this.
- **Settlement.** Settlement Type (d6) gives a dice pool — Village 3d4, Town 4d4, City 6d6,
  Metropolis 8d8. The number of dice is the district count (**never summed**), and each die's
  face indexes that district's type, so d4 settlements can only reach the first 4 of 8 district
  types. This tiering is intentional RAW; don't "fix" it. The generator stores game content
  only (no geometry). `settlementPlan.ts` derives the map at render time from the districts
  plus a seeded hash. Each settlement rolls an outline (round / angular with corner bastions /
  elongated along its main road) and a street pattern (organic / planned grid with avenues
  crossing at the center / grid core with organic outskirts / old town inside an inner wall),
  odds by size (villages: organic, never angular). ~24-110 blocks (by type) in a convex
  outline — Voronoi cells, organic ones smoothed with Lloyd's relaxation; the game districts
  are groups of neighboring blocks, seat at the center
  (a plaza, or a castle for a Castle District seat); streets are the gaps between blocks, main
  roads the shortest gate-to-center routes along block edges (wider gaps); blocks sliced into
  street-facing lots (polygon subdivision), interior scraps become yards; gardens, temples and
  roof palettes by district type; a towered wall with gates for Town+, while villages are
  unwalled houses along their roads with fields between. Water (`waterForHex`, fed by
  `SettlementView` from the hex's terrain and its revealed neighbors' directions): a coast cuts
  the outline on the sea side (no wall there, gates on the land side, a harbor road and
  piers); a river splits blocks along its banks, with bridges the main roads use and water
  gaps in the wall. Suburbs (Town+): houses along the roads out of some gates (Town 1-2, City
  2-3, Metropolis all), thinning with distance, kept off the water and clear of fields. Each
  district POI is
  `{text, npc}` with `npc` from `npcTables.ts` (OSR Appendix C Urban: race, profession, noble
  class, plus a 1d5 activity tier — the one non-verbatim addition). Also rolls government
  and population, plus civic amenities (`generateCivicAmenities.ts`, OSR Appendix E,
  `CivicAmenitiesPanel`). Static prices in `PricesPanel` (`equipmentTables.ts`).
  `generateTavern`/`generateShop` are ephemeral, re-rollable, not persisted.
- **Tower.** Floor count from the Size roll (Small 2-3, Medium 4-5, Large 6-7 — never fewer
  than 2 floors, user rule 2026-10-31). Ground floor = entry hall + guard room. Each floor
  above has a stair landing (`floorRoomIndex` 0, id `level-N`) plus side rooms (middle floors d3
  rooms in total, top floor d2); side rooms open
  only onto their own landing, and landings chain floor to floor, so the climb stays linear.
  Objective is **hard-coded on the top floor's landing** (a deliberate exception, avoiding an
  anticlimactic walk-back). `towerPlan.ts` derives each floor's drawing at render time from
  the room list plus a seeded hash: a round core that stays the same width or narrows going up
  (user rule, 2026-10-31; only exception: ~15% of towers get a flared, wider top floor),
  extra rooms either as wall partitions (halves/quarters) or rectangular annexes, a curved
  stair inside the landing, door positions, and the ground floor's entrance walkway opposite
  the guard-room annex.
  `TowerMapSvg` draws a schematic side view beside one plan per floor, black on white.
- **Keep.** Rooms carry a `floor` (-1 cellar, 0 ground, 1+ upper). Ground floor: the Courtyard
  (room 1, outdoors) plus building rooms by Size (3-4/5-6/7-8; Hall, Barracks, Armory, then
  generic). Upper floors: 1 (Small/Medium) or 2 (Large), d3+1 rooms each, the top one led by
  the Lord's Quarters. Cellar: always, d3+1 rooms (Storeroom, Cells, then generic). Normal
  highest-roll objective. Castle owner/reaction block from `castleTables.ts`. `keepPlan.ts`
  derives the drawing at render time from the room list plus a seeded hash: one building
  footprint shared by every floor, each floor's rooms packed into it with
  `dungeonLayout.ts`'s `partitionRect` (first room gets the largest space; the footprint grows
  until every floor fits), doors on a spanning tree of shared walls, an octagonal stair turret
  on a top corner, and the ground floor's walled compound (curtain wall, square towers,
  gatehouse, building entrance, open yard). `KeepMapSvg` draws the compound, then the upper
  floors and cellar in a row below, black on white like the tower.
- **Camp.** Central feature + peripheral features, **no connections by design**; no danger roll;
  objective = "Ritual/leader's space" if rolled, else the central feature. `campPlan.ts` draws it
  at render time as a forest clearing: positions from `campLayout.ts` pulled in around the fire
  (only as far as features stay clear of each other), each feature type drawn as its own scene
  (fire + log seats; tents + bedrolls; crates/barrels/sacks + wagon; watch platform + stakes;
  fenced pen + horses + hay; grated pit; leader's tent + rug + banner), forest band on one side,
  white-paper fade on the other, map kept roughly square.
- **Shrine / Rift.** No topology. Shrine: d3 features, core feature is the objective. Rift:
  exactly 3 independent rolls (Origin/Effect/Stability).

### On-demand rollers (not part of any site's deterministic rng stream)

- `EncounterRoller` — mounted in `HexBaseInfo` (wilderness: Terrain table, or OSR
  wandering monster gated by the terrain's 1d6 frequency check) and per district in
  `SettlementView` (District table, or OSR Daytime/Nighttime urban tables gated by
  `hexDangerLevel`). One mutually-exclusive source dropdown; every result adds an Encounter
  Purpose d8 line. Not mounted on any other site kind (see punch-list item 5).
- `DressingRoller` (5 OSR sensory tables) and `TrickRoller` — in Dungeon, Tower and Keep views.
- Tavern/Shop generators — per district in `SettlementView`.

Engine: `rollEncounter.ts` (`rollEncounter`, `checkWildernessEncounterFrequency`,
`rollWildernessMonster` via `wildernessMonsterLevelTables.ts`, `rollOsrUrbanEncounter`).

### Overland map rendering (`hexgrid/`)

`hexMath.ts` — axial coords, flat-top layout, `computeVisibleCoords` (revealed hexes + their
unrevealed neighbors; no map size). `HexGridSvg.tsx` — hand-rolled pan/zoom via viewBox; the
initial fit is computed once at mount (lazy `useState`) and deliberately not recomputed as the
frontier grows, so reveals don't yank the camera. `HexTile.tsx` — fill = terrain, stroke =
danger; **single click moves the party (250 ms debounce), double click opens `/hex/:id`**.

### Site renderer notes

- `DungeonMapSvg.tsx` — Classic two-tone: solid blue field (`CLASSIC_BLUE`) = rock, `floor-grid` pattern =
  floor, walls are just a blue stroke. Cave/Deep tunnels: organic blobs and winding corridors
  derived deterministically from each room's `rect` (`caveRenderShapes.ts`). Tomb/Ruins: rects
  inset by `RECT_ROOM_INSET_UNITS` (0.15), and each connection is a **door rect bridging the
  shared wall** (found via `rectAdjacency`), not a corridor line — connected rooms always share
  an exact edge, so any drawn gap is artificial. Room markers are small circles colored by room
  type with the room number; the objective gets a star "statue" icon.
- `SettlementMapSvg.tsx` — color painted-map style. Draw order: countryside fields → roads out
  of the gates → trees → town ground (street color) → blocks/lots → district borders → district
  click regions → wall/towers/gates → markers. Streets aren't drawn; they're the ground showing
  between blocks (villages draw their main roads explicitly instead).

## Don't reintroduce (all passed typecheck and build)

1. `setPointerCapture` on the map SVG's pointerdown breaks click delivery to hex tiles in
   Chromium. Pan works without it.
2. React's `onWheel` is passive, so `preventDefault` no-ops. Wheel zoom uses a native
   `addEventListener('wheel', ..., { passive: false })` in a `useEffect`.
3. `#root` needs a definite height (`html, body { height: 100% }`, `#root { height: 100svh }`),
   not `min-height`, or the SVG's `height: 100%` can't resolve and the page inflates.
4. Rendering-order bugs: roads under opaque districts, corridors hidden under rooms, corridor
   spurs from center-to-center lines. Check z-order and endpoint clipping when touching
   renderers.
5. Scripted-rng tests desync silently if one intermediate value is wrong (e.g. Room Type d10
   roll 2 = Empty, 3 = Trap). Prefer seeded + structural assertions for anything with
   rejection sampling.

## Verifying UI changes in a browser

`src/components/siteViews.render.test.tsx` renders every view to static HTML (every d200
Feature row × 2 seeds, the overland map, every route) and fails on crashes, React warnings,
`NaN`/`undefined` in markup, or rooms/districts/features missing from a map. It can't see
effects, layout or looks. Typecheck and tests aren't enough for UI work — drive a real browser. Playwright isn't a
project dependency: install `playwright` in a scratch dir (one existed at
`/tmp/pw-scratch/node_modules/playwright` as of 2026-11-02 — `/tmp` may be wiped), run
`npx playwright install chromium` if the cached browser doesn't match, and launch with
`chromium.launch({ args: ['--no-sandbox'] })` from a plain Node 20 script against
`npm run dev`.

- Hexes carry `data-hex-id="q,r"` on their `<g>` — click the `<g>`, not the `<polygon>` (POI
  markers cover the center). Wait ~300 ms after `.click()` (debounce); use `.dblclick()` to open
  details.
- Site maps carry `data-room-id`, `data-district-id` or `data-feature-id`.
- Use `/poi/:n` to reach any site kind directly, or seed
  `localStorage['osr-hex-crawl:map']` for map-state scenarios.
- Collect `console` errors and `pageerror`s; expect zero. Take a screenshot and actually look
  at it.
