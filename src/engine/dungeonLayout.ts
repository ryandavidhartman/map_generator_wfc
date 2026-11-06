import type { Rng } from './dice'

// BSP-style floor-plan layout: recursively split a bounding rectangle into `roomCount`
// variable-sized leaf rectangles, producing a real, non-uniform floor plan instead of
// gridLayout.ts's uniform-cell blob (which settlements still use until districts get the
// same treatment). Ported as an algorithm idea (not code) from a sibling project's
// DungeonServer.scala BSP dungeon generator — see docs/plan-sites-settlements-mongo.md's
// "Real dungeon maps" section for the source citations and the scope this deliberately
// dropped (corner-notch non-rectangular outline, hallway-strip carving, entrance markers)
// as later-if-wanted polish, not required for the core "real rooms" upgrade.

export type Rect = { x: number; y: number; width: number; height: number }
export type RoomLayout = { index: number; rect: Rect }
export type DungeonLayout = { rooms: RoomLayout[]; connections: [number, number][] }

// Minimum width/height a room may ever have, in abstract layout units. Every leaf rect is
// guaranteed to satisfy this by construction (see splitRect): a split only ever shrinks the
// axis being split down to MIN_ROOM_DIM, and never touches the other axis, so by induction
// every leaf's dimensions stay >= MIN_ROOM_DIM starting from the root footprint.
const MIN_ROOM_DIM = 4
const UNIT = 10
const EPS = 1e-6

function canSplit(rect: Rect): boolean {
  return rect.width >= MIN_ROOM_DIM * 2 || rect.height >= MIN_ROOM_DIM * 2
}

// Splits along the longer axis (ties go vertical) so rooms stay roughly square rather than
// degenerating into slivers; the split point is randomized within [MIN_ROOM_DIM, dim -
// MIN_ROOM_DIM] so both children respect the minimum. Caller must check canSplit() first.
function splitRect(rect: Rect, rng: Rng): [Rect, Rect] {
  const canVertical = rect.width >= MIN_ROOM_DIM * 2
  const canHorizontal = rect.height >= MIN_ROOM_DIM * 2
  const splitVertically = canVertical && (!canHorizontal || rect.width >= rect.height)

  if (splitVertically) {
    const splitX = rect.x + MIN_ROOM_DIM + rng() * (rect.width - MIN_ROOM_DIM * 2)
    return [
      { x: rect.x, y: rect.y, width: splitX - rect.x, height: rect.height },
      { x: splitX, y: rect.y, width: rect.x + rect.width - splitX, height: rect.height },
    ]
  }

  const splitY = rect.y + MIN_ROOM_DIM + rng() * (rect.height - MIN_ROOM_DIM * 2)
  return [
    { x: rect.x, y: rect.y, width: rect.width, height: splitY - rect.y },
    { x: rect.x, y: splitY, width: rect.width, height: rect.y + rect.height - splitY },
  ]
}

function initialFootprint(roomCount: number): Rect {
  const cols = Math.ceil(Math.sqrt(roomCount))
  const rows = Math.ceil(roomCount / cols)
  return { x: 0, y: 0, width: cols * UNIT, height: rows * UNIT }
}

function overlaps1D(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin < bMax - EPS && bMin < aMax - EPS
}

// Two rects are connected if they share a boundary segment of positive length (not just a
// corner point). A guillotine-cut rectangular subdivision's adjacency graph built this way is
// always connected (every split's two children are adjacent by construction, and that
// property is preserved transitively as either child is split further) — verified empirically
// in dungeonLayout.test.ts rather than proven here.
function rectsShareEdge(a: Rect, b: Rect): boolean {
  const verticallyAdjacent =
    (Math.abs(a.x + a.width - b.x) < EPS || Math.abs(b.x + b.width - a.x) < EPS) &&
    overlaps1D(a.y, a.y + a.height, b.y, b.y + b.height)
  const horizontallyAdjacent =
    (Math.abs(a.y + a.height - b.y) < EPS || Math.abs(b.y + b.height - a.y) < EPS) &&
    overlaps1D(a.x, a.x + a.width, b.x, b.x + b.width)
  return verticallyAdjacent || horizontallyAdjacent
}

export function generateDungeonLayout(roomCount: number, rng: Rng = Math.random): DungeonLayout {
  if (roomCount <= 0) return { rooms: [], connections: [] }
  return partitionRect(initialFootprint(roomCount), roomCount, rng)
}

// The BSP core, on a caller-chosen footprint — also used by engine/keepPlan.ts to pack a keep
// floor's rooms into the building's outline. Consumes exactly `roomCount - 1` rng() calls
// (fewer only if the footprint is too small to split further).
export function partitionRect(footprint: Rect, roomCount: number, rng: Rng = Math.random): DungeonLayout {
  if (roomCount <= 0) return { rooms: [], connections: [] }

  const rects: Rect[] = [footprint]

  while (rects.length < roomCount) {
    // Always split the largest-area splittable rect — keeps room sizes balanced rather than
    // repeatedly slicing the same corner into slivers. One rng() call per split (the split
    // position); consumes exactly `roomCount - 1` rng() calls in total.
    let bestIndex = -1
    let bestArea = -1
    for (let i = 0; i < rects.length; i++) {
      if (!canSplit(rects[i])) continue
      const area = rects[i].width * rects[i].height
      if (area > bestArea) {
        bestArea = area
        bestIndex = i
      }
    }

    // Guarded against by initialFootprint's generous sizing relative to MIN_ROOM_DIM (see
    // dungeonLayout.test.ts across sizes 5/8/12 and many seeds) — stop early rather than loop
    // forever in the pathological case this is never expected to hit.
    if (bestIndex === -1) break

    const [a, b] = splitRect(rects[bestIndex], rng)
    rects.splice(bestIndex, 1, a, b)
  }

  const rooms: RoomLayout[] = rects.map((rect, index) => ({ index, rect }))
  const connections: [number, number][] = []
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsShareEdge(rects[i], rects[j])) connections.push([i, j])
    }
  }

  return { rooms, connections }
}
