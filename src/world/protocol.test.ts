import { describe, expect, it } from 'vitest'
import { tilesNearChunk } from '../wfc/chunks'
import { keyOf } from '../wfc/cube'
import type { TileStore } from '../wfc/recovery'
import { WfcClient, type WorkerLike } from './client'
import type { WorldParams } from './fields'
import { handleSolveChunkRequest, type SolveChunkRequest, type SolveChunkResponse } from './protocol'
import { fieldsFor, solveWorldChunk } from './solve'

const world = (seed: number): WorldParams => ({ seed, offsetX: 0, offsetY: 0 })

function grownStore(seed: number): TileStore {
  const store: TileStore = new Map()
  solveWorldChunk(store, { i: 0, j: 0 }, fieldsFor(world(seed)))
  solveWorldChunk(store, { i: 1, j: 0 }, fieldsFor(world(seed)))
  return store
}

const sortByKey = <T extends { q: number; r: number; s: number }>(ts: T[]) =>
  [...ts].sort((a, b) => keyOf(a).localeCompare(keyOf(b)))

describe('handleSolveChunkRequest', () => {
  it('gives the same result from just the nearby tiles as from the whole store', () => {
    const chunk = { i: 0, j: 1 }
    const full = grownStore(8)
    const req: SolveChunkRequest = { id: 1, world: world(8), chunk, tiles: tilesNearChunk(full, chunk), lockedKeys: [] }
    const viaWorker = handleSolveChunkRequest(req)
    const direct = solveWorldChunk(full, chunk, fieldsFor(world(8)))
    expect(viaWorker.ok).toBe(true)
    expect(sortByKey(viaWorker.updates)).toEqual(sortByKey(direct.updates))
  })

  it('reports errors instead of throwing', () => {
    const store = grownStore(1)
    const res = handleSolveChunkRequest({ id: 7, world: world(1), chunk: { i: 0, j: 0 }, tiles: [...store.values()], lockedKeys: [] })
    expect(res).toMatchObject({ id: 7, ok: false })
    expect(res.error).toMatch(/already solved/)
  })
})

describe('WfcClient', () => {
  // A fake worker that answers asynchronously, like a real one.
  function fakeWorker(): WorkerLike & { sent: SolveChunkRequest[] } {
    const w = {
      sent: [] as SolveChunkRequest[],
      onmessage: null as WorkerLike['onmessage'],
      onerror: null as WorkerLike['onerror'],
      postMessage(req: SolveChunkRequest) {
        w.sent.push(req)
        const res = handleSolveChunkRequest(req)
        setTimeout(() => w.onmessage?.({ data: res } as MessageEvent<SolveChunkResponse>), 0)
      },
      terminate() {},
    }
    return w
  }

  it('resolves each request with its own result and sends only nearby locked keys', async () => {
    const worker = fakeWorker()
    const client = new WfcClient(worker)
    const store = grownStore(4)
    const [a, b] = await Promise.all([
      client.solveChunk(store, { i: 0, j: 1 }, { world: world(4), lockedKeys: ['-4,8,-4', '999,0,-999'] }),
      client.solveChunk(store, { i: -1, j: 0 }, { world: world(4) }),
    ])
    expect([a.id, b.id]).toEqual([1, 2])
    expect(a.ok && b.ok).toBe(true)
    expect(worker.sent[0].lockedKeys).toEqual(['-4,8,-4']) // within reach of chunk (0,1)
    expect(store.size).toBe(434) // the client never modifies the store
  })

  it('fails pending requests on terminate', async () => {
    const worker: WorkerLike = { onmessage: null, onerror: null, postMessage() {}, terminate() {} }
    const client = new WfcClient(worker)
    const pending = client.solveChunk(new Map(), { i: 0, j: 0 }, { world: world(1) })
    client.terminate()
    await expect(pending).resolves.toMatchObject({ ok: false, error: 'terminated' })
  })

  it('fails pending requests when the worker errors', async () => {
    const worker: WorkerLike = { onmessage: null, onerror: null, postMessage() {}, terminate() {} }
    const client = new WfcClient(worker)
    const pending = client.solveChunk(new Map(), { i: 0, j: 0 }, { world: world(1) })
    worker.onerror?.({ message: 'boom' } as ErrorEvent)
    await expect(pending).resolves.toMatchObject({ ok: false, error: 'worker error: boom' })
  })
})
