import { describe, expect, it } from 'vitest'
import { terrainFor2d6, newHexResultFor2d6, stepTerrain, dangerForD6, settlementNameForD20, settlementNameColumnFor, TERRAIN_ORDER } from '../data/tables'
import {
  rollNextTerrain,
  rollPointOfInterest,
  pointOfInterestForFeatureRoll,
  generateStartingHexDetails,
  generateNextHexDetails,
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

describe('Hex Terrain table (2d6)', () => {
  it.each([
    [2, 'Desert/arctic'],
    [3, 'Swamp'],
    [4, 'Grassland'],
    [5, 'Grassland'],
    [6, 'Grassland'],
    [7, 'Forest/jungle'],
    [8, 'Forest/jungle'],
    [9, 'River/coast'],
    [10, 'River/coast'],
    [11, 'Ocean'],
    [12, 'Mountain'],
  ] as const)('roll %i -> %s', (roll, terrain) => {
    expect(terrainFor2d6(roll)).toBe(terrain)
  })

  it('throws out of range', () => {
    expect(() => terrainFor2d6(1)).toThrow()
    expect(() => terrainFor2d6(13)).toThrow()
  })
})

describe('New Hex table (2d6)', () => {
  it.each([
    [2, { kind: 'step', steps: 1 }],
    [3, { kind: 'step', steps: 1 }],
    [4, { kind: 'same' }],
    [8, { kind: 'same' }],
    [9, { kind: 'step', steps: 2 }],
    [11, { kind: 'step', steps: 2 }],
    [12, { kind: 'reroll' }],
  ] as const)('roll %i -> %o', (roll, expected) => {
    expect(newHexResultFor2d6(roll)).toEqual(expected)
  })
})

describe('terrain circular stepping', () => {
  it('steps forward through the loop', () => {
    expect(stepTerrain('Desert/arctic', 1)).toBe('Swamp')
    expect(stepTerrain('Mountain', 1)).toBe('Desert/arctic')
  })

  it('wraps around when stepping past the end', () => {
    expect(stepTerrain('Ocean', 2)).toBe('Desert/arctic')
    expect(stepTerrain('Mountain', 2)).toBe('Swamp')
  })

  it('is a no-op for a 0 step', () => {
    for (const terrain of TERRAIN_ORDER) {
      expect(stepTerrain(terrain, 0)).toBe(terrain)
    }
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

describe('rollNextTerrain', () => {
  it('steps +1 from current terrain on a 2-3 roll', () => {
    const rng = scripted([forDieResult(2, 6), forDieResult(1, 6)]) // 2d6 = 3
    expect(rollNextTerrain('Grassland', rng)).toBe('Forest/jungle')
  })

  it('stays the same on a 4-8 roll', () => {
    const rng = scripted([forDieResult(3, 6), forDieResult(3, 6)]) // 2d6 = 6
    expect(rollNextTerrain('Ocean', rng)).toBe('Ocean')
  })

  it('rerolls fresh on a 12', () => {
    const rng = scripted([
      forDieResult(6, 6),
      forDieResult(6, 6), // 2d6 = 12 -> reroll
      forDieResult(1, 6),
      forDieResult(1, 6), // fresh 2d6 roll = 2 -> Desert/arctic
    ])
    expect(rollNextTerrain('Mountain', rng)).toBe('Desert/arctic')
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

describe('generateStartingHexDetails / generateNextHexDetails', () => {
  it('starting hex uses the supplied terrain and rolls danger + poi', () => {
    const rng = scripted([
      forDieResult(1, 6), // danger d6 -> Safe
      forDieResult(2, 6), // poi check fails
    ])
    const hex = generateStartingHexDetails('Grassland', rng)
    expect(hex.terrain).toBe('Grassland')
    expect(hex.danger).toBe('Safe')
    expect(hex.poi).toBeUndefined()
  })

  it('next hex derives terrain from current terrain', () => {
    const rng = scripted([
      forDieResult(3, 6),
      forDieResult(3, 6), // 2d6 = 6 -> same terrain
      forDieResult(6, 6), // danger -> Deadly
      forDieResult(2, 6), // poi check fails
    ])
    const hex = generateNextHexDetails('Swamp', rng)
    expect(hex.terrain).toBe('Swamp')
    expect(hex.danger).toBe('Deadly')
  })
})
