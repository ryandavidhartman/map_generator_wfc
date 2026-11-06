import { describe, expect, it } from 'vitest'
import { NPC_TYPES, rollNpcType } from './monsterTables'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('NPC_TYPES', () => {
  it('has a non-empty list with no duplicates', () => {
    expect(NPC_TYPES.length).toBeGreaterThan(5)
    expect(new Set(NPC_TYPES).size).toBe(NPC_TYPES.length)
  })

  it('rollNpcType always returns a value from the list', () => {
    for (const seed of [1, 42, 12345]) {
      const rng = seededRng(seed)
      for (let i = 0; i < 20; i++) {
        expect(NPC_TYPES).toContain(rollNpcType(rng))
      }
    }
  })
})
