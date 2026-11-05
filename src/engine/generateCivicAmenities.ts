// Rolls OSR's settlement-level "civic amenities" list (data/settlementAmenityTables.ts) and
// staffs each one per Appendix E's "Populating a Point of Interest" rules — reusing the NPC
// sub-tables from Appendix C's Urban Encounters (npcTables.ts) rather than rolling anything new,
// per the book's own instruction. See docs/plan-osr-integration.md, round 2, Phase 6.

import { rollDie, rollInRange, type Rng } from './dice'
import {
  civicAmenityForD20,
  civicAmenityCountDiceForSettlementType,
  civicAmenityRollRangeForSettlementType,
  type CivicAmenityType,
} from '../data/settlementAmenityTables'
import type { SettlementType } from '../data/settlementTables'
import { rollSettlementNpc, nobleClassForD100, type SettlementNpc, type NobleClass } from '../data/npcTables'

export type CivicAmenityStaff =
  | { kind: 'npc'; npc: SettlementNpc }
  | { kind: 'vendors'; npcs: SettlementNpc[] }
  | { kind: 'leveledNpc'; npcClass: 'Cleric' | 'Thief' | 'Fighter' | 'Magic-User'; level: number }
  | { kind: 'noble'; nobleClass: NobleClass; nobleLevel?: number }
  | { kind: 'flavor'; text: string }

export type CivicAmenity = {
  id: string
  type: CivicAmenityType
  staff: CivicAmenityStaff
}

function rollDice(rng: Rng, count: number, sides: number, modifier = 0): number {
  let total = modifier
  for (let i = 0; i < count; i++) total += rollDie(sides, rng)
  return total
}

// "Town Militia or Guard Post" — the book calls for "an officer in charge (a City Guard, City
// Watchman, or Fighter result fits best; reroll anything that plainly doesn't)". Implemented as
// a reroll-toward bias, same "roll normally, get exactly one more chance on a miss" shape as
// roomContent.ts's rollBiasedRoomContent — not a hard override.
function rollGuardPostNpc(rng: Rng): SettlementNpc {
  const biasedTowardProfessions = ['City Guard', 'City Watchman', 'Fighter']
  const first = rollSettlementNpc(rng)
  if (biasedTowardProfessions.includes(first.profession)) return first
  const second = rollSettlementNpc(rng)
  return biasedTowardProfessions.includes(second.profession) ? second : first
}

// Church and Shrine/Small Temple share the book's own Cleric staffing rule ("per the Nighttime
// or Daytime Encounters tables' Cleric entry" — 1d6+5, verbatim). The book notes a Church capable
// of raise dead needs "a cleric of the level that spell requires" but gives no concrete number
// here — left as the same 1d6+5 roll for both rather than inventing an unconfirmed threshold.
function rollClericStaff(rng: Rng): CivicAmenityStaff {
  return { kind: 'leveledNpc', npcClass: 'Cleric', level: rollDice(rng, 1, 6, 5) }
}

export function rollCivicAmenityStaff(type: CivicAmenityType, rng: Rng): CivicAmenityStaff {
  switch (type) {
    case 'General Store':
    case 'Tavern':
    case 'Inn or Rooming House':
    case 'Smithy or Farrier':
    case 'Stables':
    case 'Physician or Healer':
    case 'Moneylender':
    case 'Carpenter or Mason':
    case 'Weaver or Tailor':
    case 'Alchemist or Apothecary':
      return { kind: 'npc', npc: rollSettlementNpc(rng) }
    case 'Market Square': {
      const vendorCount = rollInRange(2, 4, rng)
      return { kind: 'vendors', npcs: Array.from({ length: vendorCount }, () => rollSettlementNpc(rng)) }
    }
    case 'Town Militia or Guard Post':
      return { kind: 'npc', npc: rollGuardPostNpc(rng) }
    case 'Shrine or Small Temple':
    case 'Church':
      return rollClericStaff(rng)
    case "Thieves' Guild":
      return { kind: 'leveledNpc', npcClass: 'Thief', level: rollDice(rng, 1, 4, 7) }
    case "Mercenary or Adventurers' Guild Hall":
      return { kind: 'leveledNpc', npcClass: 'Fighter', level: rollDice(rng, 2, 4, 4) }
    case "Wizard's Tower or Arcane Academy":
      return { kind: 'leveledNpc', npcClass: 'Magic-User', level: rollDice(rng, 1, 6, 6) }
    case "Noble's Manor or Keep": {
      const nobleClass = nobleClassForD100(rollDie(100, rng))
      const nobleLevel = nobleClass === 'Normal Human' ? undefined : rollDie(8, rng) + 4
      return { kind: 'noble', nobleClass, nobleLevel }
    }
    case 'Sage or Scholar':
      return { kind: 'flavor', text: 'A 0-level Normal Human of unusually high Intelligence, or a low-level Magic-User with a research specialty (DM’s choice)' }
    case 'Something Unusual':
      return { kind: 'flavor', text: 'Left to the DM’s invention — a foreign embassy, a haunted house, a monster running a legitimate business under an assumed name' }
  }
}

export function rollCivicAmenities(settlementType: SettlementType, rng: Rng): CivicAmenity[] {
  const countDice = civicAmenityCountDiceForSettlementType(settlementType)
  const count = rollDice(rng, countDice.count, countDice.sides, countDice.modifier)
  const rollRange = civicAmenityRollRangeForSettlementType(settlementType)

  return Array.from({ length: count }, (_, i) => {
    const type = civicAmenityForD20(rollDie(rollRange, rng))
    return { id: `amenity-${i}`, type, staff: rollCivicAmenityStaff(type, rng) }
  })
}
