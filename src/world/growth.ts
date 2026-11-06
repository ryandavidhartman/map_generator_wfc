// Chunk growth (M5): solve more of the world as the party explores, early enough that a
// revealed hex never borders unsolved ground.
//
// The rule: every hex within GROW_RADIUS of the party must be solved. When the party moves, the
// unsolved chunks covering that disk are solved one at a time, nearest first, in the worker.
// Revealed hexes are locked (isLocked): a solve may unfix or re-solve unrevealed hexes near the
// new chunk's border, but never a revealed one. The reducer applies a result with
// applyChunkResult, which also refuses to touch a revealed hex, as a second guard.
//
// Why 8: a new chunk's solve can change existing tiles up to a few hexes outside it (unfixing,
// Local-WFC patches, river-loop breaking). With every revealed hex within 1 of a party
// position, and every party position at least 8 from unsolved ground when it was reached,
// revealed hexes sit well clear of that. (PLAN.md section 4 measured the cost of locked
// borders: 16% of solves needed drops when every border tile was locked.)

import { chunkKey, chunkOf, type ChunkCoord } from '../wfc/chunks'
import { cubeCoordsInRadius, cubeDistance } from '../wfc/cube'
import type { PlacedTile } from '../wfc/rules'
import { cubeOfHexId, hexIdOfCube, withTiles, type SavedTiles } from './hexTiles'

export const GROW_RADIUS = 8

// Unsolved chunks with a hex within `radius` of the party, nearest first.
export function chunksToGrow(solvedChunks: readonly string[], partyHexId: string, radius = GROW_RADIUS): ChunkCoord[] {
  const solved = new Set(solvedChunks)
  const party = cubeOfHexId(partyHexId)
  const best = new Map<string, { chunk: ChunkCoord; d: number }>()
  for (const c of cubeCoordsInRadius(party, radius)) {
    const chunk = chunkOf(c)
    const key = chunkKey(chunk)
    if (solved.has(key)) continue
    const d = cubeDistance(c, party)
    const prev = best.get(key)
    if (!prev || d < prev.d) best.set(key, { chunk, d })
  }
  return [...best.values()].sort((a, b) => a.d - b.d || chunkKey(a.chunk).localeCompare(chunkKey(b.chunk))).map((b) => b.chunk)
}

// The cube keys the solver must not change: every revealed hex.
export function lockedKeys(revealedHexIds: Iterable<string>): string[] {
  return [...revealedHexIds].map((id) => {
    const c = cubeOfHexId(id)
    return `${c.q},${c.r},${c.s}`
  })
}

export type ChunkApplied = { tiles: SavedTiles; rejected: string[] }

// Apply a chunk solve's tile updates, skipping (and reporting) any that would change a revealed
// hex. Updates to unrevealed hexes outside the chunk are kept: the solver changed them so their
// edges match the new chunk.
export function applyChunkResult(tiles: SavedTiles, updates: PlacedTile[], isRevealed: (id: string) => boolean): ChunkApplied {
  const rejected: string[] = []
  const accepted: PlacedTile[] = []
  for (const t of updates) {
    const id = hexIdOfCube(t)
    const old = tiles[id]
    const same = old && old[0] === t.type && old[1] === t.rotation && old[2] === t.level
    if (isRevealed(id) && !same) rejected.push(id)
    else if (!same) accepted.push(t)
  }
  return { tiles: accepted.length ? withTiles(tiles, accepted) : tiles, rejected }
}
