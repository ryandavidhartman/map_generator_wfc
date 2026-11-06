import { rollDie, rollInRange, type Rng } from './dice'
import {
  settlementTypeForD6,
  settlementTypeSpecFor,
  districtTypeForRoll,
  alignmentForD6,
  districtPoiForD6,
  governmentForD6,
  populationRangeForSettlementType,
  type SettlementType,
  type DistrictType,
  type Alignment,
  type Government,
} from '../data/settlementTables'
import { rollSettlementNpc, type SettlementNpc } from '../data/npcTables'
import { rollCivicAmenities, type CivicAmenity } from './generateCivicAmenities'

// Settlement NPC population (confirmed 2026-07-06): every district POI gets a named-flavor NPC
// attached (race + profession, from Appendix C's Urban Encounters tables — see npcTables.ts),
// the same "every slot gets one, no keyword-matched subset" scope as the dungeon monster/NPC
// population phase before it.
export type DistrictPoi = { text: string; npc: SettlementNpc }

// The map's geometry (blocks, streets, buildings, wall) is NOT stored here — since the
// 2026-10-31 settlement map overhaul, engine/settlementPlan.ts derives it at render time from
// the districts below plus a seeded hash, like towerPlan.ts/keepPlan.ts.
export type District = {
  id: string
  index: number
  districtType: DistrictType
  districtTypeRoll: number
  alignment: Alignment
  pointsOfInterest: DistrictPoi[]
  isSeatOfGovernment: boolean
}

export type Settlement = {
  kind: 'settlement'
  settlementType: SettlementType
  government: Government
  population: number
  // Settlement-level "civic amenities" (Appendix E, round 2 Phase 6) — additive to, and
  // independent of, the per-district pointsOfInterest above (OSR has no district concept at all).
  amenities: CivicAmenity[]
  districts: District[]
}

// Settlement Type is rolled fresh here — never derived from the originating hex's POI text
// (see the plan's "Two mechanical points" note). District count is the literal dice count for
// the tier (never summed): Village/Town roll d4 per district (so district type can only ever
// land in the first 4 of 8 types), City rolls d6 (reaching Temple District but not
// University/Castle), and only Metropolis rolls d8 (the full range). Preserve this tiering.
export function generateSettlement(rng: Rng = Math.random, overrideSettlementType?: SettlementType): Settlement {
  const spec = overrideSettlementType ? settlementTypeSpecFor(overrideSettlementType) : settlementTypeForD6(rollDie(6, rng))
  const government = governmentForD6(rollDie(6, rng))
  const popRange = populationRangeForSettlementType(spec.type)
  const population = rollInRange(popRange.min, popRange.max, rng)
  const amenities = rollCivicAmenities(spec.type, rng)

  const districts: District[] = Array.from({ length: spec.diceCount }, (_, index) => {
    const districtTypeRoll = rollDie(spec.diceSides, rng)
    const districtType = districtTypeForRoll(districtTypeRoll, spec.diceSides)
    const alignment = alignmentForD6(rollDie(6, rng))
    const poiCount = rollDie(4, rng)
    const pointsOfInterest: DistrictPoi[] = Array.from({ length: poiCount }, () => ({
      text: districtPoiForD6(districtType, rollDie(6, rng)),
      npc: rollSettlementNpc(rng),
    }))

    return {
      id: `district-${index}`,
      index,
      districtType,
      districtTypeRoll,
      alignment,
      pointsOfInterest,
      isSeatOfGovernment: false,
    }
  })

  // The district with the single highest district-type roll is the seat of government
  // (book RAW). First occurrence wins ties.
  let seatIndex = 0
  for (let i = 1; i < districts.length; i++) {
    if (districts[i].districtTypeRoll > districts[seatIndex].districtTypeRoll) seatIndex = i
  }
  if (districts.length > 0) districts[seatIndex] = { ...districts[seatIndex], isSeatOfGovernment: true }

  return { kind: 'settlement', settlementType: spec.type, government, population, amenities, districts }
}
