// SVG shapes for a hex's features on the 2D overland map, worked out from its tile's edges
// (world/terrain.ts's HexGeo), so drawing derives from saved data.
//
// - Rivers and roads: a line from the middle of each river (road) edge. Two edges are joined by
//   a curve bending through the hex's center; one edge (a river's end or a road's end) runs to
//   the center; three or more meet at the center.
// - Coast: the water side of a shore hex, in the sea's color. The shoreline crosses the hex's
//   `coast` edges at their middles and bends through the center, enclosing the `water` edges.
// - Lake: an oval at the center (drawn by the tile component).

import { hexCorners, type PixelPoint } from '../hexgrid/hexMath'
import { HEX_DIRS, type HexDir } from '../wfc/tiles'

const fmt = (p: PixelPoint) => `${round(p.x)},${round(p.y)}`
const round = (n: number) => Math.round(n * 100) / 100

// The middle of the edge facing `dir` (corner i to corner i + 1; see hexCorners).
export function edgeMidpoint(center: PixelPoint, size: number, dir: HexDir): PixelPoint {
  const i = HEX_DIRS.indexOf(dir)
  const c = hexCorners(center, size)
  const a = c[i]
  const b = c[(i + 1) % 6]
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

// Path data for a river or road network through one hex (null if it has none).
export function linePath(center: PixelPoint, size: number, edges: readonly HexDir[]): string | null {
  if (edges.length === 0) return null
  const mids = edges.map((d) => edgeMidpoint(center, size, d))
  if (edges.length === 2) return `M${fmt(mids[0])} Q${fmt(center)} ${fmt(mids[1])}`
  return mids.map((m) => `M${fmt(m)} L${fmt(center)}`).join(' ')
}

// Path data for the water side of a shore hex (null if no water touches it).
export function coastWaterPath(
  center: PixelPoint,
  size: number,
  seaEdges: readonly HexDir[],
  coastEdges: readonly HexDir[],
): string | null {
  const isSea = HEX_DIRS.map((d) => seaEdges.includes(d))
  const isCoast = HEX_DIRS.map((d) => coastEdges.includes(d))
  const corners = hexCorners(center, size)
  const mid = (i: number) => edgeMidpoint(center, size, HEX_DIRS[(i + 6) % 6])
  const corner = (i: number) => corners[(i + 6) % 6]

  if (isSea.every(Boolean)) return `M${corners.map(fmt).join(' L')} Z`

  let points: PixelPoint[]
  const start = isSea.findIndex((s, i) => s && !isSea[(i + 5) % 6])
  if (start >= 0) {
    // The run of water edges start..end, with the shoreline entering at the edge before it and
    // leaving at the edge after it.
    let end = start
    while (isSea[(end + 1) % 6]) end++
    points = []
    if (isCoast[(start + 5) % 6]) points.push(mid(start - 1))
    for (let i = start; i <= end + 1; i++) points.push(corner(i))
    if (isCoast[(end + 1) % 6]) points.push(mid(end + 1))
  } else {
    // No water edge: two neighboring coast edges, with the water touching at their shared corner.
    const a = isCoast.findIndex((c, i) => c && isCoast[(i + 1) % 6])
    if (a < 0) return null
    points = [mid(a), corner(a + 1), mid(a + 1)]
  }
  return `M${points.map(fmt).join(' L')} Q${fmt(center)} ${fmt(points[0])} Z`
}
