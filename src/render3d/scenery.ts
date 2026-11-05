// What decorations (trees, rocks, hills, mountains, bridges, lilies, flowers) sit on each hex in
// the 3D view. Pure (no Three.js), so it's tested; MapScene.ts places the meshes.
//
// The mesh names, the decoration kinds, and how each kind sits on its tile (bridges on river
// crossings, lilies dipped into the water, mountain models on cliffs and high ground, hills on
// river ends, tree density tiers) come from hex-map-wfc (src/hexmap/DecorationDefs.js and
// Decorations.js), Copyright (c) 2026 Felix Turner, MIT License:
// https://github.com/felixturner/hex-map-wfc/blob/main/LICENSE
// Changes (user decisions for M4b, docs/PLAN.md):
// - Placement follows each hex's terrain instead of noise fields: Forest/jungle dense trees,
//   Grassland occasional clumps, Swamp sparse trees with lilies and water plants,
//   Desert/arctic rocks only, Hills and Mountains their hill and mountain models.
// - No buildings (M6 puts them on point-of-interest hexes).
// - Each hex's choices come from its own seeded random stream (world seed + hex), so revealing
//   or re-solving elsewhere never reshuffles a hex's trees. No per-grid caps.

import type { Terrain } from '../data/tables'
import { mixSeed, mulberry32 } from '../wfc/rng'
import { HEX_DIRS, TILE_LIST, TILE_TYPE, rotateHexEdges, type HexDir } from '../wfc/tiles'
import { hexWorldPosition, rotationAngle, SURFACE_HEIGHT, tileBaseY } from './layout'

export const TREE_MESHES = {
  A: ['tree_single_A', 'trees_A_small', 'trees_A_medium', 'trees_A_large'],
  B: ['tree_single_B', 'trees_B_small', 'trees_B_medium', 'trees_B_large'],
  singles: ['tree_single_A', 'tree_single_B', 'tree_C', 'tree_D', 'tree_E'],
}
export const BRIDGE_MESHES = { A: 'building_bridge_A', B: 'building_bridge_B' }
export const LILY_MESHES = ['waterlily_A', 'waterlily_B']
export const PLANT_MESHES = ['waterplant_A', 'waterplant_B', 'waterplant_C', 'bush_A', 'bush_B', 'bush_C']
export const ROCK_MESHES = ['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E']
export const HILL_MESHES = ['hills_A', 'hills_A_trees', 'hills_B', 'hills_B_trees', 'hills_C', 'hills_C_trees', 'hill_single_A', 'hill_single_B', 'hill_single_C']
export const MOUNTAIN_MESHES = ['mountain_A_grass', 'mountain_B_grass', 'mountain_C_grass']

export const ALL_DECORATION_MESHES = [
  ...TREE_MESHES.A,
  ...TREE_MESHES.B,
  'tree_C',
  'tree_D',
  'tree_E',
  BRIDGE_MESHES.A,
  BRIDGE_MESHES.B,
  ...LILY_MESHES,
  ...PLANT_MESHES,
  ...ROCK_MESHES,
  ...HILL_MESHES,
  ...MOUNTAIN_MESHES,
]

// Chances (starting points; judged by eye in the browser).
export const SCENERY_TUNING = {
  grasslandTree: 0.22, // a flat Grassland hex gets a single tree or a small clump
  swampTree: 0.35,
  swampPlants: 0.6, // a flat Swamp hex gets 1-3 water plants or bushes
  swampLily: 0.3, // a Swamp river hex gets a water lily
  forestRiverTrees: 0.85, // a Forest river/road hex gets 1-2 trees beside the water or road
  desertRocks: 0.35,
  hillModel: 0.35, // a flat Hills hex gets a hill model
  mountainModel: 0.4, // a flat Mountain hex gets a mountain model
  cliffModel: 0.12, // any cliff tile: a hill (1-level cliff) or mountain (2-level) model
  cliffModelHigh: 0.3, // the same, on Hills and Mountain hexes
  cliffRocks: 0.2,
  riverEndHill: 0.5, // a river end with no lake gets a hill
}

export type Decoration = {
  hexId: string
  mesh: string
  x: number
  y: number
  z: number
  rotY: number
  scale: number
  level: number // the tile's level (for the palette blend)
}

export type SceneryTile = {
  id: string
  q: number
  r: number
  type: number
  rotation: number
  level: number
  terrain: Terrain
  lake: boolean
}

// Unit vector (x, z) from a hex's center toward the middle of the edge facing `dir`.
const DIR_ANGLE: Record<HexDir, number> = { NE: -60, E: 0, SE: 60, SW: 120, W: 180, NW: 240 }
function toward(dir: HexDir): { x: number; z: number } {
  const a = (DIR_ANGLE[dir] * Math.PI) / 180
  return { x: Math.cos(a), z: Math.sin(a) }
}

export function planScenery(tile: SceneryTile, worldSeed: number, tuning = SCENERY_TUNING): Decoration[] {
  const rng = mulberry32(mixSeed(worldSeed, tile.q, tile.r, 0x5ce7))
  const pick = <T>(list: readonly T[]) => list[Math.floor(rng() * list.length)]
  const chance = (p: number) => rng() < p
  const def = TILE_LIST[tile.type]
  const { x, z } = hexWorldPosition(tile.q, tile.r)
  const base = tileBaseY(tile.level)
  const surface = base + SURFACE_HEIGHT
  const out: Decoration[] = []
  const add = (mesh: string, dx: number, y: number, dz: number, rotY = rng() * Math.PI * 2, scale = 1) =>
    out.push({ hexId: tile.id, mesh, x: x + dx, y, z: z + dz, rotY, scale, level: tile.level })
  const jitter = (r: number) => (rng() - 0.5) * r
  const t = tile.terrain
  const isRiver = def.name.startsWith('RIVER_') && !def.name.startsWith('RIVER_CROSSING') && !def.name.includes('SLOPE')
  const isCliff = def.name.includes('CLIFF')

  // Bridges where a road crosses a river (hex-map-wfc places them at the tile's base).
  if (tile.type === TILE_TYPE.RIVER_CROSSING_A || tile.type === TILE_TYPE.RIVER_CROSSING_B) {
    const mesh = tile.type === TILE_TYPE.RIVER_CROSSING_A ? BRIDGE_MESHES.A : BRIDGE_MESHES.B
    add(mesh, 0, base, 0, rotationAngle(tile.rotation))
    return out
  }

  if (tile.type === TILE_TYPE.GRASS) {
    if (t === 'Forest/jungle') {
      const kind = chance(0.5) ? TREE_MESHES.A : TREE_MESHES.B
      add(kind[chance(0.6) ? 3 : 2], jitter(0.4), surface, jitter(0.4), undefined, 1 + rng() * 0.2)
    } else if (t === 'Grassland') {
      if (chance(tuning.grasslandTree)) {
        const mesh = chance(0.5) ? pick(TREE_MESHES.singles) : pick([TREE_MESHES.A[1], TREE_MESHES.B[1]])
        add(mesh, jitter(0.8), surface, jitter(0.8), undefined, 1 + rng() * 0.2)
      }
    } else if (t === 'Swamp') {
      if (chance(tuning.swampTree)) add(pick(TREE_MESHES.singles), jitter(0.8), surface, jitter(0.8))
      if (chance(tuning.swampPlants)) {
        const n = 1 + Math.floor(rng() * 3)
        for (let i = 0; i < n; i++) {
          const mesh = pick(PLANT_MESHES)
          add(mesh, jitter(1.6), surface, jitter(1.6), undefined, mesh.startsWith('bush_') ? 1 : 2)
        }
      }
    } else if (t === 'Desert/arctic') {
      if (chance(tuning.desertRocks)) {
        const n = 1 + Math.floor(rng() * 2)
        for (let i = 0; i < n; i++) add(pick(ROCK_MESHES), jitter(1.2), surface, jitter(1.2))
      }
    } else if (t === 'Hills') {
      if (chance(tuning.hillModel)) add(pick(HILL_MESHES), 0, surface, 0, Math.floor(rng() * 6) * (Math.PI / 3))
    } else if (t === 'Mountain') {
      if (chance(tuning.mountainModel)) add(pick(MOUNTAIN_MESHES), 0, surface, 0, Math.floor(rng() * 6) * (Math.PI / 3))
    }
    return out
  }

  if (isCliff) {
    const high = t === 'Hills' || t === 'Mountain'
    if (chance(high ? tuning.cliffModelHigh : tuning.cliffModel)) {
      const mesh = (def.levelIncrement ?? 0) >= 2 ? pick(MOUNTAIN_MESHES) : pick(HILL_MESHES)
      add(mesh, 0, surface, 0, Math.floor(rng() * 6) * (Math.PI / 3))
    } else if (chance(tuning.cliffRocks)) {
      add(pick(ROCK_MESHES), jitter(1.2), surface, jitter(1.2))
    }
    return out
  }

  if (tile.type === TILE_TYPE.RIVER_END) {
    if (!tile.lake && chance(tuning.riverEndHill)) add(pick(HILL_MESHES), 0, surface - 0.1, 0, Math.floor(rng() * 6) * (Math.PI / 3))
    return out
  }

  // Trees beside a river or road through a forest, toward edges that are plain grass (the
  // water or road runs from its edges to the center, so these spots are clear).
  const hasRoad = HEX_DIRS.some((d) => def.edges[d] === 'road')
  if ((isRiver || hasRoad) && !def.levelIncrement && t === 'Forest/jungle' && chance(tuning.forestRiverTrees)) {
    const edges = rotateHexEdges(def.edges, tile.rotation)
    const grass = HEX_DIRS.filter((d) => edges[d] === 'grass')
    const n = Math.min(grass.length, 1 + Math.floor(rng() * 2))
    for (let i = 0; i < n; i++) {
      const dir = grass.splice(Math.floor(rng() * grass.length), 1)[0]
      const v = toward(dir)
      add(pick(TREE_MESHES.singles), v.x * 0.62, surface, v.z * 0.62)
    }
    return out
  }

  // Water lilies on swamp rivers, dipped into the water (hex-map-wfc: 0.2 below the surface,
  // scale 2).
  if (isRiver && t === 'Swamp' && chance(tuning.swampLily)) {
    add(pick(LILY_MESHES), jitter(0.3), surface - 0.2, jitter(0.3), undefined, 2)
  }
  return out
}
