import { describe, expect, it } from 'vitest'
import { computeCampPlan, type CampPlanFeatureInput } from './campPlan'
import { generateCampSite } from './generateCamp'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function inputFor(seed: number): { features: CampPlanFeatureInput[]; seed: string } {
  const site = generateCampSite(seededRng(seed))
  return {
    features: [
      { id: 'central', feature: 'Central', x: site.central.point.x, y: site.central.point.y },
      ...site.peripheralFeatures.map((f) => ({ id: f.id, feature: f.feature, x: f.point.x, y: f.point.y })),
    ],
    seed: `camp-${seed}`,
  }
}

const SEEDS = Array.from({ length: 40 }, (_, i) => (i + 1) * 7919)

describe('computeCampPlan', () => {
  it('is deterministic for the same input', () => {
    const { features, seed } = inputFor(42)
    expect(computeCampPlan(features, seed)).toEqual(computeCampPlan(features, seed))
  })

  it('draws a campfire at the center and something for every feature, with a marker each', () => {
    for (const s of SEEDS) {
      const { features, seed } = inputFor(s)
      const plan = computeCampPlan(features, seed)
      expect(plan.props.filter((p) => p.kind === 'campfire')).toHaveLength(1)
      for (const f of features) {
        expect(plan.props.some((p) => p.featureId === f.id)).toBe(true)
        expect(plan.markers.filter((m) => m.featureId === f.id)).toHaveLength(1)
      }
    }
  })

  it('draws each feature type as its own kind of scene', () => {
    const expected: Record<string, string> = {
      'Sleeping area': 'tent',
      'Supply cache': 'crate',
      'Watch post': 'platform',
      'Mounts/pack animals pen': 'fencePost',
      'Prisoner/captive pit': 'pit',
      "Ritual/leader's space": 'leaderTent',
    }
    for (const s of SEEDS) {
      const { features, seed } = inputFor(s)
      const plan = computeCampPlan(features, seed)
      for (const f of features) {
        if (f.feature === 'Central') continue
        expect(plan.props.some((p) => p.featureId === f.id && p.kind === expected[f.feature])).toBe(true)
      }
    }
  })

  it('keeps features apart from each other and from the fire after pulling the camp in', () => {
    for (const s of SEEDS) {
      const { features, seed } = inputFor(s)
      const plan = computeCampPlan(features, seed)
      const centerOf = (id: string) => {
        const own = plan.props.filter((p) => p.featureId === id)
        return { x: own.reduce((a, p) => a + p.x, 0) / own.length, y: own.reduce((a, p) => a + p.y, 0) / own.length }
      }
      const fire = plan.props.find((p) => p.kind === 'campfire')!
      const others = features.filter((f) => f.feature !== 'Central').map((f) => centerOf(f.id))
      for (const c of others) expect(Math.hypot(c.x - fire.x, c.y - fire.y)).toBeGreaterThan(6)
      for (let i = 0; i < others.length; i++) {
        for (let j = i + 1; j < others.length; j++) {
          expect(Math.hypot(others[i].x - others[j].x, others[i].y - others[j].y)).toBeGreaterThan(5)
        }
      }
    }
  })

  it('keeps the forest out of the camp', () => {
    for (const s of SEEDS) {
      const { features, seed } = inputFor(s)
      const plan = computeCampPlan(features, seed)
      expect(plan.canopy.length).toBeGreaterThan(0)
      for (const p of plan.props) {
        for (const c of plan.canopy) expect(Math.hypot(p.x - c.x, p.y - c.y)).toBeGreaterThan(c.r * 0.5)
      }
    }
  })
})
