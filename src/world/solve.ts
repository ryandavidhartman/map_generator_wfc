// Solve a chunk of the world: WFC steered by the world fields (see masks.ts), with lookahead
// rings so the chunk doesn't leave an edge the next chunk's masks can't match, then river
// loops through the chunk broken (see rivers.ts). The first chunk
// needs no seeds; the masks already say where the sea is.

import { chunkCells, solveChunk, type ChunkCoord } from '../wfc/chunks'
import { keyOf } from '../wfc/cube'
import { mixSeed, mulberry32 } from '../wfc/rng'
import type { RegionSolveResult, TileStore } from '../wfc/recovery'
import { AdjacencyRules } from '../wfc/rules'
import type { MaskFor } from '../wfc/solver'
import { HEX_DIRS, TILE_LIST } from '../wfc/tiles'
import type { WorldFields } from './fields'
import { createMaskFor } from './masks'
import { breakRiverLoops } from './rivers'

// Rings of lookahead. Measured over 40 worlds x 19 chunks: 1 ring left 4 dropped cells,
// 2 rings left none (65 vs 80 ms per chunk).
export const LOOKAHEAD_RINGS = 2

// River tiles are weighted up from hex-map-wfc's weights to bring rivers toward ~17% of land
// (punch-list 1a). Measured in M2 (30 worlds): x1 gave 13.7%, x1.6 16.1%, x2.2 19.1% with drops returning.
export const RIVER_WEIGHT = 1.6

const isRiverTile = (type: number) => HEX_DIRS.some((d) => TILE_LIST[type].edges[d] === 'river')

let worldRules: AdjacencyRules | null = null

export function getWorldRules(): AdjacencyRules {
  return (worldRules ??= new AdjacencyRules(undefined, (t) => TILE_LIST[t].weight * (isRiverTile(t) ? RIVER_WEIGHT : 1)))
}

const masks = new WeakMap<WorldFields, MaskFor>()

function maskForFields(fields: WorldFields): MaskFor {
  let m = masks.get(fields)
  if (!m) masks.set(fields, (m = createMaskFor(fields, getWorldRules())))
  return m
}

export type WorldChunkResult = RegionSolveResult & {
  // River loops through the chunk that couldn't be broken (see rivers.ts); normally 0.
  unbrokenRiverLoops: number
}

export function solveWorldChunk(
  store: TileStore,
  chunk: ChunkCoord,
  fields: WorldFields,
  options: { isLocked?: (key: string) => boolean } = {},
): WorldChunkResult {
  const rules = getWorldRules()
  const maskFor = maskForFields(fields)
  const isLocked = options.isLocked ?? (() => false)
  const result = solveChunk(store, chunk, {
    worldSeed: fields.params.seed,
    isLocked,
    initialCollapses: [],
    maskFor,
    lookahead: LOOKAHEAD_RINGS,
    rules,
  })
  if (!result.ok) return { ...result, unbrokenRiverLoops: 0 }

  const loops = breakRiverLoops(store, new Set(chunkCells(chunk).map(keyOf)), {
    rng: mulberry32(mixSeed(fields.params.seed, chunk.i, chunk.j, 0x7140)),
    rules,
    maskFor,
    isLocked,
  })
  const updates = new Map(result.updates.map((t) => [keyOf(t), t]))
  for (const t of loops.updates) updates.set(keyOf(t), t)
  return { ...result, updates: [...updates.values()], unbrokenRiverLoops: loops.unbroken }
}
