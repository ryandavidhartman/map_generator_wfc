import { describe, expect, it } from 'vitest'
import { computeCampLayout, type CampPoint } from './campLayout'

function circlesOverlap(a: CampPoint, b: CampPoint): boolean {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  return distance < a.radius + b.radius - 1e-6
}

describe('computeCampLayout', () => {
  it('produces the requested number of peripheral features', () => {
    const layout = computeCampLayout(5)
    expect(layout.peripheral).toHaveLength(5)
  })

  it('handles zero peripheral features (just a central feature)', () => {
    const layout = computeCampLayout(0)
    expect(layout.peripheral).toHaveLength(0)
    expect(layout.central.x).toBeGreaterThanOrEqual(0)
    expect(layout.central.y).toBeGreaterThanOrEqual(0)
  })

  it('every point has non-negative x/y accounting for its own radius (renderer assumes this)', () => {
    for (const peripheralCount of [1, 2, 3, 5, 8]) {
      const layout = computeCampLayout(peripheralCount)
      const all = [layout.central, ...layout.peripheral]
      for (const point of all) {
        expect(point.x - point.radius).toBeGreaterThanOrEqual(0)
        expect(point.y - point.radius).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('no two features overlap, across peripheral counts', () => {
    for (const peripheralCount of [1, 2, 3, 5, 8]) {
      const layout = computeCampLayout(peripheralCount)
      const all = [layout.central, ...layout.peripheral]
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          expect(circlesOverlap(all[i], all[j])).toBe(false)
        }
      }
    }
  })

  it('has no connections/edges at all — a pure scatter, unlike every other layout in this project', () => {
    const layout = computeCampLayout(4)
    expect(layout).not.toHaveProperty('connections')
  })
})
