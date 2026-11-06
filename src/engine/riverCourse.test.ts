// Geometry tests for the town map's river course (PLAN.md punch-list item 2), independent of the
// settlement plan and of React. The notional hex is pointy-top with apothem A, centred on the
// town; the table below hard-codes where each edge's midpoint must be (y down), so a mirrored or
// rotated edge mapping fails loudly. Adapted from map_generator's riverCourse.test.ts (flat-top).
import { describe, expect, it } from 'vitest'
import {
  COURSE_SAMPLES,
  distanceToPolylines,
  hexEdgeMidpoint,
  nearestEdge,
  nearestOnPolylines,
  oppositeEdge,
  riverCourseFromEdges,
  riverCourseInHex,
  type Pt,
} from './riverCourse'
import { HEX_DIRS, type HexDir } from '../wfc/tiles'

const A = 60
const S3 = Math.sqrt(3) / 2

// Pointy-top layout, y down: E and W edges are vertical, so their midpoints sit on the x axis.
const EXPECTED_MIDPOINT: Record<HexDir, Pt> = {
  NE: { x: 0.5 * A, y: -S3 * A },
  E: { x: A, y: 0 },
  SE: { x: 0.5 * A, y: S3 * A },
  SW: { x: -0.5 * A, y: S3 * A },
  W: { x: -A, y: 0 },
  NW: { x: -0.5 * A, y: -S3 * A },
}

// Signed "how far outside the hex" a point is: max over the six edges of (n_d · p − A). Zero on
// the boundary, negative inside.
function hexExcess(p: Pt): number {
  return Math.max(...HEX_DIRS.map((d) => (p.x * EXPECTED_MIDPOINT[d].x + p.y * EXPECTED_MIDPOINT[d].y) / A - A))
}

function edgeOf(p: Pt): HexDir | null {
  const onEdges = HEX_DIRS.filter((d) => Math.abs((p.x * EXPECTED_MIDPOINT[d].x + p.y * EXPECTED_MIDPOINT[d].y) / A - A) < 1e-6)
  return onEdges.length === 1 ? onEdges[0] : null
}

const near = (p: Pt, q: Pt, eps = 1e-6) => Math.hypot(p.x - q.x, p.y - q.y) < eps

describe('hexEdgeMidpoint', () => {
  it.each(HEX_DIRS)('edge %s lands on the pointy-top table, on its own edge', (d) => {
    expect(near(hexEdgeMidpoint(d, A), EXPECTED_MIDPOINT[d], 1e-9)).toBe(true)
    expect(hexExcess(EXPECTED_MIDPOINT[d])).toBeCloseTo(0, 9)
    expect(edgeOf(EXPECTED_MIDPOINT[d])).toBe(d)
  })

  it('oppositeEdge and nearestEdge agree with the table', () => {
    for (const d of HEX_DIRS) {
      const o = oppositeEdge(d)
      expect(near(EXPECTED_MIDPOINT[o], { x: -EXPECTED_MIDPOINT[d].x, y: -EXPECTED_MIDPOINT[d].y }, 1e-9)).toBe(true)
      expect(nearestEdge(Math.atan2(EXPECTED_MIDPOINT[d].y, EXPECTED_MIDPOINT[d].x) + 0.4)).toBe(d)
    }
  })
})

describe('through rivers: all 30 ordered entry/exit pairs', () => {
  const pairs = HEX_DIRS.flatMap((e) => HEX_DIRS.filter((x) => x !== e).map((x) => [e, x] as const))

  it.each(pairs)('%s → %s touches the hex only at those two midpoints', (entry, exit) => {
    const course = riverCourseInHex([entry], exit, A)
    expect(course.kind).toBe('through')
    expect(course.arms).toHaveLength(1)
    const arm = course.arms[0]
    expect(arm).toHaveLength(COURSE_SAMPLES + 1)
    expect(near(arm[0], EXPECTED_MIDPOINT[entry])).toBe(true)
    expect(near(arm[arm.length - 1], EXPECTED_MIDPOINT[exit])).toBe(true)
    for (let i = 1; i + 1 < arm.length; i++) expect(hexExcess(arm[i])).toBeLessThan(0)
  })

  it('a straight pair is offset by straightOffset at its middle, ends still on the midpoints', () => {
    const course = riverCourseInHex(['W'], 'E', A, null, 5)
    const arm = course.arms[0]
    const mid = arm[COURSE_SAMPLES / 2]
    expect(Math.abs(mid.y)).toBeCloseTo(5, 6)
    expect(near(arm[0], EXPECTED_MIDPOINT.W)).toBe(true)
    expect(near(arm[arm.length - 1], EXPECTED_MIDPOINT.E)).toBe(true)
  })

  it('a bend passes through the middle of town', () => {
    const arm = riverCourseInHex(['NE'], 'W', A).arms[0]
    expect(distanceToPolylines({ x: 0, y: 0 }, [arm])).toBeLessThan(A * 0.3)
  })
})

describe('springs, endings and the fallback', () => {
  it('an ending runs from its edge midpoint to the centre', () => {
    const course = riverCourseInHex(['SW'], null, A)
    expect(course.kind).toBe('ending')
    const arm = course.arms[0]
    expect(near(arm[0], EXPECTED_MIDPOINT.SW)).toBe(true)
    expect(near(arm[arm.length - 1], { x: 0, y: 0 })).toBe(true)
  })

  it('a spring runs from the centre to its exit; no edges at all uses the fallback', () => {
    expect(riverCourseInHex([], 'NW', A).kind).toBe('spring')
    const fallback = riverCourseInHex([], null, A, 'SE')
    expect(fallback.kind).toBe('spring')
    expect(fallback.exit).toBe('SE')
  })

  it('an entry equal to the exit is dropped', () => {
    const course = riverCourseInHex(['E'], 'E', A)
    expect(course.kind).toBe('spring')
    expect(course.entries).toEqual([])
  })
})

describe('riverCourseFromEdges: tile edges have no flow direction', () => {
  it('one edge ends in town, two edges run through', () => {
    expect(riverCourseFromEdges(['W'])).toEqual({ entries: ['W'], exit: null })
    expect(riverCourseFromEdges(['E', 'W'])).toEqual({ entries: ['E'], exit: 'W' })
    expect(riverCourseFromEdges(['W', 'E'])).toEqual({ entries: ['W'], exit: 'E' })
  })

  it("a junction's exit is the trunk of the Y", () => {
    // RIVER_E (NE, E, W) and RIVER_F (E, SE, W): the two adjacent edges join and leave by W.
    expect(riverCourseFromEdges(['NE', 'E', 'W'])).toEqual({ entries: ['NE', 'E'], exit: 'W' })
    expect(riverCourseFromEdges(['E', 'SE', 'W'])).toEqual({ entries: ['E', 'SE'], exit: 'W' })
    // RIVER_D (NE, SE, W) is an even split: the tie goes to the first edge.
    expect(riverCourseFromEdges(['NE', 'SE', 'W'])).toEqual({ entries: ['SE', 'W'], exit: 'NE' })
  })

  it('no edges: a straight river across the picked edge', () => {
    for (let i = 0; i < 6; i++) {
      const { entries, exit } = riverCourseFromEdges([], (i + 0.5) / 6)
      expect(exit).toBe(HEX_DIRS[i])
      expect(entries).toEqual([oppositeEdge(HEX_DIRS[i])])
    }
  })
})

describe('nearestOnPolylines', () => {
  it('finds the closest point and the local tangent', () => {
    const arms = [[{ x: 0, y: 0 }, { x: 10, y: 0 }]]
    const n = nearestOnPolylines({ x: 3, y: 4 }, arms)
    expect(n.distance).toBeCloseTo(4, 9)
    expect(near(n.point, { x: 3, y: 0 })).toBe(true)
    expect(near(n.tangent, { x: 1, y: 0 })).toBe(true)
    expect(nearestOnPolylines({ x: 0, y: 0 }, []).distance).toBe(Infinity)
  })
})
