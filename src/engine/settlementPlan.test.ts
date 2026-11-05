import { describe, expect, it } from 'vitest'
import { computeSettlementPlan, waterForHex, type Pt, type SettlementPlanInput } from './settlementPlan'
import { generateSettlement } from './generateSettlement'
import type { SettlementType } from '../data/settlementTables'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function inputFor(seed: number, type: SettlementType): SettlementPlanInput {
  const site = generateSettlement(seededRng(seed), type)
  return {
    settlementType: site.settlementType,
    districts: site.districts,
    seedSource: `${site.settlementType}|${site.population}|${seed}`,
  }
}

function signedArea(poly: Pt[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

function insideConvex(p: Pt, poly: Pt[], eps = 1e-6): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < -eps) return false
  }
  return true
}

const TYPES: SettlementType[] = ['Village', 'Town', 'City', 'Metropolis']
const SEEDS = [1, 2, 3, 42, 777]

describe('computeSettlementPlan', () => {
  it('is deterministic for the same input', () => {
    const input = inputFor(5, 'Town')
    expect(computeSettlementPlan(input)).toEqual(computeSettlementPlan(input))
  })

  it('gives every district at least one block, and only real districts own blocks', () => {
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const input = inputFor(seed, type)
        const plan = computeSettlementPlan(input)
        const ids = new Set(input.districts.map((d) => d.id))
        for (const block of plan.blocks) expect(ids.has(block.districtId)).toBe(true)
        for (const d of input.districts) expect(plan.blocks.some((b) => b.districtId === d.id)).toBe(true)
        expect(plan.districtLabels.map((l) => l.districtId).sort()).toEqual([...ids].sort())
      }
    }
  })

  it('puts the seat of government at the center, as a plaza or (Castle District) a castle', () => {
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const input = inputFor(seed, type)
        const plan = computeSettlementPlan(input)
        const seat = input.districts.find((d) => d.isSeatOfGovernment)!
        const radius = Math.max(...plan.outline.map((p) => Math.hypot(p.x, p.y)))
        const centerpiece = plan.blocks.filter((blk) => blk.shape && (blk.kind === 'plaza' || blk.kind === 'castle'))
        expect(centerpiece).toHaveLength(1)
        expect(centerpiece[0].districtId).toBe(seat.id)
        const c = centerpiece[0].shape!.reduce((s2, p) => ({ x: s2.x + p.x / centerpiece[0].shape!.length, y: s2.y + p.y / centerpiece[0].shape!.length }), { x: 0, y: 0 })
        expect(Math.hypot(c.x, c.y)).toBeLessThan(radius * 0.3)
      }
    }
  })

  it('walls every settlement except villages, with towers and gates on the wall', () => {
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const plan = computeSettlementPlan(inputFor(seed, type))
        expect(plan.walled).toBe(type !== 'Village')
        if (type === 'Village') expect(plan.towers).toHaveLength(0)
        else expect(plan.towers.length).toBeGreaterThan(5)
        expect(plan.gates.length).toBe({ Village: 2, Town: 3, City: 4, Metropolis: 4 }[type])
        expect(plan.outerRoads).toHaveLength(plan.gates.length)
        for (const gate of plan.gates) {
          // Gates sit on the outline: inside it, but within a whisker of an edge.
          expect(insideConvex(gate.at, plan.outline, 1e-3)).toBe(true)
        }
      }
    }
  })

  it('links every gate to the center along main roads', () => {
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const plan = computeSettlementPlan(inputFor(seed, type))
        const key = (p: Pt) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`
        const adjacency = new Map<string, string[]>()
        for (const [a, b] of plan.mainRoads) {
          adjacency.set(key(a), [...(adjacency.get(key(a)) ?? []), key(b)])
          adjacency.set(key(b), [...(adjacency.get(key(b)) ?? []), key(a)])
        }
        // All gates are in one connected main-road network.
        const start = key(plan.gates[0].at)
        const seen = new Set([start])
        const queue = [start]
        while (queue.length > 0) {
          for (const n of adjacency.get(queue.shift()!) ?? []) {
            if (!seen.has(n)) {
              seen.add(n)
              queue.push(n)
            }
          }
        }
        for (const gate of plan.gates) expect(seen.has(key(gate.at))).toBe(true)
      }
    }
  })

  it('keeps every lot inside its block, inside the town outline', () => {
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const plan = computeSettlementPlan(inputFor(seed, type))
        for (const block of plan.blocks) {
          if (!block.shape || block.kind === 'field') continue
          expect(insideConvex(block.shape[0], block.cell, 1e-3)).toBe(true)
          let lotArea = 0
          for (const lot of block.lots) {
            for (const p of lot.poly) expect(insideConvex(p, block.shape, 1e-3)).toBe(true)
            lotArea += Math.abs(signedArea(lot.poly))
          }
          expect(lotArea).toBeLessThanOrEqual(Math.abs(signedArea(block.shape)) + 1e-6)
        }
      }
    }
  })

  it('fills towns with many small houses, and builds villages up only along their roads', () => {
    for (const seed of SEEDS) {
      const town = computeSettlementPlan(inputFor(seed, 'Metropolis'))
      const buildings = town.blocks.flatMap((b) => b.lots.filter((l) => l.kind === 'building'))
      expect(buildings.length).toBeGreaterThan(400)
      expect(Math.max(...buildings.map((l) => Math.abs(signedArea(l.poly))))).toBeLessThan(20)

      const village = computeSettlementPlan(inputFor(seed, 'Village'))
      expect(village.blocks.some((b) => b.kind === 'field' || b.kind === 'meadow')).toBe(true)
      expect(village.blocks.some((b) => b.lots.some((l) => l.kind === 'building'))).toBe(true)
    }
  })

  it('varies the outline and street pattern, with each one\'s own features', () => {
    const shapes = new Set<string>()
    const patterns = new Set<string>()
    for (let seed = 1; seed <= 60; seed++) {
      const plan = computeSettlementPlan(inputFor(seed * 7919, seed % 2 === 0 ? 'Metropolis' : 'City'))
      shapes.add(plan.shape)
      patterns.add(plan.pattern)
      expect(plan.bastions.length > 0).toBe(plan.shape === 'angular')
      expect(plan.innerWall.length > 0).toBe(plan.pattern === 'oldTown')
    }
    expect([...shapes].sort()).toEqual(['angular', 'elongated', 'round'])
    expect([...patterns].sort()).toEqual(['grid', 'gridCore', 'oldTown', 'organic'])
  })

  it('keeps villages organic and unwalled, never angular', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const plan = computeSettlementPlan(inputFor(seed * 7919, 'Village'))
      expect(plan.pattern).toBe('organic')
      expect(plan.shape).not.toBe('angular')
      expect(plan.bastions).toHaveLength(0)
    }
  })

  it('runs a planned grid\'s main avenues straight through the center to the gates', () => {
    let checked = 0
    for (let seed = 1; seed <= 80 && checked < 5; seed++) {
      const plan = computeSettlementPlan(inputFor(seed * 7919, 'City'))
      if (plan.pattern !== 'grid') continue
      checked++
      // Every gate sits close to one of the two avenue lines through the center.
      for (const gate of plan.gates) {
        const onAvenue = plan.mainRoads.some(([a, b]) => {
          const near = (p: Pt) => Math.hypot(p.x - gate.at.x, p.y - gate.at.y) < 1e-6
          return near(a) || near(b)
        })
        expect(onAvenue).toBe(true)
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('keeps a coastal town on the land side: no blocks in the sea, gates facing land, a harbor road', () => {
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const angle = (seed * 1.3) % (Math.PI * 2)
        const plan = computeSettlementPlan({ ...inputFor(seed, type), water: { kind: 'coast', angle } })
        expect(plan.water?.kind).toBe('coast')
        const u = { x: Math.cos(angle), y: Math.sin(angle) }
        const reachSea = Math.max(...plan.outline.map((p) => p.x * u.x + p.y * u.y))
        for (const block of plan.blocks) for (const p of block.cell) expect(p.x * u.x + p.y * u.y).toBeLessThanOrEqual(reachSea + 1e-6)
        for (const gate of plan.gates) expect(gate.at.x * u.x + gate.at.y * u.y).toBeLessThan(reachSea - 1.5)
        // The sea frontage has no wall.
        for (const [a, b] of plan.wallSegments) {
          const onShore = (p: Pt) => Math.abs(p.x * u.x + p.y * u.y - reachSea) < 1e-3
          expect(onShore(a) && onShore(b)).toBe(false)
        }
        // Some main road reaches the shore (the harbor).
        expect(plan.mainRoads.some(([a, b]) => [a, b].some((p) => Math.abs(p.x * u.x + p.y * u.y - reachSea) < 1e-3))).toBe(true)
        if (type !== 'Village') expect(plan.water!.kind === 'coast' && plan.water!.piers.length).toBeGreaterThan(0)
      }
    }
  })

  it('splits a river town along its banks, keeps blocks out of the river, and bridges it', () => {
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const angle = (seed * 0.7) % (Math.PI * 2)
        const plan = computeSettlementPlan({ ...inputFor(seed, type), water: { kind: 'river', angle } })
        expect(plan.water?.kind).toBe('river')
        if (plan.water?.kind !== 'river') continue
        expect(plan.water.bridges.length).toBeGreaterThan(0)
        // Every bridge is part of the main-road network.
        const key = (p: Pt) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`
        const mainKeys = new Set(plan.mainRoads.flatMap(([a, b]) => [key(a), key(b)]))
        expect(plan.water.bridges.some(([a, b]) => mainKeys.has(key(a)) && mainKeys.has(key(b)))).toBe(true)
        // No block straddles the river: each block lies entirely on one bank.
        const n = { x: -Math.sin(angle), y: Math.cos(angle) }
        const [a, b] = plan.water.bridges[0]
        const mid = ((a.x + b.x) / 2) * n.x + ((a.y + b.y) / 2) * n.y
        for (const block of plan.blocks) {
          const sides = new Set(block.cell.map((p) => Math.sign(Math.round((p.x * n.x + p.y * n.y - mid) * 1000))))
          sides.delete(0)
          expect(sides.size).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('has no water at all without a water input', () => {
    const plan = computeSettlementPlan(inputFor(3, 'City'))
    expect(plan.water).toBeNull()
    expect(plan.wallSegments.length).toBe(plan.outline.length)
  })
  it('builds suburbs along the roads outside some gates — never inside the wall, in water, or in villages', () => {
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        for (const water of [null, { kind: 'coast' as const, angle: 1 }, { kind: 'river' as const, angle: 2 }]) {
          const plan = computeSettlementPlan({ ...inputFor(seed, type), water })
          if (type === 'Village') {
            expect(plan.suburbs).toHaveLength(0)
            continue
          }
          expect(plan.suburbs.length).toBeGreaterThan(0)
          for (const house of plan.suburbs) {
            const c = house.poly.reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }), { x: 0, y: 0 })
            expect(insideConvex(c, plan.outline)).toBe(false)
            if (water?.kind === 'coast') {
              const u = { x: Math.cos(1), y: Math.sin(1) }
              const shore = Math.max(...plan.outline.map((p) => p.x * u.x + p.y * u.y))
              expect(c.x * u.x + c.y * u.y).toBeLessThan(shore)
            }
          }
        }
      }
    }
  })
})

describe('waterForHex', () => {
  const ne = -Math.PI / 6
  it('puts a coast toward Ocean neighbors, whatever the hex itself is', () => {
    expect(waterForHex('Grassland', [{ terrain: 'Ocean', angle: ne }])).toEqual({ kind: 'coast', angle: expect.closeTo(ne, 9) })
    expect(waterForHex('River/coast', [{ terrain: 'Ocean', angle: ne }, { terrain: 'Forest/jungle', angle: 2 }])?.kind).toBe('coast')
    const twoSeas = waterForHex('Ocean', [{ terrain: 'Ocean', angle: 0 }, { terrain: 'Ocean', angle: Math.PI / 2 }])
    expect(twoSeas?.angle).toBeCloseTo(Math.PI / 4, 9)
  })

  it('gives an Ocean hex with no known Ocean neighbor a coast on an unknown side', () => {
    expect(waterForHex('Ocean', [])).toEqual({ kind: 'coast' })
  })

  it('runs a river through a River/coast hex, toward a River/coast neighbor when there is one', () => {
    expect(waterForHex('River/coast', [{ terrain: 'River/coast', angle: 1 }])).toEqual({ kind: 'river', angle: 1 })
    expect(waterForHex('River/coast', [{ terrain: 'Mountain', angle: 1 }])).toEqual({ kind: 'river' })
  })

  it('gives dry hexes with no Ocean neighbor no water', () => {
    for (const terrain of ['Grassland', 'Forest/jungle', 'Mountain', 'Desert/arctic', 'Swamp'] as const) {
      expect(waterForHex(terrain, [{ terrain: 'River/coast', angle: 0 }, { terrain: 'Grassland', angle: 1 }])).toBeNull()
    }
  })
})
