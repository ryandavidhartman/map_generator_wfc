import { describe, expect, it } from 'vitest'
import type { Terrain } from '../data/tables'
import { TILE_TYPE } from '../wfc/tiles'
import { hexWorldPosition, rotationAngle } from './layout'
import {
  BRIDGE_MESHES,
  HILL_MESHES,
  LILY_MESHES,
  MOUNTAIN_MESHES,
  planScenery,
  PLANT_MESHES,
  ROCK_MESHES,
  TREE_MESHES,
  type SceneryTile,
} from './scenery'

const TREES = new Set([...TREE_MESHES.A, ...TREE_MESHES.B, ...TREE_MESHES.singles])
const tile = (over: Partial<SceneryTile> = {}): SceneryTile => ({
  id: '3,-2',
  q: 3,
  r: -2,
  type: TILE_TYPE.GRASS,
  rotation: 0,
  level: 1,
  terrain: 'Grassland',
  lake: false,
  ...over,
})

// Plan the same kind of tile at many hexes, to see what a terrain gets overall.
function across(over: Partial<SceneryTile>, n = 400) {
  const all = []
  for (let i = 0; i < n; i++) all.push(...planScenery(tile({ ...over, id: `${i},0`, q: i, r: 0 }), 7))
  return all
}

describe('planScenery', () => {
  it('is the same every time for the same hex and seed, and differs by seed', () => {
    const t = tile({ terrain: 'Swamp' })
    expect(planScenery(t, 1)).toEqual(planScenery(t, 1))
    const plans = Array.from({ length: 20 }, (_, s) => JSON.stringify(planScenery(t, s)))
    expect(new Set(plans).size).toBeGreaterThan(1)
  })

  it('puts dense trees on every flat Forest/jungle hex, on the surface near its center', () => {
    for (let i = 0; i < 50; i++) {
      const t = tile({ terrain: 'Forest/jungle', id: `${i},1`, q: i, r: 1, level: 2 })
      const [tree, ...rest] = planScenery(t, 3)
      expect(rest).toEqual([])
      expect([TREE_MESHES.A[2], TREE_MESHES.A[3], TREE_MESHES.B[2], TREE_MESHES.B[3]]).toContain(tree.mesh)
      const c = hexWorldPosition(i, 1)
      expect(Math.hypot(tree.x - c.x, tree.z - c.z)).toBeLessThanOrEqual(0.3)
      expect(tree.y).toBe(2 * 0.5 + 1)
    }
  })

  it('gives each terrain only its own kinds of scenery', () => {
    const kinds = (terrain: Terrain) => new Set(across({ terrain }).map((d) => d.mesh))
    const only = (terrain: Terrain, allowed: Set<string>) => {
      for (const m of kinds(terrain)) expect(allowed).toContain(m)
    }
    only('Grassland', TREES)
    only('Swamp', new Set([...TREES, ...PLANT_MESHES]))
    only('Desert/arctic', new Set(ROCK_MESHES))
    only('Hills', new Set(HILL_MESHES))
    only('Mountain', new Set(MOUNTAIN_MESHES))
    expect(across({ terrain: 'Ocean', type: TILE_TYPE.WATER })).toEqual([])
    expect(across({ terrain: 'Coast', type: TILE_TYPE.COAST_A })).toEqual([])
  })

  it('makes forests dense and grassland sparse', () => {
    const forest = across({ terrain: 'Forest/jungle' }).length
    const grass = across({ terrain: 'Grassland' }).length
    expect(forest).toBe(400)
    expect(grass).toBeGreaterThan(40)
    expect(grass).toBeLessThan(140)
  })

  it('puts a bridge on every river crossing, turned with the tile', () => {
    const t = tile({ type: TILE_TYPE.RIVER_CROSSING_B, rotation: 4, level: 1 })
    expect(planScenery(t, 9)).toEqual([expect.objectContaining({ mesh: BRIDGE_MESHES.B, y: 0.5, rotY: rotationAngle(4) })])
  })

  it('keeps trees beside a forest river off the water (toward its grass edges)', () => {
    // RIVER_A runs E-W: grass on NE, SE, SW and NW, so trees stand well north or south of it.
    const plans = across({ terrain: 'Forest/jungle', type: TILE_TYPE.RIVER_A, rotation: 0 }, 100)
    expect(plans.length).toBeGreaterThan(50)
    for (const p of plans) {
      const [q] = p.hexId.split(',').map(Number)
      const c = hexWorldPosition(q, 0)
      expect(TREES).toContain(p.mesh)
      expect(Math.abs(p.z - c.z)).toBeGreaterThan(0.5)
    }
  })

  it('floats lilies on swamp rivers, and puts hills on river ends without a lake', () => {
    const lilies = across({ terrain: 'Swamp', type: TILE_TYPE.RIVER_B })
    expect(lilies.length).toBeGreaterThan(60)
    for (const l of lilies) expect(LILY_MESHES).toContain(l.mesh)
    expect(across({ terrain: 'Grassland', type: TILE_TYPE.RIVER_END, lake: true })).toEqual([])
    const hills = across({ terrain: 'Grassland', type: TILE_TYPE.RIVER_END, lake: false })
    expect(hills.length).toBeGreaterThan(100)
    for (const h of hills) expect(HILL_MESHES).toContain(h.mesh)
  })
})
