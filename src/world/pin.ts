// GM editing (M7): when the GM changes a revealed hex's terrain, reshape its tile to match and
// re-solve the unrevealed hexes around it (hex-map-wfc's Rebuild-WFC, radius 2, widened here to
// 3 or 4 when needed).
//
// - Terrains come in shape classes. Ocean, Coast, Hills and Mountain each need their own kind of
//   tile; Grassland, Forest/jungle, Swamp and Desert/arctic are all flat land, told apart by the
//   world's moisture and temperature, which the tile set can't change. So a change between two
//   of those is a label only (the 2D color, 3D tint and scenery already follow the hex's own
//   terrain), and needs no re-solve.
// - The hex's own tile may change (it's the GM's edit). Unrevealed hexes within the radius may
//   change to fit. Everything else is locked: revealed neighbors never change.
// - If no tile of the wanted shape fits, the closest shape that does is used instead (the
//   fallback: Ocean becomes the wettest shore tile, Mountain becomes Hills, flat land a shore
//   tile with some land), so the map looks as near to the edit as it can. The GM's terrain stays
//   a label over it and the reducer flags the hex "tile mismatch". If nothing near fits either,
//   no tile changes.

import type { Terrain } from '../data/tables'
import { cubeCoordsInRadius, keyOf, type Cube } from '../wfc/cube'
import type { Rng } from '../engine/dice'
import { solveRegion } from '../wfc/recovery'
import { maskWhere, type PlacedTile } from '../wfc/rules'
import { fieldsFor, type WorldParams } from './fields'
import { cubeOfHexId, geoAt, hexIdOfCube, tilesToStore, type SavedTiles } from './hexTiles'
import { getWorldRules } from './solve'
import { deriveHexGeo, type HexGeo } from './terrain'

// The re-solve starts with the hexes within 2 and widens to 3, then 4, if nothing fits: a big
// change of height (Mountain is level 4; most land sits at 1-2) or open water inland needs
// room to slope up or down to the shore, about a level per hex.
export const PIN_RADIUS = 2
export const MAX_PIN_RADIUS = 4

export type ShapeClass = 'Ocean' | 'Coast' | 'Hills' | 'Mountain' | 'flat'

export function shapeClass(t: Terrain): ShapeClass {
  return t === 'Ocean' || t === 'Coast' || t === 'Hills' || t === 'Mountain' ? t : 'flat'
}

export type PinResult = {
  // True when the tile already fits the terrain, or a re-solve made it fit.
  ok: boolean
  // When not ok: true if a fallback shape was used (the updates hold it).
  approximate: boolean
  // Tiles written (the hex and unrevealed hexes around it); empty when nothing changed.
  updates: PlacedTile[]
}

export function pinHex(
  world: WorldParams,
  tiles: SavedTiles,
  hexId: string,
  terrain: Terrain,
  isRevealed: (id: string) => boolean,
  rng: Rng,
): PinResult {
  const geo = geoAt(world, tiles, hexId)
  if (!geo) return { ok: false, approximate: false, updates: [] }
  const wanted = shapeClass(terrain)
  if (shapeClass(geo.terrain) === wanted) return { ok: true, approximate: false, updates: [] }

  const fields = fieldsFor(world)
  const rules = getWorldRules()
  const center = cubeOfHexId(hexId)
  const geoOf = (s: { type: number; rotation: number; level: number }) => deriveHexGeo({ ...center, ...s }, fields)
  const tryShape = (accept: (g: HexGeo) => boolean): PlacedTile[] | null => {
    // The hex itself: only tiles of the accepted shape here. The rest: anything.
    const mask = maskWhere(rules, (s) => accept(geoOf(s)))
    if (mask.every((w) => w === 0)) return null
    return resolveAround(tiles, hexId, center, mask, isRevealed, rng)
  }

  const exact = tryShape((g) => shapeClass(g.terrain) === wanted)
  if (exact) return { ok: true, approximate: false, updates: exact }
  for (const accept of FALLBACKS[wanted]) {
    const near = tryShape(accept)
    if (near) return { ok: false, approximate: true, updates: near }
  }
  return { ok: false, approximate: false, updates: [] }
}

// The closest shapes to try, in order, when the wanted one can't fit.
const FALLBACKS: Record<ShapeClass, ((g: HexGeo) => boolean)[]> = {
  Ocean: [(g) => g.terrain === 'Coast' && g.seaEdges.length >= 3, (g) => g.terrain === 'Coast'],
  Mountain: [(g) => g.terrain === 'Hills'],
  flat: [(g) => g.terrain === 'Coast', (g) => g.terrain === 'Hills'],
  Coast: [],
  Hills: [],
}

// Re-solve the hex (with `mask`) and the unrevealed hexes around it, widening from PIN_RADIUS
// to MAX_PIN_RADIUS; null if nothing fits.
function resolveAround(
  tiles: SavedTiles,
  hexId: string,
  center: Cube,
  mask: Uint32Array,
  isRevealed: (id: string) => boolean,
  rng: Rng,
): PlacedTile[] | null {
  const rules = getWorldRules()
  const centerKey = keyOf(center)
  for (let radius = PIN_RADIUS; radius <= MAX_PIN_RADIUS; radius++) {
    const region = cubeCoordsInRadius(center, radius).filter((c) => {
      const id = hexIdOfCube(c)
      return id === hexId || (id in tiles && !isRevealed(id))
    })
    const regionKeys = new Set(region.map(keyOf))
    const store = tilesToStore(tiles)
    for (const k of regionKeys) store.delete(k)
    const result = solveRegion(store, region, {
      rng,
      rules,
      maskFor: (key) => (key === centerKey ? mask : null),
      isLocked: (key) => !regionKeys.has(key),
    })
    if (result.ok && result.dropped.length === 0) return result.updates
  }
  return null
}
