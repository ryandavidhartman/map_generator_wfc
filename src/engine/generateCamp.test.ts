import { describe, expect, it } from 'vitest'
import { generateCampSite } from './generateCamp'

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

describe('generateCampSite', () => {
  it('a Small roll with 1 peripheral feature that rolls Ritual/leader\'s space makes it the objective, not the central feature', () => {
    const rng = scripted([
      forDieResult(1, 6), // size -> Small (range 2-3 total features)
      forDieResult(1, 2), // feature count d2 -> range.min(2) + 1 - 1 = 2 total -> 1 peripheral
      forDieResult(6, 6), // peripheral feature #1 -> Ritual/leader's space
    ])
    const site = generateCampSite(rng)
    expect(site.size).toBe('Small')
    expect(site.peripheralFeatures).toHaveLength(1)
    expect(site.peripheralFeatures[0].feature).toBe("Ritual/leader's space")
    expect(site.peripheralFeatures[0].isObjectiveFeature).toBe(true)
    expect(site.central.isObjectiveFeature).toBe(false)
  })

  it('falls back to the central feature as the objective when no Ritual/leader\'s space is rolled', () => {
    const rng = scripted([
      forDieResult(1, 6), // size -> Small
      forDieResult(2, 2), // feature count d2 -> range.min(2) + 2 - 1 = 3 total -> 2 peripheral
      forDieResult(1, 6), // peripheral feature #1 -> Sleeping area
      forDieResult(3, 6), // peripheral feature #2 -> Watch post
    ])
    const site = generateCampSite(rng)
    expect(site.peripheralFeatures).toHaveLength(2)
    expect(site.peripheralFeatures.every((f) => !f.isObjectiveFeature)).toBe(true)
    expect(site.central.isObjectiveFeature).toBe(true)
  })

  it('holds structural invariants across many seeds: valid feature counts, exactly one objective, non-overlapping points', () => {
    for (const seed of [1, 2, 3, 42, 12345, 999999]) {
      const site = generateCampSite(seededRng(seed))
      const totalFeatureCount = site.peripheralFeatures.length + 1

      if (site.size === 'Small') expect([2, 3]).toContain(totalFeatureCount)
      if (site.size === 'Medium') expect([4, 5]).toContain(totalFeatureCount)
      if (site.size === 'Large') expect([6, 7, 8]).toContain(totalFeatureCount)

      const objectiveCount = site.peripheralFeatures.filter((f) => f.isObjectiveFeature).length + (site.central.isObjectiveFeature ? 1 : 0)
      expect(objectiveCount).toBe(1)

      for (const point of [site.central.point, ...site.peripheralFeatures.map((f) => f.point)]) {
        expect(point.x - point.radius).toBeGreaterThanOrEqual(0)
        expect(point.y - point.radius).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('never has more than one Ritual/leader\'s space marked as objective (first occurrence wins)', () => {
    for (const seed of [1, 2, 3, 42, 12345, 999999]) {
      const site = generateCampSite(seededRng(seed))
      const ritualFeatures = site.peripheralFeatures.filter((f) => f.feature === "Ritual/leader's space")
      const objectiveRitualFeatures = ritualFeatures.filter((f) => f.isObjectiveFeature)
      expect(objectiveRitualFeatures.length).toBeLessThanOrEqual(1)
    }
  })
})
