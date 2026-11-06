// Town-map rivers (PLAN.md punch-list item 2): every river tile shape, a few seeds each, checked
// against checkRiverTown's structural invariants, plus what the plan reports about its river.
// Adapted from map_generator's settlementRiver.test.ts (its punch-list 1b).
import { describe, expect, it } from 'vitest'
import { computeSettlementPlan, waterForEdges } from './settlementPlan'
import { distanceToPolylines } from './riverCourse'
import { SCENARIOS, TYPES, checkRiverTown, distanceFn, inputFor, isConvex, pointInConvex, riverOf, riverWater } from './settlementRiverChecks'

describe('river towns: structural invariants for every tile shape', () => {
  for (const [label, edges] of Object.entries(SCENARIOS)) {
    it(`${label} (${edges.join(',') || 'no edges'})`, () => {
      for (const type of TYPES) {
        for (const seed of [1, 2, 3]) {
          checkRiverTown(computeSettlementPlan({ ...inputFor(seed, type), water: riverWater(edges) }), `${label} ${type} ${seed}`)
        }
      }
    }, 120000)
  }
})

describe('what the plan reports', () => {
  it('the course kind and edges come through from the tile', () => {
    const plan = (edges: Parameters<typeof riverWater>[0]) => riverOf(computeSettlementPlan({ ...inputFor(1, 'Town'), water: riverWater(edges) }))
    expect(plan(['E', 'W'])).toMatchObject({ course: 'through', entries: ['E'], exit: 'W' })
    expect(plan(['NE', 'W'])).toMatchObject({ course: 'through', entries: ['NE'], exit: 'W' })
    expect(plan(['W'])).toMatchObject({ course: 'ending', entries: ['W'], exit: null })
    const junction = plan(['NE', 'E', 'W'])
    expect(junction).toMatchObject({ course: 'through', entries: ['NE', 'E'], exit: 'W' })
    expect(junction.arms).toHaveLength(2)
  })

  it('a river with no edges picks a straight course from the seed: stable per town, varied across towns', () => {
    const exitFor = (seed: number) => riverOf(computeSettlementPlan({ ...inputFor(seed, 'Town'), water: riverWater([]) })).exit
    expect(exitFor(5)).toBe(exitFor(5))
    expect(new Set(Array.from({ length: 12 }, (_, i) => exitFor(i + 1))).size).toBeGreaterThan(2)
  })

  it('bridges: a through river gets 1 (Village/Town) or 2 (City/Metropolis), a river ending in town 1', () => {
    for (const seed of [1, 2, 3, 4]) {
      for (const type of TYPES) {
        const big = type === 'City' || type === 'Metropolis'
        const through = riverOf(computeSettlementPlan({ ...inputFor(seed, type), water: riverWater(['E', 'W']) }))
        expect(through.bridges.length).toBeLessThanOrEqual(big ? 2 : 1)
        expect(through.bridges.length).toBeGreaterThan(0)
        const end = riverOf(computeSettlementPlan({ ...inputFor(seed, type), water: riverWater(['W']) }))
        expect(end.bridges).toHaveLength(1)
      }
    }
  })

  it('waterForEdges passes every river edge on', () => {
    const none = { seaEdges: [], coastEdges: [] }
    expect(waterForEdges('Forest/jungle', { ...none, riverEdges: ['NE', 'E', 'W'] })).toEqual({ kind: 'river', edges: ['NE', 'E', 'W'] })
  })
})

describe('block helpers used above', () => {
  it('the fast river distance matches distanceToPolylines', () => {
    const arms = riverOf(computeSettlementPlan({ ...inputFor(2, 'City'), water: riverWater(['NE', 'E', 'W']) })).arms
    const d = distanceFn(arms)
    for (let i = 0; i < 200; i++) {
      const p = { x: Math.sin(i * 1.7) * 60, y: Math.cos(i * 2.3) * 60 }
      expect(d(p)).toBeCloseTo(distanceToPolylines(p, arms), 9)
    }
  })

  it('isConvex and pointInConvex behave', () => {
    const square = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
    expect(isConvex(square)).toBe(true)
    expect(isConvex([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0.2 }, { x: 1, y: 2 }])).toBe(false)
    expect(pointInConvex({ x: 0.5, y: 0.5 }, square)).toBe(true)
    expect(pointInConvex({ x: 1.5, y: 0.5 }, square)).toBe(false)
  })
})
