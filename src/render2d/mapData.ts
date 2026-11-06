// What the 2D map draws, shared by the interactive map (HexGridSvg) and the PNG export.

import { computeVisibleCoords, hexId, parseHexId, type AxialCoord } from '../hexgrid/hexMath'
import type { MapState } from '../state/mapReducer'
import { fieldsFor } from '../world/fields'
import { placedTileAt } from '../world/hexTiles'
import { deriveHexGeo, type HexGeo } from '../world/terrain'

export const HEX_SIZE = 40

// Every solved hex's geography, worked out from its tile.
export function geoByHex(state: Pick<MapState, 'world' | 'tiles'>): Map<string, HexGeo> {
  const out = new Map<string, HexGeo>()
  if (!state.world) return out
  const fields = fieldsFor(state.world)
  for (const id of Object.keys(state.tiles)) out.set(id, deriveHexGeo(placedTileAt(state.tiles, id)!, fields))
  return out
}

// Player view: revealed hexes and their unexplored frontier. GM view: every solved hex too.
export function mapCoords(state: Pick<MapState, 'hexes' | 'tiles'>, gmView: boolean): AxialCoord[] {
  const visible = computeVisibleCoords(Object.values(state.hexes).map((hex) => ({ q: hex.q, r: hex.r })))
  if (!gmView) return visible
  const ids = new Set(visible.map(hexId))
  return [...visible, ...Object.keys(state.tiles).filter((id) => !ids.has(id)).map(parseHexId)]
}
