// Messages between the main thread (WfcClient) and the WFC worker.
//
// A request carries the world params and only the tiles near the chunk (tilesNearChunk), so
// the worker holds no state between requests (beyond caches) and the same request always gives
// the same result.

import type { ChunkCoord } from '../wfc/chunks'
import { keyOf, type Cube } from '../wfc/cube'
import type { RegionSolveStats, TileStore } from '../wfc/recovery'
import type { PlacedTile } from '../wfc/rules'
import { fieldsFor, type WorldParams } from './fields'
import { solveWorldChunk } from './solve'

export type SolveChunkRequest = {
  id: number
  world: WorldParams
  chunk: ChunkCoord
  tiles: PlacedTile[]
  lockedKeys: string[]
}

export type SolveChunkResponse = {
  id: number
  ok: boolean
  updates: PlacedTile[]
  dropped: Cube[]
  stats: RegionSolveStats
  unbrokenRiverLoops?: number
  error?: string
}

export function handleSolveChunkRequest(req: SolveChunkRequest): SolveChunkResponse {
  try {
    const store: TileStore = new Map(req.tiles.map((t) => [keyOf(t), t]))
    const locked = new Set(req.lockedKeys)
    const result = solveWorldChunk(store, req.chunk, fieldsFor(req.world), { isLocked: (k) => locked.has(k) })
    return { id: req.id, ...result }
  } catch (e) {
    return {
      id: req.id,
      ok: false,
      updates: [],
      dropped: [],
      stats: { tries: 0, backtracks: 0, localWfcAttempts: 0, unfixed: 0, dropped: 0 },
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
