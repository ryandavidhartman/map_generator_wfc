import { describe, expect, it } from 'vitest'
import { generateRiftSite } from './generateRift'

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

describe('generateRiftSite', () => {
  it('rolls exactly Origin (d6), Effect (d6), then Stability (d4), in that order', () => {
    const rng = scripted([
      forDieResult(3, 6), // Origin -> Feywild
      forDieResult(6, 6), // Effect -> Time distortion
      forDieResult(4, 4), // Stability -> Collapsing
    ])
    const site = generateRiftSite(rng)
    expect(site.kind).toBe('rift')
    expect(site.origin).toBe('Feywild')
    expect(site.effect).toBe('Time distortion')
    expect(site.stability).toBe('Collapsing')
    expect(site.effectNote.length).toBeGreaterThan(0)
    expect(site.stabilityNote.length).toBeGreaterThan(0)
  })

  it('holds structural invariants across many seeds', () => {
    const validOrigins = [
      'Elemental (fire/water/air/earth — pick or roll again)',
      'Shadow/Void',
      'Feywild',
      'Abyss/Infernal',
      'Astral',
      'Far Realm / aberrant',
    ]
    const validEffects = ['Terrain warps', 'Color/life drains', 'Hallucination/whispers', 'Temperature extreme', 'Gravity anomaly', 'Time distortion']
    const validStabilities = ['Stable', 'Growing', 'Pulsing/unstable', 'Collapsing']

    for (const seed of [1, 2, 3, 42, 12345, 999999]) {
      const site = generateRiftSite(seededRng(seed))
      expect(validOrigins).toContain(site.origin)
      expect(validEffects).toContain(site.effect)
      expect(validStabilities).toContain(site.stability)
    }
  })

  it('the three axes roll independently — no correlation forced between them', () => {
    // Force the same underlying value on all three rolls and confirm each axis still resolves
    // via its own table (different sizes: d6, d6, d4), rather than accidentally sharing state.
    const rng = scripted([0, 0, 0])
    const site = generateRiftSite(rng)
    expect(site.origin).toBe('Elemental (fire/water/air/earth — pick or roll again)')
    expect(site.effect).toBe('Terrain warps')
    expect(site.stability).toBe('Stable')
  })
})
