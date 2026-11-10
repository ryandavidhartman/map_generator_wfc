// Town-map lakes and river mouths (PLAN.md punch-list item 2): which water a tile calls for
// (waterForEdges), and the plans they make. A lake is drawn with a curved shore and no piers
// (user, 2026-11-10); a river mouth or a river ending in a lake runs from its edge into the water.
import { describe, expect, it } from 'vitest'
import { computeSettlementPlan, waterForEdges, type SettlementPlan, type SettlementWaterInput } from './settlementPlan'
import { edgeAngle, oppositeEdge } from './riverCourse'
import { TYPES, assertFinite, checkRiverTown, inputFor, pointInPolygon, rotated } from './settlementRiverChecks'
import { TILE_TYPE, type HexDir } from '../wfc/tiles'
import { tileWaterEdges } from '../world/terrain'

const angleGap = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
const edgesOf = (tileName: string, rotation: number) => tileWaterEdges(TILE_TYPE[tileName], rotation)

describe('waterForEdges: lakes and river mouths', () => {
  it('a river mouth is a coast that keeps its river edge, the sea across from it', () => {
    for (let rotation = 0; rotation < 6; rotation++) {
      const e = edgesOf('RIVER_INTO_COAST', rotation)
      const water = waterForEdges('Coast', e)
      expect(water?.kind).toBe('coast')
      if (water?.kind !== 'coast') continue
      expect(water.riverEdges).toEqual(e.riverEdges)
      expect(water.lake).toBeUndefined()
      expect(angleGap(water.angle!, edgeAngle(oppositeEdge(e.riverEdges[0])))).toBeLessThan(1e-9)
    }
  })

  it('a river end with a lake is a lakeshore across from the river edge, with the river', () => {
    for (let rotation = 0; rotation < 6; rotation++) {
      const e = edgesOf('RIVER_END', rotation)
      const water = waterForEdges('Grassland', { ...e, lake: true })
      expect(water).toEqual({ kind: 'coast', angle: edgeAngle(oppositeEdge(e.riverEdges[0])), lake: true, riverEdges: e.riverEdges })
      // Without the lake it is still a river ending in town.
      expect(waterForEdges('Grassland', e)).toEqual({ kind: 'river', edges: e.riverEdges })
    }
  })

  it('a lake on a grass-only hex is a lakeshore whose side the plan picks', () => {
    expect(waterForEdges('Forest/jungle', { seaEdges: [], coastEdges: [], riverEdges: [], lake: true })).toEqual({ kind: 'coast', lake: true })
    expect(waterForEdges('Forest/jungle', { seaEdges: [], coastEdges: [], riverEdges: [], lake: false })).toBeNull()
  })

  it('plain coasts are unchanged: no lake or river keys', () => {
    expect(waterForEdges('Coast', edgesOf('COAST_A', 0))).toEqual({ kind: 'coast', angle: expect.any(Number) })
  })
})

// The water shapes stay off the town: no block corner in the sea or lake.
function checkStandingWater(plan: SettlementPlan, label: string) {
  assertFinite(plan)
  expect(plan.water?.kind, label).toBe('coast')
  if (plan.water?.kind !== 'coast') return
  const sea = plan.water.sea
  for (const block of plan.blocks) for (const p of block.cell) expect(pointInPolygon(p, sea), `${label} block in the water`).toBe(false)
  for (const g of plan.gates) expect(pointInPolygon(g.at, sea), `${label} gate in the water`).toBe(false)
}

describe('town plans with a lake or a river mouth', () => {
  const lake: SettlementWaterInput = { kind: 'coast', lake: true }
  const mouth = (r: number) => waterForEdges('Coast', edgesOf('RIVER_INTO_COAST', r))!
  const riverEndLake = (r: number) => waterForEdges('Grassland', { ...edgesOf('RIVER_END', r), lake: true })!

  it('a lake: curved shore all round, no piers, the town on dry land', () => {
    for (const type of TYPES) {
      for (let seed = 1; seed <= 6; seed++) {
        const plan = computeSettlementPlan({ ...inputFor(seed, type), water: lake })
        const label = `lake ${type} ${seed}`
        checkStandingWater(plan, label)
        if (plan.water?.kind !== 'coast') continue
        expect(plan.water.lake).toBe(true)
        expect(plan.water.piers).toEqual([])
        expect(plan.water.river).toBeUndefined()
        // A closed loop around a centre across the waterfront from the town.
        const shore = plan.water.shore
        expect(shore[0]).toEqual(shore[shore.length - 1])
        const c = { x: shore.reduce((t, p) => t + p.x, 0) / shore.length, y: shore.reduce((t, p) => t + p.y, 0) / shore.length }
        expect(angleGap(Math.atan2(c.y, c.x), plan.water.angle)).toBeLessThan(0.05)
        // Stable per settlement.
        expect(computeSettlementPlan({ ...inputFor(seed, type), water: lake }).water).toEqual(plan.water)
      }
    }
  })

  it('a river mouth and a river ending in a lake: the river runs in from its edge and ends in the water', () => {
    for (const type of TYPES) {
      for (let seed = 1; seed <= 6; seed++) {
        const rotation = seed % 6
        for (const [name, water] of [['mouth', mouth(rotation)], ['river end + lake', riverEndLake(rotation)]] as const) {
          const plan = computeSettlementPlan({ ...inputFor(seed, type), water })
          const label = `${name}@${rotation} ${type} ${seed}`
          checkStandingWater(plan, label)
          checkRiverTown(plan, label)
          if (plan.water?.kind !== 'coast' || water.kind !== 'coast') continue
          expect(plan.water.lake === true).toBe(name !== 'mouth')
          expect(plan.water.river?.entries).toEqual(water.riverEdges)
        }
      }
    }
  })

  it('a river mouth keeps its piers (towns and up)', () => {
    for (const type of TYPES) {
      if (type === 'Village') continue
      const plan = computeSettlementPlan({ ...inputFor(3, type), water: mouth(0) })
      expect(plan.water?.kind === 'coast' && plan.water.piers.length).toBeGreaterThan(0)
    }
  })

  it('every rotation of a river mouth: entry edge as the tile says', () => {
    const entries = new Set<HexDir>()
    for (let rotation = 0; rotation < 6; rotation++) {
      const plan = computeSettlementPlan({ ...inputFor(2, 'Town'), water: mouth(rotation) })
      checkRiverTown(plan, `mouth@${rotation}`)
      if (plan.water?.kind === 'coast') entries.add(plan.water.river!.entries[0])
      expect(plan.water?.kind === 'coast' && plan.water.river!.entries).toEqual(rotated(edgesOf('RIVER_INTO_COAST', 0).riverEdges, rotation))
    }
    expect(entries.size).toBe(6)
  })
})
