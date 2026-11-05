import { describe, expect, it } from 'vitest'
import { rollDressing, rollTrap, rollTrick } from './generateDressing'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('rollDressing', () => {
  it('rolls all 5 universal atmosphere lines', () => {
    const dressing = rollDressing(seededRng(1))
    expect(dressing.airCurrent).toBeTruthy()
    expect(dressing.odour).toBeTruthy()
    expect(dressing.noise).toBeTruthy()
    expect(dressing.general).toBeTruthy()
    expect(dressing.furnishing).toBeTruthy()
  })
})

describe('rollTrap', () => {
  it('rolls a concrete trap name and derives severity from dungeon level', () => {
    const trap = rollTrap(seededRng(1), 1)
    expect(trap.name).toBeTruthy()
    expect(trap.severity).toBe('Nuisance')
  })

  it('severity scales with dungeon level across seeds', () => {
    for (const seed of [1, 2, 3, 42]) {
      expect(rollTrap(seededRng(seed), 16).severity).toBe('Fatal')
      expect(rollTrap(seededRng(seed), 1).severity).toBe('Nuisance')
    }
  })
})

describe('rollTrick', () => {
  it('rolls an object + attribute pair', () => {
    for (const seed of [1, 2, 3, 42]) {
      const trick = rollTrick(seededRng(seed))
      expect(trick.object).toBeTruthy()
      expect(trick.attribute).toBeTruthy()
    }
  })
})
