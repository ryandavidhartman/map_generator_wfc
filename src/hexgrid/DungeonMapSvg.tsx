// Renders a generated dungeon's real BSP room layout in an "old-school blue module map" style —
// a two-tone blue-field/white-room scheme, replacing the earlier "painted VTT" look (warm
// terracotta colors, brick/crosshatch wall textures). Reference: an Inkscape tutorial for
// hand-drawn-style VTT dungeon maps (crookedstaff.co.uk, "Drawing old-school dungeon maps") —
// solid blue = unexplored rock, white = traversable space, a thin blue grid inside rooms/
// corridors, rounded corridor ends, and small door-rectangles bridging connected spaces. Two
// room-shape styles, chosen by the caller via `caveStyle` based on the dungeon's site type (see
// DungeonSiteView.tsx): Cave/Deep tunnels get organic cavern blobs; Tomb/Ruins keep rectangular
// built rooms — a distinction from geometry, not wall texture (texture no longer exists in this
// two-tone scheme). Corridors render as two stacked strokes (blue "wall" + white/grid "floor")
// with round line caps, which is what produces the reference's rounded corridor-end caps with no
// extra geometry. Rectangular rooms stay inset from their true rect bounds so a visible gap
// exists for corridors to occupy (BSP rooms tile edge-to-edge with zero gap otherwise); cave
// blobs are naturally smaller than their room's rect already, so no extra inset is needed there.

import {
  blobToPolygon,
  generateBlobShape,
  generateOrganicCorridorWaypoints,
  seedForConnection,
  seedForRect,
  smoothPathData,
  type Point,
} from '../engine/caveRenderShapes'

export type DungeonMapRoomData = {
  id: string
  rect: { x: number; y: number; width: number; height: number }
  color: string
  label: string
  highlighted?: boolean
  onClick?: () => void
}

export type DungeonMapSvgProps = {
  rooms: DungeonMapRoomData[]
  connections: [string, string][]
  caveStyle?: boolean
  unitSize?: number
}

const CLASSIC_BLUE = '#2f6fed'
const CLASSIC_BLUE_LIGHT = '#bcd4fb'

const WALL_STROKE_UNITS = 0.22
const CORRIDOR_HALF_WIDTH_UNITS = 0.55
// dungeonLayout.ts's rects always share an exact boundary when connected (zero real distance
// between them) — this inset exists only to draw a thin wall seam between adjacent rooms, NOT to
// create room for a hallway. Keep it small: it used to be 0.9 units, big enough to read as a
// detached corridor stub with a floating door in the middle rather than a doorway cut into a
// shared wall (see the file header's "Follow-up fix" note for the full story).
const RECT_ROOM_INSET_UNITS = 0.15

function pointsAttr(polygon: Point[]): string {
  return polygon.map((p) => `${p.x},${p.y}`).join(' ')
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

type Rect = DungeonMapRoomData['rect']
const ADJACENCY_EPS = 1e-6

function overlapRange(aMin: number, aMax: number, bMin: number, bMax: number): [number, number] | null {
  const lo = Math.max(aMin, bMin)
  const hi = Math.min(aMax, bMax)
  return hi > lo + ADJACENCY_EPS ? [lo, hi] : null
}

// dungeonLayout.ts's rectsShareEdge guarantees every connection is an exact axis-aligned shared
// wall (never a corner-only touch or a diagonal relationship) — this mirrors that same check so
// the rendered corridor runs straight through the real shared wall instead of the old diagonal
// center-to-center ray, which read as a floating sliver detached from the room whenever the two
// rooms' centers weren't aligned with the wall between them (the source of the "hallways don't
// touch the rooms" / "doors in a weird place" bug).
function rectAdjacency(a: Rect, b: Rect): { axis: 'x' | 'y'; overlapMid: number } | null {
  const sharedVerticalWall =
    Math.abs(a.x + a.width - b.x) < ADJACENCY_EPS || Math.abs(b.x + b.width - a.x) < ADJACENCY_EPS
  if (sharedVerticalWall) {
    const overlap = overlapRange(a.y, a.y + a.height, b.y, b.y + b.height)
    if (overlap) return { axis: 'x', overlapMid: (overlap[0] + overlap[1]) / 2 }
  }
  const sharedHorizontalWall =
    Math.abs(a.y + a.height - b.y) < ADJACENCY_EPS || Math.abs(b.y + b.height - a.y) < ADJACENCY_EPS
  if (sharedHorizontalWall) {
    const overlap = overlapRange(a.x, a.x + a.width, b.x, b.x + b.width)
    if (overlap) return { axis: 'y', overlapMid: (overlap[0] + overlap[1]) / 2 }
  }
  return null
}

// Fallback only — real dungeon connections always satisfy rectAdjacency above. Where a ray from
// a rectangle's center towards `towards` exits the rectangle's boundary.
function exitPointFromRect(center: Point, halfWidth: number, halfHeight: number, towards: Point): Point {
  const dx = towards.x - center.x
  const dy = towards.y - center.y
  if (dx === 0 && dy === 0) return center
  const tx = dx !== 0 ? halfWidth / Math.abs(dx) : Infinity
  const ty = dy !== 0 ? halfHeight / Math.abs(dy) : Infinity
  const t = Math.min(tx, ty)
  return { x: center.x + dx * t, y: center.y + dy * t }
}

// Ordinary parametric star-polygon construction — a rendering-cosmetic detail specific to this
// style's objective-room "statue" icon (echoing the reference's own circle+star symbol for
// notable features), not shared geometry, so it lives here rather than in caveRenderShapes.ts.
function starPolygonPoints(center: Point, outerRadius: number, innerRadius: number, points = 5): Point[] {
  const result: Point[] = []
  const step = Math.PI / points
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius
    const angle = i * step - Math.PI / 2
    result.push({ x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r })
  }
  return result
}

export function DungeonMapSvg({ rooms, connections, caveStyle = false, unitSize = 24 }: DungeonMapSvgProps) {
  if (rooms.length === 0) return null

  const maxX = Math.max(...rooms.map((r) => r.rect.x + r.rect.width))
  const maxY = Math.max(...rooms.map((r) => r.rect.y + r.rect.height))
  const pad = unitSize
  const width = maxX * unitSize + pad * 2
  const height = maxY * unitSize + pad * 2

  const byId = new Map(rooms.map((r) => [r.id, r]))
  const wallStroke = WALL_STROKE_UNITS * unitSize
  const corridorHalfWidth = CORRIDOR_HALF_WIDTH_UNITS * unitSize
  const roomInset = RECT_ROOM_INSET_UNITS * unitSize
  // Two adjacent rect rooms are always exactly `2 * roomInset` apart (see the constant's own
  // comment) — the door is sized to fully bridge that gap, plus a little overlap into each
  // room's own wall stroke, so it reads as a notch cut into a continuous wall rather than a
  // separate rectangle floating in a gap that doesn't quite reach either room.
  const doorThickness = roomInset * 2 + wallStroke
  const gridTile = unitSize / 3

  function toPx(x: number, y: number): Point {
    return { x: x * unitSize + pad, y: y * unitSize + pad }
  }

  function centerPx(rect: DungeonMapRoomData['rect']): Point {
    return toPx(rect.x + rect.width / 2, rect.y + rect.height / 2)
  }

  // Rect-style rooms' actual rendered bounds (after the corridor-visibility inset) — shared by
  // both the connection-clipping math above and the room-rendering loop below, so they always
  // agree on exactly where a room's boundary is.
  function outerRectPx(rect: DungeonMapRoomData['rect']) {
    return {
      x: rect.x * unitSize + pad + roomInset,
      y: rect.y * unitSize + pad + roomInset,
      width: Math.max(0, rect.width * unitSize - roomInset * 2),
      height: Math.max(0, rect.height * unitSize - roomInset * 2),
    }
  }

  // The room-number circle (colored by ROOM_TYPE_COLORS, same value the room used to be filled
  // with entirely) does double duty as both "keep numbered labels" and "keep a subtle room-type
  // indicator" — one glance-able symbol instead of two competing ones.
  function roomMarker(r: DungeonMapRoomData, center: Point, fontSize: number) {
    const radius = fontSize * 0.9
    return (
      <g style={{ pointerEvents: 'none' }}>
        <circle cx={center.x} cy={center.y} r={radius} fill={r.color} stroke={CLASSIC_BLUE} strokeWidth={wallStroke * 0.6} />
        <text
          x={center.x}
          y={center.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={fontSize * 0.12}
          paintOrder="stroke"
          style={{ fontWeight: 700 }}
        >
          {r.label}
        </text>
      </g>
    )
  }

  // The objective room's "statue" icon — a circle-with-star, echoing the reference's own symbol
  // for a notable fixed feature — replaces the plain star-glyph label used previously. The star
  // is filled with the room's own type color so the room-type-at-a-glance property survives even
  // for the one room that doesn't get the plain numbered marker.
  function objectiveMarker(r: DungeonMapRoomData, center: Point, fontSize: number) {
    const outerRadius = fontSize * 1.1
    const starOuter = fontSize * 0.9
    const starInner = fontSize * 0.45
    return (
      <g style={{ pointerEvents: 'none' }}>
        <circle cx={center.x} cy={center.y} r={outerRadius} fill="#ffffff" stroke={CLASSIC_BLUE} strokeWidth={wallStroke * 0.6} />
        <polygon points={pointsAttr(starPolygonPoints(center, starOuter, starInner))} fill={r.color} stroke={CLASSIC_BLUE} strokeWidth={wallStroke * 0.3} />
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', background: CLASSIC_BLUE }}>
      <defs>
        <pattern id="floor-grid" width={gridTile} height={gridTile} patternUnits="userSpaceOnUse">
          <rect width={gridTile} height={gridTile} fill="#ffffff" />
          <path d={`M ${gridTile},0 L 0,0 L 0,${gridTile}`} fill="none" stroke={CLASSIC_BLUE_LIGHT} strokeWidth={1} />
        </pattern>
      </defs>

      <rect x={0} y={0} width={width} height={height} fill={CLASSIC_BLUE} />

      {/* Corridors — drawn first so rooms (on top) hide the parts that overlap them, leaving
          only the visible span between rooms. Both styles use the same two-stroke technique
          (blue "wall" stroke + grid-pattern "floor" stroke, both round-capped) — the round cap
          is what produces the reference's rounded corridor-end look, with no extra geometry.
          Cave-style corridors wind (a few deterministic waypoints via a smoothed path) rather
          than running dead straight; Tomb/Ruins keep straight halls (a built structure plausibly
          has them) and additionally get a door-rectangle marker at the midpoint, matching the
          reference's convention — skipped for cave-style, since a straight perpendicular door
          crossing a winding organic passage wouldn't read correctly. */}
      {connections.map(([aId, bId]) => {
        const a = byId.get(aId)
        const b = byId.get(bId)
        if (!a || !b) return null
        const ca = centerPx(a.rect)
        const cb = centerPx(b.rect)

        if (caveStyle) {
          const seed = seedForConnection(seedForRect(a.rect), seedForRect(b.rect))
          const pathData = smoothPathData(generateOrganicCorridorWaypoints(ca, cb, seed))
          return (
            <g key={`${aId}-${bId}`}>
              <path
                d={pathData}
                fill="none"
                stroke={CLASSIC_BLUE}
                strokeWidth={(corridorHalfWidth + wallStroke) * 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d={pathData} fill="none" stroke="url(#floor-grid)" strokeWidth={corridorHalfWidth * 2} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )
        }

        const outerA = outerRectPx(a.rect)
        const outerB = outerRectPx(b.rect)
        const adjacency = rectAdjacency(a.rect, b.rect)

        let exitA: Point
        let exitB: Point
        if (adjacency) {
          if (adjacency.axis === 'x') {
            // Shared vertical wall — rooms sit side by side, corridor runs horizontally between
            // the two rooms' facing (inset) edges, at the vertical midpoint of their true overlap.
            const rawY = adjacency.overlapMid * unitSize + pad
            const rangeMin = Math.max(outerA.y, outerB.y)
            const rangeMax = Math.min(outerA.y + outerA.height, outerB.y + outerB.height)
            const y = rangeMin <= rangeMax ? clamp(rawY, rangeMin, rangeMax) : (rangeMin + rangeMax) / 2
            const aIsLeft = a.rect.x < b.rect.x
            exitA = { x: aIsLeft ? outerA.x + outerA.width : outerA.x, y }
            exitB = { x: aIsLeft ? outerB.x : outerB.x + outerB.width, y }
          } else {
            // Shared horizontal wall — rooms stack top/bottom, corridor runs vertically.
            const rawX = adjacency.overlapMid * unitSize + pad
            const rangeMin = Math.max(outerA.x, outerB.x)
            const rangeMax = Math.min(outerA.x + outerA.width, outerB.x + outerB.width)
            const x = rangeMin <= rangeMax ? clamp(rawX, rangeMin, rangeMax) : (rangeMin + rangeMax) / 2
            const aIsTop = a.rect.y < b.rect.y
            exitA = { x, y: aIsTop ? outerA.y + outerA.height : outerA.y }
            exitB = { x, y: aIsTop ? outerB.y : outerB.y + outerB.height }
          }
        } else {
          exitA = exitPointFromRect(ca, outerA.width / 2, outerA.height / 2, cb)
          exitB = exitPointFromRect(cb, outerB.width / 2, outerB.height / 2, ca)
        }

        const angleRad = Math.atan2(exitB.y - exitA.y, exitB.x - exitA.x)
        const angleDeg = (angleRad * 180) / Math.PI
        const mid = { x: (exitA.x + exitB.x) / 2, y: (exitA.y + exitB.y) / 2 }
        const doorSpan = corridorHalfWidth * 2

        // No separate corridor line here: adjacent rooms are always exactly `2 * roomInset` apart
        // (a true wall seam, not hallway-length distance), and doorThickness is sized to fully
        // bridge that gap on its own — a corridor stub would either be entirely hidden under the
        // door or, if it peeked out, read as the same "detached floating segment" bug this was
        // fixed for. The door rect IS the connection between the two rooms.
        return (
          <rect
            key={`${aId}-${bId}`}
            x={mid.x - doorSpan / 2}
            y={mid.y - doorThickness / 2}
            width={doorSpan}
            height={doorThickness}
            fill="url(#floor-grid)"
            stroke={CLASSIC_BLUE}
            strokeWidth={wallStroke * 0.6}
            transform={`rotate(${angleDeg + 90} ${mid.x} ${mid.y})`}
          />
        )
      })}

      {rooms.map((r) => {
        const center = centerPx(r.rect)
        const fontSize = Math.min(unitSize * 0.5, 16)
        const strokeWidth = r.highlighted ? wallStroke * 2.2 : wallStroke

        if (caveStyle) {
          const baseRadius = Math.min(r.rect.width, r.rect.height) * unitSize * 0.46
          const shape = generateBlobShape(seedForRect(r.rect))
          const floorPoly = blobToPolygon(center, baseRadius, shape, 0)
          return (
            <g key={r.id} data-room-id={r.id} onClick={r.onClick} style={{ cursor: r.onClick ? 'pointer' : 'default' }}>
              <polygon points={pointsAttr(floorPoly)} fill="url(#floor-grid)" stroke={CLASSIC_BLUE} strokeWidth={strokeWidth} />
              {r.highlighted ? objectiveMarker(r, center, fontSize) : roomMarker(r, center, fontSize)}
            </g>
          )
        }

        const outer = outerRectPx(r.rect)
        return (
          <g key={r.id} data-room-id={r.id} onClick={r.onClick} style={{ cursor: r.onClick ? 'pointer' : 'default' }}>
            <rect x={outer.x} y={outer.y} width={outer.width} height={outer.height} fill="url(#floor-grid)" stroke={CLASSIC_BLUE} strokeWidth={strokeWidth} />
            {r.highlighted ? objectiveMarker(r, center, fontSize) : roomMarker(r, center, fontSize)}
          </g>
        )
      })}
    </svg>
  )
}
