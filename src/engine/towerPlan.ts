// Pure, deterministic rendering-only geometry for TowerMapSvg.tsx's floor plans and side view —
// NOT part of the generation engine. Like caveRenderShapes.ts, every shape here is derived at
// render time from data a generated TowerSite already carries (room ids, floor membership,
// Room Type rolls) via a seeded hash, so nothing new is persisted and generateTower.ts's rng
// stream is untouched. Reference for the look (2026-10-31): a side-view tower beside one
// top-down plan per floor — round cores split into rooms by straight walls, annex rooms
// sticking out of some floors, a curved stair along the wall.
//
// Coordinates are in grid units (1 unit = one 5-ft grid square), each floor plan centered on
// (0, 0), SVG orientation (y grows downward). Angles are degrees, 0 = +x (right), 90 = +y (down).

import { seededRngFromNumber, type Point, type Rect } from './caveRenderShapes'

export type TowerPlanRoomInput = { id: string; levelIndex: number; floorRoomIndex: number }

export type TowerPlanInput = {
  levelCount: number
  rooms: TowerPlanRoomInput[]
  // Any string that identifies this particular generated tower (e.g. room ids + Room Type
  // rolls joined) — the same tower always produces the same plan.
  seedSource: string
}

export type WedgeRoomShape = { kind: 'wedge'; id: string; startAngle: number; endAngle: number; labelAt: Point }
export type AnnexRoomShape = { kind: 'annex'; id: string; rect: Rect; side: 'left' | 'right'; labelAt: Point }
export type TowerRoomShape = WedgeRoomShape | AnnexRoomShape

// A doorway centered at `at`, cut through a wall running in direction `wallAngle`.
export type TowerDoor = { at: Point; wallAngle: number }

export type TowerStair = { startAngle: number; endAngle: number; innerRadius: number; outerRadius: number }

export type TowerFloorPlan = {
  levelIndex: number
  radius: number
  rooms: TowerRoomShape[]
  // Straight interior walls, from the center out to the core's rim, at these angles.
  partitionAngles: number[]
  doors: TowerDoor[]
  stair: TowerStair
  // Ground floor only: the way in from outside, on the side without the guard-room annex.
  entrance?: { side: 'left' | 'right' }
}

export type TowerPlan = { floors: TowerFloorPlan[] }

export const ANNEX_WIDTH = 4
export const ANNEX_HEIGHT = 5
// How far an annex reaches into the core, so it reads as attached rather than floating.
const ANNEX_OVERLAP = 0.6
const STAIR_DEPTH = 1.4
const BASE_RADIUS = 4.5
// Smallest core that still fits a quartered floor's room markers and the stair.
const MIN_RADIUS = 3.6
// Going up, each floor usually keeps the width of the one below (this chance) or else narrows
// by a few percent. The one exception: occasionally the top floor flares out into a wider
// crowning chamber, like the reference drawing's.
const SAME_WIDTH_CHANCE = 0.55
const FLARED_TOP_CHANCE = 0.15
const FLARED_TOP_FACTOR = 1.2

// Per-floor core radius, ground floor first: same-or-narrower going up, except for the rare
// flared top floor (user decision 2026-10-31: the reference's wide top is the exception, not
// the norm).
function floorRadii(levelCount: number, rng: () => number): number[] {
  const radii = [BASE_RADIUS * (1 + rng() * 0.15)]
  for (let level = 1; level < levelCount; level++) {
    const below = radii[level - 1]
    radii.push(rng() < SAME_WIDTH_CHANCE ? below : Math.max(MIN_RADIUS, below * (0.88 + rng() * 0.07)))
  }
  if (levelCount > 1 && rng() < FLARED_TOP_CHANCE) {
    radii[levelCount - 1] = radii[levelCount - 2] * FLARED_TOP_FACTOR
  }
  return radii
}

// FNV-1a — cheap deterministic string hash.
export function seedForString(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function polarPoint(radius: number, angleDeg: number): Point {
  const a = (angleDeg * Math.PI) / 180
  return { x: radius * Math.cos(a), y: radius * Math.sin(a) }
}

function annexRect(radius: number, side: 'left' | 'right'): Rect {
  const innerEdge = radius - ANNEX_OVERLAP
  const x = side === 'right' ? innerEdge : -innerEdge - ANNEX_WIDTH
  return { x, y: -ANNEX_HEIGHT / 2, width: ANNEX_WIDTH, height: ANNEX_HEIGHT }
}

function annexLabel(rect: Rect, side: 'left' | 'right'): Point {
  // Center of the part of the annex outside the core.
  const outsideWidth = rect.width - ANNEX_OVERLAP
  const x = side === 'right' ? rect.x + ANNEX_OVERLAP + outsideWidth / 2 : rect.x + outsideWidth / 2
  return { x, y: 0 }
}

function wedgeLabel(radius: number, startAngle: number, endAngle: number): Point {
  if (endAngle - startAngle >= 360) return { x: 0, y: radius * 0.15 }
  return polarPoint(radius * 0.5, (startAngle + endAngle) / 2)
}

function stairWithin(radius: number, startAngle: number, endAngle: number, preferredCenter?: number): TowerStair {
  const span = Math.min(70, (endAngle - startAngle) * 0.45)
  const center = preferredCenter ?? (startAngle + endAngle) / 2
  return { startAngle: center - span / 2, endAngle: center + span / 2, innerRadius: radius - STAIR_DEPTH, outerRadius: radius }
}

// The core of every floor is a circle; floors differ in radius (see floorRadii) and in how
// extra rooms are fitted: split the circle with
// straight walls ("partition"), or hang rectangular rooms off its sides ("annex").
export function computeTowerPlan(input: TowerPlanInput): TowerPlan {
  const rng = seededRngFromNumber(seedForString(input.seedSource))
  const radii = floorRadii(input.levelCount, rng)
  const floors: TowerFloorPlan[] = []

  for (let level = 0; level < input.levelCount; level++) {
    const floorRooms = input.rooms
      .filter((r) => r.levelIndex === level)
      .sort((a, b) => a.floorRoomIndex - b.floorRoomIndex)
    if (floorRooms.length === 0) continue

    const radius = radii[level]
    const [stairRoom, ...sideRooms] = floorRooms

    if (level === 0) {
      // Ground floor: entry hall is the whole core; the guard room is an annex on one side,
      // the entrance walkway on the other.
      const guardSide: 'left' | 'right' = rng() < 0.5 ? 'left' : 'right'
      const rooms: TowerRoomShape[] = [{ kind: 'wedge', id: stairRoom.id, startAngle: 0, endAngle: 360, labelAt: wedgeLabel(radius, 0, 360) }]
      const doors: TowerDoor[] = []
      for (const room of sideRooms) {
        const rect = annexRect(radius, guardSide)
        rooms.push({ kind: 'annex', id: room.id, rect, side: guardSide, labelAt: annexLabel(rect, guardSide) })
        doors.push({ at: { x: guardSide === 'right' ? radius : -radius, y: 0 }, wallAngle: 90 })
      }
      floors.push({
        levelIndex: level,
        radius,
        rooms,
        partitionAngles: [],
        doors,
        stair: stairWithin(radius, 0, 360, 270),
        entrance: { side: guardSide === 'right' ? 'left' : 'right' },
      })
      continue
    }

    const useAnnexes = sideRooms.length > 0 && rng() < 0.4
    if (sideRooms.length === 0) {
      floors.push({
        levelIndex: level,
        radius,
        rooms: [{ kind: 'wedge', id: stairRoom.id, startAngle: 0, endAngle: 360, labelAt: wedgeLabel(radius, 0, 360) }],
        partitionAngles: [],
        doors: [],
        stair: stairWithin(radius, 0, 360, 270),
      })
    } else if (useAnnexes) {
      const sides: ('left' | 'right')[] = rng() < 0.5 ? ['right', 'left'] : ['left', 'right']
      const rooms: TowerRoomShape[] = [{ kind: 'wedge', id: stairRoom.id, startAngle: 0, endAngle: 360, labelAt: wedgeLabel(radius, 0, 360) }]
      const doors: TowerDoor[] = []
      sideRooms.forEach((room, i) => {
        const side = sides[i]
        const rect = annexRect(radius, side)
        rooms.push({ kind: 'annex', id: room.id, rect, side, labelAt: annexLabel(rect, side) })
        doors.push({ at: { x: side === 'right' ? radius : -radius, y: 0 }, wallAngle: 90 })
      })
      floors.push({ levelIndex: level, radius, rooms, partitionAngles: [], doors, stair: stairWithin(radius, 0, 360, 270) })
    } else {
      // Partition: the stair room takes one half (left or right); one side room takes the other
      // half, two side rooms split it into quarters.
      const stairOnLeft = rng() < 0.5
      const stairStart = stairOnLeft ? 90 : 270
      const stairEnd = stairStart + 180
      const otherStart = stairOnLeft ? 270 : 90
      // The stair hugs this half's outer wall, so its label sits closer to the center.
      const stairLabel = polarPoint(radius * 0.3, (stairStart + stairEnd) / 2)
      const rooms: TowerRoomShape[] = [{ kind: 'wedge', id: stairRoom.id, startAngle: stairStart, endAngle: stairEnd, labelAt: stairLabel }]
      const doors: TowerDoor[] = []
      const partitionAngles = [90, 270]
      if (sideRooms.length === 1) {
        const [room] = sideRooms
        rooms.push({ kind: 'wedge', id: room.id, startAngle: otherStart, endAngle: otherStart + 180, labelAt: wedgeLabel(radius, otherStart, otherStart + 180) })
        doors.push({ at: polarPoint(radius * 0.55, 90), wallAngle: 90 })
      } else {
        const splitAngle = otherStart + 90
        partitionAngles.push(splitAngle % 360)
        const halves: [number, number][] = [
          [otherStart, splitAngle],
          [splitAngle, otherStart + 180],
        ]
        sideRooms.forEach((room, i) => {
          const [start, end] = halves[i]
          rooms.push({ kind: 'wedge', id: room.id, startAngle: start, endAngle: end, labelAt: wedgeLabel(radius, start, end) })
          // Each quarter shares one diameter wall with the stair half: the top quarter the
          // wall at 270 (up), the bottom quarter the wall at 90 (down).
          const sharedWallAngle = i === 0 ? otherStart : (otherStart + 180) % 360
          doors.push({ at: polarPoint(radius * 0.55, sharedWallAngle), wallAngle: 90 })
        })
      }
      floors.push({ levelIndex: level, radius, rooms, partitionAngles, doors, stair: stairWithin(radius, stairStart, stairEnd) })
    }
  }

  return { floors }
}

// Bounding box of one floor plan (core + annexes + entrance walkway), in grid units.
export function floorPlanBounds(floor: TowerFloorPlan): Rect {
  let minX = -floor.radius
  let maxX = floor.radius
  for (const room of floor.rooms) {
    if (room.kind !== 'annex') continue
    minX = Math.min(minX, room.rect.x)
    maxX = Math.max(maxX, room.rect.x + room.rect.width)
  }
  if (floor.entrance) {
    if (floor.entrance.side === 'left') minX = Math.min(minX, -floor.radius - ENTRANCE_LENGTH)
    else maxX = Math.max(maxX, floor.radius + ENTRANCE_LENGTH)
  }
  return { x: minX, y: -floor.radius, width: maxX - minX, height: floor.radius * 2 }
}

export const ENTRANCE_LENGTH = 2.5
