# Brief: site maps for Tombs, Ruins and Temples (punch-list item 6)

A self-contained brief for whoever builds PLAN.md's punch-list item 6. Written 2026-11-05.
**Status: decisions recorded (2026-11-05); waiting on the reference images,** Tomb's first
(D1). Several decisions are "decide from the image": when an image arrives, propose the answer
from it and confirm with the user before code. Don't guess an open point: ask the user, then
record the answer here (dated) before writing code for it.

## The job

Give Tombs, Ruins and Temples better site maps, one kind at a time, each from its own reference
image. Tower, Keep, Settlement and Camp were overhauled the same way in map_generator before
the fork. Those are the precedents (see "Read first").

The three kinds today:

| Kind | d200 Feature rows (roll: feature) | Generator → site | Drawn by today |
|---|---|---|---|
| **Tomb** | 20-24 Large tomb; 25-30 Tomb; 94-99 Barrow mounds; 100-103 Necropolis/catacombs; 133 Ancient dolmens | `generateDungeon.ts` → `DungeonSite`, `siteType: 'Tomb'` | `DungeonMapSvg.tsx`, classic-blue, rectangular rooms |
| **Ruins** | 88-93 Ruins (temple); 104-105 Sunken ruins; 140-141 Lost library/arcane archive | `generateDungeon.ts` → `DungeonSite`, `siteType: 'Ruins'` | `DungeonMapSvg.tsx`, same as Tomb |
| **Temple (oracle)** | 84-87 Temple (oracle) | `generateShrine.ts` → `ShrineSite` | **no map**: `ShrineSiteView` shows a scene card |
| **Hermit's abode** (a variant of the Temple map, D6) | 131 Hermit's abode | `generateShrine.ts` → `ShrineSite` | **no map**: the same scene card |

Facts that shape the design:
- **Tomb and Ruins share one renderer with Cave and Deep tunnels.** `DungeonMapSvg.tsx` branches
  on `siteType`: Cave/Deep tunnels get organic blobs (`caveRenderShapes.ts`); Tomb/Ruins get
  inset rectangles, with each connection drawn as a door across the shared wall. Changing
  Tomb/Ruins must leave Cave and Deep tunnels as they are.
- **A dungeon site stores** `rooms` (each with a `rect`, `roomType`, contents and
  `isObjectiveRoom`) and `connections` (room-id pairs) (`generateDungeon.ts:11-37`). The rooms
  come from `dungeonLayout.ts` (a BSP split of a rectangle).
- **The site doesn't record which feature row made it.** A "Ruins (temple)" and a "Sunken
  ruins" site are both just `siteType: 'Ruins'`. The hex's POI does keep it: `hex.poi.location`
  is the feature ("Ruins (temple)") and `hex.poi.development` the flavor ("Temple ruins")
  (`generateHex.ts:5-21`). A variant look per feature would read the POI.
- **A Shrine has no spatial data.** `ShrineSite` is a `core` (a disposition and note) plus an
  ordered list of `approachFeatures`. The code calls these "not a graph, there's no traversal"
  (`generateShrine.ts:33-38`). A map has to be laid out from that list.
- **Two rows make Shrines:** 84-87 Temple (oracle) and 131 Hermit's abode. A new Shrine map
  would draw both, unless it tells them apart by `hex.poi.location`.

## Decisions (one by one, from the user)

| # | Question | Answer |
|---|---|---|
| D1 | **Order:** which kind first? (One kind at a time; each is reviewed before the next.) | **Tomb first** (user, 2026-11-05). Ruins shares its renderer, so it can reuse what Tomb settles. |
| D2 | **Tomb: style only, or layout too?** Style only keeps the rooms and connections and changes how they're drawn. Layout changes the shapes or arrangement of rooms. | **Decide from the image** (user, 2026-11-05): when the Tomb reference image arrives, propose style-only or layout from what it shows, and confirm with the user before code. |
| D3 | **Ruins: style only, or layout too?** | **Decide from the image** (user, 2026-11-05), as for Tomb: propose from the Ruins reference image and confirm before code. |
| D4 | **Colour scheme per kind.** Options: classic blue and white (today's dungeons), black line art on white (Tower, Keep), or colour (Settlement, Camp). Don't assume one kind's scheme carries over. | **Decide from each image** (user, 2026-11-05): follow each kind's reference image and confirm the scheme with the user. If Tomb and Ruins leave classic blue, Cave and Deep tunnels keep it. |
| D5 | **What the Temple (oracle) map shows.** For example: a path through the approach features, in order, ending at the sanctum (the core); or a temple building with a room per feature; or something else. | **Decide from the image** (user, 2026-11-05): propose a form from the Temple reference image and confirm before code. Either way the map is laid out from the core and the ordered approach features. |
| D6 | **Hermit's abode** (also a Shrine): the same new map, a variant of it, or keep the scene card? | **A variant of the Temple map** (user, 2026-11-05): the same layout idea drawn as a hermitage, from its own reference image, told apart by `hex.poi.location`. Built after the Temple map. |
| D7 | **Variants within a kind.** Should features look different within their kind? E.g. Barrow mounds vs. Necropolis/catacombs (Tomb); Temple ruins vs. Sunken ruins vs. Arcane archive (Ruins). Or one look per kind? | **One look per kind first** (user, 2026-11-05). Per-row variants (read from `hex.poi.location`) are a later polish step, after the base map for the kind is approved. |
| D8 | **Saved data.** Drawing-only (shapes worked out at render time from the stored site, as Tower, Keep and Camp do, so existing saves keep working), or may a generator change what it stores? The project rule is drawing-only (see Rules); a generator change needs the user's explicit OK and a `SAVE_VERSION` bump. | **Drawing-only** (user, 2026-11-05): no saved fields added, no change to any generator's rolls. Old saves open and draw with the new maps. |

## Reference images (one per kind, from the user)

| Kind | Image | Notes from viewing it |
|---|---|---|
| Tomb | ⬜ | |
| Ruins | ⬜ | |
| Temple (oracle) | ⬜ | |
| Hermit's abode (D6) | ⬜ | |

When an image arrives, look at it (don't work from its description), write what it shows here
in a few lines (as `plan-camp-map-overhaul.md` does), and confirm the scope against it with the
user before writing code. A pasted image has no URL, so this description is the record.

## Read first

1. `CLAUDE.md`: the project rules (auto-loaded by Claude Code; read it yourself otherwise).
2. `docs/PLAN.md`, punch-list item 6, and the items it affects: 7 (tracking will add markers to
   these maps) and 8 (Mongo).
3. `docs/reference/map_generator-CLAUDE.md`, a snapshot of map_generator's notes. Its
   architecture notes for sites still apply here:
   - **Site kinds table** (around line 398): generator, layout and renderer per kind.
   - **Tower and Keep notes** (around lines 451-475): the render-time plan pattern
     (`towerPlan.ts`, `keepPlan.ts`).
   - **Site renderer notes** (around line 509): how `DungeonMapSvg` draws today.
   - **Punch-list item 2** (around lines 214-254): how each earlier overhaul was decided, with
     its reference image and decisions.
   - **Working rules** (around lines 294-310).
   - Its browser-testing section is out of date here (see "Checking your work").
4. **Precedent specs** in map_generator (not copied into this repo):
   `~/dev/source/map_generator/docs/plan-camp-map-overhaul.md` (short: decisions plus the
   reference image described in words) and `plan-settlement-map-overhaul.md` (long: the
   algorithm agreed with the user). They predate the fork, so they say "River/coast" (now
   Coast) and refer to CLAUDE.md's old punch list.

## Rules

- **Visual changes start from a reference image** that is actually viewed, with the scope
  confirmed against it before code. Look critically at your own screenshots; several real
  rendering bugs were only caught that way.
- **Drawing derives from saved data.** Compute shapes at render time from the stored site (room
  `rect`s, connections, the feature list), with a seeded hash where variety is needed. Never
  add saved fields or change a generator's random rolls (D8). Old saves must still open and
  draw.
- **Tables are transcribed verbatim.** If a kind needs new table content, the user supplies it.
- **Keep the data attributes** that tracking (item 7) will hook into: rooms carry
  `data-room-id`, features `data-feature-id`.
- **Don't name any other game, publisher or rulebook** in code, comments or docs, except Basic
  Fantasy where its license requires attribution.
- **Workflow:** one kind at a time, each reviewed by the user before the next. Explain jargon.
  Don't commit unless asked, and branch off `main` first. The tests must pass.
- **Stack:** Node 20.16 and Vite 6.4. Run `source ~/.nvm/nvm.sh && nvm use` before npm.

## Checking your work

- `npm test` (about 25-30 s; every test must pass). Add tests for any new plan module, as
  `towerPlan.test.ts` and `keepPlan.test.ts` do, and for the variants and edge cases (smallest
  and largest sizes, every feature row of the kind).
- **Review routes:** `/poi/:n` force-generates d200 row *n*, with terrain and danger selectors
  and a Reroll button (plus water and rotation selectors, which only settlements use). Tomb `/poi/25` (variants: 20, 94, 100, 133); Ruins `/poi/88` (104,
  140); Temple (oracle) `/poi/84`; Hermit's abode `/poi/131`.
- **Screenshots:** there's no playwright package here, but its Chromium is cached at
  `~/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`.
  Run `npm run build` and `npx vite preview`, then either:
  - for a still page: `chrome-headless-shell --no-sandbox --disable-gpu --hide-scrollbars
    --window-size=W,H --screenshot=out.png <url>`; or
  - to click or wait for something: launch with `--remote-debugging-port=9333` and drive it
    from a Node script run with `node --experimental-websocket` (Node 20.16 has no global
    WebSocket otherwise). Open the page with `PUT /json/new?<url>`, then use
    `Runtime.evaluate` and `Page.captureScreenshot`.

  Collect console errors and expect none. Close each tab when done.
- The save key here is `wfc-hex-crawl:map` (the reference doc's `osr-hex-crawl:map` is
  map_generator's).

## Done when

For each kind: the user has approved its screenshots against the reference image; the tests
pass; Cave and Deep tunnels draw as before; an old save's site of that kind still opens and
draws; and this brief and PLAN.md's item 6 say what was built and which decisions it followed.

## Out of scope

Tracking markers on the maps (item 7), Mongo (item 8), and encounter rollers for these sites
(items 4 and 10).
