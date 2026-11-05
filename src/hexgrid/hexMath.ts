// Axial coordinate hex-grid math for a pointy-top hexagon layout (the WFC tiles' orientation;
// map_generator was flat-top until M3). The axial pair (q, r) is the same as the WFC cube
// coordinates' q and r (s = -q - r).
// Reference: https://www.redblobgames.com/grids/hexagons/

export type AxialCoord = {
  q: number
  r: number
}

export function hexId({ q, r }: AxialCoord): string {
  return `${q},${r}`
}

export function parseHexId(id: string): AxialCoord {
  const [q, r] = id.split(',').map(Number)
  return { q, r }
}

// Axial neighbor directions, ordered starting east and going counter-clockwise on screen
// (E, NE, NW, W, SW, SE).
const NEIGHBOR_OFFSETS: AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export function neighborsOf(coord: AxialCoord): AxialCoord[] {
  return NEIGHBOR_OFFSETS.map((offset) => ({ q: coord.q + offset.q, r: coord.r + offset.r }))
}

export function axialDistance(a: AxialCoord, b: AxialCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2
}

export type PixelPoint = { x: number; y: number }

// size = distance from hex center to a corner.
// Screen y points down, so north (r - 1) is up.
export function axialToPixel(coord: AxialCoord, size: number): PixelPoint {
  const x = size * Math.sqrt(3) * (coord.q + coord.r / 2)
  const y = size * 1.5 * coord.r
  return { x, y }
}

// Corner i sits at -90° + 60°·i (corner 0 is the top point), so the edge facing WFC direction
// HEX_DIRS[i] (NE, E, SE, SW, W, NW) runs from corner i to corner i + 1.
export function hexCorners(center: PixelPoint, size: number): PixelPoint[] {
  const corners: PixelPoint[] = []
  for (let i = 0; i < 6; i++) {
    const angleDeg = -90 + 60 * i
    const angleRad = (Math.PI / 180) * angleDeg
    corners.push({
      x: center.x + size * Math.cos(angleRad),
      y: center.y + size * Math.sin(angleRad),
    })
  }
  return corners
}

export function hexCornersPointsAttr(center: PixelPoint, size: number): string {
  return hexCorners(center, size)
    .map((p) => `${p.x},${p.y}`)
    .join(' ')
}

// Fog-of-war visibility for an unbounded map: every revealed hex, plus every
// unrevealed hex adjacent to at least one revealed hex (the "frontier").
// Replaces the old fixed-radius-disk enumeration so rendering scales with the
// explored area instead of a hypothetical max map size.
export function computeVisibleCoords(revealedCoords: AxialCoord[]): AxialCoord[] {
  const revealedIds = new Set(revealedCoords.map(hexId))
  const frontier = new Map<string, AxialCoord>()
  for (const coord of revealedCoords) {
    for (const neighbor of neighborsOf(coord)) {
      const id = hexId(neighbor)
      if (!revealedIds.has(id) && !frontier.has(id)) {
        frontier.set(id, neighbor)
      }
    }
  }
  return [...revealedCoords, ...frontier.values()]
}
