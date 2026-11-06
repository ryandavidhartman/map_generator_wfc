import { beforeAll, describe, expect, it } from 'vitest'
import { EMPTY_MAP_STATE, mapReducer, type MapState } from '../state/mapReducer'
import { tilesNearChunk } from '../wfc/chunks'
import { cubeCoordsInRadius, cubeDistance } from '../wfc/cube'
import { mulberry32 } from '../wfc/rng'
import { findMismatches } from '../wfc/rules'
import { cubeOfHexId, geoAt, hexIdOfCube, placedTileAt } from './hexTiles'
import { MAX_PIN_RADIUS, pinHex, shapeClass } from './pin'
import { handleSolveChunkRequest } from './protocol'
import { createStartingWorld, type ChunkSolver } from './startWorld'

const solveHere: ChunkSolver = async (store, chunk, world, locked = []) =>
  handleSolveChunkRequest({ id: 0, world, chunk, tiles: tilesNearChunk(store, chunk), lockedKeys: locked })

let base: MapState

beforeAll(async () => {
  const start = await createStartingWorld(11, 'Grassland', solveHere)
  base = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', ...start, rng: mulberry32(1) })
}, 30000)

const mismatchesNear = (state: MapState, id: string) => {
  const near = cubeCoordsInRadius(cubeOfHexId(id), MAX_PIN_RADIUS + 2)
    .map((c) => placedTileAt(state.tiles, hexIdOfCube(c)))
    .filter((t) => t !== null)
  return findMismatches(near)
}

describe('shapeClass', () => {
  it('groups the flat-land biomes and keeps the shaped terrains apart', () => {
    for (const t of ['Grassland', 'Forest/jungle', 'Swamp', 'Desert/arctic'] as const) expect(shapeClass(t)).toBe('flat')
    for (const t of ['Ocean', 'Coast', 'Hills', 'Mountain'] as const) expect(shapeClass(t)).toBe(t)
  })
})

describe('editing a revealed hex\'s terrain (M7)', () => {
  it('a change between flat-land biomes is a label only: no tile changes, no mismatch', () => {
    const id = base.partyHexId!
    const next = mapReducer(base, { type: 'EDIT_HEX', hexId: id, patch: { terrain: 'Swamp' }, rng: mulberry32(2) })
    expect(next.hexes[id].terrain).toBe('Swamp')
    expect(next.tiles).toBe(base.tiles)
    expect(next.hexes[id].tileMismatch).toBeUndefined()
  })

  it.each(['Mountain', 'Hills', 'Ocean', 'Coast'] as const)('reshapes the hex to %s and re-solves only unrevealed hexes nearby, edges matching', (terrain) => {
    const id = base.partyHexId!
    const next = mapReducer(base, { type: 'EDIT_HEX', hexId: id, patch: { terrain }, rng: mulberry32(3) })
    expect(next.hexes[id].tileMismatch).toBeUndefined()
    expect(geoAt(next.world!, next.tiles, id)!.terrain).toBe(terrain)
    expect(mismatchesNear(next, id)).toEqual([])
    // Only hexes within the radius changed.
    for (const [hid, t] of Object.entries(next.tiles)) {
      if (t === base.tiles[hid]) continue
      expect(cubeDistance(cubeOfHexId(hid), cubeOfHexId(id))).toBeLessThanOrEqual(MAX_PIN_RADIUS)
    }
  })

  it('never changes a revealed neighbor; if no tile fits, it keeps the tile and flags a mismatch', () => {
    // Reveal the hex's whole ring, then ask for open water in the middle of it.
    let state = base
    const id = state.partyHexId!
    const ring = cubeCoordsInRadius(cubeOfHexId(id), 1).map(hexIdOfCube).filter((h) => h !== id)
    for (const n of ring) {
      state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: n, rng: mulberry32(4) })
      state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: id, rng: mulberry32(4) })
    }
    expect(ring.every((n) => n in state.hexes)).toBe(true)
    const before = state
    // Land all round: open water can't sit in the middle of revealed land (its edges are water).
    expect(ring.every((n) => shapeClass(state.hexes[n].terrain) !== 'Ocean')).toBe(true)
    const next = mapReducer(state, { type: 'EDIT_HEX', hexId: id, patch: { terrain: 'Ocean' }, rng: mulberry32(5) })
    expect(next.hexes[id].terrain).toBe('Ocean')
    expect(next.hexes[id].tileMismatch).toBe(true)
    expect(next.tiles).toBe(before.tiles)
    // Editing back to a terrain the tile fits clears the flag.
    const back = mapReducer(next, { type: 'EDIT_HEX', hexId: id, patch: { terrain: geoAt(next.world!, next.tiles, id)!.terrain }, rng: mulberry32(6) })
    expect(back.hexes[id].tileMismatch).toBeUndefined()
  })

  it('falls back to the closest shape that fits: Ocean beside revealed land becomes a wet shore tile', async () => {
    // Reveal one neighbor of an inland hex (the party walks in from it), then ask for Ocean.
    const id = base.partyHexId!
    const [q, r] = id.split(',').map(Number)
    const state = mapReducer(base, { type: 'MOVE_PARTY_TO', hexId: `${q - 1},${r}`, rng: mulberry32(7) })
    const next = mapReducer(state, { type: 'EDIT_HEX', hexId: id, patch: { terrain: 'Ocean' }, rng: mulberry32(8) })
    const geo = geoAt(next.world!, next.tiles, id)!
    expect(next.hexes[id].terrain).toBe('Ocean')
    if (geo.terrain === 'Ocean') {
      expect(next.hexes[id].tileMismatch).toBeUndefined() // an exact fit after all
    } else {
      expect(next.hexes[id].tileMismatch).toBe(true)
      expect(geo.terrain).toBe('Coast')
      expect(geo.seaEdges.length).toBeGreaterThan(0)
    }
    expect(next.tiles[`${q - 1},${r}`]).toEqual(state.tiles[`${q - 1},${r}`])
    expect(mismatchesNear(next, id)).toEqual([])
  })

  it('pinHex reports no-op success when the shape already fits', () => {
    const id = base.partyHexId!
    const terrain = geoAt(base.world!, base.tiles, id)!.terrain
    expect(pinHex(base.world!, base.tiles, id, terrain, () => false, mulberry32(1))).toEqual({ ok: true, approximate: false, updates: [] })
  })
})
