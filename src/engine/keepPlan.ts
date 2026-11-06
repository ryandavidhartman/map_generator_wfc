// Pure, deterministic rendering-only geometry for KeepMapSvg.tsx — NOT part of the generation
// engine. Like towerPlan.ts, everything here is derived at render time from a generated
// KeepSite's room list via a seeded hash, so nothing extra is persisted and generateKeep.ts's
// rng stream is untouched. Reference for the look (2026-10-31): a walled compound (thick
// curtain wall, square corner and mid-wall towers, a gatehouse with a path out) around a keep
// building whose rooms are packed together sharing walls, plus the same building's upper
// floors and cellar drawn as separate plans.
//
// Coordinates are grid units (1 unit = one 5-ft square), y grows downward. Every building
// floor (ground, upper floors, cellar) shares one footprint, `building` (0,0)-(width,height);
// the ground floor's compound wraps it, with the building offset by `compound.buildingOffset`.

import { seededRngFromNumber, type Point, type Rect } from './caveRenderShapes'
import { partitionRect } from './dungeonLayout'
import { seedForString } from './towerPlan'

export type KeepPlanRoomInput = { id: string; floor: number; isCourtyard: boolean }

export type KeepPlanInput = {
  rooms: KeepPlanRoomInput[]
  seedSource: string
}

export type KeepPlanRoom = { id: string; rect: Rect; labelAt: Point }

// A doorway centered at `at`, cut through a wall that runs along `axis` ('x' = horizontal wall,
// 'y' = vertical wall).
export type KeepDoor = { at: Point; axis: 'x' | 'y' }

export type KeepFloorPlan = {
  floor: number
  rooms: KeepPlanRoom[]
  doors: KeepDoor[]
}

export type KeepTower = { rect: Rect }

export type KeepCompound = {
  // Outer edge of the curtain wall.
  wall: Rect
  wallThickness: number
  towers: KeepTower[]
  gatehouse: Rect
  buildingOffset: Point
  // Where the building's front door is, in building coordinates (on its bottom wall).
  buildingEntrance: KeepDoor
  courtyardLabel: Point
}

export type KeepPlan = {
  building: { width: number; height: number }
  // Octagonal stair turret centered on one corner of the building, on every floor.
  stairTurret: { center: Point; radius: number }
  compound: KeepCompound
  floors: KeepFloorPlan[]
}

const ROOM_AREA = 34
const WALL_THICKNESS = 1
const TOWER_SIZE = 3.2
const SIDE_MARGIN = 4
const TOP_MARGIN = 3.5
const YARD_DEPTH = 9
const GATEHOUSE_WIDTH = 5
const GATEHOUSE_DEPTH = 3.5
const STAIR_TURRET_RADIUS = 2.1
const EPS = 1e-6

function overlap(aMin: number, aMax: number, bMin: number, bMax: number): [number, number] | null {
  const lo = Math.max(aMin, bMin)
  const hi = Math.min(aMax, bMax)
  return hi - lo > EPS ? [lo, hi] : null
}

// Door on the wall two touching rooms share, centered on the shared stretch.
function sharedWallDoor(a: Rect, b: Rect): KeepDoor | null {
  if (Math.abs(a.x + a.width - b.x) < EPS || Math.abs(b.x + b.width - a.x) < EPS) {
    const span = overlap(a.y, a.y + a.height, b.y, b.y + b.height)
    const x = Math.abs(a.x + a.width - b.x) < EPS ? b.x : a.x
    if (span) return { at: { x, y: (span[0] + span[1]) / 2 }, axis: 'y' }
  }
  if (Math.abs(a.y + a.height - b.y) < EPS || Math.abs(b.y + b.height - a.y) < EPS) {
    const span = overlap(a.x, a.x + a.width, b.x, b.x + b.width)
    const y = Math.abs(a.y + a.height - b.y) < EPS ? b.y : a.y
    if (span) return { at: { x: (span[0] + span[1]) / 2, y }, axis: 'x' }
  }
  return null
}

function center(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

// Packs one floor's rooms into the shared footprint. The first room listed (Hall, Lord's
// Quarters, Storeroom) gets the largest space. Doors follow a spanning tree of shared walls,
// grown from `startNear` (the front door on the ground floor, the stair corner elsewhere), so
// every room is reachable without a door on every shared wall.
function planFloor(
  floor: number,
  roomIds: string[],
  footprint: Rect,
  startNear: Point,
  rng: () => number,
): KeepFloorPlan | null {
  const layout = partitionRect(footprint, roomIds.length, rng)
  // The packer stops early if the footprint can't be split into that many rooms of the
  // minimum size — the caller retries with a bigger footprint.
  if (layout.rooms.length < roomIds.length) return null
  const rects = layout.rooms.map((r) => r.rect).sort((a, b) => b.width * b.height - a.width * a.height)
  const rooms: KeepPlanRoom[] = roomIds.map((id, i) => ({ id, rect: rects[i], labelAt: center(rects[i]) }))

  const neighbors = new Map<number, number[]>(rects.map((_, i) => [i, []]))
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (sharedWallDoor(rects[i], rects[j])) {
        neighbors.get(i)!.push(j)
        neighbors.get(j)!.push(i)
      }
    }
  }
  const distanceTo = (r: Rect) => Math.hypot(center(r).x - startNear.x, center(r).y - startNear.y)
  let start = 0
  rects.forEach((r, i) => {
    if (distanceTo(r) < distanceTo(rects[start])) start = i
  })
  const doors: KeepDoor[] = []
  const visited = new Set([start])
  const queue = [start]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const next of neighbors.get(current)!) {
      if (visited.has(next)) continue
      visited.add(next)
      queue.push(next)
      doors.push(sharedWallDoor(rects[current], rects[next])!)
    }
  }
  return { floor, rooms, doors }
}

export function computeKeepPlan(input: KeepPlanInput): KeepPlan {
  const rng = seededRngFromNumber(seedForString(input.seedSource))
  const buildingRooms = input.rooms.filter((r) => !r.isCourtyard)
  const floorNumbers = [...new Set(buildingRooms.map((r) => r.floor))].sort((a, b) => b - a)
  const roomsOn = (floor: number) => buildingRooms.filter((r) => r.floor === floor).map((r) => r.id)

  // One footprint for every floor, sized for the busiest one.
  const maxRooms = Math.max(1, ...floorNumbers.map((f) => roomsOn(f).length))
  const aspect = 1.25 + rng() * 0.35
  const stairOnLeft = rng() < 0.5
  let height = Math.max(8, Math.round(Math.sqrt((maxRooms * ROOM_AREA) / aspect)))

  // Grow the footprint until every floor's rooms fit (rarely needs more than one step).
  for (;;) {
    const width = Math.max(10, Math.round(height * aspect))
    const footprint: Rect = { x: 0, y: 0, width, height }
    const stairCorner: Point = stairOnLeft ? { x: 0, y: 0 } : { x: width, y: 0 }
    const frontDoorX = width / 2
    const planned = floorNumbers.map((floor) =>
      planFloor(floor, roomsOn(floor), footprint, floor === 0 ? { x: frontDoorX, y: height } : stairCorner, rng),
    )
    if (planned.every((f) => f !== null)) {
      return withCompound(planned as KeepFloorPlan[], width, height, stairCorner)
    }
    height += 1
  }
}

function withCompound(floors: KeepFloorPlan[], width: number, height: number, stairCorner: Point): KeepPlan {
  const frontDoorX = width / 2

  // Ground-floor compound: the building sits toward the back (top) of the walled yard, with the
  // open courtyard in front of it running down to the gatehouse.
  const wallWidth = width + SIDE_MARGIN * 2 + WALL_THICKNESS * 2
  const wallHeight = height + TOP_MARGIN + YARD_DEPTH + WALL_THICKNESS * 2
  const wall: Rect = { x: 0, y: 0, width: wallWidth, height: wallHeight }
  const buildingOffset = { x: WALL_THICKNESS + SIDE_MARGIN, y: WALL_THICKNESS + TOP_MARGIN }
  const towerAt = (cx: number, cy: number): KeepTower => ({
    rect: { x: cx - TOWER_SIZE / 2, y: cy - TOWER_SIZE / 2, width: TOWER_SIZE, height: TOWER_SIZE },
  })
  const towers = [
    towerAt(0, 0),
    towerAt(wallWidth, 0),
    towerAt(0, wallHeight),
    towerAt(wallWidth, wallHeight),
    towerAt(0, wallHeight / 2),
    towerAt(wallWidth, wallHeight / 2),
  ]
  if (wallWidth > 26) towers.push(towerAt(wallWidth / 2, 0))
  const gatehouse: Rect = {
    x: wallWidth / 2 - GATEHOUSE_WIDTH / 2,
    y: wallHeight - GATEHOUSE_DEPTH / 2 - WALL_THICKNESS / 2,
    width: GATEHOUSE_WIDTH,
    height: GATEHOUSE_DEPTH,
  }

  // Front door: on the building's bottom wall, under whichever ground room spans the middle.
  const ground = floors.find((f) => f.floor === 0)
  const frontRoom = ground?.rooms
    .filter((r) => Math.abs(r.rect.y + r.rect.height - height) < EPS)
    .sort((a, b) => Math.abs(center(a.rect).x - frontDoorX) - Math.abs(center(b.rect).x - frontDoorX))[0]
  const doorX = frontRoom ? center(frontRoom.rect).x : frontDoorX

  return {
    building: { width, height },
    stairTurret: { center: stairCorner, radius: STAIR_TURRET_RADIUS },
    compound: {
      wall,
      wallThickness: WALL_THICKNESS,
      towers,
      gatehouse,
      buildingOffset,
      buildingEntrance: { at: { x: doorX, y: height }, axis: 'x' },
      courtyardLabel: { x: wallWidth / 2, y: buildingOffset.y + height + YARD_DEPTH / 2 },
    },
    floors,
  }
}
