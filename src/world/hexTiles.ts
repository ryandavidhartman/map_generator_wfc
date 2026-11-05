// The saved form of the solved map, and the bridge to the WFC tile store.
//
// MapState.tiles holds one entry per solved hex, keyed by the game's hex id ("q,r", axial) and
// stored as a compact [type, rotation, level] tuple (type is an index into TILE_LIST, so the
// list's order must never change). The WFC code keys its TileStore by cube key ("q,r,s"); the
// axial pair is the same in both.

import { keyOf, type Cube } from '../wfc/cube'
import type { TileStore } from '../wfc/recovery'
import type { PlacedTile } from '../wfc/rules'
import { fieldsFor, type WorldParams } from './fields'
import { deriveHexGeo, type HexGeo } from './terrain'

export type TileTuple = [type: number, rotation: number, level: number]
export type SavedTiles = Record<string, TileTuple>

export function cubeOfHexId(id: string): Cube {
  const [q, r] = id.split(',').map(Number)
  return { q, r, s: 0 - q - r }
}

export function hexIdOfCube(c: { q: number; r: number }): string {
  return `${c.q},${c.r}`
}

export function placedTileAt(tiles: SavedTiles, id: string): PlacedTile | null {
  const t = tiles[id]
  if (!t) return null
  return { ...cubeOfHexId(id), type: t[0], rotation: t[1], level: t[2] }
}

export function tilesToStore(tiles: SavedTiles): TileStore {
  const store: TileStore = new Map()
  for (const id of Object.keys(tiles)) {
    const t = placedTileAt(tiles, id)!
    store.set(keyOf(t), t)
  }
  return store
}

// Adds (or replaces) tiles, returning a new object.
export function withTiles(tiles: SavedTiles, updates: Iterable<PlacedTile>): SavedTiles {
  const out = { ...tiles }
  for (const t of updates) out[hexIdOfCube(t)] = [t.type, t.rotation, t.level]
  return out
}

// The hex's derived geography (terrain, rivers, roads, coast, lake), or null if it isn't solved.
export function geoAt(world: WorldParams, tiles: SavedTiles, id: string): HexGeo | null {
  const t = placedTileAt(tiles, id)
  return t ? deriveHexGeo(t, fieldsFor(world)) : null
}
