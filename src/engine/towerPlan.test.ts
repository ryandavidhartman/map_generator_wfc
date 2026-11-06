import { describe, expect, it } from 'vitest'
import { computeTowerPlan, floorPlanBounds, type TowerPlanInput } from './towerPlan'
import { generateTowerSite } from './generateTower'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function inputFromSeed(seed: number): TowerPlanInput {
  const site = generateTowerSite(seededRng(seed))
  return {
    levelCount: site.levelCount,
    rooms: site.rooms,
    seedSource: site.rooms.map((r) => `${r.id}:${r.roomTypeRoll}`).join('|') + `#${seed}`,
  }
}

const SEEDS = Array.from({ length: 60 }, (_, i) => (i + 1) * 104729)

describe('computeTowerPlan', () => {
  it('is deterministic for the same input', () => {
    const input = inputFromSeed(42)
    expect(computeTowerPlan(input)).toEqual(computeTowerPlan(input))
  })

  it('produces one floor per level, and places every room exactly once on its own floor', () => {
    for (const seed of SEEDS) {
      const input = inputFromSeed(seed)
      const plan = computeTowerPlan(input)
      expect(plan.floors.map((f) => f.levelIndex)).toEqual(Array.from({ length: input.levelCount }, (_, i) => i))
      const placed = plan.floors.flatMap((f) => f.rooms.map((r) => ({ id: r.id, level: f.levelIndex })))
      expect(placed.map((p) => p.id).sort()).toEqual(input.rooms.map((r) => r.id).sort())
      for (const p of placed) {
        expect(input.rooms.find((r) => r.id === p.id)!.levelIndex).toBe(p.level)
      }
    }
  })

  it('wedge rooms on a floor tile the full circle with no overlap', () => {
    for (const seed of SEEDS) {
      for (const floor of computeTowerPlan(inputFromSeed(seed)).floors) {
        const wedges = floor.rooms.filter((r) => r.kind === 'wedge')
        const total = wedges.reduce((sum, w) => sum + (w.kind === 'wedge' ? w.endAngle - w.startAngle : 0), 0)
        expect(total).toBe(360)
      }
    }
  })

  it('never puts two annexes on the same side of a floor', () => {
    for (const seed of SEEDS) {
      for (const floor of computeTowerPlan(inputFromSeed(seed)).floors) {
        const sides = floor.rooms.flatMap((r) => (r.kind === 'annex' ? [r.side] : []))
        expect(new Set(sides).size).toBe(sides.length)
      }
    }
  })

  it('the ground floor has the guard room as an annex and the entrance on the opposite side', () => {
    for (const seed of SEEDS) {
      const ground = computeTowerPlan(inputFromSeed(seed)).floors[0]
      const guard = ground.rooms.find((r) => r.id === 'guard-room')!
      expect(guard.kind).toBe('annex')
      if (guard.kind === 'annex') expect(ground.entrance?.side).not.toBe(guard.side)
    }
  })

  it('every side room gets a door, and the stair sits inside the stair room\'s own wedge', () => {
    for (const seed of SEEDS) {
      for (const floor of computeTowerPlan(inputFromSeed(seed)).floors) {
        expect(floor.doors).toHaveLength(floor.rooms.length - 1)
        const stairRoom = floor.rooms[0]
        expect(stairRoom.kind).toBe('wedge')
        if (stairRoom.kind === 'wedge') {
          expect(floor.stair.startAngle).toBeGreaterThanOrEqual(stairRoom.startAngle)
          expect(floor.stair.endAngle).toBeLessThanOrEqual(stairRoom.endAngle)
        }
        expect(floor.stair.outerRadius).toBe(floor.radius)
      }
    }
  })

  it('produces both partitioned and annexed upper floors across towers', () => {
    let sawPartition = false
    let sawUpperAnnex = false
    for (const seed of SEEDS) {
      for (const floor of computeTowerPlan(inputFromSeed(seed)).floors) {
        if (floor.levelIndex === 0) continue
        if (floor.partitionAngles.length > 0) sawPartition = true
        if (floor.rooms.some((r) => r.kind === 'annex')) sawUpperAnnex = true
      }
    }
    expect(sawPartition).toBe(true)
    expect(sawUpperAnnex).toBe(true)
  })

  it('floors never get wider going up, except sometimes a flared top floor', () => {
    let flaredTops = 0
    let multiFloorTowers = 0
    let narrowings = 0
    for (let seed = 1; seed <= 400; seed++) {
      const { floors } = computeTowerPlan(inputFromSeed(seed * 7919))
      if (floors.length < 2) continue
      multiFloorTowers++
      for (let i = 1; i < floors.length; i++) {
        const isTop = i === floors.length - 1
        if (floors[i].radius > floors[i - 1].radius) {
          expect(isTop).toBe(true)
          flaredTops++
        }
        if (floors[i].radius < floors[i - 1].radius) narrowings++
      }
    }
    // The flared top is the exception, not the norm — but it does happen.
    expect(flaredTops).toBeGreaterThan(0)
    expect(flaredTops / multiFloorTowers).toBeLessThan(0.3)
    expect(narrowings).toBeGreaterThan(0)
  })

  it('never shrinks a floor below the minimum usable radius', () => {
    for (let seed = 1; seed <= 400; seed++) {
      for (const floor of computeTowerPlan(inputFromSeed(seed * 7919)).floors) {
        expect(floor.radius).toBeGreaterThanOrEqual(3.6)
      }
    }
  })

  it('floorPlanBounds contains the core, every annex and the entrance walkway', () => {
    for (const seed of SEEDS) {
      for (const floor of computeTowerPlan(inputFromSeed(seed)).floors) {
        const b = floorPlanBounds(floor)
        const eps = 1e-9
        expect(b.x).toBeLessThanOrEqual(-floor.radius + eps)
        expect(b.x + b.width).toBeGreaterThanOrEqual(floor.radius - eps)
        for (const room of floor.rooms) {
          if (room.kind !== 'annex') continue
          expect(room.rect.x).toBeGreaterThanOrEqual(b.x - eps)
          expect(room.rect.x + room.rect.width).toBeLessThanOrEqual(b.x + b.width + eps)
        }
      }
    }
  })
})
