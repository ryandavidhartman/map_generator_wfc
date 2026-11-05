// WFC tile definitions: the shape vocabulary of the overland map.
//
// Ported from hex-map-wfc (src/hexmap/HexTileData.js), Copyright (c) 2026 Felix Turner,
// MIT License: https://github.com/felixturner/hex-map-wfc/blob/main/LICENSE
// Changes: TypeScript types; the commented-out and removed tiles and the debug-only fields
// are dropped; the 34 active tiles, their edges and weights are unchanged.
//
// Each tile's six edges (pointy-top: NE, E, SE, SW, W, NW) have a type. Touching edges must
// have the same type and, except for grass, the same level. A tile is placed with a rotation
// (0-5, each step 60° clockwise) and a base level (0 to LEVELS_COUNT - 1). Slopes and cliffs
// have `highEdges`: those edges sit `levelIncrement` levels above the base.
// `preventChaining` tiles may not sit next to another tile of the same type.
// `mesh` names the model in the KayKit GLB, used by the 3D renderer (M4).

export const LEVELS_COUNT = 5

export const HEX_DIRS = ['NE', 'E', 'SE', 'SW', 'W', 'NW'] as const
export type HexDir = (typeof HEX_DIRS)[number]

export const HEX_OPPOSITE: Record<HexDir, HexDir> = {
  NE: 'SW',
  E: 'W',
  SE: 'NW',
  SW: 'NE',
  W: 'E',
  NW: 'SE',
}

export type EdgeType = 'grass' | 'water' | 'coast' | 'river' | 'road'

export type TileDef = {
  name: string
  mesh: string
  edges: Record<HexDir, EdgeType>
  weight: number
  preventChaining?: boolean
  highEdges?: HexDir[]
  levelIncrement?: number
}

// Array index is the tile's numeric type id. Ids are only stable while this list is
// unchanged; saved maps store the id, so reordering or removing tiles breaks saves.
export const TILE_LIST: readonly TileDef[] = [
  { name: 'GRASS', mesh: 'hex_grass', edges: { NE: 'grass', E: 'grass', SE: 'grass', SW: 'grass', W: 'grass', NW: 'grass' }, weight: 500 },
  { name: 'WATER', mesh: 'hex_water', edges: { NE: 'water', E: 'water', SE: 'water', SW: 'water', W: 'water', NW: 'water' }, weight: 500 },
  { name: 'ROAD_A', mesh: 'hex_road_A', edges: { NE: 'grass', E: 'road', SE: 'grass', SW: 'grass', W: 'road', NW: 'grass' }, weight: 30 },
  { name: 'ROAD_B', mesh: 'hex_road_B', edges: { NE: 'road', E: 'grass', SE: 'grass', SW: 'grass', W: 'road', NW: 'grass' }, weight: 8 },
  { name: 'ROAD_D', mesh: 'hex_road_D', edges: { NE: 'road', E: 'grass', SE: 'road', SW: 'grass', W: 'road', NW: 'grass' }, weight: 2, preventChaining: true },
  { name: 'ROAD_E', mesh: 'hex_road_E', edges: { NE: 'road', E: 'road', SE: 'grass', SW: 'grass', W: 'road', NW: 'grass' }, weight: 2, preventChaining: true },
  { name: 'ROAD_F', mesh: 'hex_road_F', edges: { NE: 'grass', E: 'road', SE: 'road', SW: 'grass', W: 'road', NW: 'grass' }, weight: 2, preventChaining: true },
  { name: 'ROAD_END', mesh: 'hex_road_M', edges: { NE: 'grass', E: 'grass', SE: 'grass', SW: 'grass', W: 'road', NW: 'grass' }, weight: 1, preventChaining: true },
  { name: 'RIVER_A', mesh: 'hex_river_A', edges: { NE: 'grass', E: 'river', SE: 'grass', SW: 'grass', W: 'river', NW: 'grass' }, weight: 20 },
  { name: 'RIVER_A_CURVY', mesh: 'hex_river_A_curvy', edges: { NE: 'grass', E: 'river', SE: 'grass', SW: 'grass', W: 'river', NW: 'grass' }, weight: 20 },
  { name: 'RIVER_B', mesh: 'hex_river_B', edges: { NE: 'river', E: 'grass', SE: 'grass', SW: 'grass', W: 'river', NW: 'grass' }, weight: 30 },
  { name: 'RIVER_D', mesh: 'hex_river_D', edges: { NE: 'river', E: 'grass', SE: 'river', SW: 'grass', W: 'river', NW: 'grass' }, weight: 4, preventChaining: true },
  { name: 'RIVER_E', mesh: 'hex_river_E', edges: { NE: 'river', E: 'river', SE: 'grass', SW: 'grass', W: 'river', NW: 'grass' }, weight: 4, preventChaining: true },
  { name: 'RIVER_F', mesh: 'hex_river_F', edges: { NE: 'grass', E: 'river', SE: 'river', SW: 'grass', W: 'river', NW: 'grass' }, weight: 4, preventChaining: true },
  { name: 'RIVER_END', mesh: 'river_end', edges: { NE: 'grass', E: 'grass', SE: 'grass', SW: 'grass', W: 'river', NW: 'grass' }, weight: 4, preventChaining: true },
  { name: 'COAST_A', mesh: 'hex_coast_A', edges: { NE: 'grass', E: 'coast', SE: 'water', SW: 'coast', W: 'grass', NW: 'grass' }, weight: 20 },
  { name: 'COAST_B', mesh: 'hex_coast_B', edges: { NE: 'grass', E: 'coast', SE: 'water', SW: 'water', W: 'coast', NW: 'grass' }, weight: 15 },
  { name: 'COAST_C', mesh: 'hex_coast_C', edges: { NE: 'coast', E: 'water', SE: 'water', SW: 'water', W: 'coast', NW: 'grass' }, weight: 15 },
  { name: 'COAST_D', mesh: 'hex_coast_D', edges: { NE: 'water', E: 'water', SE: 'water', SW: 'water', W: 'coast', NW: 'coast' }, weight: 15, preventChaining: true },
  { name: 'COAST_E', mesh: 'hex_coast_E', edges: { NE: 'grass', E: 'grass', SE: 'coast', SW: 'coast', W: 'grass', NW: 'grass' }, weight: 10, preventChaining: true },
  { name: 'COAST_SLOPE_A_LOW', mesh: 'coast_slope_low', edges: { NE: 'grass', E: 'grass', SE: 'grass', SW: 'coast', W: 'water', NW: 'coast' }, weight: 1, highEdges: ['NE', 'E', 'SE'], levelIncrement: 1 },
  { name: 'COAST_SLOPE_A_HIGH', mesh: 'coast_slope_high', edges: { NE: 'grass', E: 'grass', SE: 'grass', SW: 'coast', W: 'water', NW: 'coast' }, weight: 1, highEdges: ['NE', 'E', 'SE'], levelIncrement: 2 },
  { name: 'RIVER_A_SLOPE_LOW', mesh: 'river_slope_low', edges: { NE: 'grass', E: 'river', SE: 'grass', SW: 'grass', W: 'river', NW: 'grass' }, weight: 1, highEdges: ['NE', 'E', 'SE'], levelIncrement: 1 },
  { name: 'RIVER_INTO_COAST', mesh: 'river_coast', edges: { NE: 'coast', E: 'water', SE: 'water', SW: 'water', W: 'coast', NW: 'river' }, weight: 3, preventChaining: true },
  { name: 'RIVER_CROSSING_A', mesh: 'hex_river_crossing_A', edges: { NE: 'grass', E: 'river', SE: 'road', SW: 'grass', W: 'river', NW: 'road' }, weight: 4, preventChaining: true },
  { name: 'RIVER_CROSSING_B', mesh: 'hex_river_crossing_B', edges: { NE: 'road', E: 'river', SE: 'grass', SW: 'road', W: 'river', NW: 'grass' }, weight: 4, preventChaining: true },
  { name: 'GRASS_SLOPE_HIGH', mesh: 'hex_grass_sloped_high', edges: { NE: 'grass', E: 'grass', SE: 'grass', SW: 'grass', W: 'grass', NW: 'grass' }, weight: 20, highEdges: ['NE', 'E', 'SE'], levelIncrement: 2 },
  { name: 'ROAD_A_SLOPE_HIGH', mesh: 'hex_road_A_sloped_high', edges: { NE: 'grass', E: 'road', SE: 'grass', SW: 'grass', W: 'road', NW: 'grass' }, weight: 12, highEdges: ['NE', 'E', 'SE'], levelIncrement: 2 },
  { name: 'GRASS_CLIFF', mesh: 'hex_grass', edges: { NE: 'grass', E: 'grass', SE: 'grass', SW: 'grass', W: 'grass', NW: 'grass' }, weight: 6, highEdges: ['NE', 'E', 'SE'], levelIncrement: 2 },
  { name: 'GRASS_CLIFF_C', mesh: 'hex_grass', edges: { NE: 'grass', E: 'grass', SE: 'grass', SW: 'grass', W: 'grass', NW: 'grass' }, weight: 6, highEdges: ['E'], levelIncrement: 2 },
  { name: 'GRASS_SLOPE_LOW', mesh: 'hex_grass_sloped_low', edges: { NE: 'grass', E: 'grass', SE: 'grass', SW: 'grass', W: 'grass', NW: 'grass' }, weight: 20, highEdges: ['NE', 'E', 'SE'], levelIncrement: 1 },
  { name: 'ROAD_A_SLOPE_LOW', mesh: 'hex_road_A_sloped_low', edges: { NE: 'grass', E: 'road', SE: 'grass', SW: 'grass', W: 'road', NW: 'grass' }, weight: 12, highEdges: ['NE', 'E', 'SE'], levelIncrement: 1 },
  { name: 'GRASS_CLIFF_LOW', mesh: 'hex_grass', edges: { NE: 'grass', E: 'grass', SE: 'grass', SW: 'grass', W: 'grass', NW: 'grass' }, weight: 6, highEdges: ['NE', 'E', 'SE'], levelIncrement: 1 },
  { name: 'GRASS_CLIFF_LOW_C', mesh: 'hex_grass', edges: { NE: 'grass', E: 'grass', SE: 'grass', SW: 'grass', W: 'grass', NW: 'grass' }, weight: 6, highEdges: ['E'], levelIncrement: 1 },
]

// Name → type id, e.g. TILE_TYPE.GRASS === 0, TILE_TYPE.WATER === 1.
export const TILE_TYPE: Readonly<Record<string, number>> = Object.fromEntries(
  TILE_LIST.map((t, i) => [t.name, i]),
)

// Rotate a tile's edges by `rotation` 60° steps clockwise (NE → E → SE …).
export function rotateHexEdges(
  edges: Record<HexDir, EdgeType>,
  rotation: number,
): Record<HexDir, EdgeType> {
  const rotated = {} as Record<HexDir, EdgeType>
  for (let i = 0; i < 6; i++) {
    rotated[HEX_DIRS[(i + rotation) % 6]] = edges[HEX_DIRS[i]]
  }
  return rotated
}
