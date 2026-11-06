import { describe, expect, it } from 'vitest'
import { rollTreasure, describeTreasureAmount } from './generateTreasure'

function scripted(values: number[]): () => number {
  let i = 0
  return () => {
    if (i >= values.length) throw new Error('scripted rng ran out of values')
    return values[i++]
  }
}

function forDieResult(n: number, sides: number): number {
  return (n - 1) / sides
}

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('rollTreasure', () => {
  it('rolls a single amount when not guarded by a monster, scaled by dungeon level', () => {
    const rng = scripted([
      forDieResult(14, 20), // amount roll -> gp row (1d4x100 gp)
      forDieResult(2, 4), // gp dice roll -> 2
      forDieResult(1, 20), // container roll
      forDieResult(2, 2), // guard/hidden 50% check -> no guard
    ])
    const treasure = rollTreasure(rng, 3, false)
    expect(treasure.amounts).toEqual([{ kind: 'coins', coinType: 'gp', amount: 2 * 100 * 3 }])
    expect(treasure.container).toBe('Bags')
    expect(treasure.guard).toBeUndefined()
    expect(treasure.hiddenIn).toBeUndefined()
  })

  it('rolls the amount table twice, +1 to each roll, when guarded by a monster', () => {
    const rng = scripted([
      forDieResult(13, 20), // first amount roll -> die 13, +1 bonus -> row 14 (gp)
      forDieResult(1, 4), // gp dice roll
      forDieResult(13, 20), // second amount roll -> die 13, +1 bonus -> row 14 (gp)
      forDieResult(1, 4), // gp dice roll
      forDieResult(1, 20), // container roll
      forDieResult(1, 2), // guard/hidden 50% check -> guard present
      forDieResult(1, 20), // guard roll
      forDieResult(1, 20), // hidden-in roll
    ])
    const treasure = rollTreasure(rng, 1, true)
    expect(treasure.amounts).toEqual([
      { kind: 'coins', coinType: 'gp', amount: 100 },
      { kind: 'coins', coinType: 'gp', amount: 100 },
    ])
    expect(treasure.guard).toBe('Blade scything across inside')
    expect(treasure.hiddenIn).toBe('Behind a loose wall stone')
  })

  it('clamps the +1 guarded-by-monster bonus at the table max (roll 20 stays 20)', () => {
    const rng = scripted([
      forDieResult(20, 20), // amount roll 20, +1 clamped to 20 -> noneOrMagicItem
      forDieResult(10, 10), // sub-roll -> magic item
      forDieResult(20, 20), // second amount roll 20, +1 clamped -> noneOrMagicItem
      forDieResult(10, 10),
      forDieResult(1, 20), // container roll
      forDieResult(2, 2), // no guard
    ])
    const treasure = rollTreasure(rng, 5, true)
    expect(treasure.amounts).toEqual([
      { kind: 'magicItem', count: 5 },
      { kind: 'magicItem', count: 5 },
    ])
  })

  it('holds structural invariants across many seeds', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      for (const guarded of [false, true]) {
        const treasure = rollTreasure(seededRng(seed + (guarded ? 1000 : 0)), 4, guarded)
        expect(treasure.amounts).toHaveLength(guarded ? 2 : 1)
        for (const amount of treasure.amounts) {
          if (amount.kind === 'coins') expect(amount.amount).toBeGreaterThan(0)
          if (amount.kind === 'magicItem') expect(amount.count).toBe(4)
        }
        expect(treasure.container).toBeTruthy()
        expect(Boolean(treasure.guard)).toBe(Boolean(treasure.hiddenIn))
      }
    }
  })
})

describe('describeTreasureAmount', () => {
  it('formats every amount kind', () => {
    expect(describeTreasureAmount({ kind: 'coins', coinType: 'gp', amount: 500 })).toBe('500 gp')
    expect(describeTreasureAmount({ kind: 'gems', count: 2 })).toBe('2 gems')
    expect(describeTreasureAmount({ kind: 'gems', count: 1 })).toBe('1 gem')
    expect(describeTreasureAmount({ kind: 'jewellery' })).toBe('1 piece of jewellery')
    expect(describeTreasureAmount({ kind: 'magicItem', count: 2 })).toBe('2 magic items')
    expect(describeTreasureAmount({ kind: 'magicItem', count: 1 })).toBe('1 magic item')
    expect(describeTreasureAmount({ kind: 'none' })).toBe('nothing of value')
  })
})
