// Solve a region against the tiles around it, with hex-map-wfc's layered recovery:
//   1. Solve, letting the solver unfix conflicting neighbor cells.
//   2. Local-WFC: re-solve a radius-2 patch around a nearby fixed cell to make the boundary
//      friendlier, then retry (up to 5 times).
//   3. Drop: ignore fixed cells one at a time, nearest the failure first, and retry. A dropped
//      cell keeps its tile, so its edge with the region may not match (hex-map-wfc hides this
//      with a mountain decoration).
//
// Ported from hex-map-wfc (WFCManager.runWfcAttempt, getFixedCellsForRegion and
// getAnchorsForCell in src/hexmap/WFCManager.js; HexMap._setupPopulateContext and
// _runWfcWithRecovery in src/hexmap/HexMap.js), Copyright (c) 2026 Felix Turner, MIT License:
// https://github.com/felixturner/hex-map-wfc/blob/main/LICENSE
// Changes:
// - Runs synchronously on a plain tile map (it runs inside the worker as a whole) instead of
//   orchestrating several worker calls and updating rendered grids.
// - `isLocked`: locked tiles (revealed hexes) are never unfixed, never re-solved by
//   Local-WFC and never used as a Local-WFC center. They can still be dropped, which leaves
//   their tile unchanged.
// - Returns the list of tiles written instead of rendering them.

import type { Rng } from '../engine/dice'
import { CUBE_DIRS, cubeCoordsInRadius, cubeDistance, cubeKey, keyOf, parseCubeKey, type Cube } from './cube'
import { getDefaultRules, type AdjacencyRules, type PlacedTile } from './rules'
import { HexWFCSolver, type Conflict, type NeighborCell } from './solver'

export type TileStore = Map<string, PlacedTile> // keyed by cubeKey

export type RegionSolveOptions = {
  rng: Rng
  rules?: AdjacencyRules
  isLocked?: (key: string) => boolean
  initialCollapses?: PlacedTile[]
  maxLocalAttempts?: number
}

export type RegionSolveStats = {
  tries: number
  backtracks: number
  localWfcAttempts: number
  unfixed: number
  dropped: number
}

export type RegionSolveResult = {
  ok: boolean
  // Every tile written to the store (new, or changed by unfixing or Local-WFC).
  updates: PlacedTile[]
  // Fixed cells whose constraint was ignored. Their edge with the region may not match.
  dropped: Cube[]
  stats: RegionSolveStats
}

type FixedCell = PlacedTile & { dropped?: boolean }

type Context = {
  solveCells: Cube[]
  fixedCells: FixedCell[]
  anchorMap: Map<string, PlacedTile[]>
  persistedUnfixedKeys: Set<string>
  initialCollapses: PlacedTile[]
}

// One shape for success and failure: the project's tsconfig isn't `strict`, so TypeScript
// can't narrow a union on a boolean flag.
type AttemptResult = {
  success: boolean
  tiles: PlacedTile[] // empty on failure
  unfixed: number
  conflict: Conflict | null
  isNeighborConflict: boolean
}

// Solve `solveCells` (none of which may be in the store) against the store's tiles. The store
// is updated in place with every tile written, including on failure (Local-WFC changes stay).
export function solveRegion(store: TileStore, solveCells: Cube[], options: RegionSolveOptions): RegionSolveResult {
  const rules = options.rules ?? getDefaultRules()
  const isLocked = options.isLocked ?? (() => false)
  const maxLocalAttempts = options.maxLocalAttempts ?? 5
  const { rng } = options
  const stats: RegionSolveStats = { tries: 0, backtracks: 0, localWfcAttempts: 0, unfixed: 0, dropped: 0 }
  const updates = new Map<string, PlacedTile>()
  const dropped: Cube[] = []

  const write = (tiles: PlacedTile[]) => {
    for (const t of tiles) {
      const key = keyOf(t)
      const old = store.get(key)
      if (old && old.type === t.type && old.rotation === t.rotation && old.level === t.level) continue
      const tile = { q: t.q, r: t.r, s: t.s, type: t.type, rotation: t.rotation, level: t.level }
      store.set(key, tile)
      updates.set(key, tile)
    }
  }

  const ctx: Context = {
    solveCells,
    fixedCells: [],
    anchorMap: new Map(),
    persistedUnfixedKeys: new Set(),
    initialCollapses: options.initialCollapses ?? [],
  }
  const rebuildFixed = () => {
    ctx.fixedCells = getFixedCellsForRegion(store, ctx.solveCells)
    const solveSet = new Set(ctx.solveCells.map(keyOf))
    const fixedSet = new Set(ctx.fixedCells.map(keyOf))
    ctx.anchorMap = new Map(ctx.fixedCells.map((fc) => [keyOf(fc), getAnchorsForCell(store, fc, solveSet, fixedSet)]))
  }
  rebuildFixed()

  const attempt = (): AttemptResult => {
    let activeFixed: PlacedTile[] = ctx.fixedCells.filter((fc) => !fc.dropped)
    let activeSolve = ctx.solveCells

    // Cells unfixed by an earlier failed attempt stay solve cells; their anchors are fixed.
    if (ctx.persistedUnfixedKeys.size > 0) {
      activeSolve = [...ctx.solveCells]
      const solveKeys = new Set(activeSolve.map(keyOf))
      const fixedKeys = new Set(activeFixed.map(keyOf))
      const anchorFixed: PlacedTile[] = []
      const anchorKeys = new Set<string>()
      for (const uk of ctx.persistedUnfixedKeys) {
        if (!solveKeys.has(uk)) {
          activeSolve.push(parseCubeKey(uk))
          solveKeys.add(uk)
        }
        for (const a of ctx.anchorMap.get(uk) ?? []) {
          const ak = keyOf(a)
          if (!fixedKeys.has(ak) && !solveKeys.has(ak) && !anchorKeys.has(ak)) {
            anchorFixed.push(a)
            anchorKeys.add(ak)
          }
        }
      }
      activeFixed = [...activeFixed.filter((fc) => !ctx.persistedUnfixedKeys.has(keyOf(fc))), ...anchorFixed]
    }

    const neighborCells: NeighborCell[] = activeFixed
      .filter((fc) => !ctx.persistedUnfixedKeys.has(keyOf(fc)) && !isLocked(keyOf(fc)))
      .map((fc) => ({ ...plain(fc), anchors: ctx.anchorMap.get(keyOf(fc)) ?? [] }))

    const solver = new HexWFCSolver(rules, { rng, maxTries: 2 })
    solver.initNeighborData(neighborCells)
    const tiles = solver.solve(activeSolve, activeFixed, ctx.initialCollapses)
    stats.tries += solver.tryCount
    stats.backtracks += solver.backtracks

    if (tiles) {
      const unfixed = solver.unfixedKeys.length + ctx.persistedUnfixedKeys.size
      return { success: true, tiles, unfixed, conflict: null, isNeighborConflict: false }
    }
    for (const uk of solver.unfixedKeys) ctx.persistedUnfixedKeys.add(uk)
    return {
      success: false,
      tiles: [],
      unfixed: 0,
      conflict: solver.neighborConflict ?? solver.lastConflict,
      isNeighborConflict: solver.neighborConflict !== null,
    }
  }

  let result = attempt()

  if (!result.success) {
    let failedCell = result.conflict ? parseCubeKey(result.conflict.failedKey) : null
    let sourceKey = result.conflict?.sourceKey ?? null
    let isNeighborConflict = result.isNeighborConflict

    // Phase 2: Local-WFC around the conflict.
    const resolvedRegions = new Set<string>()
    let localAttempts = 0
    while (!result.success && localAttempts < maxLocalAttempts && failedCell) {
      let center: Cube
      if (localAttempts === 0 && isNeighborConflict && sourceKey && !isLocked(sourceKey)) {
        center = parseCubeKey(sourceKey)
        resolvedRegions.add(sourceKey)
      } else {
        const fc = failedCell
        const candidates = ctx.fixedCells.filter(
          (c) => !c.dropped && !resolvedRegions.has(keyOf(c)) && !isLocked(keyOf(c)),
        )
        if (candidates.length === 0) break
        candidates.sort((a, b) => cubeDistance(a, fc) - cubeDistance(b, fc))
        center = candidates[0]
        resolvedRegions.add(keyOf(center))
      }
      localAttempts++
      stats.localWfcAttempts++

      const localSolve = cubeCoordsInRadius(center, 2).filter((c) => store.has(keyOf(c)) && !isLocked(keyOf(c)))
      if (localSolve.length === 0) continue
      const localSolver = new HexWFCSolver(rules, { rng, maxTries: 5 })
      const localTiles = localSolver.solve(localSolve, getFixedCellsForRegion(store, localSolve))
      if (!localTiles) continue
      write(localTiles)

      rebuildFixed()
      ctx.persistedUnfixedKeys.clear()
      result = attempt()
      if (!result.success) {
        failedCell = result.conflict ? parseCubeKey(result.conflict.failedKey) : failedCell
        sourceKey = result.conflict?.sourceKey ?? null
        isNeighborConflict = result.isNeighborConflict
      }
    }

    // Phase 3: drop fixed cells, nearest the failure first.
    ctx.persistedUnfixedKeys.clear()
    while (!result.success) {
      const candidates = ctx.fixedCells.filter((c) => !c.dropped)
      if (candidates.length === 0) break
      const fc = failedCell
      if (fc) candidates.sort((a, b) => cubeDistance(a, fc) - cubeDistance(b, fc))
      const toDrop = candidates[0]
      toDrop.dropped = true
      dropped.push({ q: toDrop.q, r: toDrop.r, s: toDrop.s })
      stats.dropped++
      result = attempt()
      if (!result.success && result.conflict) failedCell = parseCubeKey(result.conflict.failedKey)
    }
  }

  if (result.success) {
    stats.unfixed = result.unfixed
    write(result.tiles)
  }
  return { ok: result.success, updates: [...updates.values()], dropped, stats }
}

// Solved tiles in the store that touch the region from outside, each listed once.
export function getFixedCellsForRegion(store: TileStore, solveCells: Cube[]): PlacedTile[] {
  const solveSet = new Set(solveCells.map(keyOf))
  const fixed = new Map<string, PlacedTile>()
  for (const c of solveCells) {
    for (const d of CUBE_DIRS) {
      const key = cubeKey(c.q + d.dq, c.r + d.dr, c.s + d.ds)
      if (solveSet.has(key) || fixed.has(key)) continue
      const t = store.get(key)
      if (t) fixed.set(key, plain(t))
    }
  }
  return [...fixed.values()]
}

// A fixed cell's anchors: its solved neighbors that are neither in the region nor fixed.
export function getAnchorsForCell(
  store: TileStore,
  fc: Cube,
  solveSet: Set<string>,
  fixedSet: Set<string>,
): PlacedTile[] {
  const anchors: PlacedTile[] = []
  for (const d of CUBE_DIRS) {
    const key = cubeKey(fc.q + d.dq, fc.r + d.dr, fc.s + d.ds)
    if (solveSet.has(key) || fixedSet.has(key)) continue
    const t = store.get(key)
    if (t) anchors.push(plain(t))
  }
  return anchors
}

function plain(t: PlacedTile): PlacedTile {
  return { q: t.q, r: t.r, s: t.s, type: t.type, rotation: t.rotation, level: t.level }
}
