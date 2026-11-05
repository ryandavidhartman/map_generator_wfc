// Build a campaign's starting world: place it, solve the first chunk, find a starting hex of the
// chosen terrain, then solve the ring of six chunks around the first one.
//
// The starting terrain has to come out of the map, not be forced onto it. placeWorld already
// puts the origin well inland or well at sea. For a specific land terrain (Forest, Hills...),
// the start is the hex nearest the origin in chunk 0 whose derived terrain matches. If chunk 0
// has none (rare terrains like Desert/arctic), a new seed is tried. So the starting hex isn't
// always (0, 0).
//
// Chunk growth as the party explores is M5. Until then the seven chunks solved here (about
// 1,500 hexes, at least 9 hexes past the edge of chunk 0) are the whole map.

import type { Terrain } from '../data/tables'
import { chunkCells, chunkCenter, chunkKey, chunkNeighbors, type ChunkCoord } from '../wfc/chunks'
import { cubeDistance } from '../wfc/cube'
import { mixSeed } from '../wfc/rng'
import type { TileStore } from '../wfc/recovery'
import { fieldsFor, placeWorld, type WorldParams } from './fields'
import { hexIdOfCube, tilesToStore, withTiles, type SavedTiles } from './hexTiles'
import type { SolveChunkResponse } from './protocol'
import { deriveHexGeo } from './terrain'

// Solves one chunk against the store's tiles and resolves with the result (doesn't change the
// store). The app uses the Web Worker (workerSolver.ts); tests call the solver directly.
export type ChunkSolver = (
  store: TileStore,
  chunk: ChunkCoord,
  world: WorldParams,
  lockedKeys?: string[], // cube keys the solve must not change (revealed hexes)
) => Promise<SolveChunkResponse>

export const START_SEED_ATTEMPTS = 12

export type StartingWorld = {
  world: WorldParams
  chunks: string[]
  tiles: SavedTiles
  startHexId: string
  // False only if no attempt found the terrain; the start is then the origin, whatever it is.
  terrainMatched: boolean
}

export type StartProgress = { attempt: number; chunksSolved: number; chunksTotal: number }

export function randomWorldSeed(): number {
  return Math.floor(Math.random() * 4294967296)
}

export async function createStartingWorld(
  seed: number,
  terrain: Terrain,
  solve: ChunkSolver,
  onProgress: (p: StartProgress) => void = () => {},
): Promise<StartingWorld> {
  const origin = { i: 0, j: 0 }
  const ring = chunkNeighbors(origin)
  const total = 1 + ring.length
  let fallback: { world: WorldParams; tiles: SavedTiles } | null = null

  for (let attempt = 0; attempt < START_SEED_ATTEMPTS; attempt++) {
    onProgress({ attempt, chunksSolved: 0, chunksTotal: total })
    const world = placeWorld(attempt === 0 ? seed : mixSeed(seed, attempt), terrain === 'Ocean')
    const tiles = await solveInto({}, origin, world, solve)
    fallback ??= { world, tiles }
    // A cheap first check on chunk 0 alone, before solving the ring.
    if (!findStartHex(world, tiles, origin, terrain)) continue

    let grown = tiles
    for (const [n, chunk] of ring.entries()) {
      onProgress({ attempt, chunksSolved: n + 1, chunksTotal: total })
      grown = await solveInto(grown, chunk, world, solve)
    }
    // Pick the start from the finished tiles: solving the ring can re-solve cells inside
    // chunk 0 (recovery and river-loop breaking patch across the border), which can change a
    // hex's terrain.
    const start = findStartHex(world, grown, origin, terrain)
    if (!start) continue
    return { world, chunks: [origin, ...ring].map(chunkKey), tiles: grown, startHexId: start, terrainMatched: true }
  }

  // No seed gave the terrain: start at the origin of the first world tried.
  let grown = fallback!.tiles
  for (const chunk of ring) grown = await solveInto(grown, chunk, fallback!.world, solve)
  return {
    world: fallback!.world,
    chunks: [origin, ...ring].map(chunkKey),
    tiles: grown,
    startHexId: '0,0',
    terrainMatched: false,
  }
}

async function solveInto(tiles: SavedTiles, chunk: ChunkCoord, world: WorldParams, solve: ChunkSolver): Promise<SavedTiles> {
  const res = await solve(tilesToStore(tiles), chunk, world)
  if (!res.ok) throw new Error(`Could not solve chunk ${chunkKey(chunk)}: ${res.error ?? 'no solution'}`)
  return withTiles(tiles, res.updates)
}

// The solved hex in the chunk nearest its center whose terrain is `terrain` (ties broken by id,
// so it's deterministic), or null.
export function findStartHex(world: WorldParams, tiles: SavedTiles, chunk: ChunkCoord, terrain: Terrain): string | null {
  const fields = fieldsFor(world)
  const center = chunkCenter(chunk)
  let best: { id: string; d: number } | null = null
  for (const c of chunkCells(chunk)) {
    const id = hexIdOfCube(c)
    const t = tiles[id]
    if (!t) continue
    if (deriveHexGeo({ ...c, type: t[0], rotation: t[1], level: t[2] }, fields).terrain !== terrain) continue
    const d = cubeDistance(c, center)
    if (!best || d < best.d || (d === best.d && id < best.id)) best = { id, d }
  }
  return best?.id ?? null
}
