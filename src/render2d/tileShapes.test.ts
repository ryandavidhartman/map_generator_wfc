import { describe, expect, it } from 'vitest'
import { axialToPixel, hexCorners } from '../hexgrid/hexMath'
import { CUBE_DIRS } from '../wfc/cube'
import { HEX_DIRS } from '../wfc/tiles'
import { coastWaterPath, edgeMidpoint, linePath } from './tileShapes'

const O = { x: 0, y: 0 }
const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-9

describe('pointy-top geometry matches the WFC directions', () => {
  it('each edge midpoint lies halfway to the neighbor in that direction', () => {
    for (const d of CUBE_DIRS) {
      const n = axialToPixel({ q: d.dq, r: d.dr }, 1)
      expect(near(edgeMidpoint(O, 1, d.name), { x: n.x / 2, y: n.y / 2 })).toBe(true)
    }
  })

  it('neighbors are one hex width apart and the top corner points north', () => {
    for (const d of CUBE_DIRS) {
      const n = axialToPixel({ q: d.dq, r: d.dr }, 1)
      expect(Math.hypot(n.x, n.y)).toBeCloseTo(Math.sqrt(3), 9)
    }
    expect(near(hexCorners(O, 1)[0], { x: 0, y: -1 })).toBe(true)
    expect(axialToPixel({ q: 0, r: -1 }, 1).y).toBeLessThan(0) // NW is up
  })
})

describe('linePath', () => {
  it('draws nothing without edges', () => {
    expect(linePath(O, 10, [])).toBeNull()
  })

  it('joins two edges with one curve through the center', () => {
    expect(linePath(O, 10, ['E', 'W'])).toMatch(/^M8\.66,0 Q0,0 -8\.66,0$/)
  })

  it('runs a single edge, or each of three, to the center', () => {
    expect(linePath(O, 10, ['W'])).toBe('M-8.66,0 L0,0')
    expect(linePath(O, 10, ['NE', 'SE', 'W'])!.match(/L0,0/g)).toHaveLength(3)
  })
})

describe('coastWaterPath', () => {
  const corners = hexCorners(O, 10)
  const pt = (p: { x: number; y: number }) => `${Math.round(p.x * 100) / 100},${Math.round(p.y * 100) / 100}`

  it('is null with no water at all', () => {
    expect(coastWaterPath(O, 10, [], [])).toBeNull()
  })

  it('encloses the water edges between the two shoreline edges (COAST_A: water SE, coast E and SW)', () => {
    const d = coastWaterPath(O, 10, ['SE'], ['E', 'SW'])!
    // From the middle of E, along the SE edge's two corners, to the middle of SW, then back.
    expect(d).toBe(
      `M${pt(edgeMidpoint(O, 10, 'E'))} L${pt(corners[2])} L${pt(corners[3])} L${pt(edgeMidpoint(O, 10, 'SW'))} Q0,0 ${pt(edgeMidpoint(O, 10, 'E'))} Z`,
    )
  })

  it('handles a water run that wraps past NW (COAST_D rotated so water is NW..SE)', () => {
    const d = coastWaterPath(O, 10, ['NW', 'NE', 'E', 'SE'], ['SW', 'W'])!
    expect(d.startsWith(`M${pt(edgeMidpoint(O, 10, 'W'))} L${pt(corners[5])}`)).toBe(true)
    expect(d).toContain(`L${pt(corners[3])} L${pt(edgeMidpoint(O, 10, 'SW'))} Q`)
  })

  it('with only two coast edges, puts the water at their shared corner (COAST_E)', () => {
    expect(coastWaterPath(O, 10, [], ['SE', 'SW'])).toBe(
      `M${pt(edgeMidpoint(O, 10, 'SE'))} L${pt(corners[3])} L${pt(edgeMidpoint(O, 10, 'SW'))} Q0,0 ${pt(edgeMidpoint(O, 10, 'SE'))} Z`,
    )
  })

  it('fills the whole hex for open water', () => {
    expect(coastWaterPath(O, 10, [...HEX_DIRS], [])).toBe(`M${corners.map(pt).join(' L')} Z`)
  })
})
