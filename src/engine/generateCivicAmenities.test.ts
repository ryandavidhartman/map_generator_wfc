import { describe, expect, it } from 'vitest'
import { rollCivicAmenities, rollCivicAmenityStaff } from './generateCivicAmenities'
import { civicAmenityCountDiceForSettlementType } from '../data/settlementAmenityTables'
import type { CivicAmenityType } from '../data/settlementAmenityTables'
import type { SettlementType } from '../data/settlementTables'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const ALL_TYPES: CivicAmenityType[] = [
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

describe('rollCivicAmenityStaff', () => {
  it('every amenity type produces a well-formed staff result across many seeds', () => {
    for (const type of ALL_TYPES) {
      for (const seed of [1, 2, 3, 42, 12345]) {
        const staff = rollCivicAmenityStaff(type, seededRng(seed))
        switch (staff.kind) {
          case 'npc':
            expect(staff.npc.race.length).toBeGreaterThan(0)
            break
          case 'vendors':
            expect(staff.npcs.length).toBeGreaterThanOrEqual(2)
            expect(staff.npcs.length).toBeLessThanOrEqual(4)
            break
          case 'leveledNpc':
            expect(staff.level).toBeGreaterThan(0)
            break
          case 'noble':
            expect(['Normal Human', 'Fighter', 'Cleric']).toContain(staff.nobleClass)
            break
          case 'flavor':
            expect(staff.text.length).toBeGreaterThan(0)
            break
        }
      }
    }
  })

  // Scripted rather than statistical — this project has previously removed a probabilistic test
  // as flaky because small sequential LCG seeds correlate on early rolls (see
  // generateShrine.test.ts's history). A scripted rng proves the reroll-toward mechanism
  // deterministically: first roll misses (Bandit), second roll hits (Fighter) and is the one used.
  it('rerolls toward City Guard/City Watchman/Fighter on a miss, and uses the hit', () => {
    function forDieResult(n: number, sides: number): number {
      return (n - 1) / sides
    }
    let i = 0
    const values = [
      forDieResult(1, 100), // first roll: race -> Dwarf (irrelevant)
      forDieResult(1, 100), // first roll: profession -> Bandit (a miss, not in the biased set)
      forDieResult(1, 5), // first roll: activity tier -> Infirm
      forDieResult(1, 100), // second roll: race -> Dwarf (irrelevant)
      forDieResult(30, 100), // second roll: profession -> Fighter (a hit)
      forDieResult(1, 5), // second roll: activity tier -> Infirm
    ]
    const rng = () => values[i++]

    const staff = rollCivicAmenityStaff('Town Militia or Guard Post', rng)
    expect(staff.kind).toBe('npc')
    if (staff.kind === 'npc') expect(staff.npc.profession).toBe('Fighter')
  })
})

describe('rollCivicAmenities', () => {
  it('rolls the settlement-size-appropriate count and every amenity has staff', () => {
    const settlementTypes: SettlementType[] = ['Village', 'Town', 'City', 'Metropolis']
    for (const type of settlementTypes) {
      for (const seed of [1, 2, 3, 42, 12345]) {
        const amenities = rollCivicAmenities(type, seededRng(seed))
        const spec = civicAmenityCountDiceForSettlementType(type)
        expect(amenities.length).toBeGreaterThanOrEqual(spec.count * 1 + spec.modifier)
        expect(amenities.length).toBeLessThanOrEqual(spec.count * spec.sides + spec.modifier)
        for (const amenity of amenities) {
          expect(ALL_TYPES).toContain(amenity.type)
          expect(amenity.staff).toBeDefined()
        }
      }
    }
  })

  it('Village never rolls a rare (roll-range > 8) amenity type', () => {
    for (const seed of [1, 2, 3, 42, 12345, 777, 2024]) {
      const amenities = rollCivicAmenities('Village', seededRng(seed))
      for (const amenity of amenities) {
        expect(ALL_TYPES.indexOf(amenity.type)).toBeLessThan(8)
      }
    }
  })
})
