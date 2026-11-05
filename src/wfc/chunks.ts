// Chunks: the hexagonal blocks of hexes WFC solves one at a time.
//
// A chunk is every hex within CHUNK_RADIUS (8) of its center: 217 hexes, as a grid in
// hex-map-wfc. Chunks tile the plane without gaps or overlaps on the lattice spanned by
// A = (R+1, R) and B = (-R, 2R+1) in axial (q, r), whose determinant 3R² + 3R + 1 equals the
// chunk's cell count. Neighboring chunk centers are 2R + 1 = 17 hexes apart. Chunk (0, 0) is
// centered on hex (0, 0). (hex-map-wfc positions its 19 grids with a world-space walk instead;
// this lattice is new, and unbounded.)
//
// The first-chunk seeds (grass at the center, one water tile at the midpoint of a random
// edge) are ported from hex-map-wfc (HexMap._setupPopulateContext and addWaterEdgeSeeds in
// src/hexmap/HexMap.js), Copyright (c) 2026 Felix Turner, MIT License:
// https://github.com/felixturner/hex-map-wfc/blob/main/LICENSE
// M2 replaces them with seeds from a continent noise field.

import { cubeCoordsInRadius, cubeDistance, keyOf, type Cube } from './cube'
import { solveRegion, getFixedCellsForRegion, type RegionSolveResult, type TileStore } from './recovery'
import type { PlacedTile } from './rules'
import { mixSeed, mulberry32 } from './rng'
import { TILE_TYPE } from './tiles'
import type { Rng } from '../engine/dice'

export const CHUNK_RADIUS = 8

export type ChunkCoord = { i: number; j: number }

export function chunkKey(c: ChunkCoord): string {
  return `${c.i},${c.j}`
}

export function parseChunkKey(key: string): ChunkCoord {
  const [i, j] = key.split(',').map(Number)
  return { i, j }
}

const R = CHUNK_RADIUS
const A = { q: R + 1, r: R }
const B = { q: -R, r: 2 * R + 1 }
const DET = 3 * R * R + 3 * R + 1

export function chunkCenter({ i, j }: ChunkCoord): Cube {
  const q = i * A.q + j * B.q
  const r = i * A.r + j * B.r
  return { q, r, s: 0 - q - r } // 0 - q - r, not -q - r, which gives -0 at the origin
}

export function chunkCells(c: ChunkCoord): Cube[] {
  return cubeCoordsInRadius(chunkCenter(c), R)
}

// The chunk that contains a hex.
export function chunkOf(h: Cube): ChunkCoord {
  // Invert the lattice to get a nearby (i, j), then check the lattice points around it.
  const fi = ((2 * R + 1) * h.q + R * h.r) / DET
  const fj = (-R * h.q + (R + 1) * h.r) / DET
  const bi = Math.floor(fi)
  const bj = Math.floor(fj)
  for (let di = -1; di <= 2; di++) {
    for (let dj = -1; dj <= 2; dj++) {
      const c = { i: bi + di, j: bj + dj }
      if (cubeDistance(chunkCenter(c), h) <= R) return c
    }
  }
  throw new Error(`chunkOf: no chunk found for ${keyOf(h)}`)
}

// The six chunks sharing a border with this one.
export function chunkNeighbors({ i, j }: ChunkCoord): ChunkCoord[] {
  return [
    { i: i + 1, j },
    { i: i + 1, j: j - 1 },
    { i, j: j - 1 },
    { i: i - 1, j },
    { i: i - 1, j: j + 1 },
    { i, j: j + 1 },
  ]
}

// How far from a chunk's center the solve can read tiles: the fixed ring (R+1), anchors
// (R+2), Local-WFC patches around fixed cells (R+3) and those patches' own fixed ring (R+4).
export const CHUNK_CONTEXT_RADIUS = R + 4

export type ChunkSolveOptions = {
  worldSeed: number
  isLocked?: (key: string) => boolean
  // Tiles to place before solving (only those inside the chunk are used). When omitted and
  // the chunk has no solved neighbors, the first-chunk seeds are used.
  initialCollapses?: PlacedTile[]
}

// Each chunk gets its own Rng, from the world seed and the chunk coordinates.
export function chunkRng(worldSeed: number, c: ChunkCoord): Rng {
  return mulberry32(mixSeed(worldSeed, c.i, c.j))
}

// Solve one chunk against the solved tiles around it. Updates the store in place.
export function solveChunk(store: TileStore, chunk: ChunkCoord, options: ChunkSolveOptions): RegionSolveResult {
  const cells = chunkCells(chunk)
  if (cells.some((c) => store.has(keyOf(c)))) {
    throw new Error(`solveChunk: chunk ${chunkKey(chunk)} is already solved`)
  }
  const rng = chunkRng(options.worldSeed, chunk)
  const cellKeys = new Set(cells.map(keyOf))
  let initialCollapses = (options.initialCollapses ?? []).filter((t) => cellKeys.has(keyOf(t)))
  if (options.initialCollapses === undefined && getFixedCellsForRegion(store, cells).length === 0) {
    initialCollapses = firstChunkSeeds(chunkCenter(chunk), rng)
  }
  return solveRegion(store, cells, { rng, isLocked: options.isLocked, initialCollapses })
}

// Grass at the center, and one water tile at the midpoint of a random edge of the chunk.
export function firstChunkSeeds(center: Cube, rng: Rng): PlacedTile[] {
  const dirs = [
    { q: 1, r: -1, s: 0 },
    { q: 1, r: 0, s: -1 },
    { q: 0, r: 1, s: -1 },
    { q: -1, r: 1, s: 0 },
    { q: -1, r: 0, s: 1 },
    { q: 0, r: -1, s: 1 },
  ]
  const side = Math.floor(rng() * 6)
  const d = dirs[side]
  const d2 = dirs[(side + 1) % 6]
  const half = Math.floor(R / 2)
  return [
    { ...center, type: TILE_TYPE.GRASS, rotation: 0, level: 0 },
    {
      q: center.q + d.q * (R - half) + d2.q * half,
      r: center.r + d.r * (R - half) + d2.r * half,
      s: center.s + d.s * (R - half) + d2.s * half,
      type: TILE_TYPE.WATER,
      rotation: 0,
      level: 0,
    },
  ]
}

// The store's tiles within CHUNK_CONTEXT_RADIUS of a chunk: everything solveChunk can read.
export function tilesNearChunk(store: TileStore, chunk: ChunkCoord): PlacedTile[] {
  const out: PlacedTile[] = []
  for (const c of cubeCoordsInRadius(chunkCenter(chunk), CHUNK_CONTEXT_RADIUS)) {
    const t = store.get(keyOf(c))
    if (t) out.push(t)
  }
  return out
}
