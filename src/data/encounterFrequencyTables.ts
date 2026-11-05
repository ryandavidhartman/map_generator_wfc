// Transcribed from the Basic Fantasy compilation's (core rules + Field Guide) Appendix C: Random Encounters — "Encounter
// Frequency" (wilderness half only) and "Encounter Purpose". Source text:
// docs/osr-appendix-cde-source.txt, ~lines 52-97.
//
// Layered on top of this project's existing d100 tables (encounterTables.ts), which already
// cover WHAT is encountered — this covers WHETHER an encounter happens at all (wilderness
// only) and WHY the creature is here. See docs/plan-osr-integration.md, Phase 4.
//
// OSR's wilderness frequency table uses its own broad terrain terms (Clear/Grasslands, Woods,
// River, Mountains, Desert, Inhabited, Ocean, Jungle, Hills, Barren, plus Aerial for airborne
// travel) via a documented "Terrain Name Cross-Reference," not this project's core
// Terrain type (Desert/arctic, Swamp, Grassland, Forest/jungle, River/coast, Ocean, Mountain —
// 7 types, deliberately coarser). Mapped by closest match below, same "treat other terrain
// types as whichever entry is the closest match" latitude the book itself grants: Forest/jungle
// takes Jungle's chance (the wider, more encounter-prone of the two source rows it merges,
// since the core rules don't distinguish them) and Swamp takes the book's own suggested fallback
// for its unlisted Wetlands ("River or Ocean, DM's choice" — River picked here).

import type { Terrain } from './tables'

// The set of 1d6 results that trigger an encounter for this terrain.
const WILDERNESS_ENCOUNTER_CHANCE: Record<Terrain, number[]> = {
  Grassland: [6],
  'Forest/jungle': [4, 5, 6],
  'River/coast': [5, 6],
  Ocean: [5, 6],
  Mountain: [4, 5, 6],
  'Desert/arctic': [5, 6],
  Swamp: [5, 6],
}

// Hills (added 2026-11-02 for punch-list item 1a, which adds a Hills terrain): the book's own
// "Hills 5-6" row. Exported but not yet used; it moves into WILDERNESS_ENCOUNTER_CHANCE when the
// Hills terrain is added to the Terrain type.
export const HILLS_ENCOUNTER_CHANCE: number[] = [5, 6]

export function wildernessEncounterChanceForTerrain(terrain: Terrain): number[] {
  return WILDERNESS_ENCOUNTER_CHANCE[terrain]
}

// Encounter Purpose (d8) — verbatim, applies regardless of setting (dungeon/wilderness/urban).
const ENCOUNTER_PURPOSES: string[] = [
  'Guarding a lair, nest, or treasure',
  'Hunting or foraging for food',
  'Patrolling a territory or route',
  'Fleeing something more dangerous',
  'Lost, wandering, or migrating',
  'Investigating a noise, light, or scent',
  'Resting, sleeping, or otherwise off guard',
  'Escorting or accompanying another creature or NPC',
]

export function encounterPurposeForD8(roll: number): string {
  if (roll < 1 || roll > 8) throw new Error(`encounterPurposeForD8: roll out of range: ${roll}`)
  return ENCOUNTER_PURPOSES[roll - 1]
}

// Terrain Category Summary (d%) — round 2, Phase 4. Source text: ~lines 929-961. Originally paired
// with a hand-curated monster pool instead of the book's own per-terrain name tables (14 terrain
// tables x 12 category columns x 20 rows), for lack of numeric level state to gate the deeper
// rows with — house-rule Hex Danger Level (state/mapReducer.ts) later supplied exactly that gate,
// so this category roll now feeds the real per-terrain tables instead
// (wildernessMonsterLevelTables.ts, via rollEncounter.ts's rollWildernessMonster).
//
// Terrain mapping reuses the book's own "Terrain Name Cross-Reference" (~lines 892-919) where it
// applies directly (Grassland->Plains, Mountain->Mountains, Ocean->Marine, River/coast->Aquatic);
// Forest/jungle->Jungle matches the choice already made above for Encounter Frequency (the wider
// of the two source rows this project's coarser Terrain type merges); Desert/arctic->Desert picks
// the more literal of its two merged source terms (Arctic has its own Category Summary row too,
// but nothing in this project's data distinguishes which of the two a given hex actually is);
// Swamp->Wetlands uses Wetlands' own real Category Summary row directly, more specific than the
// Encounter Frequency table's River/Ocean fallback (Wetlands has no Encounter Frequency row of
// its own, but it does have a Category Summary row, transcribed below).
export type WildernessEncounterCategory =
  | 'Airborne'
  | 'Animal'
  | 'Dragon'
  | 'Giant'
  | 'Human/Demi-Human'
  | 'Humanoid'
  | 'Monster'
  | 'NPC'
  | 'Undead'
  | 'Invertebrates'
  | 'Water'
  | 'Special'

type CategoryRangeEntry = { min: number; max: number; category: WildernessEncounterCategory }

function expandCategoryD100(entries: CategoryRangeEntry[]): WildernessEncounterCategory[] {
  const table = new Array<WildernessEncounterCategory>(100)
  for (const { min, max, category } of entries) {
    for (let i = min; i <= max; i++) table[i - 1] = category
  }
  return table
}

// Each row transcribed verbatim except Wetlands (see the note above that row): the source
// prints overlapping boundaries (NPC and Undead both starting at 58; Water and Special both
// touching 95) — a real anomaly in the source table itself, not a transcription choice here.
// Resolved by giving the first-listed column the disputed boundary and starting the next column
// one after, the same "documented judgment call, not a silent guess" approach used for Table
// 12's off-by-one row in treasureTables.ts.
const TERRAIN_CATEGORY_ROWS: Record<'Plains' | 'Jungle' | 'Aquatic' | 'Marine' | 'Mountains' | 'Desert' | 'Wetlands' | 'Hills', CategoryRangeEntry[]> = {
  Plains: [
    { min: 1, max: 19, category: 'Airborne' },
    { min: 20, max: 29, category: 'Animal' },
    { min: 30, max: 31, category: 'Dragon' },
    { min: 32, max: 32, category: 'Giant' },
    { min: 33, max: 52, category: 'Human/Demi-Human' },
    { min: 53, max: 60, category: 'Humanoid' },
    { min: 61, max: 75, category: 'Monster' },
    { min: 76, max: 78, category: 'NPC' },
    { min: 79, max: 79, category: 'Undead' },
    { min: 80, max: 89, category: 'Invertebrates' },
    { min: 90, max: 97, category: 'Water' },
    { min: 98, max: 100, category: 'Special' },
  ],
  Jungle: [
    { min: 1, max: 15, category: 'Airborne' },
    { min: 16, max: 25, category: 'Animal' },
    { min: 26, max: 27, category: 'Dragon' },
    { min: 28, max: 29, category: 'Giant' },
    { min: 30, max: 37, category: 'Human/Demi-Human' },
    { min: 38, max: 49, category: 'Humanoid' },
    { min: 50, max: 67, category: 'Monster' },
    { min: 68, max: 69, category: 'NPC' },
    { min: 70, max: 74, category: 'Undead' },
    { min: 75, max: 89, category: 'Invertebrates' },
    { min: 90, max: 99, category: 'Water' },
    { min: 100, max: 100, category: 'Special' },
  ],
  Aquatic: [
    { min: 1, max: 10, category: 'Airborne' },
    { min: 11, max: 15, category: 'Animal' },
    { min: 16, max: 17, category: 'Dragon' },
    { min: 18, max: 21, category: 'Giant' },
    { min: 22, max: 31, category: 'Human/Demi-Human' },
    { min: 32, max: 46, category: 'Humanoid' },
    { min: 47, max: 56, category: 'Monster' },
    { min: 57, max: 58, category: 'NPC' },
    { min: 59, max: 59, category: 'Undead' },
    { min: 60, max: 69, category: 'Invertebrates' },
    { min: 70, max: 99, category: 'Water' },
    { min: 100, max: 100, category: 'Special' },
  ],
  Marine: [
    { min: 1, max: 10, category: 'Airborne' },
    { min: 11, max: 15, category: 'Animal' },
    { min: 16, max: 16, category: 'Dragon' },
    { min: 17, max: 20, category: 'Giant' },
    { min: 21, max: 30, category: 'Human/Demi-Human' },
    { min: 31, max: 45, category: 'Humanoid' },
    { min: 46, max: 60, category: 'Monster' },
    { min: 61, max: 65, category: 'NPC' },
    { min: 66, max: 66, category: 'Undead' },
    { min: 67, max: 69, category: 'Invertebrates' },
    { min: 70, max: 99, category: 'Water' },
    { min: 100, max: 100, category: 'Special' },
  ],
  Mountains: [
    { min: 1, max: 19, category: 'Airborne' },
    { min: 20, max: 39, category: 'Animal' },
    { min: 40, max: 44, category: 'Dragon' },
    { min: 45, max: 52, category: 'Giant' },
    { min: 53, max: 62, category: 'Human/Demi-Human' },
    { min: 63, max: 77, category: 'Humanoid' },
    { min: 78, max: 82, category: 'Monster' },
    { min: 83, max: 84, category: 'NPC' },
    { min: 85, max: 85, category: 'Undead' },
    { min: 86, max: 92, category: 'Invertebrates' },
    { min: 93, max: 95, category: 'Water' },
    { min: 96, max: 100, category: 'Special' },
  ],
  Desert: [
    { min: 1, max: 4, category: 'Airborne' },
    { min: 5, max: 19, category: 'Animal' },
    { min: 20, max: 24, category: 'Dragon' },
    { min: 25, max: 29, category: 'Giant' },
    { min: 30, max: 49, category: 'Human/Demi-Human' },
    { min: 50, max: 61, category: 'Humanoid' },
    { min: 62, max: 76, category: 'Monster' },
    { min: 77, max: 83, category: 'NPC' },
    { min: 84, max: 84, category: 'Undead' },
    { min: 85, max: 96, category: 'Invertebrates' },
    { min: 97, max: 98, category: 'Water' },
    { min: 99, max: 100, category: 'Special' },
  ],
  Wetlands: [
    { min: 1, max: 5, category: 'Airborne' },
    { min: 6, max: 15, category: 'Animal' },
    { min: 16, max: 18, category: 'Dragon' },
    { min: 19, max: 20, category: 'Giant' },
    { min: 21, max: 22, category: 'Human/Demi-Human' },
    { min: 23, max: 37, category: 'Humanoid' },
    { min: 38, max: 57, category: 'Monster' },
    { min: 58, max: 58, category: 'NPC' },
    { min: 59, max: 60, category: 'Undead' },
    { min: 61, max: 80, category: 'Invertebrates' },
    { min: 81, max: 95, category: 'Water' },
    { min: 96, max: 100, category: 'Special' },
  ],
  // Hills (added 2026-11-02 for punch-list item 1a), verbatim from the source's Hills row. Not
  // yet reached by any Terrain; exported via HILLS_CATEGORY_TABLE below until Hills exists.
  Hills: [
    { min: 1, max: 15, category: 'Airborne' },
    { min: 16, max: 25, category: 'Animal' },
    { min: 26, max: 30, category: 'Dragon' },
    { min: 31, max: 40, category: 'Giant' },
    { min: 41, max: 60, category: 'Human/Demi-Human' },
    { min: 61, max: 75, category: 'Humanoid' },
    { min: 76, max: 90, category: 'Monster' },
    { min: 91, max: 92, category: 'NPC' },
    { min: 93, max: 93, category: 'Undead' },
    { min: 94, max: 98, category: 'Invertebrates' },
    { min: 99, max: 99, category: 'Water' },
    { min: 100, max: 100, category: 'Special' },
  ],
}

// The Hills category d100, ready to become TERRAIN_CATEGORY_TABLES' Hills entry.
export const HILLS_CATEGORY_TABLE: WildernessEncounterCategory[] = expandCategoryD100(TERRAIN_CATEGORY_ROWS.Hills)

const TERRAIN_CATEGORY_TABLES: Record<Terrain, WildernessEncounterCategory[]> = {
  Grassland: expandCategoryD100(TERRAIN_CATEGORY_ROWS.Plains),
  'Forest/jungle': expandCategoryD100(TERRAIN_CATEGORY_ROWS.Jungle),
  'River/coast': expandCategoryD100(TERRAIN_CATEGORY_ROWS.Aquatic),
  Ocean: expandCategoryD100(TERRAIN_CATEGORY_ROWS.Marine),
  Mountain: expandCategoryD100(TERRAIN_CATEGORY_ROWS.Mountains),
  'Desert/arctic': expandCategoryD100(TERRAIN_CATEGORY_ROWS.Desert),
  Swamp: expandCategoryD100(TERRAIN_CATEGORY_ROWS.Wetlands),
}

export function wildernessCategoryForD100(terrain: Terrain, roll: number): WildernessEncounterCategory {
  if (roll < 1 || roll > 100) throw new Error(`wildernessCategoryForD100: roll out of range: ${roll}`)
  return TERRAIN_CATEGORY_TABLES[terrain][roll - 1]
}
