import { describe, expect, it } from 'vitest'
import {
  blobToPolygon,
  corridorPolygon,
  generateBlobShape,
  generateOrganicCorridorWaypoints,
  seedForConnection,
  seedForRect,
  smoothPathData,
} from './caveRenderShapes'

describe('seedForRect', () => {
  it('is deterministic for the same rect', () => {
    const rect = { x: 3, y: 5, width: 8, height: 6 }
    expect(seedForRect(rect)).toBe(seedForRect({ ...rect }))
  })

  it('differs for different rects (no accidental collisions in a small sample)', () => {
    const seeds = new Set<number>()
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        seeds.add(seedForRect({ x, y, width: 6, height: 6 }))
      }
    }
    expect(seeds.size).toBe(25)
  })
})

describe('generateBlobShape', () => {
  it('is deterministic for the same seed', () => {
    expect(generateBlobShape(42)).toEqual(generateBlobShape(42))
  })

  it('produces a non-empty shape with radius factors in the expected range', () => {
    const shape = generateBlobShape(7)
    expect(shape.length).toBeGreaterThan(3)
    for (const { radiusFactor } of shape) {
      expect(radiusFactor).toBeGreaterThan(0.5)
      expect(radiusFactor).toBeLessThan(1.3)
    }
  })
})

describe('blobToPolygon', () => {
  it('returns a closed polygon (first point repeated at the end)', () => {
    const shape = generateBlobShape(1)
    const polygon = blobToPolygon({ x: 0, y: 0 }, 10, shape, 0)
    expect(polygon[0]).toEqual(polygon[polygon.length - 1])
    expect(polygon.length).toBe(shape.length + 1)
  })

  it('inflating by extraRadius pushes every vertex further from center', () => {
    const shape = generateBlobShape(2)
    const center = { x: 5, y: 5 }
    const inner = blobToPolygon(center, 10, shape, 0)
    const outer = blobToPolygon(center, 10, shape, 2)
    for (let i = 0; i < shape.length; i++) {
      const innerDist = Math.hypot(inner[i].x - center.x, inner[i].y - center.y)
      const outerDist = Math.hypot(outer[i].x - center.x, outer[i].y - center.y)
      expect(outerDist).toBeGreaterThan(innerDist)
    }
  })
})

describe('corridorPolygon', () => {
  it('produces a closed quadrilateral of the requested width', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 10, y: 0 }
    const polygon = corridorPolygon(a, b, 2)
    expect(polygon).toHaveLength(5)
    expect(polygon[0]).toEqual(polygon[4])
    // Perpendicular to a horizontal segment is vertical — corners should be offset in y only.
    expect(polygon[0].y).toBeCloseTo(2)
    expect(polygon[3].y).toBeCloseTo(-2)
  })

  it('handles coincident points without dividing by zero', () => {
    const polygon = corridorPolygon({ x: 1, y: 1 }, { x: 1, y: 1 }, 3)
    expect(polygon.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
  })
})

describe('seedForConnection', () => {
  it('is order-independent', () => {
    expect(seedForConnection(11, 22)).toBe(seedForConnection(22, 11))
  })

  it('differs for different realistic (large, rect-hash-shaped) seed pairs', () => {
    // Small sequential integers collide under plain XOR (e.g. 0^5 === 1^4) — that's expected
    // XOR behavior, not a bug; real inputs are seedForRect's widely-spread hash outputs.
    const rects = [
      { x: 0, y: 0, width: 6, height: 6 },
      { x: 6, y: 0, width: 5, height: 8 },
      { x: 0, y: 6, width: 7, height: 4 },
      { x: 10, y: 10, width: 9, height: 5 },
    ]
    const seeds = rects.map(seedForRect)
    const combined = new Set<number>()
    for (let i = 0; i < seeds.length; i++) {
      for (let j = i + 1; j < seeds.length; j++) {
        combined.add(seedForConnection(seeds[i], seeds[j]))
      }
    }
    expect(combined.size).toBe((seeds.length * (seeds.length - 1)) / 2)
  })
})

describe('generateOrganicCorridorWaypoints', () => {
  it('is deterministic for the same inputs', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 20, y: 5 }
    expect(generateOrganicCorridorWaypoints(a, b, 99)).toEqual(generateOrganicCorridorWaypoints(a, b, 99))
  })

  it('starts and ends exactly at the given endpoints', () => {
    const a = { x: 2, y: 3 }
    const b = { x: 30, y: -4 }
    const waypoints = generateOrganicCorridorWaypoints(a, b, 5)
    expect(waypoints[0]).toEqual(a)
    expect(waypoints[waypoints.length - 1]).toEqual(b)
  })

  it('produces at least one intermediate waypoint that deviates from the straight line', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 40, y: 0 }
    const waypoints = generateOrganicCorridorWaypoints(a, b, 3)
    const interior = waypoints.slice(1, -1)
    expect(interior.length).toBeGreaterThan(0)
    expect(interior.some((p) => Math.abs(p.y) > 0.01)).toBe(true)
  })

  it('different seeds produce different waypoints for the same endpoints', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 40, y: 0 }
    expect(generateOrganicCorridorWaypoints(a, b, 1)).not.toEqual(generateOrganicCorridorWaypoints(a, b, 2))
  })
})

describe('smoothPathData', () => {
  it('starts with M at the first point', () => {
    const d = smoothPathData([{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }])
    expect(d.startsWith('M 1,2')).toBe(true)
  })

  it('renders a straight line for exactly 2 points', () => {
    expect(smoothPathData([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe('M 0,0 L 10,0')
  })

  it('returns an empty string for fewer than 2 points', () => {
    expect(smoothPathData([])).toBe('')
    expect(smoothPathData([{ x: 0, y: 0 }])).toBe('')
  })

  it('ends at the final point', () => {
    const points = [{ x: 0, y: 0 }, { x: 5, y: 10 }, { x: 10, y: -5 }, { x: 20, y: 0 }]
    const d = smoothPathData(points)
    expect(d.endsWith('L 20,0')).toBe(true)
  })
})
