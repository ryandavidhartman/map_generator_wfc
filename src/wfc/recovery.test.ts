import { describe, expect, it } from 'vitest'
import { chunkCells, chunkNeighbors, solveChunk } from './chunks'
import { CUBE_DIRS, keyOf } from './cube'
import { getAnchorsForCell, getFixedCellsForRegion, solveRegion, type TileStore } from './recovery'
import { mulberry32 } from './rng'
import { findMismatches, type PlacedTile } from './rules'
import { HEX_DIRS, HEX_OPPOSITE, TILE_TYPE } from './tiles'

const ORIGIN = { q: 0, r: 0, s: 0 }

// Six ROAD_END tiles around the origin, each with its road pointing at the origin. No tile has
// six road edges, so the origin can't be solved without changing or ignoring a neighbor.
function roadsPointingIn(): TileStore {
  const store: TileStore = new Map()
  CUBE_DIRS.forEach((d) => {
    const facing = HEX_OPPOSITE[d.name] // the neighbor's edge that faces the origin
    const rotation = (HEX_DIRS.indexOf(facing) - HEX_DIRS.indexOf('W') + 6) % 6 // ROAD_END's road is W
    const t: PlacedTile = { q: d.dq, r: d.dr, s: d.ds, type: TILE_TYPE.ROAD_END, rotation, level: 0 }
    store.set(keyOf(t), t)
  })
  return store
}

describe('solveRegion recovery', () => {
  it('unfixes a conflicting neighbor when it is allowed to', () => {
    const store = roadsPointingIn()
    const result = solveRegion(store, [ORIGIN], { rng: mulberry32(1) })
    expect(result.ok).toBe(true)
    expect(result.dropped).toEqual([])
    expect(result.stats.unfixed).toBeGreaterThan(0)
    expect(findMismatches(store.values())).toEqual([])
    // At least one neighbor's tile changed, and is reported as an update.
    expect(result.updates.some((t) => keyOf(t) !== keyOf(ORIGIN))).toBe(true)
  })

  it('never changes locked tiles: it drops them instead', () => {
    const store = roadsPointingIn()
    const before = new Map([...store].map(([k, t]) => [k, { ...t }]))
    const result = solveRegion(store, [ORIGIN], { rng: mulberry32(1), isLocked: (k) => before.has(k) })
    expect(result.ok).toBe(true)
    expect(result.dropped.length).toBeGreaterThan(0)
    for (const [k, t] of before) expect(store.get(k)).toEqual(t)
    expect(result.updates.map(keyOf)).toEqual([keyOf(ORIGIN)])
  })
})

describe('fixed cells and anchors', () => {
  it('finds the solved ring around a region, and the anchors beyond it', () => {
    const store: TileStore = new Map()
    solveChunk(store, { i: 0, j: 0 }, { worldSeed: 2 })
    const next = chunkCells({ i: 1, j: 0 })
    const fixed = getFixedCellsForRegion(store, next)
    expect(fixed.length).toBeGreaterThan(0)
    const solveSet = new Set(next.map(keyOf))
    const fixedSet = new Set(fixed.map(keyOf))
    for (const fc of fixed) {
      expect(solveSet.has(keyOf(fc))).toBe(false)
      for (const a of getAnchorsForCell(store, fc, solveSet, fixedSet)) {
        expect(fixedSet.has(keyOf(a)) || solveSet.has(keyOf(a))).toBe(false)
        expect(store.has(keyOf(a))).toBe(true)
      }
    }
  })
})

describe('locked growth', () => {
  it('grows six chunks around a fully locked chunk without changing it', () => {
    for (const seed of [1, 2, 3, 4]) {
      const store: TileStore = new Map()
      solveChunk(store, { i: 0, j: 0 }, { worldSeed: seed })
      const locked = new Map([...store].map(([k, t]) => [k, { ...t }]))
      for (const c of chunkNeighbors({ i: 0, j: 0 })) {
        const result = solveChunk(store, c, { worldSeed: seed, isLocked: (k) => locked.has(k) })
        expect(result.ok).toBe(true)
        for (const u of result.updates) expect(locked.has(keyOf(u))).toBe(false)
      }
      for (const [k, t] of locked) expect(store.get(k)).toEqual(t)
    }
  })
})
