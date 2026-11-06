// Solve-rate benchmark (milestone M1): 50 seeds, each growing three chunks where the third
// borders both earlier ones. Every solve must succeed, and every edge mismatch must involve
// a dropped cell (the recovery's last resort).
//
// The locked pass is stricter than real play: it locks every tile already solved (in play,
// only revealed hexes are locked), so recovery can't unfix or re-solve anything outside the
// new chunk and has to drop instead.

import { describe, expect, it } from 'vitest'
import { solveChunk, type ChunkCoord } from './chunks'
import { keyOf } from './cube'
import type { TileStore } from './recovery'
import { findMismatches } from './rules'

const CHUNKS: ChunkCoord[] = [
  { i: 0, j: 0 },
  { i: 1, j: 0 },
  { i: 0, j: 1 }, // borders both (0,0) and (1,0)
]
const SEEDS = Array.from({ length: 50 }, (_, n) => n + 1)

function grow(seed: number, lockEarlier: boolean) {
  const store: TileStore = new Map()
  const dropped = new Set<string>()
  let ok = true
  for (const chunk of CHUNKS) {
    const locked = lockEarlier ? new Set(store.keys()) : null
    const result = solveChunk(store, chunk, { worldSeed: seed, isLocked: locked ? (k) => locked.has(k) : undefined })
    ok &&= result.ok
    for (const d of result.dropped) dropped.add(keyOf(d))
  }
  const unexplained = findMismatches(store.values()).filter((m) => !dropped.has(keyOf(m.a)) && !dropped.has(keyOf(m.b)))
  return { ok, size: store.size, dropped: dropped.size, unexplained: unexplained.length }
}

describe('WFC solve-rate benchmark', () => {
  it('solves every chunk for 50 seeds', () => {
    const runs = SEEDS.map((seed) => grow(seed, false))
    expect(runs.every((r) => r.ok)).toBe(true)
    expect(runs.every((r) => r.size === 651)).toBe(true)
    expect(runs.reduce((n, r) => n + r.unexplained, 0)).toBe(0)
  }, 120_000)

  it('solves every chunk for 50 seeds with all earlier tiles locked', () => {
    const runs = SEEDS.map((seed) => grow(seed, true))
    expect(runs.every((r) => r.ok)).toBe(true)
    expect(runs.reduce((n, r) => n + r.unexplained, 0)).toBe(0)
  }, 120_000)
})
