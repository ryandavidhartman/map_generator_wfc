import { describe, expect, it } from 'vitest'
import { treasureAmountRowForD20, treasureContainerForD20, treasureGuardForD20, treasureHiddenInForD20 } from './treasureTables'

describe('Treasure Amount table (1d20)', () => {
  it.each([
    [1, 'coins', 'cp'],
    [5, 'coins', 'cp'],
    [6, 'coins', 'sp'],
    [10, 'coins', 'sp'],
    [11, 'coins', 'ep'],
    [13, 'coins', 'ep'],
    [14, 'coins', 'gp'],
    [16, 'coins', 'gp'],
    [17, 'coins', 'pp'],
    [18, 'coins', 'pp'],
  ] as const)('roll %i -> %s (%s)', (roll, kind, coinType) => {
    const row = treasureAmountRowForD20(roll)
    expect(row.kind).toBe(kind)
    if (row.kind === 'coins') expect(row.coinType).toBe(coinType)
  })

  it('roll 19 -> gems or jewellery', () => {
    expect(treasureAmountRowForD20(19).kind).toBe('gemsOrJewellery')
  })

  it('roll 20 -> none or magic item (folds the source table\'s stray 21st row)', () => {
    expect(treasureAmountRowForD20(20).kind).toBe('noneOrMagicItem')
  })

  it('throws out of range', () => {
    expect(() => treasureAmountRowForD20(0)).toThrow()
    expect(() => treasureAmountRowForD20(21)).toThrow()
  })
})

describe('Treasure Container table (1d20)', () => {
  it.each([
    [1, 'Bags'],
    [2, 'Bags'],
    [3, 'Sacks'],
    [9, 'Large Chests'],
    [10, 'Large Chests'],
    [19, 'None, loose'],
    [20, 'None, loose'],
  ] as const)('roll %i -> %s', (roll, container) => {
    expect(treasureContainerForD20(roll)).toBe(container)
  })
})

describe('Treasure Guards & Wards table (1d20)', () => {
  it('covers the full 1-20 range with no gaps', () => {
    for (let roll = 1; roll <= 20; roll++) {
      expect(treasureGuardForD20(roll)).toBeTruthy()
    }
  })

  it('spot-checks a couple of rows', () => {
    expect(treasureGuardForD20(1)).toBe('Blade scything across inside')
    expect(treasureGuardForD20(20)).toBe('Trapdoor opening 6 ft in front of container')
  })
})

describe('Treasure Hidden By or In table (1d20)', () => {
  it('covers the full 1-20 range with no gaps', () => {
    for (let roll = 1; roll <= 20; roll++) {
      expect(treasureHiddenInForD20(roll)).toBeTruthy()
    }
  })

  it('spot-checks a couple of rows', () => {
    expect(treasureHiddenInForD20(1)).toBe('Behind a loose wall stone')
    expect(treasureHiddenInForD20(20)).toBe('Under a loose flooring stone')
  })
})
