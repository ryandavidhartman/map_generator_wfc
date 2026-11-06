import { describe, expect, it } from 'vitest'
import { CUBE_DIRS, keyOf } from '../wfc/cube'
import type { TileStore } from '../wfc/recovery'
import { mulberry32 } from '../wfc/rng'
import { findMismatches, getDefaultRules, type PlacedTile } from '../wfc/rules'
import { TILE_TYPE } from '../wfc/tiles'
import { breakRiverLoops, findRiverLoops, riverLinks } from './rivers'
import { growWorld } from './stats'

// Six RIVER_B bends around the origin, joined into a ring. The ring cell in direction i links
// to its ring neighbors in directions i+2 and i+4; RIVER_B (river at NE and W) rotated by i+4
// has river edges exactly there.
function riverRing(): TileStore {
  const store: TileStore = new Map()
  CUBE_DIRS.forEach((d, i) => {
    const t: PlacedTile = { q: d.dq, r: d.dr, s: d.ds, type: TILE_TYPE.RIVER_B, rotation: (i + 4) % 6, level: 0 }
    store.set(keyOf(t), t)
  })
  return store
}

describe('findRiverLoops', () => {
  it('finds the one cycle in a ring of river tiles', () => {
    const store = riverRing()
    expect(findMismatches(store.values())).toEqual([])
    for (const k of store.keys()) expect(riverLinks(store, k)).toHaveLength(2)
    expect(findRiverLoops(store, store.keys())).toHaveLength(1)
  })

  it('finds none once the ring is cut', () => {
    const store = riverRing()
    store.delete([...store.keys()][0])
    expect(findRiverLoops(store, store.keys())).toEqual([])
  })
})

describe('breakRiverLoops', () => {
  it('re-solves part of the ring so no loop remains and edges still match', () => {
    const store = riverRing()
    const keys = new Set(store.keys())
    const result = breakRiverLoops(store, keys, {
      rng: mulberry32(1),
      rules: getDefaultRules(),
      maskFor: () => null,
      isLocked: () => false,
    })
    expect(result.unbroken).toBe(0)
    expect(result.updates.length).toBeGreaterThan(0)
    expect(findRiverLoops(store, store.keys())).toEqual([])
    expect(findMismatches(store.values())).toEqual([])
  })

  it('leaves a loop of locked tiles alone', () => {
    const store = riverRing()
    const before = JSON.stringify([...store.entries()])
    const result = breakRiverLoops(store, new Set(store.keys()), {
      rng: mulberry32(1),
      rules: getDefaultRules(),
      maskFor: () => null,
      isLocked: () => true,
    })
    expect(result.unbroken).toBe(1)
    expect(JSON.stringify([...store.entries()])).toBe(before)
  })

  it('keeps generated worlds (nearly) loop-free', () => {
    let loops = 0
    for (const seed of [1, 2, 3]) {
      const w = growWorld(seed, 1)
      loops += findRiverLoops(w.store, w.store.keys()).length
    }
    expect(loops).toBeLessThanOrEqual(1)
  }, 60_000)
})
