// Pure, deterministic rendering-only geometry for SettlementMapSvg.tsx — NOT part of the
// generation engine. Like towerPlan.ts/keepPlan.ts, the whole town layout is derived at render
// time from a generated Settlement's districts via a seeded hash, so nothing extra is persisted
// (generateSettlement.ts only stores game content: districts, POIs, NPCs, government...).
//
// The approach (user-chosen, 2026-10-31 — see docs/plan-settlement-map-overhaul.md):
// 1. Blocks: many small Voronoi cells inside a convex town outline, evened out with Lloyd's
//    relaxation. The game's 3-8 districts are groups of neighboring blocks, seat in the middle.
// 2. Streets: the gaps between blocks. Main roads are the shortest routes from each gate to the
//    central plaza along block edges (a simplified "agents walk from the gates" idea) — they
//    get a wider gap.
// 3. Buildings: each block is recursively sliced into lots facing the streets (polygon
//    subdivision); lots buried inside a block become courtyards.
// 4. Wall (towns and larger) with towers and gates; farmland and trees outside.
//
// Coordinates are abstract units (~10 ft), y grows downward, town centered on (0, 0).

import { Delaunay } from 'd3-delaunay'
import { seededRngFromNumber } from './caveRenderShapes'
import { seedForString } from './towerPlan'
import type { DistrictType, SettlementType } from '../data/settlementTables'
import type { Terrain } from '../data/tables'
import { axialToPixel, hexId, neighborsOf, type AxialCoord } from '../hexgrid/hexMath'

export type Pt = { x: number; y: number }

// What water the settlement's hex calls for (see waterForHex). `angle` is the direction of the
// sea, or the river's downstream direction, in map coordinates (radians, y down); left out when
// no revealed neighbor says which way, in which case the plan picks one from its seed.
export type SettlementWaterInput = { kind: 'coast' | 'river'; angle?: number }

export type SettlementPlanInput = {
  settlementType: SettlementType
  water?: SettlementWaterInput | null
  districts: { id: string; districtType: DistrictType; isSeatOfGovernment: boolean }[]
  seedSource: string
}

export type Lot = { poly: Pt[]; kind: 'building' | 'yard' | 'tree'; color: string }

export type Block = {
  districtId: string
  // The block's Voronoi cell (streets run along its edges) and the built-up area inside it.
  cell: Pt[]
  shape: Pt[] | null
  // 'field' / 'meadow': a village's open plots away from the roads — a crop field, or plain
  // countryside (drawn as nothing), so the village doesn't read as a filled circle.
  kind: 'buildings' | 'plaza' | 'garden' | 'castle' | 'temple' | 'field' | 'meadow'
  lots: Lot[]
  trees: { at: Pt; r: number }[]
}

// Rolled per settlement, odds by size (user decision 2026-10-31 — see
// docs/plan-settlement-map-overhaul.md's "Shape diversity").
export type OutlineShape = 'round' | 'angular' | 'elongated'
export type StreetPattern = 'organic' | 'grid' | 'gridCore' | 'oldTown'

export type PlanWater =
  | { kind: 'coast'; angle: number; sea: Pt[]; shore: Pt[]; piers: [Pt, Pt][] }
  | { kind: 'river'; angle: number; river: Pt[]; bridges: [Pt, Pt][] }

export type SettlementPlan = {
  shape: OutlineShape
  pattern: StreetPattern
  water: PlanWater | null
  // The town wall as segments: the outline minus any sea frontage and river crossings.
  wallSegments: [Pt, Pt][]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  outline: Pt[]
  walled: boolean
  towers: Pt[]
  // Angular walls only: the corner bastions.
  bastions: Pt[]
  // Old-town pattern only: the old inner wall, broken where main roads pass through it.
  innerWall: [Pt, Pt][]
  innerTowers: Pt[]
  gates: { at: Pt; angle: number }[]
  // Street segments the main roads follow (drawn explicitly in villages, which have no paved
  // street grid — elsewhere they're just the wider gaps between blocks).
  mainRoads: [Pt, Pt][]
  outerRoads: Pt[][]
  blocks: Block[]
  districtBorders: [Pt, Pt][]
  districtLabels: { districtId: string; at: Pt }[]
  fields: { poly: Pt[]; color: string }[]
  outsideTrees: { at: Pt; r: number }[]
  // Houses strung along the roads just outside some gates (walled towns only).
  suburbs: { poly: Pt[]; color: string }[]
}

const BLOCK_COUNT: Record<SettlementType, number> = { Village: 24, Town: 40, City: 70, Metropolis: 110 }
const GATE_COUNT: Record<SettlementType, number> = { Village: 2, Town: 3, City: 4, Metropolis: 4 }
const BLOCK_AREA = 58
const LLOYD_ITERATIONS = 3
const STREET_HALF = 0.4
const MAIN_ROAD_HALF = 1.5
const WALL_GAP = 1.4
const RIVER_HALF_WIDTH: Record<SettlementType, number> = { Village: 1.1, Town: 1.5, City: 1.9, Metropolis: 2.3 }
const LOT_GAP = 0.1

const LOT_AREA: Record<DistrictType, number> = {
  Slums: 1.6,
  'Low District': 2,
  'Artisan District': 2.4,
  Market: 2.4,
  'High District': 4,
  'Temple District': 3.4,
  'University District': 3.4,
  'Castle District': 4,
}

const GARDEN_CHANCE: Record<DistrictType, number> = {
  Slums: 0,
  'Low District': 0.04,
  'Artisan District': 0.06,
  Market: 0.05,
  'High District': 0.22,
  'Temple District': 0.15,
  'University District': 0.15,
  'Castle District': 0.2,
}

// Painted-map roof tones (reference: red/brown dominating, purple-ish noble quarters,
// weathered grey-brown slums).
const ROOF_COLORS: Record<DistrictType, string[]> = {
  Slums: ['#6e5a4b', '#7a6656', '#5f4e42', '#806b55'],
  'Low District': ['#8a4a3a', '#7d4434', '#94573f', '#86503c'],
  'Artisan District': ['#9c4f35', '#a65d3c', '#8b4530', '#b06a45'],
  Market: ['#a8452f', '#b85a3a', '#9a3e2c', '#c06b44'],
  'High District': ['#7b3f55', '#8a4a62', '#6d3a5a', '#a0503f'],
  'Temple District': ['#a9864f', '#9b7a4a', '#b8955a', '#8f5a3c'],
  'University District': ['#5d6b7d', '#6b5a7d', '#8a4a3a', '#76606e'],
  'Castle District': ['#6d6f78', '#7a7c85', '#5e5a66', '#8a5050'],
}

const SHAPE_ODDS: Record<SettlementType, [OutlineShape, number][]> = {
  Village: [['elongated', 0.6], ['round', 0.4]],
  Town: [['round', 0.5], ['angular', 0.25], ['elongated', 0.25]],
  City: [['round', 0.35], ['angular', 0.45], ['elongated', 0.2]],
  Metropolis: [['round', 0.3], ['angular', 0.55], ['elongated', 0.15]],
}
const PATTERN_ODDS: Record<SettlementType, [StreetPattern, number][]> = {
  Village: [['organic', 1]],
  Town: [['organic', 0.6], ['grid', 0.2], ['oldTown', 0.2]],
  City: [['organic', 0.3], ['grid', 0.2], ['gridCore', 0.25], ['oldTown', 0.25]],
  Metropolis: [['organic', 0.2], ['grid', 0.15], ['gridCore', 0.35], ['oldTown', 0.3]],
}

function pickWeighted<T>(options: [T, number][], rng: () => number): T {
  let roll = rng() * options.reduce((sum, [, w]) => sum + w, 0)
  for (const [value, weight] of options) {
    roll -= weight
    if (roll < 0) return value
  }
  return options[options.length - 1][0]
}

// How many gates get a suburb, and how far it runs along the road (in units).
const SUBURB_GATES: Record<SettlementType, [number, number]> = { Village: [0, 0], Town: [1, 2], City: [2, 3], Metropolis: [4, 4] }
const SUBURB_LENGTH: Record<SettlementType, number> = { Village: 0, Town: 12, City: 16, Metropolis: 22 }
// Poorer, weathered roofs than inside the walls.
const SUBURB_COLORS = ['#7a6656', '#6e5a4b', '#86503c', '#806b55', '#8a4a3a']

const FIELD_COLORS = ['#9bb36a', '#b5c27a', '#c9bf7f', '#86a35e', '#a8b872']

// --- water from the hex ------------------------------------------------------------------

// User rule (2026-10-31): water must make sense for the hex the settlement is in. A coast faces
// the Ocean neighbors; a River/coast hex with no Ocean neighbor gets a river flowing toward a
// watery neighbor; a hex with no water and no Ocean neighbor gets none. `neighbors` are the
// revealed neighboring hexes with their direction from this hex on the overland map.
export function waterForHex(terrain: Terrain, neighbors: { terrain: Terrain; angle: number }[]): SettlementWaterInput | null {
  const meanAngle = (angles: number[]) =>
    Math.atan2(
      angles.reduce((s2, a) => s2 + Math.sin(a), 0),
      angles.reduce((s2, a) => s2 + Math.cos(a), 0),
    )
  const ocean = neighbors.filter((n) => n.terrain === 'Ocean').map((n) => n.angle)
  if (ocean.length > 0) return { kind: 'coast', angle: meanAngle(ocean) }
  if (terrain === 'Ocean') return { kind: 'coast' }
  if (terrain === 'River/coast') {
    const river = neighbors.filter((n) => n.terrain === 'River/coast').map((n) => n.angle)
    return river.length > 0 ? { kind: 'river', angle: river[0] } : { kind: 'river' }
  }
  return null
}

// Feeds waterForHex from the overland map: the hex's own terrain plus each revealed neighbor
// with its direction from this hex (radians, y down — the same frame as the settlement plan, so a
// neighbor to the screen's north-east puts the sea on the town map's north-east). Unrevealed
// neighbors don't count. Neighbors are visited in neighborsOf order, which decides which
// River/coast neighbor a river heads toward when there are several.
export function waterForMapHex(hex: AxialCoord & { terrain: Terrain }, hexes: Record<string, { terrain: Terrain }>): SettlementWaterInput | null {
  const center = axialToPixel(hex, 1)
  const neighbors = neighborsOf(hex).flatMap((coord) => {
    const neighbor = hexes[hexId(coord)]
    if (!neighbor) return []
    const p = axialToPixel(coord, 1)
    return [{ terrain: neighbor.terrain, angle: Math.atan2(p.y - center.y, p.x - center.x) }]
  })
  return waterForHex(hex.terrain, neighbors)
}

// --- small geometry helpers -------------------------------------------------------------

function area(poly: Pt[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

function centroid(poly: Pt[]): Pt {
  const a = area(poly)
  if (Math.abs(a) < 1e-9) {
    return { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length }
  }
  let cx = 0
  let cy = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const f = p.x * q.y - q.x * p.y
    cx += (p.x + q.x) * f
    cy += (p.y + q.y) * f
  }
  return { x: cx / (6 * a), y: cy / (6 * a) }
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// Makes a polygon counter-clockwise in math terms (positive signed area).
function ccw(poly: Pt[]): Pt[] {
  return area(poly) < 0 ? [...poly].reverse() : poly
}

// Sutherland–Hodgman: keep the part of a convex polygon on the side of the line through `a`
// with direction `d` where cross(d, p - a) >= offset (left side for a CCW polygon's edges).
function clipHalfPlane(poly: Pt[], a: Pt, d: Pt, offset: number): Pt[] {
  const len = Math.hypot(d.x, d.y) || 1
  const side = (p: Pt) => (d.x * (p.y - a.y) - d.y * (p.x - a.x)) / len - offset
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const sp = side(p)
    const sq = side(q)
    if (sp >= 0) out.push(p)
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq)
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
    }
  }
  return out
}

// Clip a polygon to a convex, CCW clip polygon.
function clipToConvex(poly: Pt[], clip: Pt[]): Pt[] {
  let out = poly
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const a = clip[i]
    const b = clip[(i + 1) % clip.length]
    out = clipHalfPlane(out, a, { x: b.x - a.x, y: b.y - a.y }, 0)
  }
  return out
}

// Inset a convex CCW polygon, each edge by its own distance.
function insetConvex(poly: Pt[], distances: number[]): Pt[] {
  let out = poly
  for (let i = 0; i < poly.length && out.length > 0; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    out = clipHalfPlane(out, a, { x: b.x - a.x, y: b.y - a.y }, distances[i])
  }
  return out
}

function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Pt[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Pt[] = []
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

function pointInConvex(p: Pt, poly: Pt[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < 0) return false
  }
  return true
}

function distanceToEdges(p: Pt, poly: Pt[]): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)))
  }
  return best
}

// Smooth 1-D noise in [-1, 1]: a few sines with random frequencies and phases.
function smoothNoise(rng: () => number): (t: number) => number {
  const waves = Array.from({ length: 3 }, (_, i) => ({ f: (0.15 + rng() * 0.2) * (i + 1), p: rng() * Math.PI * 2, a: 1 / (i + 1) }))
  const total = waves.reduce((s2, w) => s2 + w.a, 0)
  return (t) => waves.reduce((s2, w) => s2 + w.a * Math.sin(w.f * t + w.p), 0) / total
}

const keyOf = (p: Pt) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`

// --- town outline and blocks -----------------------------------------------------------

// Every outline is convex (built as a hull), which keeps every clipped block convex too. Each
// shape is scaled to roughly the same area as a circle of `radius`.
function roundOutline(radius: number, rng: () => number): Pt[] {
  const samples = 48
  const a1 = 0.03 + rng() * 0.05
  const a2 = rng() * 0.04
  const p1 = rng() * Math.PI * 2
  const p2 = rng() * Math.PI * 2
  const pts: Pt[] = []
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2
    const r = radius * (1 + a1 * Math.sin(2 * t + p1) + a2 * Math.sin(3 * t + p2))
    pts.push({ x: Math.cos(t) * r, y: Math.sin(t) * r })
  }
  return ccw(convexHull(pts))
}

// Straight wall runs between 7-10 corners (the bastions), like a planned fortified town.
function angularOutline(radius: number, rng: () => number): Pt[] {
  const corners = 7 + Math.floor(rng() * 4)
  const circumradius = radius * Math.sqrt((2 * Math.PI) / (corners * Math.sin((2 * Math.PI) / corners)))
  const offset = rng() * Math.PI * 2
  const step = (Math.PI * 2) / corners
  const pts: Pt[] = []
  for (let i = 0; i < corners; i++) {
    const t = offset + i * step + (rng() - 0.5) * step * 0.4
    const r = circumradius * (0.92 + rng() * 0.16)
    pts.push({ x: Math.cos(t) * r, y: Math.sin(t) * r })
  }
  return ccw(convexHull(pts))
}

// An oval stretched along `axis` — a town grown along its main road.
function elongatedOutline(radius: number, axis: number, rng: () => number): Pt[] {
  // Kept fairly mild (user, 2026-10-31: "a little more circular") — was 1.45-1.8.
  const stretch = 1.25 + rng() * 0.25
  const major = radius * stretch
  const minor = radius / stretch
  const samples = 40
  const pts: Pt[] = []
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2
    const wobble = 1 + (rng() - 0.5) * 0.06
    const u = Math.cos(t) * major * wobble
    const v = Math.sin(t) * minor * wobble
    pts.push({ x: u * Math.cos(axis) - v * Math.sin(axis), y: u * Math.sin(axis) + v * Math.cos(axis) })
  }
  return ccw(convexHull(pts))
}

function voronoiCells(sites: Pt[], outline: Pt[], pad: number): Pt[][] {
  const xs = outline.map((p) => p.x)
  const ys = outline.map((p) => p.y)
  const voronoi = Delaunay.from(sites.map((p) => [p.x, p.y] as [number, number])).voronoi([
    Math.min(...xs) - pad,
    Math.min(...ys) - pad,
    Math.max(...xs) + pad,
    Math.max(...ys) + pad,
  ])
  return sites.map((_, i) => {
    const ring = voronoi.cellPolygon(i)
    if (!ring) return []
    const cell = ring.slice(0, -1).map(([x, y]) => ({ x, y }))
    return clipToConvex(ccw(cell), outline)
  })
}

// Block sites for each street pattern; `fixed` sites (grid points) are left alone by Lloyd's
// relaxation, the rest are relaxed so organic blocks come out evenly sized.
function blockSites(
  pattern: StreetPattern,
  count: number,
  outline: Pt[],
  radius: number,
  axis: number,
  rng: () => number,
): { sites: Pt[]; fixed: boolean[] } {
  const sites: Pt[] = []
  const fixed: boolean[] = []
  const randomPoint = () => {
    for (;;) {
      const extent = radius * 2
      const p = { x: (rng() * 2 - 1) * extent, y: (rng() * 2 - 1) * extent }
      if (pointInConvex(p, outline)) return p
    }
  }
  if (pattern === 'grid' || pattern === 'gridCore') {
    // Rectangular grid aligned to `axis`. Sites sit at half-steps so the cell edges — the
    // streets — include the two lines through the center: the main avenues.
    const side = Math.sqrt(BLOCK_AREA)
    const sx = side * 1.3
    const sy = side / 1.3
    const coreRadius = pattern === 'gridCore' ? radius * 0.55 : Infinity
    const reach = Math.ceil((radius * 2.2) / sy)
    for (let i = -reach; i < reach; i++) {
      for (let j = -reach; j < reach; j++) {
        const u = (i + 0.5) * sx
        const v = (j + 0.5) * sy
        const p = {
          x: u * Math.cos(axis) - v * Math.sin(axis) + (rng() - 0.5) * 0.04,
          y: u * Math.sin(axis) + v * Math.cos(axis) + (rng() - 0.5) * 0.04,
        }
        if (!pointInConvex(p, outline) || Math.hypot(p.x, p.y) > coreRadius) continue
        sites.push(p)
        fixed.push(true)
      }
    }
    if (pattern === 'gridCore') {
      const outerCount = Math.max(0, Math.round(count * (1 - (coreRadius * coreRadius) / (radius * radius))))
      while (sites.length < sites.filter((_, i) => fixed[i]).length + outerCount) {
        const p = randomPoint()
        if (Math.hypot(p.x, p.y) < coreRadius) continue
        sites.push(p)
        fixed.push(false)
      }
    }
  } else {
    while (sites.length < count) {
      sites.push(randomPoint())
      fixed.push(false)
    }
  }
  return { sites, fixed }
}

function relaxedBlocks(sitesIn: Pt[], fixed: boolean[], outline: Pt[], radius: number): Pt[][] {
  let sites = sitesIn
  let cells = voronoiCells(sites, outline, radius * 2)
  if (fixed.every(Boolean)) return cells
  for (let i = 0; i < LLOYD_ITERATIONS; i++) {
    sites = cells.map((cell, j) => (fixed[j] || cell.length < 3 ? sites[j] : centroid(cell)))
    cells = voronoiCells(sites, outline, radius * 2)
  }
  return cells
}

// The block nearest the middle of town that's a real block — not a sliver left over where a
// river or shoreline cut through a cell (those would put the seat's plaza on a riverbank).
function centralBlock(cells: Pt[][], centers: Pt[]): number {
  const areas = cells.map((c) => Math.abs(area(c)))
  const median = [...areas].sort((a, b) => a - b)[Math.floor(areas.length / 2)]
  let best = -1
  centers.forEach((c, i) => {
    if (areas[i] < median * 0.6) return
    if (best === -1 || Math.hypot(c.x, c.y) < Math.hypot(centers[best].x, centers[best].y)) best = i
  })
  return best === -1 ? 0 : best
}

// --- districts --------------------------------------------------------------------------

function assignDistricts(centers: Pt[], districtCount: number, seatSlot: number, seatBlock: number): number[] {
  // Seat seed: the central block (see centralBlock). Other seeds: farthest-point sampling, so
  // districts spread around it.
  const seeds: number[] = [seatBlock]
  while (seeds.length < districtCount) {
    let best = -1
    let bestDist = -1
    centers.forEach((c, i) => {
      if (seeds.includes(i)) return
      const d = Math.min(...seeds.map((s) => dist(c, centers[s])))
      if (d > bestDist) {
        bestDist = d
        best = i
      }
    })
    seeds.push(best)
  }
  // Seed 0 belongs to the seat; the rest go to the other districts in order around the town.
  const others = seeds.slice(1).sort((a, b) => Math.atan2(centers[a].y, centers[a].x) - Math.atan2(centers[b].y, centers[b].x))
  const slotForSeed = new Map<number, number>()
  slotForSeed.set(seeds[0], seatSlot)
  let next = 0
  for (const seed of others) {
    if (next === seatSlot) next++
    slotForSeed.set(seed, next++)
  }
  const orderedSeeds = [seeds[0], ...others]
  return centers.map((c) => {
    let best = orderedSeeds[0]
    let bestDist = Infinity
    for (const s of orderedSeeds) {
      // The seat claims a slightly larger area, so the center isn't a sliver.
      const d = dist(c, centers[s]) * (s === seeds[0] ? 0.85 : 1)
      if (d < bestDist) {
        bestDist = d
        best = s
      }
    }
    return slotForSeed.get(best)!
  })
}

// --- streets ----------------------------------------------------------------------------

type Graph = {
  points: Map<string, Pt>
  neighbors: Map<string, { to: string; length: number }[]>
  edgeCells: Map<string, number[]>
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function streetGraph(cells: Pt[][]): Graph {
  const points = new Map<string, Pt>()
  const neighbors = new Map<string, { to: string; length: number }[]>()
  const edgeCells = new Map<string, number[]>()
  cells.forEach((cell, ci) => {
    for (let i = 0; i < cell.length; i++) {
      const a = cell[i]
      const b = cell[(i + 1) % cell.length]
      const ka = keyOf(a)
      const kb = keyOf(b)
      if (ka === kb) continue
      points.set(ka, a)
      points.set(kb, b)
      const ek = edgeKey(ka, kb)
      if (!edgeCells.has(ek)) {
        edgeCells.set(ek, [])
        const length = dist(a, b)
        if (!neighbors.has(ka)) neighbors.set(ka, [])
        if (!neighbors.has(kb)) neighbors.set(kb, [])
        neighbors.get(ka)!.push({ to: kb, length })
        neighbors.get(kb)!.push({ to: ka, length })
      }
      edgeCells.get(ek)!.push(ci)
    }
  })
  return { points, neighbors, edgeCells }
}

function shortestPathTree(graph: Graph, from: string): Map<string, string> {
  const distance = new Map<string, number>([[from, 0]])
  const previous = new Map<string, string>()
  const open = new Set([from])
  while (open.size > 0) {
    let current = ''
    let best = Infinity
    for (const k of open) {
      const d = distance.get(k)!
      if (d < best) {
        best = d
        current = k
      }
    }
    open.delete(current)
    for (const { to, length } of graph.neighbors.get(current) ?? []) {
      const d = best + length
      if (d < (distance.get(to) ?? Infinity)) {
        distance.set(to, d)
        previous.set(to, current)
        open.add(to)
      }
    }
  }
  return previous
}

// --- lots -------------------------------------------------------------------------------

// Recursively slices a convex polygon across its longest edge until pieces reach lot size —
// so cuts run perpendicular to the street frontage, like rows of narrow medieval houses.
function subdivide(poly: Pt[], targetArea: number, rng: () => number, depth = 0): Pt[][] {
  if (Math.abs(area(poly)) < targetArea * 1.7 || depth > 9) return [poly]
  let longest = 0
  let longestLen = -1
  for (let i = 0; i < poly.length; i++) {
    const l = dist(poly[i], poly[(i + 1) % poly.length])
    if (l > longestLen) {
      longestLen = l
      longest = i
    }
  }
  const a = poly[longest]
  const b = poly[(longest + 1) % poly.length]
  const t = 0.38 + rng() * 0.24
  const cutPoint = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  // Cut line perpendicular to the longest edge, through cutPoint.
  const dir = { x: -(b.y - a.y), y: b.x - a.x }
  const left = clipHalfPlane(poly, cutPoint, dir, 0)
  const right = clipHalfPlane(poly, cutPoint, { x: -dir.x, y: -dir.y }, 0)
  if (left.length < 3 || right.length < 3) return [poly]
  return [...subdivide(left, targetArea, rng, depth + 1), ...subdivide(right, targetArea, rng, depth + 1)]
}

function shrink(poly: Pt[], by: number): Pt[] {
  return insetConvex(poly, poly.map(() => by))
}

// --- the plan ---------------------------------------------------------------------------

export function computeSettlementPlan(input: SettlementPlanInput): SettlementPlan {
  const rng = seededRngFromNumber(seedForString(input.seedSource))
  const type = input.settlementType
  const walled = type !== 'Village'
  const blockCount = BLOCK_COUNT[type]
  const radius = Math.sqrt((blockCount * BLOCK_AREA) / Math.PI)

  const shape = pickWeighted(SHAPE_ODDS[type], rng)
  const pattern = pickWeighted(PATTERN_ODDS[type], rng)
  // The grid's (and an elongated town's) main axis; gates line up with it.
  const axis = rng() * Math.PI
  let outline =
    shape === 'angular' ? angularOutline(radius, rng) : shape === 'elongated' ? elongatedOutline(radius, axis, rng) : roundOutline(radius, rng)

  // Water (see waterForHex). Coast: a straight cut through the outline at distance `seaCut`
  // toward the sea — the town keeps the land side, still convex. River: a straight band of
  // half-width `riverHalf` at offset `riverOffset` from the center, along `riverDir`; blocks are
  // split along its banks.
  const waterKind = input.water?.kind ?? null
  const waterAngle = input.water ? (input.water.angle ?? rng() * Math.PI * 2) : 0
  const seaDir = { x: Math.cos(waterAngle), y: Math.sin(waterAngle) }
  const seaCut = radius * (0.3 + rng() * 0.25)
  const riverDir = seaDir
  const riverNormal = { x: -riverDir.y, y: riverDir.x }
  const riverOffset = radius * (rng() - 0.5) * 0.3
  const riverHalf = RIVER_HALF_WIDTH[type]
  const dot = (p: Pt, d: Pt) => p.x * d.x + p.y * d.y
  if (waterKind === 'coast') {
    outline = clipHalfPlane(outline, { x: seaDir.x * seaCut, y: seaDir.y * seaCut }, { x: -seaDir.y, y: seaDir.x }, 0)
  }
  const onSeaLine = (p: Pt) => waterKind === 'coast' && Math.abs(dot(p, seaDir) - seaCut) < 1e-3
  const riverDistance = (p: Pt) => Math.abs(dot(p, riverNormal) - riverOffset)
  const inRiver = (p: Pt, margin: number) => waterKind === 'river' && riverDistance(p) < riverHalf + margin

  const { sites, fixed } = blockSites(pattern, blockCount, outline, radius, axis, rng)
  let cells = relaxedBlocks(sites, fixed, outline, radius).filter((c) => c.length >= 3)
  if (waterKind === 'river') {
    const bankA = { x: riverNormal.x * (riverOffset + riverHalf), y: riverNormal.y * (riverOffset + riverHalf) }
    const bankB = { x: riverNormal.x * (riverOffset - riverHalf), y: riverNormal.y * (riverOffset - riverHalf) }
    cells = cells.flatMap((cell) => [
      clipHalfPlane(cell, bankA, riverDir, 0),
      clipHalfPlane(cell, bankB, { x: -riverDir.x, y: -riverDir.y }, 0),
    ])
  }
  cells = cells.filter((c) => c.length >= 3 && Math.abs(area(c)) > 2)
  const centers = cells.map(centroid)

  const seatSlot = Math.max(0, input.districts.findIndex((d) => d.isSeatOfGovernment))
  const districtCount = Math.min(input.districts.length, cells.length)
  const seatBlock = centralBlock(cells, centers)
  const slotOf = assignDistricts(centers, Math.max(1, districtCount), seatSlot, seatBlock)
  const districtOf = (i: number) => input.districts[slotOf[i]] ?? input.districts[0]

  // Streets, gates and main roads.
  const graph = streetGraph(cells)
  // Gate candidates: vertices on the town's outer edge that face land (not the sea frontage,
  // not a river bank).
  const gateCandidates = new Set<string>()
  for (const [ek, owners] of graph.edgeCells) {
    if (owners.length !== 1) continue
    for (const k of ek.split('|')) {
      const p = graph.points.get(k)!
      if (distanceToEdges(p, outline) > 1e-3) continue
      if (waterKind === 'coast' && dot(p, seaDir) > seaCut - 2) continue
      if (inRiver(p, 2)) continue
      gateCandidates.add(k)
    }
  }
  // The seat block's corner nearest the middle of town — on a grid, the crossing of the avenues.
  const centerKey = cells[seatBlock]
    .map(keyOf)
    .reduce((best, k) => (Math.hypot(graph.points.get(k)!.x, graph.points.get(k)!.y) < Math.hypot(graph.points.get(best)!.x, graph.points.get(best)!.y) ? k : best))

  // Bridges: main roads cross the river at 1-2 points, bank vertex to the facing bank vertex.
  const bridges: [Pt, Pt][] = []
  if (waterKind === 'river') {
    const bankKeys = (side: 1 | -1) =>
      [...graph.points.keys()].filter((k) => Math.abs(dot(graph.points.get(k)!, riverNormal) - (riverOffset + side * riverHalf)) < 1e-3)
    const sideA = bankKeys(1)
    const sideB = bankKeys(-1)
    const spots = type === 'Village' || type === 'Town' ? [0] : [-radius * 0.35, radius * 0.35]
    for (const t of spots) {
      const target = {
        x: riverNormal.x * (riverOffset + riverHalf) + riverDir.x * t,
        y: riverNormal.y * (riverOffset + riverHalf) + riverDir.y * t,
      }
      const a = sideA.reduce<string | null>((best, k) => (best === null || dist(graph.points.get(k)!, target) < dist(graph.points.get(best)!, target) ? k : best), null)
      if (!a) continue
      const across = { x: graph.points.get(a)!.x - riverNormal.x * riverHalf * 2, y: graph.points.get(a)!.y - riverNormal.y * riverHalf * 2 }
      const b = sideB.reduce<string | null>((best, k) => (best === null || dist(graph.points.get(k)!, across) < dist(graph.points.get(best)!, across) ? k : best), null)
      if (!b) continue
      const length = dist(graph.points.get(a)!, graph.points.get(b)!)
      graph.neighbors.get(a)!.push({ to: b, length })
      graph.neighbors.get(b)!.push({ to: a, length })
      bridges.push([graph.points.get(a)!, graph.points.get(b)!])
    }
  }

  const gateCount = GATE_COUNT[type]
  // Gates: on a coast, spread around the land side; on a grid, where the avenues meet the
  // wall; on an elongated town, at its two ends first; otherwise evenly around a random start.
  const gateOffset = rng() * Math.PI * 2
  const gateAngles = Array.from({ length: gateCount }, (_, g) => {
    if (waterKind === 'coast') return waterAngle + Math.PI + (g - (gateCount - 1) / 2) * ((Math.PI * 1.2) / gateCount)
    if (pattern === 'grid' || pattern === 'gridCore') return axis + (g * Math.PI) / 2
    if (shape === 'elongated') return axis + [0, Math.PI, Math.PI / 2, (3 * Math.PI) / 2][g % 4]
    return gateOffset + (g / gateCount) * Math.PI * 2
  })
  const gateKeys: string[] = []
  for (const target of gateAngles) {
    let best = ''
    let bestDelta = Infinity
    for (const k of gateCandidates) {
      if (gateKeys.includes(k)) continue
      const p = graph.points.get(k)!
      let delta = Math.abs(Math.atan2(p.y, p.x) - Math.atan2(Math.sin(target), Math.cos(target)))
      delta = Math.min(delta, Math.PI * 2 - delta)
      if (delta < bestDelta) {
        bestDelta = delta
        best = k
      }
    }
    if (best) gateKeys.push(best)
  }
  // Coast: a harbor on the shore, straight out from the middle of town, also gets a main road.
  let harborKey: string | null = null
  if (waterKind === 'coast') {
    const shoreMid = { x: seaDir.x * seaCut, y: seaDir.y * seaCut }
    for (const k of graph.points.keys()) {
      if (!onSeaLine(graph.points.get(k)!)) continue
      if (harborKey === null || dist(graph.points.get(k)!, shoreMid) < dist(graph.points.get(harborKey)!, shoreMid)) harborKey = k
    }
  }
  const tree = shortestPathTree(graph, centerKey)
  const mainEdges = new Set<string>()
  for (const gate of harborKey ? [...gateKeys, harborKey] : gateKeys) {
    let current = gate
    while (current !== centerKey && tree.has(current)) {
      const prev = tree.get(current)!
      mainEdges.add(edgeKey(current, prev))
      current = prev
    }
  }

  // Blocks: special kinds first, then lots.
  const templeBlockFor = new Map<string, number>()
  input.districts.forEach((d) => {
    if (d.districtType !== 'Temple District') return
    let best = -1
    cells.forEach((_, i) => {
      if (districtOf(i).id !== d.id || i === seatBlock) return
      if (best === -1 || Math.hypot(centers[i].x, centers[i].y) < Math.hypot(centers[best].x, centers[best].y)) best = i
    })
    if (best !== -1) templeBlockFor.set(d.id, best)
  })
  const templeBlocks = new Set(templeBlockFor.values())

  const blocks: Block[] = cells.map((cell, i) => {
    const district = districtOf(i)
    const distances = cell.map((a, e) => {
      const b = cell[(e + 1) % cell.length]
      const ek = edgeKey(keyOf(a), keyOf(b))
      if ((graph.edgeCells.get(ek)?.length ?? 2) === 1) return WALL_GAP
      return mainEdges.has(ek) ? MAIN_ROAD_HALF : STREET_HALF
    })
    const inset = insetConvex(cell, distances)
    const shape = inset.length >= 3 && Math.abs(area(inset)) > 3 ? inset : null
    const base: Block = { districtId: district.id, cell, shape, kind: 'buildings', lots: [], trees: [] }
    if (!shape) return { ...base, kind: 'plaza' }
    if (i === seatBlock) return { ...base, kind: district.districtType === 'Castle District' ? 'castle' : 'plaza' }
    if (templeBlocks.has(i)) return { ...base, kind: 'temple' }
    if (!walled) {
      // Villages: only plots along the main roads are built up; the rest stay fields.
      const onRoad = cell.some((a, e) => mainEdges.has(edgeKey(keyOf(a), keyOf(cell[(e + 1) % cell.length]))))
      if (!onRoad) {
        if (rng() < 0.5) return { ...base, kind: 'meadow' }
        return { ...base, kind: 'field', lots: [{ poly: shape, kind: 'yard', color: FIELD_COLORS[Math.floor(rng() * FIELD_COLORS.length)] }] }
      }
    }
    if (rng() < GARDEN_CHANCE[district.districtType] * (walled ? 1 : 0.5)) {
      const c = centroid(shape)
      const trees = Array.from({ length: 4 + Math.floor(rng() * 4) }, () => {
        const p = { x: c.x + (rng() - 0.5) * 3.5, y: c.y + (rng() - 0.5) * 3.5 }
        return { at: p, r: 0.6 + rng() * 0.5 }
      }).filter((t) => pointInConvex(t.at, shape))
      return { ...base, kind: 'garden', trees }
    }
    const palette = ROOF_COLORS[district.districtType]
    const lots: Lot[] = subdivide(shape, LOT_AREA[district.districtType] * (walled ? 1 : 1.8), rng)
      .map((piece) => {
        const lot = shrink(piece, LOT_GAP)
        if (lot.length < 3) return null
        const interior = distanceToEdges(centroid(lot), shape) > 2.1
        // Villages are loose: many plots stay open ground.
        const openPlot = interior || (!walled && rng() < 0.35)
        const kind: Lot['kind'] = openPlot ? (rng() < 0.3 ? 'tree' : 'yard') : 'building'
        return { poly: lot, kind, color: palette[Math.floor(rng() * palette.length)] }
      })
      .filter((lot): lot is Lot => lot !== null)
    return { ...base, lots }
  })

  // District borders and labels.
  const districtBorders: [Pt, Pt][] = []
  for (const [ek, owners] of graph.edgeCells) {
    if (owners.length === 2 && districtOf(owners[0]).id !== districtOf(owners[1]).id) {
      const [ka, kb] = ek.split('|')
      districtBorders.push([graph.points.get(ka)!, graph.points.get(kb)!])
    }
  }
  const districtLabels = input.districts.map((d) => {
    const all = cells.map((_, i) => i).filter((i) => districtOf(i).id === d.id)
    // Prefer built-up blocks, so a village's marker sits on its houses rather than a field.
    const built = all.filter((i) => blocks[i].kind !== 'buildings' ? blocks[i].kind !== 'field' && blocks[i].kind !== 'meadow' : blocks[i].lots.some((l) => l.kind === 'building'))
    const mine = built.length > 0 ? built : all
    if (mine.length === 0) return { districtId: d.id, at: { x: 0, y: 0 } }
    const avg = {
      x: mine.reduce((s, i) => s + centers[i].x, 0) / mine.length,
      y: mine.reduce((s, i) => s + centers[i].y, 0) / mine.length,
    }
    // Put the marker on the district's block nearest its average position.
    const nearest = mine.reduce((best, i) => (dist(centers[i], avg) < dist(centers[best], avg) ? i : best))
    return { districtId: d.id, at: centers[nearest] }
  })

  // Wall, towers, gates and the roads leading out.
  const gates = gateKeys.map((k) => {
    const p = graph.points.get(k)!
    return { at: p, angle: Math.atan2(p.y, p.x) }
  })
  // Distance from the center to the town's edge in a given direction (the outline is convex).
  const edgeDistance = (angle: number) => {
    let best = outline[0]
    let bestDelta = Infinity
    for (const p of outline) {
      let delta = Math.abs(Math.atan2(p.y, p.x) - angle) % (Math.PI * 2)
      delta = Math.min(delta, Math.PI * 2 - delta)
      if (delta < bestDelta) {
        bestDelta = delta
        best = p
      }
    }
    return Math.hypot(best.x, best.y)
  }

  // Wall: every outline edge except the sea frontage, with the river's crossing cut out.
  const wallSegments: [Pt, Pt][] = []
  if (walled) {
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i]
      const b = outline[(i + 1) % outline.length]
      if (onSeaLine(a) && onSeaLine(b)) continue
      if (waterKind !== 'river') {
        wallSegments.push([a, b])
        continue
      }
      // Keep the parts of the edge outside the river band (plus a little room for the water gate).
      const da = dot(a, riverNormal) - riverOffset
      const db = dot(b, riverNormal) - riverOffset
      const limit = riverHalf + 0.6
      const at = (v: number) => {
        const t = (v - da) / (db - da)
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      }
      const pieces: [number, number][] = [[-Infinity, -limit], [limit, Infinity]]
      for (const [lo, hi] of pieces) {
        const from = Math.max(Math.min(da, db), lo)
        const to = Math.min(Math.max(da, db), hi)
        if (to - from < 1e-6) continue
        const p1 = Math.abs(da - db) < 1e-9 ? a : at(from)
        const p2 = Math.abs(da - db) < 1e-9 ? b : at(to)
        wallSegments.push(da <= db ? [p1, p2] : [p2, p1])
      }
    }
  }

  const bastions = walled && shape === 'angular' ? outline.filter((p) => !onSeaLine(p) && !inRiver(p, 1)) : []
  const towers: Pt[] = []
  if (walled) {
    const spacing = 6
    for (const [a, b] of wallSegments) {
      const steps = Math.max(1, Math.round(dist(a, b) / spacing))
      for (let s = 0; s < steps; s++) {
        const p = { x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps }
        if (towers.some((t) => dist(t, p) < spacing * 0.8)) continue
        if (bastions.some((t) => dist(t, p) < spacing * 0.7)) continue
        if (gates.some((g) => dist(g.at, p) < 3)) continue
        towers.push(p)
      }
      // A tower at the end of each run, so the wall ends cleanly at the shore or river.
      if (!towers.some((t) => dist(t, b) < 2)) towers.push(b)
    }
  }

  // Old-town pattern: an inner wall around the blocks near the center, with gaps where the
  // main roads pass through.
  const innerWall: [Pt, Pt][] = []
  const innerTowers: Pt[] = []
  if (pattern === 'oldTown') {
    const innerRadius = radius * (0.42 + rng() * 0.12)
    const isInner = centers.map((c) => Math.hypot(c.x, c.y) < innerRadius)
    for (const [ek, owners] of graph.edgeCells) {
      if (owners.length !== 2 || isInner[owners[0]] === isInner[owners[1]] || mainEdges.has(ek)) continue
      const [ka, kb] = ek.split('|')
      const a = graph.points.get(ka)!
      const b = graph.points.get(kb)!
      innerWall.push([a, b])
      for (const p of [a, b]) if (!innerTowers.some((t) => dist(t, p) < 4.5)) innerTowers.push(p)
    }
  }

  const outerRoads = gates.map((g) => {
    const bend = (rng() - 0.5) * 0.5
    const from = Math.hypot(g.at.x, g.at.y)
    const mid = { x: Math.cos(g.angle + bend * 0.5) * (from + radius * 0.3), y: Math.sin(g.angle + bend * 0.5) * (from + radius * 0.3) }
    const end = { x: Math.cos(g.angle + bend) * (from + radius * 0.75), y: Math.sin(g.angle + bend) * (from + radius * 0.75) }
    return [g.at, mid, end]
  })

  // Nothing grows in the water.
  const isWet = (p: Pt, margin: number) =>
    (waterKind === 'coast' && dot(p, seaDir) > seaCut - margin) || (waterKind === 'river' && riverDistance(p) < riverHalf + margin + 1.5)

  // Suburbs: houses on both sides of the road leading out of some gates, starting just past the
  // wall, with gaps here and there.
  const suburbs: SettlementPlan['suburbs'] = []
  if (walled && outerRoads.length > 0) {
    const [minGates, maxGates] = SUBURB_GATES[type]
    const gateCountWithSuburbs = Math.min(outerRoads.length, minGates + Math.floor(rng() * (maxGates - minGates + 1)))
    const order = outerRoads.map((_, i) => i)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    const roadPoint = (road: Pt[], t: number) => ({
      x: (1 - t) * (1 - t) * road[0].x + 2 * (1 - t) * t * road[1].x + t * t * road[2].x,
      y: (1 - t) * (1 - t) * road[0].y + 2 * (1 - t) * t * road[1].y + t * t * road[2].y,
    })
    const houseCenters: Pt[] = []
    for (const roadIndex of order.slice(0, gateCountWithSuburbs)) {
      const road = outerRoads[roadIndex]
      // Approximate the curve's length to turn "units along the road" into curve positions.
      let length = 0
      for (let i = 1; i <= 20; i++) length += dist(roadPoint(road, (i - 1) / 20), roadPoint(road, i / 20))
      const runLength = SUBURB_LENGTH[type] * (0.75 + rng() * 0.5)
      for (let along = 2.4; along < runLength; along += 2 + rng() * 0.5) {
        const t = along / length
        if (t > 0.95) break
        const here = roadPoint(road, t)
        const ahead = roadPoint(road, Math.min(1, t + 0.01))
        const dir = { x: ahead.x - here.x, y: ahead.y - here.y }
        const len = Math.hypot(dir.x, dir.y) || 1
        const u = { x: dir.x / len, y: dir.y / len }
        const n = { x: -u.y, y: u.x }
        // Front row on each side of the road, and sometimes a second row behind it — thinning out
        // toward the far end of the run.
        const fade = along / runLength
        const slots = [-1, 1].flatMap((side) => [
          { side, row: 0 },
          ...(rng() < 0.55 * (1 - fade) ? [{ side, row: 1 }] : []),
        ])
        for (const { side, row } of slots) {
          if (rng() < 0.1 + fade * 0.25) continue
          const w = 1.5 + rng() * 0.8
          const h = 1.2 + rng() * 0.6
          const offset = 1.5 + h / 2 + rng() * 0.3 + row * 2.2
          const c = { x: here.x + n.x * side * offset, y: here.y + n.y * side * offset }
          if (pointInConvex(c, outline) || distanceToEdges(c, outline) < 1.6 || isWet(c, 1)) continue
          if (houseCenters.some((q) => dist(q, c) < 1.9)) continue
          houseCenters.push(c)
          const corners = [
            [-w / 2, -h / 2],
            [w / 2, -h / 2],
            [w / 2, h / 2],
            [-w / 2, h / 2],
          ].map(([du, dn]) => ({ x: c.x + u.x * du + n.x * dn, y: c.y + u.y * du + n.y * dn }))
          suburbs.push({ poly: corners, color: SUBURB_COLORS[Math.floor(rng() * SUBURB_COLORS.length)] })
        }
      }
    }
  }
  const nearSuburb = (p: Pt, margin: number) => suburbs.some((house) => dist(centroid(house.poly), p) < margin)

  // Farmland and trees outside the town, following its outline.
  const fields: SettlementPlan['fields'] = []
  const fieldCount = Math.round(blockCount * 0.45)
  for (let i = 0; i < fieldCount; i++) {
    const angle = rng() * Math.PI * 2
    const r = edgeDistance(angle) + radius * (0.18 + rng() * 0.32)
    const c = { x: Math.cos(angle) * r, y: Math.sin(angle) * r }
    const w = 3 + rng() * 4
    const h = 2.2 + rng() * 3
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const corners = [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ].map(([dx, dy]) => ({ x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos }))
    if (corners.some((corner) => isWet(corner, 1)) || nearSuburb(c, 4.5)) continue
    fields.push({ poly: corners, color: FIELD_COLORS[Math.floor(rng() * FIELD_COLORS.length)] })
  }
  const outsideTrees: SettlementPlan['outsideTrees'] = []
  const clumps = Math.round(blockCount * 0.25)
  for (let i = 0; i < clumps; i++) {
    const angle = rng() * Math.PI * 2
    const r = edgeDistance(angle) + radius * (0.12 + rng() * 0.42)
    const c = { x: Math.cos(angle) * r, y: Math.sin(angle) * r }
    const n = 3 + Math.floor(rng() * 5)
    for (let j = 0; j < n; j++) {
      const at = { x: c.x + (rng() - 0.5) * 3.5, y: c.y + (rng() - 0.5) * 3.5 }
      if (!isWet(at, 1) && !nearSuburb(at, 1.6)) outsideTrees.push({ at, r: 0.6 + rng() * 0.5 })
    }
  }

  const mainRoads: [Pt, Pt][] = [...mainEdges].map((ek) => {
    const [ka, kb] = ek.split('|')
    return [graph.points.get(ka)!, graph.points.get(kb)!]
  })

  // A square map: the town's farthest edge plus a band of countryside.
  const extent = Math.max(...outline.map((p) => Math.hypot(p.x, p.y))) + radius * 0.5

  // Water shapes. Edges stay close to the straight line inside the town (within the quay gap
  // the blocks already leave) and wander more freely out in the countryside.
  let water: PlanWater | null = null
  if (waterKind) {
    const noise = smoothNoise(rng)
    const reach = extent * 1.6
    const townHalf = radius * 1.1
    const freedom = (t: number) => Math.min(1, Math.max(0, (Math.abs(t) - townHalf) / (radius * 0.6)))
    if (waterKind === 'coast') {
      const along = { x: -seaDir.y, y: seaDir.x }
      const shore: Pt[] = []
      for (let t = -reach; t <= reach; t += 0.8) {
        const out = seaCut + 0.35 + 0.35 * (noise(t) + 1) * (1 - freedom(t)) + (noise(t * 0.5 + 40) * 3) * freedom(t)
        shore.push({ x: along.x * t + seaDir.x * out, y: along.y * t + seaDir.y * out })
      }
      const far = (t: number) => ({ x: along.x * t + seaDir.x * reach * 2, y: along.y * t + seaDir.y * reach * 2 })
      const sea = [...shore, far(reach), far(-reach)]
      const piers: [Pt, Pt][] = []
      const shoreVertices = [...graph.points.values()].filter(onSeaLine)
      const pierRoots = harborKey ? [graph.points.get(harborKey)!] : []
      for (const p of shoreVertices) {
        if (pierRoots.length >= (type === 'Village' ? 1 : 3)) break
        if (pierRoots.every((q) => dist(p, q) > 6)) pierRoots.push(p)
      }
      for (const p of pierRoots) {
        piers.push([
          { x: p.x + seaDir.x * 0.6, y: p.y + seaDir.y * 0.6 },
          { x: p.x + seaDir.x * 4.5, y: p.y + seaDir.y * 4.5 },
        ])
      }
      water = { kind: 'coast', angle: waterAngle, sea, shore, piers }
    } else {
      const left: Pt[] = []
      const right: Pt[] = []
      for (let t = -reach; t <= reach; t += 0.8) {
        const wander = noise(t * 0.35) * 4 * freedom(t)
        const width = riverHalf * (1 + 0.08 * noise(t + 17))
        const c = { x: riverNormal.x * (riverOffset + wander) + riverDir.x * t, y: riverNormal.y * (riverOffset + wander) + riverDir.y * t }
        left.push({ x: c.x + riverNormal.x * width, y: c.y + riverNormal.y * width })
        right.push({ x: c.x - riverNormal.x * width, y: c.y - riverNormal.y * width })
      }
      water = { kind: 'river', angle: waterAngle, river: [...left, ...right.reverse()], bridges }
    }
  }

  return {
    shape,
    pattern,
    water,
    wallSegments,
    mainRoads,
    bounds: { minX: -extent, minY: -extent, maxX: extent, maxY: extent },
    outline,
    walled,
    towers,
    bastions,
    innerWall,
    innerTowers,
    gates,
    outerRoads,
    blocks,
    districtBorders,
    districtLabels,
    fields,
    outsideTrees,
    suburbs,
  }
}
