// Shared helpers for the town-map river tests (settlementRiver*.test.ts, PLAN.md punch-list
// item 2): the river scenarios, plan inputs, and checkRiverTown's structural invariants. Split
// out so the slow sweep can live in its own test file, which Vitest runs in parallel.
//
// Ported from map_generator's settlementRiverChecks.ts (its punch-list 1b, PR #1). Changes: the
// scenarios are WFC river tiles' edge sets (pointy-top HexDir edges, no flow direction) instead
// of map_generator's entries/exit, and the hex boundary uses the pointy-top edge angles.
import { expect } from 'vitest'
import { generateSettlement } from './generateSettlement'
import { edgeAngle, hexEdgeMidpoint, nearestOnPolylines } from './riverCourse'
import type { PlanRiver, Pt, SettlementPlan, SettlementPlanInput, SettlementWaterInput } from './settlementPlan'
import { HEX_DIRS, type HexDir } from '../wfc/tiles'
import type { SettlementType } from '../data/settlementTables'

export function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

export const TYPES: SettlementType[] = ['Village', 'Town', 'City', 'Metropolis']

export type RiverWater = PlanRiver

// Every river tile's edge set at rotation 0 (wfc/tiles.ts), plus the cases with no tile.
export const SCENARIOS: Record<string, HexDir[]> = {
  straight: ['E', 'W'], // RIVER_A, RIVER_A_CURVY, the slope and the crossings
  bend: ['NE', 'W'], // RIVER_B
  end: ['W'], // RIVER_END
  junctionD: ['NE', 'SE', 'W'],
  junctionE: ['NE', 'E', 'W'],
  junctionF: ['E', 'SE', 'W'],
  noTile: [], // the /poi review page with no Coast neighbor: a seed-picked straight river
  adjacent: ['NE', 'E'], // no tile has it; kept so a tight U-bend stays safe
}

// A scenario turned by `rotation` steps clockwise (as a tile's rotation turns its edges).
export function rotated(edges: HexDir[], rotation: number): HexDir[] {
  return edges.map((d) => HEX_DIRS[(HEX_DIRS.indexOf(d) + rotation) % 6])
}

export function riverWater(edges: HexDir[]): Extract<SettlementWaterInput, { kind: 'river' }> {
  return { kind: 'river', edges }
}

export function inputFor(seed: number, type: SettlementType): SettlementPlanInput {
  const site = generateSettlement(seededRng(seed), type)
  return { settlementType: site.settlementType, districts: site.districts, seedSource: `${site.settlementType}|${site.population}|${seed}` }
}

// The plan's river: on its own, or running into the sea or a lake (a coast's `river`).
export function riverOf(plan: SettlementPlan): RiverWater {
  const river = plan.water?.kind === 'coast' ? plan.water.river : plan.water
  expect(river?.kind).toBe('river')
  return river as RiverWater
}

// Ray-cast point-in-polygon, for the sea and lake shapes (not convex).
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function isConvex(poly: Pt[]): boolean {
  let sign = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const c = poly[(i + 2) % poly.length]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-7) continue // welded collinear vertex
    if (sign === 0) sign = Math.sign(cross)
    else if (Math.sign(cross) !== sign) return false
  }
  return true
}

export function pointInConvex(p: Pt, poly: Pt[], eps = 1e-9): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < -eps) return false
  }
  return true
}

export function signedArea(poly: Pt[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) a += poly[i].x * poly[(i + 1) % poly.length].y - poly[(i + 1) % poly.length].x * poly[i].y
  return a / 2
}

export function edgeSamples(poly: Pt[], step: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step))
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })
  }
  return out
}

// Points of the drawn band: the arms themselves and both banks.
export function bandPoints(river: RiverWater): Pt[] {
  const out: Pt[] = []
  for (const arm of river.arms) {
    for (let i = 0; i < arm.length; i++) {
      const prev = arm[Math.max(0, i - 1)]
      const next = arm[Math.min(arm.length - 1, i + 1)]
      const len = Math.hypot(next.x - prev.x, next.y - prev.y) || 1
      const n = { x: -(next.y - prev.y) / len, y: (next.x - prev.x) / len }
      out.push(arm[i], { x: arm[i].x + n.x * river.halfWidth * 0.98, y: arm[i].y + n.y * river.halfWidth * 0.98 }, { x: arm[i].x - n.x * river.halfWidth * 0.98, y: arm[i].y - n.y * river.halfWidth * 0.98 })
    }
  }
  return out
}

export const key = (p: Pt) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`

// Exact distance from a point to the river's arms, for the hot loops: the same minimum as
// riverCourse.ts's distanceToPolylines, but the segments are grouped in runs of CHUNK with a
// bounding box each, and a run whose box is already farther than the best distance found is
// skipped. The checks call this hundreds of thousands of times per sweep.
const CHUNK = 12
export function distanceFn(arms: Pt[][]): (p: Pt) => number {
  type Run = { minX: number; minY: number; maxX: number; maxY: number; pts: Pt[] }
  const runs: Run[] = []
  for (const arm of arms) {
    for (let i = 0; i + 1 < arm.length; i += CHUNK) {
      const pts = arm.slice(i, Math.min(arm.length, i + CHUNK + 1))
      runs.push({
        minX: Math.min(...pts.map((q) => q.x)),
        minY: Math.min(...pts.map((q) => q.y)),
        maxX: Math.max(...pts.map((q) => q.x)),
        maxY: Math.max(...pts.map((q) => q.y)),
        pts,
      })
    }
  }
  return (p: Pt) => {
    let best = Infinity
    for (const run of runs) {
      const bx = p.x < run.minX ? run.minX - p.x : p.x > run.maxX ? p.x - run.maxX : 0
      const by = p.y < run.minY ? run.minY - p.y : p.y > run.maxY ? p.y - run.maxY : 0
      if (bx * bx + by * by >= best) continue
      for (let i = 0; i + 1 < run.pts.length; i++) {
        const a = run.pts[i]
        const b = run.pts[i + 1]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len2 = dx * dx + dy * dy || 1
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
        t = t < 0 ? 0 : t > 1 ? 1 : t
        const qx = a.x + dx * t - p.x
        const qy = a.y + dy * t - p.y
        const d2 = qx * qx + qy * qy
        if (d2 < best) best = d2
      }
    }
    return Math.sqrt(best)
  }
}

// A plain check for the hot loops below: `expect` costs far more than the comparison itself, and
// these loops run millions of times across the sweeps, so `expect` is only reached on a failure.
export function ensure(ok: boolean, message: string) {
  if (!ok) expect.fail(message)
}

export function assertFinite(value: unknown, path = 'plan') {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} is ${value}`)
  } else if (Array.isArray(value)) value.forEach((v, i) => assertFinite(v, `${path}[${i}]`))
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) assertFinite(v, `${path}.${k}`)
}

// Where an arm crosses the notional hex's boundary (distance-from-centre = apothem on a
// pointy-top hex: max over edge normals), refined between consecutive samples.
export function hexCrossings(arm: Pt[], apothem: number): Pt[] {
  const excess = (p: Pt) => Math.max(...HEX_DIRS.map((d) => p.x * Math.cos(edgeAngle(d)) + p.y * Math.sin(edgeAngle(d)))) - apothem
  const out: Pt[] = []
  for (let i = 0; i + 1 < arm.length; i++) {
    const ea = excess(arm[i])
    const eb = excess(arm[i + 1])
    if (Math.abs(ea) < 1e-9) {
      out.push(arm[i])
      continue
    }
    if ((ea < 0) !== (eb < 0)) {
      const t = ea / (ea - eb)
      out.push({ x: arm[i].x + (arm[i + 1].x - arm[i].x) * t, y: arm[i].y + (arm[i + 1].y - arm[i].y) * t })
    }
  }
  if (Math.abs(excess(arm[arm.length - 1])) < 1e-9) out.push(arm[arm.length - 1])
  // A sample sitting exactly on the boundary also shows up as a sign change with its neighbour.
  return out.filter((p, i) => out.findIndex((q) => Math.hypot(p.x - q.x, p.y - q.y) < 0.01) === i)
}

// Structural invariants every river town must satisfy.
export function checkRiverTown(plan: SettlementPlan, label: string) {
  assertFinite(plan)
  const river = riverOf(plan)
  const w = river.halfWidth
  const arms = river.arms
  const d = distanceFn(arms)
  const context = `[${label}]`

  // 1. No block (and so no lot) overlaps the band; every block is convex. (Blocks whose whole
  //    extent is clear of the band are skipped — they can't overlap it.)
  const band = bandPoints(river)
  for (const block of plan.blocks) {
    ensure(isConvex(block.cell), `${context} non-convex block`)
    for (const lot of block.lots) for (const p of lot.poly) ensure(pointInConvex(p, block.cell, 1e-6), `${context} lot outside its block`)
    const c = { x: block.cell.reduce((t, p) => t + p.x, 0) / block.cell.length, y: block.cell.reduce((t, p) => t + p.y, 0) / block.cell.length }
    const reach = Math.max(...block.cell.map((p) => Math.hypot(p.x - c.x, p.y - c.y)))
    if (d(c) > reach + w + 1) continue
    for (const p of edgeSamples(block.cell, 0.25)) ensure(d(p) >= w - 1e-6, `${context} block edge inside the river at ${key(p)}`)
    for (const p of band) {
      if (Math.hypot(p.x - c.x, p.y - c.y) > reach) continue
      ensure(!pointInConvex(p, block.cell, -1e-6), `${context} river inside a block at ${key(p)}`)
    }
  }

  // 2. Main roads never run through the water except on a bridge; every bridge spans the river
  //    bank to bank and is part of the street network.
  const bridgeKeys = new Set(river.bridges.map(([a, b]) => `${key(a)}|${key(b)}`).flatMap((k) => [k, k.split('|').reverse().join('|')]))
  expect(river.bridges.length, `${context} no bridge`).toBeGreaterThan(0)
  for (const [a, b] of river.bridges) {
    expect(d({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), `${context} bridge misses the river`).toBeLessThan(w)
    for (const p of [a, b]) {
      expect(d(p)).toBeGreaterThanOrEqual(w - 1e-6)
      expect(d(p)).toBeLessThan(w + 1.3)
      ensure(plan.blocks.some((block) => block.cell.some((v) => key(v) === key(p))), `${context} bridge end not on a block corner`)
    }
  }
  for (const [a, b] of plan.mainRoads) {
    if (bridgeKeys.has(`${key(a)}|${key(b)}`)) continue
    for (const p of edgeSamples([a, b, a], 0.25)) ensure(d(p) >= w - 1e-6, `${context} main road in the water at ${key(p)}`)
  }
  // A through river splits the town; when gates sit on both banks some main road has to cross,
  // and it may only do so on a bridge. (A spring or ending river can be walked around, and at a
  // U-bend all the gates can sit on one bank.)
  const mainKeys = new Set(plan.mainRoads.flatMap(([a, b]) => [key(a), key(b)]))
  const bankOf = (p: Pt) => {
    const near = nearestOnPolylines(p, arms)
    return Math.sign(near.tangent.x * (p.y - near.point.y) - near.tangent.y * (p.x - near.point.x))
  }
  const gateBanks = new Set(plan.gates.map((g) => bankOf(g.at)))
  if (river.course === 'through' && river.arms.length === 1 && gateBanks.size === 2) {
    expect(river.bridges.some(([a, b]) => mainKeys.has(key(a)) && mainKeys.has(key(b))), `${context} no bridge on a main road`).toBe(true)
  }

  // 3. Wall: no wall segment in the band (+0.6), and a gap wherever the river crosses the outline.
  for (const [a, b] of plan.wallSegments) for (const p of edgeSamples([a, b, a], 0.25)) ensure(d(p) >= w + 0.6 - 1e-3, `${context} wall in the water at ${key(p)}`)
  if (plan.walled) {
    // Where the outline runs through the band there is a gap: no wall segment covers it.
    const wet = edgeSamples(plan.outline, 0.2).filter((p) => d(p) < w)
    expect(wet.length, `${context} river never crosses the outline`).toBeGreaterThan(0)
    const onSegment = (p: Pt, [a, b]: [Pt, Pt]) => {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
      return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)) < 0.05
    }
    for (const c of wet) ensure(!plan.wallSegments.some((seg) => onSegment(c, seg)), `${context} wall across the river at ${key(c)}`)
  }

  // 4. Gates, suburbs and fields stay off the water (today's margins: gate candidates +2,
  //    wet check +1 margin +1.5).
  for (const g of plan.gates) ensure(d(g.at) >= w + 2 - 1e-6, `${context} gate on the river at ${key(g.at)}`)
  for (const house of plan.suburbs) {
    const c = house.poly.reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }), { x: 0, y: 0 })
    ensure(d(c) >= w + 2.5 - 1e-6, `${context} suburb in the water at ${key(c)}`)
  }
  for (const f of plan.fields) for (const p of f.poly) ensure(d(p) >= w + 2.5 - 1e-6, `${context} field in the water at ${key(p)}`)
  for (const t of plan.outsideTrees) ensure(d(t.at) >= w + 2.5 - 1e-6, `${context} tree in the water at ${key(t.at)}`)
  for (const b of plan.bastions) ensure(d(b) >= w + 1 - 1e-6, `${context} bastion in the water at ${key(b)}`)

  // 5. Welded edges: no block vertex lies strictly inside another block's edge (no T-junctions).
  const vertices = plan.blocks.flatMap((b) => b.cell)
  for (const block of plan.blocks) {
    for (let i = 0; i < block.cell.length; i++) {
      const a = block.cell[i]
      const b = block.cell[(i + 1) % block.cell.length]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len2 = dx * dx + dy * dy
      if (len2 < 1e-12) continue
      const minX = Math.min(a.x, b.x) - 1e-6
      const maxX = Math.max(a.x, b.x) + 1e-6
      const minY = Math.min(a.y, b.y) - 1e-6
      const maxY = Math.max(a.y, b.y) + 1e-6
      for (const v of vertices) {
        if (v.x < minX || v.x > maxX || v.y < minY || v.y > maxY) continue
        const cross = dx * (v.y - a.y) - dy * (v.x - a.x)
        if (Math.abs(cross) > 1e-6 * Math.sqrt(len2)) continue
        const t = ((v.x - a.x) * dx + (v.y - a.y) * dy) / len2
        if (t > 1e-6 && t < 1 - 1e-6 && key(v) !== key(a) && key(v) !== key(b)) throw new Error(`${context} T-junction: ${key(v)} inside edge ${key(a)}-${key(b)}`)
      }
    }
  }

  // 6. The arms cross into the neighbouring hexes exactly at the right edge midpoints, and run
  //    off the map. A river into the sea or a lake (a mouth) enters at its entry midpoint and
  //    ends in the water instead.
  const apothem = river.hexApothem
  expect(apothem).toBeCloseTo(plan.bounds.maxX, 9)
  const midpoint = (dir: HexDir) => hexEdgeMidpoint(dir, apothem)
  const mouth = plan.water?.kind === 'coast' ? plan.water : null
  const expectedMidpoints = [...river.entries, ...(river.exit !== null && !mouth ? [river.exit] : [])].map(midpoint)
  const allCrossings = arms.flatMap((arm) => hexCrossings(arm, apothem))
  expect(allCrossings.length).toBe(
    mouth ? river.entries.length : river.course === 'through' ? river.entries.length * 2 : river.entries.length + (river.exit !== null ? 1 : 0),
  )
  for (const c of allCrossings) ensure(expectedMidpoints.some((m) => Math.hypot(m.x - c.x, m.y - c.y) < 0.01), `${context} crossing off a midpoint at ${key(c)}`)
  for (const arm of arms) {
    const offMap = (p: Pt) => Math.max(Math.abs(p.x), Math.abs(p.y)) > apothem + 1e-6
    if (mouth) {
      expect(offMap(arm[0]), `${context} mouth river doesn't start off the map`).toBe(true)
      expect(pointInPolygon(arm[arm.length - 1], mouth.sea), `${context} mouth river doesn't end in the water`).toBe(true)
      continue
    }
    if (river.course !== 'spring') expect(offMap(arm[0])).toBe(true)
    if (river.course !== 'ending') expect(offMap(arm[arm.length - 1])).toBe(true)
    if (river.course === 'spring') expect(Math.hypot(arm[0].x, arm[0].y)).toBeLessThan(1e-6)
    if (river.course === 'ending') expect(Math.hypot(arm[arm.length - 1].x, arm[arm.length - 1].y)).toBeLessThan(1e-6)
  }

  // 7. Districts: every district owns a block, and every block can be reached from the seat
  //    along the streets (blocks sharing a corner) and over the bridges.
  const districtIds = new Set(plan.blocks.map((b) => b.districtId))
  expect(districtIds.size).toBe(plan.districtLabels.length)
  const seat = plan.blocks.findIndex((b) => b.kind === 'plaza' || b.kind === 'castle')
  expect(seat, `${context} no seat block`).toBeGreaterThanOrEqual(0)
  const byVertex = new Map<string, number[]>()
  plan.blocks.forEach((b, i) => b.cell.forEach((v) => byVertex.set(key(v), [...(byVertex.get(key(v)) ?? []), i])))
  const adjacency = plan.blocks.map(() => new Set<number>())
  for (const owners of byVertex.values()) for (const a of owners) for (const b of owners) if (a !== b) adjacency[a].add(b)
  for (const [a, b] of river.bridges) for (const x of byVertex.get(key(a)) ?? []) for (const y of byVertex.get(key(b)) ?? []) {
    adjacency[x].add(y)
    adjacency[y].add(x)
  }
  const seen = new Set([seat])
  const stack = [seat]
  while (stack.length) for (const n of adjacency[stack.pop()!]) if (!seen.has(n)) {
    seen.add(n)
    stack.push(n)
  }
  // A junction can carve the town into more regions than its one-bridge-per-arm can join;
  // reachability is only promised for a single arm.
  if (river.arms.length === 1) expect(seen.size, `${context} blocks unreachable from the seat`).toBe(plan.blocks.length)
}

