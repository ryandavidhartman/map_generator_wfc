// Cube coordinates for pointy-top hexes.
//
// Ported from hex-map-wfc (src/hexmap/HexWFCCore.js), Copyright (c) 2026 Felix Turner,
// MIT License: https://github.com/felixturner/hex-map-wfc/blob/main/LICENSE
// Change: TypeScript types; the offset-coordinate helpers (only used by hex-map-wfc's
// renderer and debug labels) are left out.
//
// q + r + s = 0. (q, r) is the same axial pair map_generator stores as a hex id "q,r".
// Reference: https://www.redblobgames.com/grids/hexagons/

import type { HexDir } from './tiles'

export type Cube = { q: number; r: number; s: number }

// Neighbor steps in HEX_DIRS order (NE, E, SE, SW, W, NW).
export const CUBE_DIRS: readonly { name: HexDir; dq: number; dr: number; ds: number }[] = [
  { name: 'NE', dq: +1, dr: -1, ds: 0 },
  { name: 'E', dq: +1, dr: 0, ds: -1 },
  { name: 'SE', dq: 0, dr: +1, ds: -1 },
  { name: 'SW', dq: -1, dr: +1, ds: 0 },
  { name: 'W', dq: -1, dr: 0, ds: +1 },
  { name: 'NW', dq: 0, dr: -1, ds: +1 },
]

export function cubeKey(q: number, r: number, s: number): string {
  return `${q},${r},${s}`
}

export function keyOf(c: Cube): string {
  return cubeKey(c.q, c.r, c.s)
}

export function parseCubeKey(key: string): Cube {
  const [q, r, s] = key.split(',').map(Number)
  return { q, r, s }
}

export function cubeDistance(a: Cube, b: Cube): number {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s))
}

export function cubeCoordsInRadius(center: Cube, radius: number): Cube[] {
  const coords: Cube[] = []
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      coords.push({ q: center.q + q, r: center.r + r, s: center.s - q - r })
    }
  }
  return coords
}

export function cubeNeighbor(c: Cube, dirIndex: number): Cube {
  const d = CUBE_DIRS[dirIndex]
  return { q: c.q + d.dq, r: c.r + d.dr, s: c.s + d.ds }
}
