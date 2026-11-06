// Camp content tables — house-rule content (not book RAW), confirmed 2026-07-04 as part of
// the Location Generator expansion (see docs/plan-sites-settlements-mongo.md's "Location
// Generator expansion" section for the full design conversation). Same "original content the
// user specified directly, table entry by table entry" provenance as shrineTables.ts/
// riftTables.ts — nothing here is invented.

import type { SiteSize } from './dungeonTables'

// Size maps to TOTAL feature count (central feature included), not room count — unlike Keep's
// keepRoomCountRangeForSize, which explicitly excludes its hub (the courtyard). Camp's table was
// given without that exclusion, so peripheralCount = totalFeatureCount - 1 (see generateCamp.ts).
export type CampFeatureCountRange = { min: number; max: number }

const CAMP_FEATURE_COUNT_RANGES: Record<SiteSize, CampFeatureCountRange> = {
  Small: { min: 2, max: 3 },
  Medium: { min: 4, max: 5 },
  Large: { min: 6, max: 8 },
}

export function campFeatureCountRangeForSize(size: SiteSize): CampFeatureCountRange {
  return CAMP_FEATURE_COUNT_RANGES[size]
}

export type CampPeripheralFeature =
  | 'Sleeping area'
  | 'Supply cache'
  | 'Watch post'
  | 'Mounts/pack animals pen'
  | 'Prisoner/captive pit'
  | "Ritual/leader's space"

export type CampPeripheralFeatureEntry = { feature: CampPeripheralFeature; description: string }

const CAMP_PERIPHERAL_FEATURES: CampPeripheralFeatureEntry[] = [
  { feature: 'Sleeping area', description: 'Tents/bedrolls' },
  { feature: 'Supply cache', description: 'Food, loot, mundane gear' },
  { feature: 'Watch post', description: 'Armed NPCs, sightlines' },
  { feature: 'Mounts/pack animals pen', description: 'Mounts/pack animals pen' },
  { feature: 'Prisoner/captive pit', description: 'Prisoner/captive pit' },
  { feature: "Ritual/leader's space", description: 'Where the "boss" NPC actually is' },
]

export function campPeripheralFeatureForD6(roll: number): CampPeripheralFeatureEntry {
  if (roll < 1 || roll > 6) throw new Error(`campPeripheralFeatureForD6: roll out of range: ${roll}`)
  return CAMP_PERIPHERAL_FEATURES[roll - 1]
}
