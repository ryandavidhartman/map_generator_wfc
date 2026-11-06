import { describe, expect, it } from 'vitest'
import { monsterTreasureType } from './monsterTreasureTypes'

describe('monsterTreasureType', () => {
  it('returns the raw stat-block string for a known monster', () => {
    expect(monsterTreasureType('Ogre')).toBe('C + 1000 gp')
    expect(monsterTreasureType('Skeleton')).toBe('Nil')
  })

  it('returns undefined for a name with no known mapping', () => {
    expect(monsterTreasureType('Not A Real Monster')).toBeUndefined()
  })

  it('every dragon color shares the same Treasure Type, including the four with no dedicated source entry', () => {
    const colors = ['Black', 'Blue', 'Brass', 'Bronze', 'Copper', 'Gold', 'Green', 'Red', 'Silver', 'White']
    for (const color of colors) {
      expect(monsterTreasureType(`Dragon, ${color}`)).toBe('H')
    }
  })
})
