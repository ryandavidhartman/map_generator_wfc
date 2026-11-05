// A fixture world for reducer and persistence tests: every hex within FIXTURE_RADIUS of the
// origin is solved as plain grass at level 0 (so its terrain is a land biome picked by the
// fields), except one open-water hex east of the origin, at (2, 0).

import { cubeCoordsInRadius } from '../wfc/cube'
import { TILE_TYPE } from '../wfc/tiles'
import type { WorldParams } from '../world/fields'
import { geoAt, hexIdOfCube, type SavedTiles } from '../world/hexTiles'
import type { MapAction } from './mapReducer'

export const FIXTURE_RADIUS = 55
export const FIXTURE_WORLD: WorldParams = { seed: 1, offsetX: 0, offsetY: 0 }
export const FIXTURE_WATER_HEX = '2,0'

export const FIXTURE_TILES: SavedTiles = Object.fromEntries(
  cubeCoordsInRadius({ q: 0, r: 0, s: 0 }, FIXTURE_RADIUS).map((c) => {
    const id = hexIdOfCube(c)
    return [id, [id === FIXTURE_WATER_HEX ? TILE_TYPE.WATER : TILE_TYPE.GRASS, 0, 0]]
  }),
)

export function fixtureTerrain(id: string) {
  return geoAt(FIXTURE_WORLD, FIXTURE_TILES, id)!.terrain
}

export function startMapAction(startHexId = '0,0'): Extract<MapAction, { type: 'START_MAP' }> {
  return { type: 'START_MAP', world: FIXTURE_WORLD, chunks: ['0,0'], tiles: FIXTURE_TILES, startHexId }
}
