// What WFC may place in each cell, from the world fields. Each cell gets a zone from the
// continent field at the cell and its six neighbors:
// - sea: the cell and all its neighbors are sea. Open water only.
// - wetShore: a sea cell next to land. Anything at base level 0-1 (WFC draws the coastline,
//   coves and islets here). A sea cell with fewer than two sea neighbors (a speck of sea in
//   the noise) is treated as dryShore instead, so it can't become a one-hex pond.
// - dryShore: a land cell next to sea. Land at base level 0-1 (coast tiles included), no open
//   water.
// - land: the cell and all its neighbors are land. No open water, and the tile's levels (lowest
//   to highest edge) must overlap the band within one of the elevation target, so heights
//   follow the elevation field (coherent hills and ranges) instead of wandering at random.
//   Overlap, not base level: a slope's base is its low side, and a river or road climbing out of
//   a lower band needs that slope.
// Deciding zones from the neighbors guarantees at least two free shore cells wherever sea meets
// land. Without that, a one-hex isthmus or islet in the noise would need a tile with two
// separate water edges, which doesn't exist, and the chunk couldn't be solved.
// Open water is only ever at level 0, so every water body is at sea level.

import { CUBE_DIRS, parseCubeKey, type Cube } from '../wfc/cube'
import { getDefaultRules, maskWhere, type AdjacencyRules } from '../wfc/rules'
import type { MaskFor } from '../wfc/solver'
import { LEVELS_COUNT, TILE_LIST, TILE_TYPE } from '../wfc/tiles'
import type { WorldFields } from './fields'

export type Zone = 'sea' | 'wetShore' | 'dryShore' | 'land'

export function zoneOf(fields: WorldFields, c: Cube): Zone {
  const isSea = (x: Cube) => fields.isSea(fields.sample(x).continent)
  const sea = isSea(c)
  const seaNeighbors = CUBE_DIRS.filter((d) => isSea({ q: c.q + d.dq, r: c.r + d.dr, s: c.s + d.ds })).length
  if (sea) return seaNeighbors === 6 ? 'sea' : seaNeighbors >= 2 ? 'wetShore' : 'dryShore'
  return seaNeighbors === 0 ? 'land' : 'dryShore'
}

export function createMaskFor(fields: WorldFields, rules: AdjacencyRules = getDefaultRules()): MaskFor {
  const water = TILE_TYPE.WATER
  const cache = new Map<string, Uint32Array>()
  const cached = (key: string, build: () => Uint32Array) => {
    let m = cache.get(key)
    if (!m) cache.set(key, (m = build()))
    return m
  }
  const sea = () => cached('sea', () => maskWhere(rules, (s) => s.type === water && s.level === 0))
  const wetShore = () => cached('wet', () => maskWhere(rules, (s) => s.level <= 1 && (s.type !== water || s.level === 0)))
  const topLevel = (type: number, level: number) =>
    level + (TILE_LIST[type].highEdges?.length ? (TILE_LIST[type].levelIncrement ?? 1) : 0)
  const land = (lo: number, hi: number) =>
    cached(`land${lo}-${hi}`, () =>
      maskWhere(rules, (s) => s.type !== water && s.level <= hi && topLevel(s.type, s.level) >= lo),
    )

  return (key) => {
    const c = parseCubeKey(key)
    switch (zoneOf(fields, c)) {
      case 'sea':
        return sea()
      case 'wetShore':
        return wetShore()
      case 'dryShore':
        return land(0, 1)
      case 'land': {
        const e = Math.round(fields.sample(c).elevation)
        return land(Math.max(0, e - 1), Math.min(LEVELS_COUNT - 1, e + 1))
      }
    }
  }
}
