import { describe, expect, it } from 'vitest'
import {
  axialDistance,
  computeVisibleCoords,
  hexId,
  parseHexId,
  neighborsOf,
} from './hexMath'

describe('hexId / parseHexId', () => {
  it('round-trips', () => {
    const coord = { q: -2, r: 3 }
    expect(parseHexId(hexId(coord))).toEqual(coord)
  })
})

describe('neighborsOf', () => {
  it('returns 6 distinct neighbors, all at distance 1', () => {
    const center = { q: 1, r: -1 }
    const neighbors = neighborsOf(center)
    expect(neighbors).toHaveLength(6)
    for (const n of neighbors) {
      expect(axialDistance(center, n)).toBe(1)
    }
    const ids = new Set(neighbors.map((n) => `${n.q},${n.r}`))
    expect(ids.size).toBe(6)
  })
})

describe('axialDistance', () => {
  it('is 0 for the same hex', () => {
    expect(axialDistance({ q: 3, r: -2 }, { q: 3, r: -2 })).toBe(0)
  })

  it('matches known hand-computed distances', () => {
    expect(axialDistance({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(2)
    expect(axialDistance({ q: 0, r: 0 }, { q: 0, r: 2 })).toBe(2)
    expect(axialDistance({ q: 0, r: 0 }, { q: 2, r: -2 })).toBe(2)
  })
})

describe('computeVisibleCoords', () => {
  it('returns just the center plus its 6 neighbors for a single revealed hex', () => {
    const coords = computeVisibleCoords([{ q: 0, r: 0 }])
    expect(coords).toHaveLength(7)
    expect(coords).toContainEqual({ q: 0, r: 0 })
    for (const n of neighborsOf({ q: 0, r: 0 })) {
      expect(coords).toContainEqual(n)
    }
  })

  it('does not duplicate a frontier hex shared by two revealed hexes', () => {
    const coords = computeVisibleCoords([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
    ])
    const ids = coords.map(hexId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never re-lists an already-revealed coord as frontier', () => {
    const revealed = [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 1, r: -1 },
    ]
    const coords = computeVisibleCoords(revealed)
    const revealedIds = new Set(revealed.map(hexId))
    const seen = new Set<string>()
    for (const c of coords) {
      const id = hexId(c)
      expect(seen.has(id)).toBe(false)
      seen.add(id)
    }
    // every revealed coord is present exactly once
    for (const r of revealed) {
      expect(seen.has(hexId(r))).toBe(true)
    }
    expect(revealedIds.size).toBe(revealed.length)
  })

  it('returns an empty array for no revealed hexes', () => {
    expect(computeVisibleCoords([])).toEqual([])
  })
})
