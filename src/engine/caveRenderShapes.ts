// Pure, deterministic geometry helpers for rendering Cave/Deep tunnels dungeon rooms as organic
// cavern blobs with a thick textured wall band, instead of plain rectangles — used only by
// DungeonMapSvg.tsx, and only for Cave/Deep tunnels site types (Tomb/Ruins keep rectangular
// rendering, since built structures plausibly have straight walls where natural caves don't).
//
// Deliberately NOT part of the persisted generation model: Room.rect is unchanged, and this
// module is not Rng-injectable in the way engine/dungeonLayout.ts is. A room's blob shape is
// derived deterministically from its existing rect via a cheap seeded hash, so the same room
// always renders the same organic silhouette without needing new generated data or touching
// generateDungeonSite's rng stream (rerolling the site still rerolls rects as before; the blob
// wobble just follows wherever the new rect ends up).

export type Point = { x: number; y: number }
export type Rect = { x: number; y: number; width: number; height: number }
export type BlobShape = { angle: number; radiusFactor: number }[]

const BLOB_SAMPLES = 14
const BLOB_JITTER_MIN = 0.72
const BLOB_JITTER_MAX = 1.15

export function seededRngFromNumber(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

// Cheap deterministic hash from a room's rect into a seed number — two different rects
// (almost) always hash to different seeds, and the same rect always hashes the same way.
export function seedForRect(rect: Rect): number {
  const raw = Math.round(rect.x * 73856093) ^ Math.round(rect.y * 19349663) ^ Math.round(rect.width * 83492791) ^ Math.round(rect.height * 2654435761)
  return raw >>> 0
}

// A reusable organic "wobble": N angles with jittered radius factors, generated once per room
// and reused for both its floor polygon and its (larger) wall-band polygon, so the two follow
// the same contour at a roughly constant offset rather than being independently random.
export function generateBlobShape(seed: number): BlobShape {
  const rng = seededRngFromNumber(seed)
  const shape: BlobShape = []
  for (let i = 0; i < BLOB_SAMPLES; i++) {
    const angle = (i / BLOB_SAMPLES) * Math.PI * 2
    const radiusFactor = BLOB_JITTER_MIN + rng() * (BLOB_JITTER_MAX - BLOB_JITTER_MIN)
    shape.push({ angle, radiusFactor })
  }
  return shape
}

// Renders a blob shape to a closed polygon around `center`: baseRadius scaled by each sample's
// jitter factor, plus a fixed extraRadius — inflating the same wobble outward by extraRadius
// gives a wall-band polygon of roughly constant thickness following the floor polygon's
// contour (extraRadius = 0 for the floor itself).
export function blobToPolygon(center: Point, baseRadius: number, shape: BlobShape, extraRadius: number): Point[] {
  const points = shape.map(({ angle, radiusFactor }) => {
    const r = baseRadius * radiusFactor + extraRadius
    return { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r }
  })
  points.push(points[0])
  return points
}

// A straight quadrilateral ribbon connecting two points at a given half-width — used for
// Tomb/Ruins corridors (built structures plausibly have straight halls). Not a true rounded
// capsule (no arcs at the ends) — a plain quad reads fine at the render sizes this app uses.
export function corridorPolygon(a: Point, b: Point, halfWidth: number): Point[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const px = (-dy / len) * halfWidth
  const py = (dx / len) * halfWidth
  return [
    { x: a.x + px, y: a.y + py },
    { x: b.x + px, y: b.y + py },
    { x: b.x - px, y: b.y - py },
    { x: a.x - px, y: a.y - py },
    { x: a.x + px, y: a.y + py },
  ]
}

// Two rooms' seeds combined (order-independent, via XOR) into one seed for their shared
// corridor's wobble — so the same pair of rooms always gets the same winding passage.
export function seedForConnection(seedA: number, seedB: number): number {
  return (seedA ^ seedB) >>> 0
}

// A handful of waypoints between `a` and `b`, each offset perpendicular to the straight line
// by a deterministic jittered amount — used to make a cave corridor visibly wind rather than
// running dead straight (a straight quadrilateral ribbon reads as a network diagram, not a
// natural passage, once several of them converge on one room).
export function generateOrganicCorridorWaypoints(a: Point, b: Point, seed: number): Point[] {
  const rng = seededRngFromNumber(seed)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const waypointCount = 2
  const points: Point[] = [a]
  for (let i = 1; i <= waypointCount; i++) {
    const t = i / (waypointCount + 1)
    const baseX = a.x + dx * t
    const baseY = a.y + dy * t
    const jitter = (rng() - 0.5) * len * 0.4
    points.push({ x: baseX + nx * jitter, y: baseY + ny * jitter })
  }
  points.push(b)
  return points
}

// Renders a sequence of points as a smooth SVG path `d` string — each interior point acts as a
// quadratic-bezier control point curving toward the midpoint of itself and the next point (the
// standard "smooth freehand curve through N points" construction), so the path flows through
// bends rather than having sharp polyline corners.
export function smoothPathData(points: Point[]): string {
  if (points.length < 2) return ''
  if (points.length === 2) return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`

  let d = `M ${points[0].x},${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 }
    d += ` Q ${points[i].x},${points[i].y} ${mid.x},${mid.y}`
  }
  const last = points[points.length - 1]
  d += ` L ${last.x},${last.y}`
  return d
}
