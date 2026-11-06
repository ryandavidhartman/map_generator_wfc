import { describe, expect, it } from 'vitest'
import { EMPTY_MAP_STATE, isRevealableNow, mapReducer, type MapState } from '../state/mapReducer'
import { chunkKey, chunkOf, tilesNearChunk } from '../wfc/chunks'
import { CUBE_DIRS, cubeDistance } from '../wfc/cube'
import { mulberry32 } from '../wfc/rng'
import { findMismatches, type PlacedTile } from '../wfc/rules'
import { applyChunkResult, chunksToGrow, GROW_RADIUS, lockedKeys } from './growth'
import { cubeOfHexId, placedTileAt, tilesToStore, type TileTuple } from './hexTiles'
import { handleSolveChunkRequest } from './protocol'
import { createStartingWorld, type ChunkSolver } from './startWorld'

const solveHere: ChunkSolver = async (store, chunk, world, locked = []) =>
  handleSolveChunkRequest({ id: 0, world, chunk, tiles: tilesNearChunk(store, chunk), lockedKeys: locked })

describe('chunksToGrow', () => {
  it('lists the unsolved chunks within the radius, nearest first', () => {
    const solved = [chunkKey({ i: 0, j: 0 })]
    // The origin's chunk reaches 8 hexes out, so a party there needs nothing more at radius 8,
    // and the neighbors at radius 9.
    expect(chunksToGrow(solved, '0,0', 8)).toEqual([])
    const nine = chunksToGrow(solved, '0,0', 9)
    expect(nine).toHaveLength(6)
    // A party at the chunk's east edge needs the two chunks just past it first (both one hex
    // away; ties go by chunk key).
    const east = chunksToGrow(solved, '8,0', GROW_RADIUS)
    expect(east.slice(0, 2)).toEqual(expect.arrayContaining([chunkOf({ q: 9, r: 0, s: -9 }), chunkOf({ q: 9, r: -1, s: -8 })]))
  })
})

describe('applyChunkResult', () => {
  const tiles: Record<string, TileTuple> = { '0,0': [0, 0, 0], '1,0': [0, 0, 0] }
  const t = (q: number, r: number, type: number): PlacedTile => ({ q, r, s: -q - r, type, rotation: 0, level: 0 })

  it('applies new and changed tiles, but never changes a revealed hex', () => {
    const out = applyChunkResult(tiles, [t(0, 0, 1), t(1, 0, 1), t(2, 0, 1)], (id) => id === '0,0')
    expect(out.rejected).toEqual(['0,0'])
    expect(out.tiles['0,0']).toEqual([0, 0, 0])
    expect(out.tiles['1,0']).toEqual([1, 0, 0])
    expect(out.tiles['2,0']).toEqual([1, 0, 0])
  })

  it('accepts an update that leaves a revealed hex as it is', () => {
    expect(applyChunkResult(tiles, [t(0, 0, 0)], () => true).rejected).toEqual([])
  })

  it('ADD_CHUNK applies through the reducer the same way, once per chunk', () => {
    const base: MapState = { ...EMPTY_MAP_STATE, world: { seed: 1, offsetX: 0, offsetY: 0 }, chunks: ['0,0'], tiles, hexes: { '0,0': { id: '0,0', q: 0, r: 0, terrain: 'Grassland', danger: 'Safe', dangerLevel: 1 } } }
    const next = mapReducer(base, { type: 'ADD_CHUNK', chunk: '1,0', updates: [t(0, 0, 1), t(5, 0, 1)] })
    expect(next.chunks).toEqual(['0,0', '1,0'])
    expect(next.tiles['0,0']).toEqual([0, 0, 0])
    expect(next.tiles['5,0']).toEqual([1, 0, 0])
    expect(mapReducer(next, { type: 'ADD_CHUNK', chunk: '1,0', updates: [t(6, 0, 1)] })).toBe(next)
  })
})

// PLAN.md M5: grow 30 chunks along a random walk, with no revealed hex ever changing, and count
// dropped cells (target: none in normal play). Each walk's path depends on every roll made
// along the way, so a change to what's rolled at reveal (M6's anchors) sends it elsewhere.
describe('growing the world along a random walk', () => {
  it.each([3, 17])('seed %i: 30 chunks, revealed hexes never change, the party never meets unsolved ground', async (seed) => {
    const start = await createStartingWorld(seed, 'Grassland', solveHere)
    let state = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', ...start, rng: mulberry32(seed) })
    const rng = mulberry32(seed + 100)
    const revealedTiles = new Map<string, TileTuple>()
    const snapshot = () => {
      for (const id of Object.keys(state.hexes)) if (!revealedTiles.has(id)) revealedTiles.set(id, state.tiles[id])
    }
    snapshot()
    let grown = 0
    let drops = 0
    const droppedKeys = new Set<string>()
    let heading = Math.floor(rng() * 6)
    let steps = 0
    let closest = Infinity // the nearest the party ever got to unsolved ground

    while (grown < 30 && steps < 3000) {
      // Grow until everything within GROW_RADIUS of the party is solved.
      for (let next = chunksToGrow(state.chunks, state.partyHexId!); next.length; next = chunksToGrow(state.chunks, state.partyHexId!)) {
        const res = await solveHere(tilesToStore(state.tiles), next[0], state.world!, lockedKeys(Object.keys(state.hexes)))
        expect(res.ok).toBe(true)
        drops += res.dropped.length
        for (const c of res.dropped) droppedKeys.add(`${c.q},${c.r}`)
        expect(applyChunkResult(state.tiles, res.updates, (id) => id in state.hexes).rejected).toEqual([])
        state = mapReducer(state, { type: 'ADD_CHUNK', chunk: chunkKey(next[0]), updates: res.updates })
        grown++
        for (const [id, tile] of revealedTiles) expect(state.tiles[id]).toEqual(tile)
      }

      // Walk: mostly straight on, sometimes turning, so the party travels far.
      if (rng() < 0.25) heading = (heading + (rng() < 0.5 ? 1 : 5)) % 6
      const p = cubeOfHexId(state.partyHexId!)
      const d = CUBE_DIRS[heading]
      const target = `${p.q + d.dq},${p.r + d.dr}`
      expect(isRevealableNow(state, target) || target in state.hexes).toBe(true)
      state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: target, rng })
      expect(state.partyHexId).toBe(target)
      snapshot()
      steps++

      // How close the party is to unsolved ground, before growing.
      const party = cubeOfHexId(target)
      for (let r = 1; r <= GROW_RADIUS + 1 && r < closest; r++) {
        const ring = []
        for (const c of [party]) for (const dir of CUBE_DIRS) ring.push({ q: c.q + dir.dq * r, r: c.r + dir.dr * r, s: c.s + dir.ds * r })
        if (ring.some((c) => !(`${c.q},${c.r}` in state.tiles))) closest = Math.min(closest, r)
      }
    }

    expect(grown).toBeGreaterThanOrEqual(30)
    // After a step the nearest unsolved hex is at least GROW_RADIUS away (one step closer than
    // the radius guaranteed before the step).
    expect(closest).toBeGreaterThanOrEqual(GROW_RADIUS)
    const all = Object.keys(state.tiles).map((id) => placedTileAt(state.tiles, id)!)
    const mismatches = findMismatches(all)
    console.log(`seed ${seed}: ${grown} chunks grown over ${steps} steps, ${revealedTiles.size} revealed, ${drops} dropped cells, ${mismatches.length} edge mismatches, ${Object.keys(state.tiles).length} tiles`)
    // A drop is the solver's last resort (it keeps a fixed cell's tile and ignores one of its
    // edges), so it's allowed, but rare, and every edge mismatch must be at a dropped cell.
    // Measured over 12 walks of 30 chunks: one drop in 360 solves (seed 17).
    expect(drops).toBeLessThanOrEqual(1)
    for (const m of mismatches) expect(droppedKeys.has(`${m.a.q},${m.a.r}`) || droppedKeys.has(`${m.b.q},${m.b.r}`)).toBe(true)
    // Sanity: the walk really left the starting seven chunks (about 17 hexes out).
    expect(cubeDistance(cubeOfHexId(state.partyHexId!), cubeOfHexId(start.startHexId))).toBeGreaterThan(17)
  }, 180000)
})
