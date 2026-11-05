// From a solved tile (plus the world fields at its hex) to what the game needs: terrain, and
// the hex's river, road and sea edges and lake. Pure and local: the same tile and hex always
// give the same answer, so this is worked out when needed rather than saved.
//
// Terrain:
// - Ocean: open water (WATER).
// - Coast: any land tile with a water edge (the coast tiles, and a river mouth).
// - Mountain / Hills, from the tile's highest edge level, with steep tiles (a slope or cliff
//   rising two levels) counted one class higher:
//     level 4, or steep at level 3 -> Mountain
//     level 3, or steep at level 2 -> Hills
//   Steering WFC higher to get more high land costs solve failures and rivers (measured in M2),
//   so steepness stands in for height. (Plain level 3 alone gave ~7% Hills; every level-2 slope
//   as Hills gave 28%.)
// - Otherwise the biome, from moisture and temperature: Swamp (wet, at level 0),
//   Desert/arctic (very dry, or very hot or cold), Forest/jungle (moist), else Grassland.

import type { Terrain } from '../data/tables'
import { mixSeed } from '../wfc/rng'
import { edgeOf, type PlacedTile } from '../wfc/rules'
import { HEX_DIRS, TILE_LIST, TILE_TYPE, type EdgeType, type HexDir } from '../wfc/tiles'
import type { FieldSample, WorldFields } from './fields'

export const BIOME_TUNING = {
  swampMoisture: 0.2, // at level 0, moisture above this is Swamp
  forestMoisture: -0.04, // moisture above this is Forest/jungle
  dryMoisture: -0.65, // moisture below this is Desert/arctic
  extremeTemperature: 0.7, // |temperature| above this is Desert/arctic (hot or cold)
  riverEndLakeChance: 0.5, // a river that ends inland ends in a lake (else it's a spring)
  lakeChance: 0.095, // chance of a lake on a hex with only grass edges (no river, road or coast)
}

export type HexGeo = {
  terrain: Terrain
  level: number // the tile's highest edge level, 0-4
  riverEdges: HexDir[]
  roadEdges: HexDir[]
  seaEdges: HexDir[] // edges facing open water
  lake: boolean
}

export function deriveHexGeo(tile: PlacedTile, fields: WorldFields, tuning = BIOME_TUNING): HexGeo {
  const edges = HEX_DIRS.map((d) => ({ dir: d, ...edgeOf(tile, d) }))
  const of = (type: EdgeType) => edges.filter((e) => e.type === type).map((e) => e.dir)
  const level = Math.max(...edges.map((e) => e.level))
  const riverEdges = of('river')
  const roadEdges = of('road')
  const seaEdges = of('water')
  const sample = fields.sample(tile)

  const terrain = terrainFor(tile, level, seaEdges.length > 0, sample, tuning)
  const lake = terrain !== 'Ocean' && terrain !== 'Coast' && hasLake(tile, fields.params.seed, tuning)
  return { terrain, level, riverEdges, roadEdges, seaEdges, lake }
}

function terrainFor(tile: PlacedTile, level: number, touchesSea: boolean, f: FieldSample, t: typeof BIOME_TUNING): Terrain {
  if (tile.type === TILE_TYPE.WATER) return 'Ocean'
  if (touchesSea) return 'Coast'
  const steep = (TILE_LIST[tile.type].levelIncrement ?? 0) >= 2 ? 1 : 0
  if (level + steep >= 4) return 'Mountain'
  if (level + steep === 3) return 'Hills'
  if (level === 0 && f.moisture > t.swampMoisture) return 'Swamp'
  if (f.moisture < t.dryMoisture || Math.abs(f.temperature) > t.extremeTemperature) return 'Desert/arctic'
  if (f.moisture > t.forestMoisture) return 'Forest/jungle'
  return 'Grassland'
}

function hasLake(tile: PlacedTile, seed: number, t: typeof BIOME_TUNING): boolean {
  const def = TILE_LIST[tile.type]
  const roll = mixSeed(seed, tile.q, tile.r, 0x1a4e) / 4294967296
  if (def.name === 'RIVER_END') return roll < t.riverEndLakeChance
  if (HEX_DIRS.every((d) => def.edges[d] === 'grass')) return roll < t.lakeChance
  return false
}
