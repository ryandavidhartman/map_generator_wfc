import { describe, expect, it } from 'vitest'
import { generateShrineSite } from './generateShrine'

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

describe('generateShrineSite', () => {
  it('a feature-count roll of 1 produces no approach features, just the core', () => {
    const rng = scripted([
      forDieResult(1, 3), // feature count -> 1 (core only)
      forDieResult(5, 6), // disposition -> Helpful
    ])
    const site = generateShrineSite(rng)
    expect(site.kind).toBe('shrine')
    expect(site.approachFeatures).toHaveLength(0)
    expect(site.core.disposition).toBe('Helpful')
  })

  it('a feature-count roll of 3 produces exactly 2 approach features before the core, in order', () => {
    const rng = scripted([
      forDieResult(3, 3), // feature count -> 3
      forDieResult(2, 6), // approach 1 -> Warning totem/marker
      forDieResult(2, 6), // approach 2 -> Warning totem/marker (duplicate, allowed by design)
      forDieResult(1, 6), // disposition -> Hostile
    ])
    const site = generateShrineSite(rng)
    expect(site.approachFeatures).toHaveLength(2)
    expect(site.approachFeatures[0].feature).toBe('Warning totem/marker')
    expect(site.approachFeatures[1].feature).toBe('Warning totem/marker')
    expect(site.approachFeatures[0].id).not.toBe(site.approachFeatures[1].id)
    expect(site.core.disposition).toBe('Hostile')
  })

  it('holds structural invariants across many seeds', () => {
    const validDispositions = ['Hostile', 'Wary', 'Testing', 'Indifferent', 'Helpful', 'Desperate']
    const validFeatures = ['Guardian beast', 'Warning totem/marker', 'Blessed/cursed threshold', 'Offering pile', 'False lead', 'Physical obstacle']

    for (const seed of [1, 2, 3, 42, 12345, 999999]) {
      const site = generateShrineSite(seededRng(seed))
      expect(site.approachFeatures.length).toBeGreaterThanOrEqual(0)
      expect(site.approachFeatures.length).toBeLessThanOrEqual(2)
      expect(validDispositions).toContain(site.core.disposition)
      for (const f of site.approachFeatures) {
        expect(validFeatures).toContain(f.feature)
      }
    }
  })

})
