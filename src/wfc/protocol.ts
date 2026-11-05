// Messages between the main thread (WfcClient) and the WFC worker.
//
// A request carries only the tiles near the chunk (tilesNearChunk), so the worker holds no
// state between requests and the same request always gives the same result.

import { solveChunk, type ChunkCoord } from './chunks'
import { keyOf } from './cube'
import type { RegionSolveStats, TileStore } from './recovery'
import type { PlacedTile } from './rules'
import type { Cube } from './cube'

export type SolveChunkRequest = {
  id: number
  worldSeed: number
  chunk: ChunkCoord
  tiles: PlacedTile[]
  lockedKeys: string[]
  initialCollapses?: PlacedTile[]
}

export type SolveChunkResponse = {
  id: number
  ok: boolean
  updates: PlacedTile[]
  dropped: Cube[]
  stats: RegionSolveStats
  error?: string
}

export function handleSolveChunkRequest(req: SolveChunkRequest): SolveChunkResponse {
  try {
    const store: TileStore = new Map(req.tiles.map((t) => [keyOf(t), t]))
    const locked = new Set(req.lockedKeys)
    const result = solveChunk(store, req.chunk, {
      worldSeed: req.worldSeed,
      isLocked: (k) => locked.has(k),
      initialCollapses: req.initialCollapses,
    })
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
