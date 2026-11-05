// Overland tables: Starting Terrain 3d6 (punch-list 1a), Danger d6 (dice structure from the core
// rules; terrain and danger names are plain generic labels), plus the Settlement Name table
// (original names).

// Coast was "River/coast" until M2 (rivers are now a hex feature, not a terrain); Hills was
// added in M2. See docs/PLAN.md.
export type Terrain =
  | 'Desert/arctic'
  | 'Swamp'
  | 'Grassland'
  | 'Forest/jungle'
  | 'Coast'
  | 'Ocean'
  | 'Hills'
  | 'Mountain'

// Every terrain, low to high, for pickers and the legend.
export const ALL_TERRAINS: Terrain[] = [
  'Ocean',
  'Coast',
  'Swamp',
  'Grassland',
  'Forest/jungle',
  'Desert/arctic',
  'Hills',
  'Mountain',
]

// Starting Terrain table (3d6), from punch-list item 1a's base frequencies, transcribed verbatim.
// The start dialog's Random button rolls it, Ocean row included. (The old 2d6 Hex Terrain and
// New Hex tables were retired in M3: terrain now comes from the WFC map.)
export function terrainFor3d6(roll: number): Terrain {
  if (roll >= 3 && roll <= 4) return 'Desert/arctic'
  if (roll >= 5 && roll <= 6) return 'Swamp'
  if (roll >= 7 && roll <= 9) return 'Grassland'
  if (roll >= 10 && roll <= 11) return 'Forest/jungle'
  if (roll === 12) return 'Hills'
  if (roll >= 13 && roll <= 14) return 'Coast'
  if (roll >= 15 && roll <= 16) return 'Ocean'
  if (roll >= 17 && roll <= 18) return 'Mountain'
  throw new Error(`terrainFor3d6: roll out of range: ${roll}`)
}

// Danger Level table (d6).
export type DangerLevel = 'Safe' | 'Unsafe' | 'Risky' | 'Deadly'

export function dangerForD6(roll: number): DangerLevel {
  if (roll === 1) return 'Safe'
  if (roll >= 2 && roll <= 3) return 'Unsafe'
  if (roll >= 4 && roll <= 5) return 'Risky'
  if (roll === 6) return 'Deadly'
  throw new Error(`dangerForD6: roll out of range: ${roll}`)
}

// House-rule numeric tiering (Hex Danger Level / Effective Dungeon Level): how much a hex or
// site's own qualitative Danger roll pushes a neighbor-averaged or dungeon-level-derived base
// number up or down. Shared by hex generation (state/mapReducer.ts) and dungeon-shaped site
// generation (data/dungeonTables.ts's effectiveDungeonLevel) — one source of truth.
const DANGER_LEVEL_DELTAS: Record<DangerLevel, number> = {
  Safe: -1,
  Unsafe: 0,
  Risky: 2,
  Deadly: 3,
}

export function dangerLevelDelta(danger: DangerLevel): number {
  return DANGER_LEVEL_DELTAS[danger]
}

// Settlement Name table (d20) — three columns, transcribed verbatim from the user's canonical
// Location Generator doc (Village/Town/City+Metropolis — City and Metropolis intentionally share
// one name pool there, unlike the Settlement Type roll itself which keeps them as distinct types;
// see settlementNameColumnFor below). Keyed by the forced Settlement Type from the Location
// Generator's Feature table (src/data/locationTables.ts).
export type SettlementColumn = 'Village' | 'Town' | 'City/Metropolis'

export const SETTLEMENT_LOCATIONS: readonly string[] = ['Village', 'Town', 'City', 'Metropolis']

const SETTLEMENT_NAMES: Record<SettlementColumn, string[]> = {
  Village: [
    "Hobb's Ford", 'Mossbank', 'Redwillow', 'Elderby', 'Cragfoot', 'Pell', 'Barrowdene', "Lark's Rest",
    'Millbrook', 'Stonewick', 'Emberfen', 'Wrenhollow', 'Oakmere', 'Greyfurrow', 'Thistledown', 'Ashvale',
    'Coldrun', 'Fenwick', 'Sparrowgate', 'Hollowmere',
  ],
  Town: [
    'Westmarch', 'Halden', 'Copperton', 'Gullhaven', "Merrin's Cross", 'Stagford', 'Brackwater', 'Lindmoor',
    'Havensworth', 'Duskmoor', 'Castellan', 'Wyndale', "Ferrow's Landing", 'Brannigan', 'Silverford',
    "Aldric's Rest", 'Thornmarch', 'Greywatch', 'Marrowvale', 'Kestrel Bend',
  ],
  'City/Metropolis': [
    'Aurenna', 'Valcresta', 'Highcrown', 'Tharnis', 'Corbanne', 'Ulmaris', 'Varrowmont', 'Esterholm',
    'Valdorra', 'Sorenthal', 'Casterun', 'Nemvark', 'Aldrathas', 'Korvashan', 'Ethmoor', 'Zalkarra',
    'Ostravia', 'Belmourne', 'Draxholm', 'Ivanthar',
  ],
}

export function settlementNameForD20(roll: number, column: SettlementColumn): string {
  if (roll < 1 || roll > 20) {
    throw new Error(`settlementNameForD20: roll out of range: ${roll}`)
  }
  return SETTLEMENT_NAMES[column][roll - 1]
}

// Maps a forced Settlement Type (the Feature table's "Village"/"Town"/"City"/"Metropolis" values)
// to its Settlement Name column — City and Metropolis share one name pool per the doc, even though
// they remain distinct Settlement Types for district-count/district-type-roll purposes elsewhere.
export function settlementNameColumnFor(settlementType: string): SettlementColumn {
  if (settlementType === 'Village') return 'Village'
  if (settlementType === 'Town') return 'Town'
  return 'City/Metropolis'
}
