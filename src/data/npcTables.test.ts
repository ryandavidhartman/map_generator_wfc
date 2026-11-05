import { describe, expect, it } from 'vitest'
import {
  npcRaceForD100,
  urbanProfessionForD100,
  nobleClassForD100,
  zeroLevelActivityTierForD5,
  rollSettlementNpc,
} from './npcTables'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('npcRaceForD100', () => {
  it('covers the full 1-100 range with no gaps', () => {
    for (let roll = 1; roll <= 100; roll++) {
      expect(() => npcRaceForD100(roll)).not.toThrow()
    }
  })

  it('spot-checks boundary values', () => {
    expect(npcRaceForD100(1)).toBe('Dwarf')
    expect(npcRaceForD100(10)).toBe('Dwarf')
    expect(npcRaceForD100(11)).toBe('Elf')
    expect(npcRaceForD100(40)).toBe('Half-Orc')
    expect(npcRaceForD100(41)).toBe('Human')
    expect(npcRaceForD100(100)).toBe('Human')
  })

  it('throws out of range', () => {
    expect(() => npcRaceForD100(0)).toThrow()
    expect(() => npcRaceForD100(101)).toThrow()
  })
})

describe('urbanProfessionForD100', () => {
  it('covers the full 1-100 range with no gaps', () => {
    for (let roll = 1; roll <= 100; roll++) {
      expect(() => urbanProfessionForD100(roll)).not.toThrow()
    }
  })

  it('spot-checks boundary values', () => {
    expect(urbanProfessionForD100(1)).toBe('Bandit')
    expect(urbanProfessionForD100(8)).toBe('Bandit')
    expect(urbanProfessionForD100(9)).toBe('Brigand')
    expect(urbanProfessionForD100(79)).toBe('Noble')
    expect(urbanProfessionForD100(80)).toBe('Noble')
    expect(urbanProfessionForD100(81)).toBe('Rake')
    expect(urbanProfessionForD100(100)).toBe('Tradesman')
  })

  it('throws out of range', () => {
    expect(() => urbanProfessionForD100(0)).toThrow()
    expect(() => urbanProfessionForD100(101)).toThrow()
  })
})

describe('nobleClassForD100', () => {
  it('spot-checks boundary values', () => {
    expect(nobleClassForD100(1)).toBe('Normal Human')
    expect(nobleClassForD100(50)).toBe('Normal Human')
    expect(nobleClassForD100(51)).toBe('Fighter')
    expect(nobleClassForD100(85)).toBe('Fighter')
    expect(nobleClassForD100(86)).toBe('Cleric')
    expect(nobleClassForD100(100)).toBe('Cleric')
  })
})

describe('zeroLevelActivityTierForD5', () => {
  it('covers 1-5 with no gaps, in book order', () => {
    expect(zeroLevelActivityTierForD5(1).tier).toBe('Infirm')
    expect(zeroLevelActivityTierForD5(2).tier).toBe('Sedentary')
    expect(zeroLevelActivityTierForD5(3).tier).toBe('Active')
    expect(zeroLevelActivityTierForD5(4).tier).toBe('Fit')
    expect(zeroLevelActivityTierForD5(5).tier).toBe('Very Fit')
  })

  it('throws out of range', () => {
    expect(() => zeroLevelActivityTierForD5(0)).toThrow()
    expect(() => zeroLevelActivityTierForD5(6)).toThrow()
  })
})

describe('rollSettlementNpc', () => {
  it('always returns a race, profession, and activity tier', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      const npc = rollSettlementNpc(seededRng(seed))
      expect(npc.race).toBeDefined()
      expect(npc.profession).toBeDefined()
      expect(npc.activityTier).toBeDefined()
    }
  })

  it('only Noble-profession NPCs get a nobleClass', () => {
    for (const seed of Array.from({ length: 200 }, (_, i) => i + 1)) {
      const npc = rollSettlementNpc(seededRng(seed))
      if (npc.profession === 'Noble') {
        expect(npc.nobleClass).toBeDefined()
      } else {
        expect(npc.nobleClass).toBeUndefined()
        expect(npc.nobleLevel).toBeUndefined()
      }
    }
  })

  it('a Noble with Fighter/Cleric class gets a level in the 5-12 range (1d8+4), Normal Human gets none', () => {
    let foundNormalHuman = false
    let foundClassed = false
    for (const seed of Array.from({ length: 500 }, (_, i) => i + 1)) {
      const npc = rollSettlementNpc(seededRng(seed))
      if (npc.nobleClass === 'Normal Human') {
        expect(npc.nobleLevel).toBeUndefined()
        foundNormalHuman = true
      } else if (npc.nobleClass === 'Fighter' || npc.nobleClass === 'Cleric') {
        expect(npc.nobleLevel).toBeGreaterThanOrEqual(5)
        expect(npc.nobleLevel).toBeLessThanOrEqual(12)
        foundClassed = true
      }
    }
    expect(foundNormalHuman).toBe(true)
    expect(foundClassed).toBe(true)
  })
})
