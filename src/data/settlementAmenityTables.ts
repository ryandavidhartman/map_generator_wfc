// Transcribed from the Basic Fantasy compilation's (core rules + Field Guide) Appendix E: Random Settlement Builder — "Points of
// Interest" (docs/osr-appendix-cde-source.txt, ~lines 3150-3193). OSR integration, round 2,
// Phase 6 (the last of round 2) — see docs/plan-osr-integration.md.
//
// This is a NEW settlement-level "civic amenities" list, additive to and separate from the
// existing per-district POI system (settlementTables.ts's DISTRICT_POI) — OSR has no district
// concept at all, so this doesn't replace anything, it layers a second, coarser-grained list on
// top. Settlement Size -> POI count/roll-range reuses the exact SettlementType mapping already
// established for Phase 3's population bands (Village->Village, Town->Small Town, City->Large
// Town, Metropolis->Major City — see settlementTables.ts's populationRangeForSettlementType).

import type { SettlementType } from './settlementTables'

export type CivicAmenityType =
  | 'General Store'
  | 'Tavern'
  | 'Inn or Rooming House'
  | 'Smithy or Farrier'
  | 'Shrine or Small Temple'
  | 'Stables'
  | 'Physician or Healer'
  | 'Town Militia or Guard Post'
  | 'Moneylender'
  | 'Carpenter or Mason'
  | 'Weaver or Tailor'
  | 'Market Square'
  | 'Sage or Scholar'
  | 'Church'
  | "Thieves' Guild"
  | "Mercenary or Adventurers' Guild Hall"
  | 'Alchemist or Apothecary'
  | "Wizard's Tower or Arcane Academy"
  | "Noble's Manor or Keep"
  | 'Something Unusual'

// Verbatim d20 order — rows are "ordered from common (low rolls) to rare (high rolls)" per the
// book's own note, which is exactly what makes the roll-range restriction below work (a Village's
// 1d8 cap keeps rare entries out of reach without a second table).
const CIVIC_AMENITIES: CivicAmenityType[] = [
  'General Store',
  'Tavern',
  'Inn or Rooming House',
  'Smithy or Farrier',
  'Shrine or Small Temple',
  'Stables',
  'Physician or Healer',
  'Town Militia or Guard Post',
  'Moneylender',
  'Carpenter or Mason',
  'Weaver or Tailor',
  'Market Square',
  'Sage or Scholar',
  'Church',
  "Thieves' Guild",
  "Mercenary or Adventurers' Guild Hall",
  'Alchemist or Apothecary',
  "Wizard's Tower or Arcane Academy",
  "Noble's Manor or Keep",
  'Something Unusual',
]

export function civicAmenityForD20(roll: number): CivicAmenityType {
  if (roll < 1 || roll > 20) throw new Error(`civicAmenityForD20: roll out of range: ${roll}`)
  return CIVIC_AMENITIES[roll - 1]
}

export type DiceSpec = { count: number; sides: number; modifier: number }

// POI count dice, verbatim from the Settlement Size table.
const CIVIC_AMENITY_COUNT: Record<SettlementType, DiceSpec> = {
  Village: { count: 1, sides: 4, modifier: 0 },
  Town: { count: 1, sides: 6, modifier: 2 },
  City: { count: 2, sides: 6, modifier: 4 },
  Metropolis: { count: 3, sides: 6, modifier: 8 },
}

export function civicAmenityCountDiceForSettlementType(type: SettlementType): DiceSpec {
  return CIVIC_AMENITY_COUNT[type]
}

// Roll Range: which die selects the Point of Interest row, restricting rare (high-roll) entries
// out of reach for smaller settlements — Village/Town use a smaller die (1d8/1d14) directly
// against the same 20-row table; Large Town and Major City both use the full 1d20.
const CIVIC_AMENITY_ROLL_RANGE: Record<SettlementType, number> = {
  Village: 8,
  Town: 14,
  City: 20,
  Metropolis: 20,
}

export function civicAmenityRollRangeForSettlementType(type: SettlementType): number {
  return CIVIC_AMENITY_ROLL_RANGE[type]
}
