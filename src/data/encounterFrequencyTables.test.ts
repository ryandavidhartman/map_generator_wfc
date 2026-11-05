import { describe, expect, it } from 'vitest'
import { wildernessEncounterChanceForTerrain, encounterPurposeForD8, wildernessCategoryForD100 } from './encounterFrequencyTables'
import type { Terrain } from './tables'

const ALL_TERRAINS: Terrain[] = ['Desert/arctic', 'Swamp', 'Grassland', 'Forest/jungle', 'River/coast', 'Ocean', 'Mountain']

describe('wildernessEncounterChanceForTerrain', () => {
  it('every terrain has a non-empty chance set, all values within 1-6', () => {
    for (const terrain of ALL_TERRAINS) {
      const chances = wildernessEncounterChanceForTerrain(terrain)
      expect(chances.length).toBeGreaterThan(0)
      for (const roll of chances) {
        expect(roll).toBeGreaterThanOrEqual(1)
        expect(roll).toBeLessThanOrEqual(6)
      }
    }
  })

  it('Grassland is the narrowest (only 6 triggers)', () => {
    expect(wildernessEncounterChanceForTerrain('Grassland')).toEqual([6])
  })
})

describe('encounterPurposeForD8', () => {
  it('covers the full 1-8 range', () => {
    for (let roll = 1; roll <= 8; roll++) {
      expect(encounterPurposeForD8(roll)).toBeTruthy()
    }
  })

  it('throws out of range', () => {
    expect(() => encounterPurposeForD8(0)).toThrow()
    expect(() => encounterPurposeForD8(9)).toThrow()
  })
})

describe('wildernessCategoryForD100', () => {
  it('covers the full 1-100 range with no gaps, for every terrain', () => {
    for (const terrain of ALL_TERRAINS) {
      for (let roll = 1; roll <= 100; roll++) {
        expect(wildernessCategoryForD100(terrain, roll)).toBeTruthy()
      }
    }
  })

  it('spot-checks the Plains row (Grassland) at its documented boundaries', () => {
    expect(wildernessCategoryForD100('Grassland', 1)).toBe('Airborne')
    expect(wildernessCategoryForD100('Grassland', 19)).toBe('Airborne')
    expect(wildernessCategoryForD100('Grassland', 20)).toBe('Animal')
    expect(wildernessCategoryForD100('Grassland', 100)).toBe('Special')
  })

  it('resolves the Wetlands (Swamp) row overlap deterministically at its disputed boundaries', () => {
    expect(wildernessCategoryForD100('Swamp', 58)).toBe('NPC')
    expect(wildernessCategoryForD100('Swamp', 59)).toBe('Undead')
    expect(wildernessCategoryForD100('Swamp', 95)).toBe('Water')
    expect(wildernessCategoryForD100('Swamp', 96)).toBe('Special')
  })

  it('throws out of range', () => {
    expect(() => wildernessCategoryForD100('Grassland', 0)).toThrow()
    expect(() => wildernessCategoryForD100('Grassland', 101)).toThrow()
  })
})
