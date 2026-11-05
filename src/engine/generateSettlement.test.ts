import { describe, expect, it } from 'vitest'
import { generateSettlement } from './generateSettlement'
import { populationRangeForSettlementType } from '../data/settlementTables'

// Seeded rng + structural invariants throughout. Map geometry is no longer generated here —
// see settlementPlan.test.ts for the render-time layout's own tests.
function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('generateSettlement', () => {
  it('rolls settlement type, then one district per die of that tier', () => {
    const settlement = generateSettlement(seededRng(1))
    expect(settlement.kind).toBe('settlement')
    expect([3, 4, 6, 8]).toContain(settlement.districts.length)
    for (const district of settlement.districts) {
      expect(district.pointsOfInterest.length).toBeGreaterThanOrEqual(1)
      expect(district.pointsOfInterest.length).toBeLessThanOrEqual(4)
      for (const poi of district.pointsOfInterest) {
        expect(poi.text).toBeTruthy()
        expect(poi.npc.race).toBeDefined()
        expect(poi.npc.profession).toBeDefined()
      }
    }
  })

  it('marks the single highest district-type roll as seat of government, first occurrence wins ties', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      const settlement = generateSettlement(seededRng(seed))
      const seats = settlement.districts.filter((d) => d.isSeatOfGovernment)
      expect(seats).toHaveLength(1)
      const maxRoll = Math.max(...settlement.districts.map((d) => d.districtTypeRoll))
      const firstMaxIndex = settlement.districts.findIndex((d) => d.districtTypeRoll === maxRoll)
      expect(seats[0].index).toBe(firstMaxIndex)
    }
  })

  it('an override settlement type skips the type roll entirely', () => {
    const settlement = generateSettlement(seededRng(7), 'Metropolis')
    expect(settlement.settlementType).toBe('Metropolis')
    expect(settlement.districts).toHaveLength(8)
  })

  it('holds structural invariants across many seeds, including the district-tiering rule', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      const settlement = generateSettlement(seededRng(seed))
      expect([3, 4, 6, 8]).toContain(settlement.districts.length)

      const seats = settlement.districts.filter((d) => d.isSeatOfGovernment)
      expect(seats).toHaveLength(1)
      const maxRoll = Math.max(...settlement.districts.map((d) => d.districtTypeRoll))
      expect(seats[0].districtTypeRoll).toBe(maxRoll)

      for (const district of settlement.districts) {
        expect(district.pointsOfInterest.length).toBeGreaterThanOrEqual(1)
        expect(district.pointsOfInterest.length).toBeLessThanOrEqual(4)
        if (settlement.settlementType === 'Village' || settlement.settlementType === 'Town') {
          expect(['Slums', 'Low District', 'Artisan District', 'Market']).toContain(district.districtType)
        }
        if (settlement.settlementType === 'City') {
          expect(['University District', 'Castle District']).not.toContain(district.districtType)
        }
      }


      expect(settlement.government.authority).toBeTruthy()
      expect(settlement.government.notes).toBeTruthy()
      const popRange = populationRangeForSettlementType(settlement.settlementType)
      expect(settlement.population).toBeGreaterThanOrEqual(popRange.min)
      expect(settlement.population).toBeLessThanOrEqual(popRange.max)

      expect(settlement.amenities.length).toBeGreaterThan(0)
      for (const amenity of settlement.amenities) {
        expect(amenity.type).toBeTruthy()
        expect(amenity.staff).toBeDefined()
      }
    }
  })
})
