// Main-thread side of the WFC worker: send a chunk to solve, get a promise of the result.
// Requests are answered in order (the worker handles one message at a time).

import { tilesNearChunk, type ChunkCoord } from '../wfc/chunks'
import { keyOf } from '../wfc/cube'
import type { TileStore } from '../wfc/recovery'
import type { WorldParams } from './fields'
import type { SolveChunkRequest, SolveChunkResponse } from './protocol'

// The subset of Worker the client uses, so tests can pass a fake.
export type WorkerLike = {
  postMessage(message: SolveChunkRequest): void
  onmessage: ((e: MessageEvent<SolveChunkResponse>) => void) | null
  onerror: ((e: ErrorEvent) => void) | null
  terminate(): void
}

export function createWfcWorker(): WorkerLike {
  return new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' }) as WorkerLike
}

export class WfcClient {
  private readonly worker: WorkerLike
  private nextId = 1
  private readonly pending = new Map<number, (r: SolveChunkResponse) => void>()

  constructor(worker: WorkerLike = createWfcWorker()) {
    this.worker = worker
    this.worker.onmessage = (e) => {
      const resolve = this.pending.get(e.data.id)
      if (!resolve) return
      this.pending.delete(e.data.id)
      resolve(e.data)
    }
    // A worker that fails to load or throws would otherwise leave every request hanging.
    this.worker.onerror = (e) => this.failAll(`worker error: ${e.message ?? 'unknown'}`)
  }

  // Solve a chunk against the store's nearby tiles. Doesn't touch the store: the caller
  // applies `updates` when the result arrives.
  solveChunk(
    store: TileStore,
    chunk: ChunkCoord,
    options: { world: WorldParams; lockedKeys?: Iterable<string> },
  ): Promise<SolveChunkResponse> {
    const id = this.nextId++
    const tiles = tilesNearChunk(store, chunk)
    const near = new Set(tiles.map(keyOf))
    const lockedKeys = [...(options.lockedKeys ?? [])].filter((k) => near.has(k))
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      this.worker.postMessage({ id, world: options.world, chunk, tiles, lockedKeys })
    })
  }

  terminate(): void {
    this.worker.terminate()
    this.failAll('terminated')
  }

  private failAll(error: string): void {
    for (const [id, resolve] of this.pending) {
      resolve({
        id,
        ok: false,
        updates: [],
        dropped: [],
        stats: { tries: 0, backtracks: 0, localWfcAttempts: 0, unfixed: 0, dropped: 0 },
        error,
      })
    }
    this.pending.clear()
  }
}
