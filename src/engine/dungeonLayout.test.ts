import { describe, expect, it } from 'vitest'
import { generateDungeonLayout } from './dungeonLayout'

// Deterministic seeded PRNG (LCG) — matches this project's deterministic-tests-only
// convention (see gridLayout.test.ts).
function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function connectedComponentSize(count: number, connections: [number, number][], from: number): number {
  const adjacency = new Map<number, number[]>()
  for (let i = 0; i < count; i++) adjacency.set(i, [])
  for (const [a, b] of connections) {
    adjacency.get(a)!.push(b)
    adjacency.get(b)!.push(a)
  }
  const seen = new Set<number>([from])
  const queue = [from]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const n of adjacency.get(current)!) {
      if (!seen.has(n)) {
        seen.add(n)
        queue.push(n)
      }
    }
  }
  return seen.size
}

function rectsOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  const eps = 1e-6
  return a.x < b.x + b.width - eps && b.x < a.x + a.width - eps && a.y < b.y + b.height - eps && b.y < a.y + a.height - eps
}

describe('generateDungeonLayout', () => {
  it('returns an empty layout for count 0', () => {
    expect(generateDungeonLayout(0, seededRng(1))).toEqual({ rooms: [], connections: [] })
  })

  it('places a single room covering the whole footprint for count 1', () => {
    const layout = generateDungeonLayout(1, seededRng(1))
    expect(layout.rooms).toHaveLength(1)
    expect(layout.connections).toEqual([])
    expect(layout.rooms[0].rect.width).toBeGreaterThan(0)
    expect(layout.rooms[0].rect.height).toBeGreaterThan(0)
  })

  it.each([5, 8, 12])('produces exactly %i non-overlapping rooms, all above the minimum size', (count) => {
    for (const seed of [1, 42, 12345, 999999]) {
      const layout = generateDungeonLayout(count, seededRng(seed))
      expect(layout.rooms).toHaveLength(count)

      for (const { rect } of layout.rooms) {
        expect(rect.width).toBeGreaterThanOrEqual(4)
        expect(rect.height).toBeGreaterThanOrEqual(4)
      }

      for (let i = 0; i < layout.rooms.length; i++) {
        for (let j = i + 1; j < layout.rooms.length; j++) {
          expect(rectsOverlap(layout.rooms[i].rect, layout.rooms[j].rect)).toBe(false)
        }
      }
    }
  })

  it.each([5, 8, 12])('produces a fully connected adjacency graph for %i rooms', (count) => {
    for (const seed of [1, 42, 12345, 999999]) {
      const layout = generateDungeonLayout(count, seededRng(seed))
      expect(connectedComponentSize(count, layout.connections, 0)).toBe(count)
    }
  })

  it('connection indices are always in range and never self-referential', () => {
    const layout = generateDungeonLayout(12, seededRng(7))
    for (const [a, b] of layout.connections) {
      expect(a).not.toBe(b)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThan(layout.rooms.length)
    }
  })
})
