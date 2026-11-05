import { describe, expect, it } from 'vitest'
import {
  civicAmenityForD20,
  civicAmenityCountDiceForSettlementType,
  civicAmenityRollRangeForSettlementType,
} from './settlementAmenityTables'
import type { SettlementType } from './settlementTables'

describe('civicAmenityForD20', () => {
  it('covers the full 1-20 range', () => {
    for (let roll = 1; roll <= 20; roll++) {
      expect(civicAmenityForD20(roll)).toBeTruthy()
    }
  })

  it('spot-checks boundary rows', () => {
    expect(civicAmenityForD20(1)).toBe('General Store')
    expect(civicAmenityForD20(8)).toBe('Town Militia or Guard Post')
    expect(civicAmenityForD20(14)).toBe('Church')
    expect(civicAmenityForD20(20)).toBe('Something Unusual')
  })

  it('throws out of range', () => {
    expect(() => civicAmenityForD20(0)).toThrow()
    expect(() => civicAmenityForD20(21)).toThrow()
  })
})

describe('civicAmenityCountDiceForSettlementType', () => {
  it.each([
    ['Village', { count: 1, sides: 4, modifier: 0 }],
    ['Town', { count: 1, sides: 6, modifier: 2 }],
    ['City', { count: 2, sides: 6, modifier: 4 }],
    ['Metropolis', { count: 3, sides: 6, modifier: 8 }],
  ] as [SettlementType, { count: number; sides: number; modifier: number }][])('%s -> %o', (type, spec) => {
    expect(civicAmenityCountDiceForSettlementType(type)).toEqual(spec)
  })
})

describe('civicAmenityRollRangeForSettlementType', () => {
  it.each([
    ['Village', 8],
    ['Town', 14],
    ['City', 20],
    ['Metropolis', 20],
  ] as [SettlementType, number][])('%s -> 1d%i', (type, range) => {
    expect(civicAmenityRollRangeForSettlementType(type)).toBe(range)
  })
})
