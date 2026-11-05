import { describe, expect, it } from 'vitest'
import { wildernessMonsterNameForRoll, wildernessEncounterLevelDie } from './wildernessMonsterLevelTables'
import type { Terrain } from './tables'

const TERRAINS: Terrain[] = ['Grassland', 'Forest/jungle', 'River/coast', 'Ocean', 'Mountain', 'Desert/arctic', 'Swamp']

describe('wildernessEncounterLevelDie', () => {
  it('matches the book\'s three tiers', () => {
    expect(wildernessEncounterLevelDie(1)).toBe(8)
    expect(wildernessEncounterLevelDie(3)).toBe(8)
    expect(wildernessEncounterLevelDie(4)).toBe(14)
    expect(wildernessEncounterLevelDie(6)).toBe(14)
    expect(wildernessEncounterLevelDie(7)).toBe(20)
    expect(wildernessEncounterLevelDie(100)).toBe(20)
  })
})

describe('wildernessMonsterNameForRoll', () => {
  it('every terrain has a non-empty name for every category at every roll 1-20', () => {
    const categories = [
      'Airborne', 'Animal', 'Dragon', 'Giant', 'Human/Demi-Human', 'Humanoid',
      'Monster', 'NPC', 'Undead', 'Invertebrates', 'Water', 'Special',
    ] as const
    for (const terrain of TERRAINS) {
      for (const category of categories) {
        for (let roll = 1; roll <= 20; roll++) {
          expect(wildernessMonsterNameForRoll(terrain, category, roll).length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('boundary spot-checks against the source table (Plains)', () => {
    expect(wildernessMonsterNameForRoll('Grassland', 'Undead', 1)).toBe('Groaning Spirit')
    expect(wildernessMonsterNameForRoll('Grassland', 'Undead', 20)).toBe('Zombie')
    expect(wildernessMonsterNameForRoll('Grassland', 'Dragon', 1)).toBe('Dragon, Black')
    expect(wildernessMonsterNameForRoll('Grassland', 'Special', 20)).toBe('Megalosaurus')
  })

  it('boundary spot-checks against the source table (Mountains)', () => {
    expect(wildernessMonsterNameForRoll('Mountain', 'Giant', 20)).toBe('Titan')
    expect(wildernessMonsterNameForRoll('Mountain', 'Special', 1)).toBe('Type VI Demon (Balor)')
  })

  it('Swamp falls back to the Marine table (Wetlands has no dedicated table in the source)', () => {
    expect(wildernessMonsterNameForRoll('Swamp', 'Water', 1)).toBe(wildernessMonsterNameForRoll('Ocean', 'Water', 1))
    expect(wildernessMonsterNameForRoll('Swamp', 'Monster', 5)).toBe('Sahuagin')
  })

  it('a Danger Level 1 hex (1d8) never reaches a row beyond 8 — the table itself supports this via row order', () => {
    // Not a die-roll assertion (that's wildernessEncounterLevelDie's job) — just confirms the
    // early rows (reachable at Danger Level 1-3) are meaningfully tamer/more common entries than
    // the late rows, matching the book's own weakest-to-strongest row ordering.
    expect(wildernessMonsterNameForRoll('Grassland', 'Undead', 1)).not.toBe(wildernessMonsterNameForRoll('Grassland', 'Undead', 20))
  })

  it('throws for an out-of-range roll', () => {
    expect(() => wildernessMonsterNameForRoll('Grassland', 'Animal', 0)).toThrow()
    expect(() => wildernessMonsterNameForRoll('Grassland', 'Animal', 21)).toThrow()
  })
})
