import { describe, expect, it } from 'vitest'
import { computeKeepPlan, type KeepPlanInput } from './keepPlan'
import { generateKeepSite } from './generateKeep'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function inputFromSeed(seed: number): KeepPlanInput {
  const site = generateKeepSite(seededRng(seed))
  return {
    rooms: site.rooms.map((r) => ({ id: r.id, floor: r.floor, isCourtyard: r.isCourtyard })),
    seedSource: site.rooms.map((r) => `${r.id}:${r.roomTypeRoll}`).join('|') + `#${seed}`,
  }
}

const SEEDS = Array.from({ length: 80 }, (_, i) => (i + 1) * 104729)
const EPS = 1e-6

describe('computeKeepPlan', () => {
  it('is deterministic for the same input', () => {
    const input = inputFromSeed(42)
    expect(computeKeepPlan(input)).toEqual(computeKeepPlan(input))
  })

  it('places every building room exactly once, on its own floor, with a real rect', () => {
    for (const seed of SEEDS) {
      const input = inputFromSeed(seed)
      const plan = computeKeepPlan(input)
      const placed = plan.floors.flatMap((f) => f.rooms.map((r) => ({ id: r.id, floor: f.floor, rect: r.rect })))
      const buildingRooms = input.rooms.filter((r) => !r.isCourtyard)
      expect(placed.map((p) => p.id).sort()).toEqual(buildingRooms.map((r) => r.id).sort())
      for (const p of placed) {
        expect(p.rect).toBeDefined()
        expect(buildingRooms.find((r) => r.id === p.id)!.floor).toBe(p.floor)
      }
    }
  })

  it('packs each floor\'s rooms inside the shared footprint without overlapping', () => {
    for (const seed of SEEDS) {
      const plan = computeKeepPlan(inputFromSeed(seed))
      const { width, height } = plan.building
      for (const floor of plan.floors) {
        for (const room of floor.rooms) {
          expect(room.rect.x).toBeGreaterThanOrEqual(-EPS)
          expect(room.rect.y).toBeGreaterThanOrEqual(-EPS)
          expect(room.rect.x + room.rect.width).toBeLessThanOrEqual(width + EPS)
          expect(room.rect.y + room.rect.height).toBeLessThanOrEqual(height + EPS)
        }
        const area = floor.rooms.reduce((sum, r) => sum + r.rect.width * r.rect.height, 0)
        expect(area).toBeCloseTo(width * height, 6) // tiles the footprint exactly
      }
    }
  })

  it('gives the first room on each floor (Hall, Lord\'s Quarters, Storeroom) the largest space', () => {
    for (const seed of SEEDS) {
      for (const floor of computeKeepPlan(inputFromSeed(seed)).floors) {
        const areas = floor.rooms.map((r) => r.rect.width * r.rect.height)
        expect(areas[0]).toBe(Math.max(...areas))
      }
    }
  })

  it('connects every room on a floor with exactly one door per extra room', () => {
    for (const seed of SEEDS) {
      for (const floor of computeKeepPlan(inputFromSeed(seed)).floors) {
        expect(floor.doors).toHaveLength(floor.rooms.length - 1)
      }
    }
  })

  it('sits the building inside the curtain wall, with the gatehouse on the bottom wall below it', () => {
    for (const seed of SEEDS) {
      const plan = computeKeepPlan(inputFromSeed(seed))
      const { wall, buildingOffset, gatehouse, buildingEntrance } = plan.compound
      expect(buildingOffset.x).toBeGreaterThan(plan.compound.wallThickness)
      expect(buildingOffset.x + plan.building.width).toBeLessThan(wall.width - plan.compound.wallThickness)
      expect(buildingOffset.y + plan.building.height).toBeLessThan(gatehouse.y)
      expect(gatehouse.y + gatehouse.height).toBeGreaterThan(wall.height)
      expect(buildingEntrance.at.y).toBe(plan.building.height)
    }
  })

  it('puts the stair turret on a top corner of the building', () => {
    for (const seed of SEEDS) {
      const plan = computeKeepPlan(inputFromSeed(seed))
      expect(plan.stairTurret.center.y).toBe(0)
      expect([0, plan.building.width]).toContain(plan.stairTurret.center.x)
    }
  })
})
