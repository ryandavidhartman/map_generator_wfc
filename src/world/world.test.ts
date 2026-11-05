import { describe, expect, it } from 'vitest'
import { chunkCells, chunkNeighbors } from '../wfc/chunks'
import { CUBE_DIRS, cubeCoordsInRadius, cubeKey, keyOf } from '../wfc/cube'
import type { TileStore } from '../wfc/recovery'
import { findMismatches, type PlacedTile } from '../wfc/rules'
import { TILE_LIST, TILE_TYPE } from '../wfc/tiles'
import { createWorldFields, placeWorld } from './fields'
import { createMaskFor, zoneOf } from './masks'
import { getWorldRules, solveWorldChunk } from './solve'
import { chunksInRings, growWorld, measureWorld, TERRAIN_TARGETS } from './stats'

describe('zones', () => {
  const fields = createWorldFields(placeWorld(3, false))

  it('always keeps shore between open sea and full land', () => {
    for (const c of cubeCoordsInRadius({ q: 0, r: 0, s: 0 }, 50)) {
      const z = zoneOf(fields, c)
      if (z !== 'sea' && z !== 'land') continue
      for (const d of CUBE_DIRS) {
        const n = zoneOf(fields, { q: c.q + d.dq, r: c.r + d.dr, s: c.s + d.ds })
        if (z === 'sea') expect(['sea', 'wetShore']).toContain(n)
        else expect(['land', 'dryShore']).toContain(n)
      }
    }
  })

  it('builds masks that allow only water at sea and no open water on land', () => {
    const rules = getWorldRules()
    const maskFor = createMaskFor(fields, rules)
    const allowed = (key: string) => rules.states.filter((_, n) => (maskFor(key)![n >>> 5] & (1 << (n & 31))) !== 0)
    let sawSea = false
    let sawLand = false
    for (const c of cubeCoordsInRadius({ q: 0, r: 0, s: 0 }, 50)) {
      const z = zoneOf(fields, c)
      if (z === 'sea' && !sawSea) {
        sawSea = true
        expect(allowed(keyOf(c)).every((s) => s.type === TILE_TYPE.WATER && s.level === 0)).toBe(true)
      }
      if (z === 'land' && !sawLand) {
        sawLand = true
        expect(allowed(keyOf(c)).some((s) => s.type === TILE_TYPE.WATER)).toBe(false)
      }
    }
    expect(sawSea && sawLand).toBe(true)
  })
})

describe('solveWorldChunk', () => {
  it('grows a world that follows the zones, with matching edges and no drops', () => {
    for (const seed of [1, 2]) {
      const fields = createWorldFields(placeWorld(seed, false))
      const store: TileStore = new Map()
      for (const c of chunksInRings(1)) {
        const r = solveWorldChunk(store, c, fields)
        expect(r.ok).toBe(true)
        expect(r.dropped).toEqual([])
      }
      expect(store.size).toBe(7 * 217)
      expect(findMismatches(store.values())).toEqual([])
      for (const t of store.values()) {
        const z = zoneOf(fields, t)
        if (z === 'sea') expect(t.type).toBe(TILE_TYPE.WATER)
        if (z === 'land' || z === 'dryShore') expect(t.type).not.toBe(TILE_TYPE.WATER)
        if (t.type === TILE_TYPE.WATER) expect(t.level).toBe(0)
      }
      // The start hex is inland: not open water, and not on the coast.
      const start = store.get('0,0,0')!
      expect(start.type).not.toBe(TILE_TYPE.WATER)
      expect(zoneOf(fields, start)).toBe('land')
    }
  }, 60_000)

  it('never writes outside the chunk when nothing is unfixed, and is deterministic', () => {
    const run = () => {
      const fields = createWorldFields(placeWorld(4, false))
      const store: TileStore = new Map()
      solveWorldChunk(store, { i: 0, j: 0 }, fields)
      const r = solveWorldChunk(store, { i: 1, j: 0 }, fields)
      return { store, r }
    }
    const a = run()
    const b = run()
    expect([...a.store.entries()].sort()).toEqual([...b.store.entries()].sort())
    const cells = new Set([...chunkCells({ i: 0, j: 0 }), ...chunkCells({ i: 1, j: 0 })].map(keyOf))
    for (const k of a.store.keys()) expect(cells.has(k)).toBe(true) // lookahead tiles are discarded
  }, 60_000)

  it('keeps locked tiles unchanged while growing around them', () => {
    const fields = createWorldFields(placeWorld(5, false))
    const store: TileStore = new Map()
    solveWorldChunk(store, { i: 0, j: 0 }, fields)
    const locked = new Map<string, PlacedTile>([...store].map(([k, t]) => [k, { ...t }]))
    for (const c of chunkNeighbors({ i: 0, j: 0 })) {
      const r = solveWorldChunk(store, c, fields, { isLocked: (k) => locked.has(k) })
      expect(r.ok).toBe(true)
    }
    for (const [k, t] of locked) expect(store.get(k)).toEqual(t)
  }, 60_000)
})

describe('world quality (loose regression bands; tune with `npm run sim`)', () => {
  it('stays near the punch-list terrain targets over a few worlds', () => {
    const worlds = [11, 12, 13].map((seed) => {
      const w = growWorld(seed, 1)
      return measureWorld(w.store, w.fields)
    })
    const mean = (f: (s: (typeof worlds)[number]) => number) => worlds.reduce((a, s) => a + f(s), 0) / worlds.length
    // Bands are wide: 3 small worlds vary a lot. They catch a broken rule, not fine tuning.
    for (const [t, target] of Object.entries(TERRAIN_TARGETS)) {
      const got = mean((s) => s.terrainShareOfLand[t as keyof typeof TERRAIN_TARGETS])
      expect(got, t).toBeLessThan(target * 3 + 0.05)
    }
    expect(mean((s) => s.terrainShareOfLand.Grassland)).toBeGreaterThan(0.1)
    expect(mean((s) => s.terrainShareOfLand['Forest/jungle'])).toBeGreaterThan(0.1)
    expect(mean((s) => s.riverShareOfLand)).toBeGreaterThan(0.05)
    expect(mean((s) => s.lakeShareOfLand)).toBeGreaterThan(0.02)
    expect(mean((s) => s.oneHexPondShare)).toBeLessThan(0.1)
  }, 120_000)
})

describe('measureWorld', () => {
  it('counts terrain, bodies and features on a small hand-made map', () => {
    const fields = createWorldFields({ seed: 1, offsetX: 0, offsetY: 0 })
    const store: TileStore = new Map()
    const put = (q: number, r: number, name: string) =>
      store.set(cubeKey(q, r, -q - r), { q, r, s: -q - r, type: TILE_TYPE[name], rotation: 0, level: 0 })
    put(0, 0, 'WATER') // a one-hex body, but at the edge of the map
    put(5, 0, 'RIVER_B')
    put(6, 0, 'ROAD_A')
    const s = measureWorld(store, fields)
    expect(s.hexes).toBe(3)
    expect(s.land).toBe(2)
    expect(s.oceanBodies).toEqual([1])
    expect(s.oneHexPondShare).toBe(0) // edge bodies don't count as ponds
    expect(s.riverShareOfLand).toBe(0.5)
    expect(s.roadShareOfLand).toBe(0.5)
    expect(TILE_LIST[store.get('5,0,-5')!.type].name).toBe('RIVER_B')
  })

  it('lists chunk rings nearest first', () => {
    expect(chunksInRings(0)).toHaveLength(1)
    expect(chunksInRings(1)).toHaveLength(7)
    expect(chunksInRings(2)).toHaveLength(19)
  })
})
