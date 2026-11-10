// Measure a generated world against the tuning targets (used by `npm run sim` and tests).

import { ALL_TERRAINS, type Terrain } from '../data/tables'
import { chunkKey, chunkNeighbors, type ChunkCoord } from '../wfc/chunks'
import { CUBE_DIRS, cubeKey } from '../wfc/cube'
import type { RegionSolveResult, TileStore } from '../wfc/recovery'
import { createWorldFields, placeWorld, type WorldFields, type WorldParams } from './fields'
import { isSettlementAnchor } from './anchors'
import { solveWorldChunk } from './solve'
import { findRiverLoops } from './rivers'
import { deriveHexGeo, type HexGeo } from './terrain'

// Share of land (every terrain but Ocean): map_generator's 3d6 land-terrain table with the
// unused Ocean row taken out (punch-list item 1a). Coast comes from WFC's coastline, so it is
// reported but not directly tunable.
export const TERRAIN_TARGETS: Record<Exclude<Terrain, 'Ocean'>, number> = {
  'Desert/arctic': 0.021,
  Swamp: 0.08,
  Grassland: 0.305,
  'Forest/jungle': 0.27,
  Hills: 0.125,
  Coast: 0.18,
  Mountain: 0.021,
}

// Other targets from punch-list item 1a.
export const WORLD_TARGETS = {
  biggestLandmassShare: 0.95, // at least
  riverShareOfLand: 0.17, // about
  lakeShareOfLand: 0.05, // about
  oneHexPondShare: 0.05, // of water bodies, at most
}

export type WorldStats = {
  hexes: number
  land: number
  waterShare: number
  terrainShareOfLand: Record<Terrain, number>
  oceanBodies: number[] // sizes, largest first
  // One-hex water bodies, as a share of the water bodies that don't touch the edge of the
  // generated area (a body at the edge may continue into unsolved chunks).
  oneHexPondShare: number
  landmasses: number[] // sizes, largest first
  biggestLandmassShare: number
  riverShareOfLand: number
  roadShareOfLand: number
  anchorShareOfLand: number // settlement anchors (anchors.ts): road ends, junctions, river crossings
  lakeShareOfLand: number
  riverLoops: number // independent river cycles (rivers.ts breaks them; should be ~0)
}

export function measureWorld(store: TileStore, fields: WorldFields): WorldStats {
  const geo = new Map<string, HexGeo>()
  for (const [k, t] of store) geo.set(k, deriveHexGeo(t, fields))
  const all = [...geo.values()]
  const landHexes = all.filter((g) => g.terrain !== 'Ocean')
  const land = landHexes.length
  const share = (n: number, d: number) => (d === 0 ? 0 : n / d)

  const terrainShareOfLand = Object.fromEntries(
    ALL_TERRAINS.map((t) => [t, share(all.filter((g) => g.terrain === t).length, t === 'Ocean' ? all.length : land)]),
  ) as Record<Terrain, number>

  const ocean = components(store, (k) => geo.get(k)!.terrain === 'Ocean')
  const oceanBodies = ocean.map((b) => b.size)
  const enclosed = ocean.filter((b) => !b.touchesEdge)
  const landmasses = components(store, (k) => geo.get(k)!.terrain !== 'Ocean').map((b) => b.size)
  return {
    hexes: all.length,
    land,
    waterShare: share(all.length - land, all.length),
    terrainShareOfLand,
    oceanBodies,
    oneHexPondShare: share(enclosed.filter((b) => b.size === 1).length, enclosed.length),
    landmasses,
    biggestLandmassShare: share(landmasses[0] ?? 0, land),
    riverShareOfLand: share(landHexes.filter((g) => g.riverEdges.length > 0).length, land),
    roadShareOfLand: share(landHexes.filter((g) => g.roadEdges.length > 0).length, land),
    anchorShareOfLand: share([...store.entries()].filter(([k, t]) => geo.get(k)!.terrain !== 'Ocean' && isSettlementAnchor(t.type)).length, land),
    lakeShareOfLand: share(landHexes.filter((g) => g.lake).length, land),
    riverLoops: findRiverLoops(store, store.keys()).length,
  }
}

// The connected groups of hexes matching `pred`, largest first, and whether each touches the
// edge of the generated area.
function components(store: TileStore, pred: (key: string) => boolean): { size: number; touchesEdge: boolean }[] {
  const seen = new Set<string>()
  const groups: { size: number; touchesEdge: boolean }[] = []
  for (const start of store.keys()) {
    if (seen.has(start) || !pred(start)) continue
    seen.add(start)
    const stack = [start]
    let n = 0
    let touchesEdge = false
    while (stack.length) {
      const k = stack.pop()!
      n++
      const [q, r, s] = k.split(',').map(Number)
      for (const d of CUBE_DIRS) {
        const nk = cubeKey(q + d.dq, r + d.dr, s + d.ds)
        if (!store.has(nk)) touchesEdge = true
        else if (!seen.has(nk) && pred(nk)) {
          seen.add(nk)
          stack.push(nk)
        }
      }
    }
    groups.push({ size: n, touchesEdge })
  }
  return groups.sort((a, b) => b.size - a.size)
}

// Chunks in rings around the origin chunk, nearest first (the order exploration grows them).
export function chunksInRings(rings: number): ChunkCoord[] {
  const out: ChunkCoord[] = [{ i: 0, j: 0 }]
  const seen = new Set([chunkKey(out[0])])
  let frontier = out.slice()
  for (let k = 0; k < rings; k++) {
    const next: ChunkCoord[] = []
    for (const c of frontier) {
      for (const n of chunkNeighbors(c)) {
        if (seen.has(chunkKey(n))) continue
        seen.add(chunkKey(n))
        next.push(n)
      }
    }
    out.push(...next)
    frontier = next
  }
  return out
}

export type GrownWorld = {
  params: WorldParams
  fields: WorldFields
  store: TileStore
  solves: RegionSolveResult[]
  ms: number
}

// Generate a world as a campaign would: placed with the start on land, then grown ring by ring.
export function growWorld(seed: number, rings: number): GrownWorld {
  const params = placeWorld(seed, false)
  const fields = createWorldFields(params)
  const store: TileStore = new Map()
  const t0 = performance.now()
  const solves = chunksInRings(rings).map((c) => solveWorldChunk(store, c, fields))
  return { params, fields, store, solves, ms: performance.now() - t0 }
}
