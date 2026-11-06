// The course of a town map's river through its hex (PLAN.md punch-list item 2, 2026-11-06).
// Pure geometry, independent of the settlement plan and of React, so it can be unit-tested edge
// by edge.
//
// Ported from map_generator's src/engine/riverCourse.ts (its punch-list 1b, PR #1). Changes:
// - Pointy-top hexes with the WFC tiles' named edges (HexDir: NE, E, SE, SW, W, NW) instead of
//   map_generator's flat-top numbered directions. The edge angles (EDGE_ANGLE_DEG) moved here
//   from settlementPlan.ts so both files share them.
// - riverCourseFromEdges (new): a WFC tile's river edges carry no flow direction, so this turns
//   them into the entries/exit riverCourseInHex takes (see its comment).
//
// The hex/square convention: the town map is a square of half-size `apothem` centred on the
// town. The hex is a notional pointy-top hex of that apothem, centred on the town, so its six
// edge midpoints sit at `apothem` from the centre in the six edge directions (E at 0°, SE at
// 60°, ... — y down). The E and W midpoints land on the map's border; the four diagonal ones
// sit inside it. The hex itself is never drawn; it only fixes where the river has to cross the
// map's edge so that it lines up with the overland map's river edges.
//
// Courses:
// - through: a cubic from the entry midpoint to the exit midpoint with both control points at
//   the town centre (perpendicular to each edge at its ends). A 60° pair (adjacent edges) makes a
//   tight U-bend inside the town; a 120° pair (RIVER_B) a gentle bend through the middle. An
//   opposite pair (RIVER_A) is straight, offset by the plan's seeded ±0.15R so straight rivers
//   look like before — done by moving the shared control point so the curve still starts and
//   ends at the midpoints.
// - spring (no entry): a straight line from the town centre to the exit midpoint.
// - ending (no exit): a straight line from the entry midpoint to the town centre (RIVER_END).
// Beyond the hex the plan continues each arm radially to the map's border (this file only
// covers the part inside the hex).
//
// Several entries (a junction, RIVER_D/E/F): one arm per entry, each to the exit; they overlap
// near the exit, which reads as two rivers joining (user approved, 2026-11-06). An entry equal
// to the exit is dropped. No entries and no exit: the caller's
// `fallbackExit` (or E) is used and the river is drawn as a spring toward it.

import type { HexDir } from '../wfc/tiles'

export type Pt = { x: number; y: number }

export type RiverCourseKind = 'through' | 'spring' | 'ending'

export type RiverCourse = {
  kind: RiverCourseKind
  // The edges actually drawn (after dropping an entry equal to the exit, and after the fallback
  // exit is applied).
  entries: HexDir[]
  exit: HexDir | null
  // One polyline per arm, inside the hex: through = entry midpoint → exit midpoint; spring =
  // centre → exit midpoint; ending = entry midpoint → centre.
  arms: Pt[][]
}

// Angles on the town map's frame (degrees, y down): pointy-top edge NE is -60°, E 0°, ...
export const EDGE_ANGLE_DEG: Record<HexDir, number> = { NE: -60, E: 0, SE: 60, SW: 120, W: 180, NW: 240 }
const DIRS: HexDir[] = ['NE', 'E', 'SE', 'SW', 'W', 'NW']

export function edgeAngle(d: HexDir): number {
  return (EDGE_ANGLE_DEG[d] * Math.PI) / 180
}

export function oppositeEdge(d: HexDir): HexDir {
  return DIRS[(DIRS.indexOf(d) + 3) % 6]
}

// The edge whose direction is nearest `angle` (radians, y down).
export function nearestEdge(angle: number): HexDir {
  let best: HexDir = 'E'
  let bestGap = Infinity
  for (const d of DIRS) {
    const gap = Math.abs(Math.atan2(Math.sin(angle - edgeAngle(d)), Math.cos(angle - edgeAngle(d))))
    if (gap < bestGap) {
      bestGap = gap
      best = d
    }
  }
  return best
}

// Samples per arm. Segments of about 0.6 units on a Town map: fine enough that the drawn
// polyline reads as a curve at the U-bend, coarse enough that distance queries stay cheap.
export const COURSE_SAMPLES = 120

// The midpoint of the hex edge `d`, for a pointy-top hex of this apothem.
export function hexEdgeMidpoint(d: HexDir, apothem: number): Pt {
  const a = edgeAngle(d)
  return { x: Math.cos(a) * apothem, y: Math.sin(a) * apothem }
}

// A tile's river edges, which have no flow direction, as entries and an exit:
// - one edge (RIVER_END): the river ends in town (entries [edge], no exit);
// - two edges (RIVER_A, RIVER_B, crossings): in through the first, out through the second;
// - three or more (junctions): the exit is the edge farthest from the others (the trunk of
//   RIVER_E's and RIVER_F's Y, any edge of RIVER_D's even three-way split, ties going to the
//   earlier edge in NE, E, SE, SW, W, NW order); the rest flow into it;
// - none (a hex with no tile whose neighbors don't say which way, e.g. the /poi review page):
//   a straight river across the seed's pick of edge, `pick` in [0, 1).
export function riverCourseFromEdges(edges: readonly HexDir[], pick = 0): { entries: HexDir[]; exit: HexDir | null } {
  const unique = DIRS.filter((d) => edges.includes(d))
  if (unique.length === 0) {
    const d = DIRS[Math.min(5, Math.floor(pick * 6))]
    return { entries: [oppositeEdge(d)], exit: d }
  }
  if (unique.length === 1) return { entries: unique, exit: null }
  if (unique.length === 2) {
    // Keep the caller's order (the first listed edge is the entry).
    const first = edges.find((d) => unique.includes(d))!
    return { entries: [first], exit: unique.find((d) => d !== first)! }
  }
  const gap = (a: HexDir, b: HexDir) => {
    const steps = Math.abs(DIRS.indexOf(a) - DIRS.indexOf(b))
    return Math.min(steps, 6 - steps)
  }
  const spread = (d: HexDir) => unique.reduce((sum, other) => sum + gap(d, other), 0)
  const exit = unique.reduce((best, d) => (spread(d) > spread(best) ? d : best))
  return { entries: unique.filter((d) => d !== exit), exit }
}

// A cubic Bézier sampled into a polyline (endpoints included).
function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, samples: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const u = 1 - t
    const w0 = u * u * u
    const w1 = 3 * u * u * t
    const w2 = 3 * u * t * t
    const w3 = t * t * t
    out.push({ x: w0 * p0.x + w1 * p1.x + w2 * p2.x + w3 * p3.x, y: w0 * p0.y + w1 * p1.y + w2 * p2.y + w3 * p3.y })
  }
  return out
}

function line(from: Pt, to: Pt, samples: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    out.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
  }
  return out
}

export function isOppositePair(a: HexDir, b: HexDir): boolean {
  return oppositeEdge(a) === b
}

// `straightOffset`: for an opposite-edge (straight) pair only, how far (signed, in map units)
// the river passes from the centre. The shared control point moves to offset / 0.75 along the
// pair's normal so the curve's middle lands at exactly `straightOffset` while its ends stay on
// the edge midpoints.
export function riverCourseInHex(
  entriesIn: readonly HexDir[],
  exitIn: HexDir | null,
  apothem: number,
  fallbackExit: HexDir | null = null,
  straightOffset = 0,
): RiverCourse {
  const centre: Pt = { x: 0, y: 0 }
  let exit = exitIn
  const entries = [...new Set(entriesIn)].filter((d) => d !== exit)
  if (exit === null && entries.length === 0) exit = fallbackExit ?? 'E'

  if (exit !== null && entries.length === 0) {
    return { kind: 'spring', entries, exit, arms: [line(centre, hexEdgeMidpoint(exit, apothem), COURSE_SAMPLES)] }
  }
  if (exit === null) {
    return { kind: 'ending', entries, exit, arms: entries.map((e) => line(hexEdgeMidpoint(e, apothem), centre, COURSE_SAMPLES)) }
  }
  const out = exit
  const to = hexEdgeMidpoint(out, apothem)
  const arms = entries.map((e) => {
    const from = hexEdgeMidpoint(e, apothem)
    let control = centre
    if (isOppositePair(e, out) && straightOffset !== 0) {
      // Normal of the straight pair: the curve's middle is 0.75 × control for a cubic whose two
      // control points coincide, so control = offset / 0.75 along the normal.
      const dx = to.x - from.x
      const dy = to.y - from.y
      const len = Math.hypot(dx, dy) || 1
      const n = { x: -dy / len, y: dx / len }
      control = { x: (n.x * straightOffset) / 0.75, y: (n.y * straightOffset) / 0.75 }
    }
    return cubic(from, control, control, to, COURSE_SAMPLES)
  })
  return { kind: 'through', entries, exit, arms }
}

// --- distance to a set of polylines (shared by the plan's cutting, wall gaps and wet checks) ---

export type NearestOnCourse = { point: Pt; tangent: Pt; distance: number; arm: number; segment: number }

// Squared distance from p to segment ab (no allocation: this runs in tight loops).
function segmentDistance2(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1
  let t = ((px - a.x) * dx + (py - a.y) * dy) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const qx = a.x + dx * t - px
  const qy = a.y + dy * t - py
  return qx * qx + qy * qy
}

export function nearestOnPolylines(p: Pt, arms: Pt[][]): NearestOnCourse {
  let bestD2 = Infinity
  let bestArm = -1
  let bestSeg = -1
  for (let ai = 0; ai < arms.length; ai++) {
    const arm = arms[ai]
    for (let i = 0; i + 1 < arm.length; i++) {
      const d2 = segmentDistance2(p.x, p.y, arm[i], arm[i + 1])
      if (d2 < bestD2) {
        bestD2 = d2
        bestArm = ai
        bestSeg = i
      }
    }
  }
  if (bestArm === -1) return { point: { x: NaN, y: NaN }, tangent: { x: 1, y: 0 }, distance: Infinity, arm: -1, segment: -1 }
  const a = arms[bestArm][bestSeg]
  const b = arms[bestArm][bestSeg + 1]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  const len = Math.sqrt(len2)
  return { point: { x: a.x + dx * t, y: a.y + dy * t }, tangent: { x: dx / len, y: dy / len }, distance: Math.sqrt(bestD2), arm: bestArm, segment: bestSeg }
}

export function distanceToPolylines(p: Pt, arms: Pt[][]): number {
  let bestD2 = Infinity
  for (let ai = 0; ai < arms.length; ai++) {
    const arm = arms[ai]
    for (let i = 0; i + 1 < arm.length; i++) {
      const d2 = segmentDistance2(p.x, p.y, arm[i], arm[i + 1])
      if (d2 < bestD2) bestD2 = d2
    }
  }
  return Math.sqrt(bestD2)
}
