import { describe, expect, it } from 'vitest'
import { terrainFor3d6, dangerForD6, settlementNameForD20, settlementNameColumnFor } from '../data/tables'
import {
  rollStartingTerrain,
  rollPointOfInterest,
  pointOfInterestForFeatureRoll,
  generateHexDetails,
} from './generateHex'

// A scripted RNG: each call to Math.random() returns the next queued value.
// rollDie(sides) computes floor(rng() * sides) + 1, so to force a specific
// die result `n` (1-indexed) supply (n - 1) / sides.
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

describe('Starting Terrain table (3d6)', () => {
  it.each([
    [3, 'Desert/arctic'],
    [4, 'Desert/arctic'],
    [5, 'Swamp'],
    [6, 'Swamp'],
    [7, 'Grassland'],
    [9, 'Grassland'],
    [10, 'Forest/jungle'],
    [11, 'Forest/jungle'],
    [12, 'Hills'],
    [13, 'Coast'],
    [14, 'Coast'],
    [15, 'Ocean'],
    [16, 'Ocean'],
    [17, 'Mountain'],
    [18, 'Mountain'],
  ] as const)('roll %i -> %s', (roll, terrain) => {
    expect(terrainFor3d6(roll)).toBe(terrain)
  })

  it('throws out of range', () => {
    expect(() => terrainFor3d6(2)).toThrow()
    expect(() => terrainFor3d6(19)).toThrow()
  })

  it('rollStartingTerrain sums three d6', () => {
    const rng = scripted([forDieResult(6, 6), forDieResult(6, 6), forDieResult(5, 6)]) // 17
    expect(rollStartingTerrain(rng)).toBe('Mountain')
  })
})

describe('Danger Level table (d6)', () => {
  it.each([
    [1, 'Safe'],
    [2, 'Unsafe'],
    [3, 'Unsafe'],
    [4, 'Risky'],
    [5, 'Risky'],
    [6, 'Deadly'],
  ] as const)('roll %i -> %s', (roll, level) => {
    expect(dangerForD6(roll)).toBe(level)
  })
})

describe('Settlement Name table (d20)', () => {
  it('looks up per-column names', () => {
    expect(settlementNameForD20(1, 'Village')).toBe("Hobb's Ford")
    expect(settlementNameForD20(20, 'Village')).toBe('Hollowmere')
    expect(settlementNameForD20(1, 'Town')).toBe('Westmarch')
    expect(settlementNameForD20(20, 'Town')).toBe('Kestrel Bend')
    expect(settlementNameForD20(1, 'City/Metropolis')).toBe('Aurenna')
    expect(settlementNameForD20(20, 'City/Metropolis')).toBe('Ivanthar')
  })

  it('throws out of range', () => {
    expect(() => settlementNameForD20(0, 'Village')).toThrow()
    expect(() => settlementNameForD20(21, 'Village')).toThrow()
  })
})

describe('settlementNameColumnFor', () => {
  it('keeps Village and Town as their own columns, but merges City and Metropolis', () => {
    expect(settlementNameColumnFor('Village')).toBe('Village')
    expect(settlementNameColumnFor('Town')).toBe('Town')
    expect(settlementNameColumnFor('City')).toBe('City/Metropolis')
    expect(settlementNameColumnFor('Metropolis')).toBe('City/Metropolis')
  })
})

describe('pointOfInterestForFeatureRoll', () => {
  it('skips the 1-in-6 gate entirely — no die consumed for it', () => {
    // A scripted rng with a single queued value would throw if a d6 gate roll were consumed
    // before the feature-specific rolls; only the settlement-name d20 roll below is expected.
    const rng = scripted([forDieResult(1, 20)])
    const poi = pointOfInterestForFeatureRoll('Grassland', 142, rng) // 142 -> Village
    expect(poi.location).toBe('Village')
    expect(poi.settlementName).toBe("Hobb's Ford")
  })

  it('matches what rollPointOfInterest produces for the same feature roll', () => {
    const rng = scripted([forDieResult(3, 8)]) // cataclysm roll
    const poi = pointOfInterestForFeatureRoll('Mountain', 1, rng) // 1 -> Cataclysm
    expect(poi).toEqual({
      location: 'Cataclysm',
      development: '',
      cataclysm: 'Quake leveled cliffside settlements',
      siteKind: 'none',
    })
  })
})

describe('rollPointOfInterest', () => {
  it('returns undefined when the d6 check fails', () => {
    const rng = scripted([forDieResult(2, 6)])
    expect(rollPointOfInterest('Grassland', rng)).toBeUndefined()
  })

  it('chains into a terrain-keyed cataclysm with no site (feature roll 1)', () => {
    const rng = scripted([
      forDieResult(1, 6), // POI check passes
      forDieResult(1, 200), // Cataclysm
      forDieResult(3, 8), // cataclysm roll, keyed by terrain
    ])
    const poi = rollPointOfInterest('Mountain', rng)
    expect(poi?.location).toBe('Cataclysm')
    expect(poi?.cataclysm).toBe('Quake leveled cliffside settlements')
    expect(poi?.siteKind).toBe('none')
    expect(poi?.settlementName).toBeUndefined()
  })

  it('chains into a terrain-keyed natural landmark with no site and no extra roll (feature roll 71-83)', () => {
    const rng = scripted([
      forDieResult(1, 6), // POI check passes
      forDieResult(71, 200), // Natural landmark
    ])
    const poi = rollPointOfInterest('Swamp', rng)
    expect(poi?.location).toBe('Natural landmark')
    expect(poi?.naturalLandmark).toBe(
      'Massive, hollowed-out cypress tree wide enough to serve as shelter, rising from the mire',
    )
    expect(poi?.siteKind).toBe('none')
  })

  it('chains into settlement name + forced Settlement Type when a settlement is rolled', () => {
    const rng = scripted([
      forDieResult(1, 6), // POI check passes
      forDieResult(142, 200), // Village
      forDieResult(2, 20), // settlement name roll
    ])
    const poi = rollPointOfInterest('Grassland', rng)
    expect(poi?.location).toBe('Village')
    expect(poi?.siteKind).toBe('settlement')
    expect(poi?.forcedType).toBe('Village')
    expect(poi?.settlementName).toBe('Mossbank')
    expect(poi?.cataclysm).toBeUndefined()
  })

  it('names a forced Metropolis from the shared City/Metropolis name pool', () => {
    const rng = scripted([
      forDieResult(1, 6), // POI check passes
      forDieResult(200, 200), // Metropolis
      forDieResult(2, 20), // settlement name roll
    ])
    const poi = rollPointOfInterest('Grassland', rng)
    expect(poi?.location).toBe('Metropolis')
    expect(poi?.forcedType).toBe('Metropolis')
    expect(poi?.settlementName).toBe('Valcresta')
  })

  it('routes to a dungeon with a forced Site Type + flavor tag (e.g. Large tomb)', () => {
    const rng = scripted([
      forDieResult(1, 6), // POI check passes
      forDieResult(20, 200), // Large tomb
    ])
    const poi = rollPointOfInterest('Mountain', rng)
    expect(poi?.location).toBe('Large tomb')
    expect(poi?.siteKind).toBe('dungeon')
    expect(poi?.forcedType).toBe('Tomb')
    expect(poi?.development).toBe('Large tomb')
  })

  it('routes to a dungeon with no forced type for the generic "Dungeon" row (fresh roll, unchanged)', () => {
    const rng = scripted([
      forDieResult(1, 6), // POI check passes
      forDieResult(31, 200), // Dungeon
    ])
    const poi = rollPointOfInterest('Mountain', rng)
    expect(poi?.location).toBe('Dungeon')
    expect(poi?.siteKind).toBe('dungeon')
    expect(poi?.forcedType).toBeUndefined()
  })

  it('routes to one of the 5 house-rule site kinds with no forced type (e.g. Tower)', () => {
    const rng = scripted([
      forDieResult(1, 6), // POI check passes
      forDieResult(2, 200), // Tower
    ])
    const poi = rollPointOfInterest('Mountain', rng)
    expect(poi?.location).toBe('Tower')
    expect(poi?.siteKind).toBe('tower')
    expect(poi?.forcedType).toBeUndefined()
  })
})

describe('generateHexDetails', () => {
  it('uses the supplied terrain and rolls danger + poi', () => {
    const rng = scripted([
      forDieResult(1, 6), // danger d6 -> Safe
      forDieResult(2, 6), // poi check fails
    ])
    const hex = generateHexDetails('Grassland', rng)
    expect(hex.terrain).toBe('Grassland')
    expect(hex.danger).toBe('Safe')
    expect(hex.poi).toBeUndefined()
  })
})
