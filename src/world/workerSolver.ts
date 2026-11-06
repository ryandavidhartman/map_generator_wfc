// The app's ChunkSolver: one shared Web Worker, created on first use.

import { WfcClient } from './client'
import type { ChunkSolver } from './startWorld'

let client: WfcClient | null = null

export const solveInWorker: ChunkSolver = (store, chunk, world, lockedKeys) => {
  client ??= new WfcClient()
  return client.solveChunk(store, chunk, { world, lockedKeys })
}
