import { describe, expect, it } from 'vitest'
import {
  CHUNK_RADIUS,
  chunkCells,
  chunkCenter,
  chunkKey,
  chunkNeighbors,
  chunkOf,
  firstChunkSeeds,
  parseChunkKey,
  solveChunk,
} from './chunks'
import { cubeCoordsInRadius, cubeDistance, keyOf } from './cube'
import type { TileStore } from './recovery'
import { mulberry32 } from './rng'
import { findMismatches } from './rules'
import { TILE_LIST, TILE_TYPE } from './tiles'

describe('chunk lattice', () => {
  it('centers chunk (0,0) on the origin with 217 cells', () => {
    expect(chunkCenter({ i: 0, j: 0 })).toEqual({ q: 0, r: 0, s: 0 })
    expect(chunkCells({ i: 0, j: 0 })).toHaveLength(217)
    expect(parseChunkKey(chunkKey({ i: -3, j: 5 }))).toEqual({ i: -3, j: 5 })
  })

  it('puts every hex in exactly one chunk', () => {
    for (const h of cubeCoordsInRadius({ q: 0, r: 0, s: 0 }, 60)) {
      const c = chunkOf(h)
      expect(cubeDistance(chunkCenter(c), h)).toBeLessThanOrEqual(CHUNK_RADIUS)
      for (const n of chunkNeighbors(c)) {
        expect(cubeDistance(chunkCenter(n), h)).toBeGreaterThan(CHUNK_RADIUS)
      }
    }
  }, 30000) // slow on a loaded machine (up to ~9 s seen); the default 5 s timeout made it flaky

  it('has neighbors 17 hexes away that share a border', () => {
    const cells0 = new Set(chunkCells({ i: 0, j: 0 }).map(keyOf))
    for (const n of chunkNeighbors({ i: 0, j: 0 })) {
      expect(cubeDistance(chunkCenter(n), { q: 0, r: 0, s: 0 })).toBe(2 * CHUNK_RADIUS + 1)
      const touches = chunkCells(n).some((c) =>
        cubeCoordsInRadius(c, 1).some((x) => cells0.has(keyOf(x))),
      )
      expect(touches).toBe(true)
    }
  })
})

describe('firstChunkSeeds', () => {
  it('places grass at the center and water inside the chunk', () => {
    const [grass, water] = firstChunkSeeds({ q: 0, r: 0, s: 0 }, mulberry32(7))
    expect(grass).toMatchObject({ q: 0, r: 0, s: 0, type: TILE_TYPE.GRASS })
    expect(water.type).toBe(TILE_TYPE.WATER)
    expect(cubeDistance(water, { q: 0, r: 0, s: 0 })).toBeLessThanOrEqual(CHUNK_RADIUS)
  })
})

describe('solveChunk', () => {
  const origin = { i: 0, j: 0 }

  it('solves the first chunk with matching edges and its seeds in place', () => {
    const store: TileStore = new Map()
    const result = solveChunk(store, origin, { worldSeed: 42 })
    expect(result.ok).toBe(true)
    expect(store.size).toBe(217)
    expect(result.updates).toHaveLength(217)
    expect(findMismatches(store.values())).toEqual([])
    expect(store.get('0,0,0')?.type).toBe(TILE_TYPE.GRASS)
    expect([...store.values()].some((t) => t.type === TILE_TYPE.WATER)).toBe(true)
  })

  it('never puts two preventChaining tiles of the same type side by side', () => {
    const store: TileStore = new Map()
    solveChunk(store, origin, { worldSeed: 3 })
    for (const t of store.values()) {
      if (!TILE_LIST[t.type].preventChaining) continue
      for (const n of cubeCoordsInRadius(t, 1)) {
        if (keyOf(n) === keyOf(t)) continue
        expect(store.get(keyOf(n))?.type).not.toBe(t.type)
      }
    }
  })

  it('is deterministic for a seed, and differs between seeds', () => {
    const solve = (seed: number) => {
      const store: TileStore = new Map()
      solveChunk(store, origin, { worldSeed: seed })
      solveChunk(store, { i: 1, j: 0 }, { worldSeed: seed })
      return JSON.stringify([...store.entries()].sort())
    }
    expect(solve(11)).toBe(solve(11))
    expect(solve(11)).not.toBe(solve(12))
  })

  it('matches edges with an already-solved neighbor chunk', () => {
    const store: TileStore = new Map()
    solveChunk(store, origin, { worldSeed: 5 })
    const result = solveChunk(store, { i: 0, j: 1 }, { worldSeed: 5 })
    expect(result.ok).toBe(true)
    expect(store.size).toBe(434)
    // Any mismatch must involve a dropped cell (the recovery's last resort).
    const dropped = new Set(result.dropped.map(keyOf))
    for (const m of findMismatches(store.values())) {
      expect(dropped.has(keyOf(m.a)) || dropped.has(keyOf(m.b))).toBe(true)
    }
  })

  it('uses given initial collapses instead of the first-chunk seeds', () => {
    const store: TileStore = new Map()
    solveChunk(store, origin, {
      worldSeed: 9,
      initialCollapses: [{ q: 2, r: -1, s: -1, type: TILE_TYPE.WATER, rotation: 0, level: 0 }],
    })
    expect(store.get('2,-1,-1')?.type).toBe(TILE_TYPE.WATER)
  })

  it('refuses to solve a chunk twice', () => {
    const store: TileStore = new Map()
    solveChunk(store, origin, { worldSeed: 1 })
    expect(() => solveChunk(store, origin, { worldSeed: 1 })).toThrow(/already solved/)
  })
})
