import { describe, expect, it } from 'vitest'
import { chunkCells, chunkKey, tilesNearChunk } from '../wfc/chunks'
import { findMismatches } from '../wfc/rules'
import { geoAt, placedTileAt } from './hexTiles'
import { handleSolveChunkRequest } from './protocol'
import { createStartingWorld, findStartHex, type ChunkSolver } from './startWorld'

// The worker's own request handler, called directly (Vitest has no Web Worker).
const solveHere: ChunkSolver = async (store, chunk, world) =>
  handleSolveChunkRequest({ id: 0, world, chunk, tiles: tilesNearChunk(store, chunk), lockedKeys: [] })

// One solved world shared by the tests that only read it (each start solves 7 chunks).
const progress: number[] = []
const forest = createStartingWorld(11, 'Forest/jungle', solveHere, (p) => progress.push(p.chunksSolved))

describe('createStartingWorld', () => {
  it('solves chunk 0 and its six neighbors, with no edge mismatches, and starts on the chosen terrain', async () => {
    const start = await forest
    expect(start.terrainMatched).toBe(true)
    expect(start.chunks).toHaveLength(7)
    const expectedHexes = start.chunks.length * chunkCells({ i: 0, j: 0 }).length
    expect(Object.keys(start.tiles)).toHaveLength(expectedHexes)
    const tiles = Object.keys(start.tiles).map((id) => placedTileAt(start.tiles, id)!)
    expect(findMismatches(tiles)).toEqual([])
    expect(geoAt(start.world, start.tiles, start.startHexId)?.terrain).toBe('Forest/jungle')
    expect(progress.at(-1)).toBe(6)
  }, 20000)

  it('picks the start from the finished map, not from chunk 0 before the ring was solved', async () => {
    // Regression (found in the M4 browser check): with this seed, solving the ring re-solved
    // hex (-5,1) in chunk 0 from Hills to Swamp, and the old code still started there.
    const start = await createStartingWorld(2891736572, 'Hills', solveHere)
    expect(geoAt(start.world, start.tiles, start.startHexId)?.terrain).toBe('Hills')
  }, 20000)

    it('starts at sea for Ocean', async () => {
    const start = await createStartingWorld(5, 'Ocean', solveHere)
    expect(geoAt(start.world, start.tiles, start.startHexId)?.terrain).toBe('Ocean')
  }, 20000)

  it('reports a failed solve as an error', async () => {
    const failing: ChunkSolver = async () => ({ id: 0, ok: false, updates: [], dropped: [], stats: { tries: 0, backtracks: 0, localWfcAttempts: 0, unfixed: 0, dropped: 0 }, error: 'boom' })
    await expect(createStartingWorld(1, 'Grassland', failing)).rejects.toThrow(/chunk 0,0: boom/)
  })
})

describe('findStartHex', () => {
  it('picks the matching hex nearest the chunk center, or null when there is none', async () => {
    const start = await forest
    const id = findStartHex(start.world, start.tiles, { i: 0, j: 0 }, 'Forest/jungle')
    expect(id).toBe(start.startHexId)
    // Every hex nearer the center than the pick has another terrain.
    const [q, r] = id!.split(',').map(Number)
    const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r))
    for (const c of chunkCells({ i: 0, j: 0 })) {
      if (Math.max(Math.abs(c.q), Math.abs(c.r), Math.abs(c.s)) < d) {
        expect(geoAt(start.world, start.tiles, `${c.q},${c.r}`)?.terrain).not.toBe('Forest/jungle')
      }
    }
    expect(findStartHex(start.world, {}, { i: 0, j: 0 }, 'Forest/jungle')).toBeNull()
    expect(start.chunks).toContain(chunkKey({ i: 0, j: 0 }))
  }, 20000)
})
