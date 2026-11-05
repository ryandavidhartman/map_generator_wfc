// River loops: WFC only checks that river edges join up, so it happily closes rivers into
// rings, which real rivers never form (measured in M2: about 7 loops per 4,100-hex world).
// After each chunk solve, breakRiverLoops finds any river cycle and re-solves a small patch on
// it with river tiles banned in one cell, so WFC reroutes or ends the river there. Run after
// every chunk, this keeps the whole map loop-free: any new cycle must pass through the new
// chunk, whose cells are never locked.

import type { Rng } from '../engine/dice'
import { CUBE_DIRS, cubeCoordsInRadius, cubeKey, keyOf, parseCubeKey } from '../wfc/cube'
import { solveRegion, type TileStore } from '../wfc/recovery'
import { edgeOf, maskWhere, type AdjacencyRules, type PlacedTile } from '../wfc/rules'
import type { MaskFor } from '../wfc/solver'
import { HEX_DIRS, HEX_OPPOSITE } from '../wfc/tiles'

// Neighbors joined to this hex by a river (both tiles have river edges facing each other).
export function riverLinks(store: TileStore, key: string): string[] {
  const t = store.get(key)
  if (!t) return []
  const out: string[] = []
  CUBE_DIRS.forEach((d) => {
    if (edgeOf(t, d.name).type !== 'river') return
    const nk = cubeKey(t.q + d.dq, t.r + d.dr, t.s + d.ds)
    const n = store.get(nk)
    if (n && edgeOf(n, HEX_OPPOSITE[d.name]).type === 'river') out.push(nk)
  })
  return out
}

// One edge closing each independent cycle, in the river networks that contain `startKeys`.
// (In a spanning forest of the river graph, every edge not in the forest closes a cycle.)
export function findRiverLoops(store: TileStore, startKeys: Iterable<string>): [string, string][] {
  const parent = new Map<string, string | null>()
  const closing: [string, string][] = []
  for (const start of startKeys) {
    if (parent.has(start) || riverLinks(store, start).length === 0) continue
    parent.set(start, null)
    const queue = [start]
    while (queue.length) {
      const k = queue.shift()!
      for (const n of riverLinks(store, k)) {
        if (n === parent.get(k)) continue
        if (parent.has(n)) {
          if (k < n) closing.push([k, n])
        } else {
          parent.set(n, k)
          queue.push(n)
        }
      }
    }
  }
  // Each closing edge is seen from both ends; the k < n check keeps one, except where the BFS
  // reached n's side first. Deduplicate to be safe.
  const seen = new Set<string>()
  return closing.filter(([a, b]) => {
    const id = a < b ? `${a}|${b}` : `${b}|${a}`
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export type BreakLoopsOptions = {
  rng: Rng
  rules: AdjacencyRules
  maskFor: MaskFor
  isLocked: (key: string) => boolean
  patchRadius?: number
  maxIterations?: number
}

const noRiverMasks = new WeakMap<AdjacencyRules, Uint32Array>()

function noRiverMask(rules: AdjacencyRules): Uint32Array {
  let m = noRiverMasks.get(rules)
  if (!m) {
    m = maskWhere(rules, (s) => HEX_DIRS.every((d) => edgeOf(s, d).type !== 'river'))
    noRiverMasks.set(rules, m)
  }
  return m
}

// Break every river loop through `cellKeys` (the chunk just solved). Updates the store and
// returns the tiles written, and how many loops couldn't be broken.
export function breakRiverLoops(
  store: TileStore,
  cellKeys: Set<string>,
  options: BreakLoopsOptions,
): { updates: PlacedTile[]; unbroken: number } {
  const { rng, rules, maskFor, isLocked } = options
  const radius = options.patchRadius ?? 2
  const maxIterations = options.maxIterations ?? 30
  const updates = new Map<string, PlacedTile>()
  const given = new Set<string>() // closing edges we failed to break

  for (let iter = 0; iter < maxIterations; iter++) {
    const loops = findRiverLoops(store, cellKeys).filter(([a, b]) => !given.has(`${a}|${b}`))
    if (loops.length === 0) break
    const [a, b] = loops[0]
    // Break at an end of the closing edge, preferring one in the new chunk.
    const target = [a, b].find((k) => cellKeys.has(k) && !isLocked(k)) ?? [a, b].find((k) => !isLocked(k))
    if (!target) {
      given.add(`${a}|${b}`)
      continue
    }

    const patch = cubeCoordsInRadius(parseCubeKey(target), radius).filter((c) => {
      const k = keyOf(c)
      return store.has(k) && !isLocked(k)
    })
    const ban = noRiverMask(rules)
    const and = (m: Uint32Array | null) => (m ? m.map((w, i) => w & ban[i]) : ban)
    const patchMask: MaskFor = (key) => (key === target ? and(maskFor(key)) : maskFor(key))

    // Solve on a copy so a failed attempt leaves the store untouched.
    const trial: TileStore = new Map(store)
    for (const c of patch) trial.delete(keyOf(c))
    const result = solveRegion(trial, patch, { rng, rules, maskFor: patchMask, isLocked })
    if (!result.ok || result.dropped.length > 0) {
      given.add(`${a}|${b}`)
      continue
    }
    for (const t of result.updates) {
      const k = keyOf(t)
      const old = store.get(k)
      store.set(k, t)
      if (!old || old.type !== t.type || old.rotation !== t.rotation || old.level !== t.level) updates.set(k, t)
    }
  }
  const unbroken = findRiverLoops(store, cellKeys).length
  return { updates: [...updates.values()], unbroken }
}
