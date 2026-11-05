// Water rules for settlement maps (user rule, 2026-10-31: water must make sense for the hex the
// settlement is in). Rules table, as agreed:
//
//   Settlement's hex | Neighbors              | Water on the map
//   Ocean            | any                    | Coast toward the Ocean neighbors (random side if none known)
//   River/coast      | an Ocean neighbor      | Coast on that side
//   River/coast      | no Ocean neighbor      | River, toward a River/coast neighbor if any, else random
//   any other        | an Ocean neighbor      | Coast on that side
//   any other        | no Ocean neighbor      | No water
//
// "Side" is the real direction of the neighboring hex on the overland map; only revealed
// neighbors count. These tests cover the rules table for every terrain, the overland-map wiring
// (waterForMapHex), the full chain from a real map to the drawn sea/river, and the random-side case.
import { describe, expect, it } from 'vitest'
import { computeSettlementPlan, waterForHex, waterForMapHex, type Pt, type SettlementPlanInput } from './settlementPlan'
import { generateSettlement } from './generateSettlement'
import { TERRAIN_ORDER, type Terrain } from '../data/tables'
import { axialToPixel, hexId, neighborsOf, type AxialCoord } from '../hexgrid/hexMath'
import type { SettlementType } from '../data/settlementTables'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const TYPES: SettlementType[] = ['Village', 'Town', 'City', 'Metropolis']
const DRY_TERRAINS = TERRAIN_ORDER.filter((t) => t !== 'Ocean' && t !== 'River/coast')
const CENTER: AxialCoord = { q: 0, r: 0 }

function inputFor(seed: number, type: SettlementType): Omit<SettlementPlanInput, 'water'> {
  const site = generateSettlement(seededRng(seed), type)
  return { settlementType: site.settlementType, districts: site.districts, seedSource: `${site.settlementType}|${site.population}|${seed}` }
}

// Smallest absolute difference between two angles, in radians.
function angleGap(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

// Same, but for a line's direction (a river runs both ways).
function lineGap(a: number, b: number): number {
  return Math.min(angleGap(a, b), angleGap(a, b + Math.PI))
}

function centroid(points: Pt[]): Pt {
  return { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length }
}

// The six neighbors of the center hex with their real on-screen direction.
const NEIGHBORS = neighborsOf(CENTER).map((coord) => {
  const c = axialToPixel(CENTER, 1)
  const p = axialToPixel(coord, 1)
  return { coord, id: hexId(coord), angle: Math.atan2(p.y - c.y, p.x - c.x) }
})

function mapWith(centerTerrain: Terrain, neighbors: Record<string, Terrain>) {
  const hexes: Record<string, { terrain: Terrain }> = { [hexId(CENTER)]: { terrain: centerTerrain } }
  for (const [id, terrain] of Object.entries(neighbors)) hexes[id] = { terrain }
  return { hex: { ...CENTER, terrain: centerTerrain }, hexes }
}

describe('water rules table, every terrain', () => {
  const east = NEIGHBORS[0]
  const scenarios: { label: string; neighbors: { terrain: Terrain; angle: number }[] }[] = [
    { label: 'no revealed neighbors', neighbors: [] },
    { label: 'only dry neighbors', neighbors: [{ terrain: 'Grassland', angle: 0 }, { terrain: 'Mountain', angle: 1 }] },
    { label: 'a River/coast neighbor', neighbors: [{ terrain: 'River/coast', angle: east.angle }] },
    { label: 'an Ocean neighbor', neighbors: [{ terrain: 'Ocean', angle: east.angle }, { terrain: 'River/coast', angle: 2 }] },
  ]

  function expected(terrain: Terrain, label: string) {
    if (label === 'an Ocean neighbor') return { kind: 'coast', angle: east.angle }
    if (terrain === 'Ocean') return { kind: 'coast' }
    if (terrain === 'River/coast') return label === 'a River/coast neighbor' ? { kind: 'river', angle: east.angle } : { kind: 'river' }
    return null
  }

  for (const terrain of TERRAIN_ORDER) {
    for (const { label, neighbors } of scenarios) {
      it(`${terrain} hex with ${label}`, () => {
        const got = waterForHex(terrain, neighbors)
        const want = expected(terrain, label)
        if (want === null) return expect(got).toBeNull()
        expect(got?.kind).toBe(want.kind)
        if (want.angle === undefined) expect(got?.angle).toBeUndefined()
        else expect(angleGap(got!.angle!, want.angle)).toBeLessThan(1e-9)
      })
    }
  }

  it('an Ocean neighbor beats a River/coast neighbor on a River/coast hex (coast, not river)', () => {
    expect(waterForHex('River/coast', [{ terrain: 'River/coast', angle: 1 }, { terrain: 'Ocean', angle: 2 }])).toEqual({ kind: 'coast', angle: expect.closeTo(2, 9) })
  })

  it('a dry hex ignores River/coast neighbors entirely (rivers only run through River/coast hexes)', () => {
    for (const terrain of DRY_TERRAINS) expect(waterForHex(terrain, NEIGHBORS.map((n) => ({ terrain: 'River/coast' as const, angle: n.angle })))).toBeNull()
  })
})

describe('waterForMapHex — reading the overland map', () => {
  it.each(NEIGHBORS.map((n, i) => ({ i, ...n })))('an Ocean hex at neighbor $id puts the coast in its on-screen direction', ({ id, angle }) => {
    const { hex, hexes } = mapWith('Grassland', { [id]: 'Ocean' })
    const water = waterForMapHex(hex, hexes)
    expect(water?.kind).toBe('coast')
    expect(angleGap(water!.angle!, angle)).toBeLessThan(1e-9)
  })

  it('uses true screen directions: east is 0, the hex below is +90° (y points down)', () => {
    const below = NEIGHBORS.find((n) => n.coord.q === 0 && n.coord.r === 1)!
    const lowerRight = NEIGHBORS.find((n) => n.coord.q === 1 && n.coord.r === 0)!
    expect(below.angle).toBeCloseTo(Math.PI / 2, 9)
    expect(lowerRight.angle).toBeCloseTo(Math.PI / 6, 9)
  })

  it('works the same away from the origin (directions are relative to the settlement hex)', () => {
    const at: AxialCoord = { q: 7, r: -4 }
    const below = hexId({ q: 7, r: -3 })
    const water = waterForMapHex({ ...at, terrain: 'Grassland' }, { [hexId(at)]: { terrain: 'Grassland' }, [below]: { terrain: 'Ocean' } })
    expect(water?.angle).toBeCloseTo(Math.PI / 2, 9)
  })

  it('two adjacent Ocean neighbors put the sea between them', () => {
    const [a, b] = [NEIGHBORS[0], NEIGHBORS[5]]
    const water = waterForMapHex(mapWith('Grassland', { [a.id]: 'Ocean', [b.id]: 'Ocean' }).hex, mapWith('Grassland', { [a.id]: 'Ocean', [b.id]: 'Ocean' }).hexes)
    expect(angleGap(water!.angle!, a.angle)).toBeCloseTo(angleGap(water!.angle!, b.angle), 9)
    expect(angleGap(water!.angle!, a.angle)).toBeLessThanOrEqual(Math.PI / 6 + 1e-9)
  })

  it('ignores Ocean hexes that are revealed but not adjacent', () => {
    const { hex, hexes } = mapWith('Grassland', {})
    hexes[hexId({ q: 2, r: 0 })] = { terrain: 'Ocean' }
    hexes[hexId({ q: -2, r: 1 })] = { terrain: 'Ocean' }
    expect(waterForMapHex(hex, hexes)).toBeNull()
  })

  it('an Ocean hex with no revealed neighbors gets a coast on an unknown (random) side', () => {
    const { hex, hexes } = mapWith('Ocean', {})
    expect(waterForMapHex(hex, hexes)).toEqual({ kind: 'coast' })
  })

  it('with several River/coast neighbors, the river heads toward the first in neighbor order', () => {
    // Today's behavior, pinned so a change is deliberate; the rule itself doesn't say which.
    const [first, , third] = NEIGHBORS
    const { hex, hexes } = mapWith('River/coast', { [third.id]: 'River/coast', [first.id]: 'River/coast' })
    const water = waterForMapHex(hex, hexes)
    expect(water?.kind).toBe('river')
    expect(angleGap(water!.angle!, first.angle)).toBeLessThan(1e-9)
  })

  it('a River/coast hex with only dry neighbors gets a river in a random direction', () => {
    const { hex, hexes } = mapWith('River/coast', { [NEIGHBORS[2].id]: 'Mountain' })
    expect(waterForMapHex(hex, hexes)).toEqual({ kind: 'river' })
  })

  // Open question for the user (2026-11-02): Ocean neighbors on opposite sides (an isthmus), or on
  // every other side, cancel out when averaged, so the coast's direction comes from rounding noise
  // and can face a land neighbor. Replace this with a real test once the intended behavior is chosen.
  it.todo('Ocean neighbors on opposite sides: the coast faces a real Ocean neighbor (awaiting decision)')
})

describe('from the overland map to the drawn town map', () => {
  const SEEDS = [1, 2, 3, 4]

  it.each(NEIGHBORS.map((n) => ({ id: n.id, angle: n.angle })))('Ocean at $id: the drawn sea lies toward that hex, for every type', ({ id, angle }) => {
    const { hex, hexes } = mapWith('Grassland', { [id]: 'Ocean' })
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const plan = computeSettlementPlan({ ...inputFor(seed, type), water: waterForMapHex(hex, hexes) })
        expect(plan.water?.kind).toBe('coast')
        if (plan.water?.kind !== 'coast') continue
        expect(angleGap(plan.water.angle, angle)).toBeLessThan(1e-9)
        // The sea area itself sits on that side of the town, and the town's land is on the other.
        const sea = centroid(plan.water.sea)
        const town = centroid(plan.outline)
        expect(angleGap(Math.atan2(sea.y - town.y, sea.x - town.x), angle)).toBeLessThan(Math.PI / 6)
      }
    }
  })

  it.each(NEIGHBORS.map((n) => ({ id: n.id, angle: n.angle })))('River/coast at $id: the drawn river runs along that direction', ({ id, angle }) => {
    const { hex, hexes } = mapWith('River/coast', { [id]: 'River/coast' })
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const plan = computeSettlementPlan({ ...inputFor(seed, type), water: waterForMapHex(hex, hexes) })
        expect(plan.water?.kind).toBe('river')
        if (plan.water?.kind !== 'river') continue
        expect(lineGap(plan.water.angle, angle)).toBeLessThan(1e-9)
      }
    }
  })

  it('a dry hex with no Ocean neighbor draws no water at all', () => {
    for (const terrain of DRY_TERRAINS) {
      const { hex, hexes } = mapWith(terrain, { [NEIGHBORS[1].id]: 'River/coast', [NEIGHBORS[3].id]: 'Grassland' })
      const plan = computeSettlementPlan({ ...inputFor(5, 'City'), water: waterForMapHex(hex, hexes) })
      expect(plan.water).toBeNull()
    }
  })
})

describe('random side (no direction known)', () => {
  const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1)

  for (const kind of ['coast', 'river'] as const) {
    it(`a ${kind} with no direction is stable per settlement, varies between settlements, and is still drawn properly`, () => {
      const angles: number[] = []
      for (const type of TYPES) {
        for (const seed of SEEDS) {
          const input = { ...inputFor(seed, type), water: { kind } }
          const plan = computeSettlementPlan(input)
          // Same settlement, same side — every visit.
          expect(computeSettlementPlan(input).water?.angle).toBe(plan.water?.angle)
          expect(plan.water?.kind).toBe(kind)
          if (!plan.water) continue
          angles.push(plan.water.angle)
          if (plan.water.kind === 'coast') {
            // Coast checks from the directed case: blocks stay on the land side, gates face land.
            const u = { x: Math.cos(plan.water.angle), y: Math.sin(plan.water.angle) }
            const reachSea = Math.max(...plan.outline.map((p) => p.x * u.x + p.y * u.y))
            for (const block of plan.blocks) for (const p of block.cell) expect(p.x * u.x + p.y * u.y).toBeLessThanOrEqual(reachSea + 1e-6)
            for (const gate of plan.gates) expect(gate.at.x * u.x + gate.at.y * u.y).toBeLessThan(reachSea - 1.5)
          } else {
            expect(plan.water.bridges.length).toBeGreaterThan(0)
          }
        }
      }
      // Not stuck on one side: the random sides spread over at least three quarters of the compass.
      const quadrants = new Set(angles.map((a) => Math.floor((((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 2))))
      expect(quadrants.size).toBeGreaterThanOrEqual(3)
    })
  }
})
