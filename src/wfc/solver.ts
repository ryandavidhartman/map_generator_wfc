// The WFC solver for one region: propagation, weighted collapse, trail-based backtracking,
// and "unfixing" of neighbor cells on a boundary conflict.
//
// Ported from hex-map-wfc (HexWFCSolver in src/workers/wfc.worker.js, HexWFCCell in
// src/hexmap/HexWFCCore.js), Copyright (c) 2026 Felix Turner, MIT License:
// https://github.com/felixturner/hex-map-wfc/blob/main/LICENSE
// The algorithm is the same: lowest-entropy cell first (log of its state count plus a little
// noise), weighted random collapse, propagation by matching edge type and level,
// trail-based backtracking (500 backtracks per try, `maxTries` tries), and unfixing of
// neighbor cells when the region's boundary is unsatisfiable. Changes:
// - Each cell's possible states are a bitset (see AdjacencyRules) instead of a Set of
//   string keys, and the trail records removed bits per cell. About 30x faster.
// - The Rng is injected instead of global.
// - Chaining prunes (removing a preventChaining tile's type from its neighbors) are recorded
//   on the trail, so backtracking restores them. hex-map-wfc doesn't record them, so after a
//   backtrack those states stayed removed for the rest of the try.
// - Logging and the collapse-order record (hex-map-wfc's drop-in animation) are removed.
// - `maskFor` (new): optional allowed states per cell, applied when cells are created (the
//   world layer uses it to keep water at sea and to steer elevation). A mask that would leave
//   a cell with no states is ignored for that cell.
//
// Terms:
// - solve cells: the region being solved; each starts with every state possible.
// - fixed cells: already-solved tiles just outside the region, used as read-only constraints.
// - neighbor cells: fixed cells that may be "unfixed" (turned into solve cells, with their own
//   neighbors, the anchors, becoming fixed) when they make the region unsolvable. A fixed
//   cell that isn't a neighbor cell is never changed. The world layer uses this to keep
//   revealed hexes fixed: it simply never passes them as neighbor cells.

import type { Rng } from '../engine/dice'
import { CUBE_DIRS, cubeKey, keyOf, parseCubeKey, type Cube } from './cube'
import { EDGE_CLASS_COUNT, edgeClass, edgeOf, type AdjacencyRules, type PlacedTile, type TileState } from './rules'
import { HEX_DIRS, HEX_OPPOSITE, TILE_LIST, type HexDir } from './tiles'

export type NeighborCell = PlacedTile & { anchors: PlacedTile[] }

export type Conflict = {
  failedKey: string // the solve cell left with no possible state
  sourceKey: string // the cell whose propagation emptied it
  dir: HexDir
}

// Allowed states for a solve cell (a bitset over AdjacencyRules.states), or null for any.
export type MaskFor = (key: string) => Uint32Array | null

export type SolverOptions = {
  rng: Rng
  maxTries?: number
  maxBacktracks?: number
  maskFor?: MaskFor
}

// Direction index → index of the opposite direction.
const OPPOSITE_INDEX = HEX_DIRS.map((d) => HEX_DIRS.indexOf(HEX_OPPOSITE[d]))

// A propagation link from a cell to a solve cell: the neighbor's index and the direction.
type Link = { cell: number; dir: number }

type Decision = {
  target: number
  prevBits: Uint32Array
  prevCount: number
  trailStart: number
  tried: Uint32Array
}

export class HexWFCSolver {
  private readonly rules: AdjacencyRules
  private readonly rng: Rng
  private readonly maxTries: number
  private readonly maxBacktracks: number
  private readonly maskFor: MaskFor | null
  private readonly W: number

  // Solve cells, by index.
  private keys: string[] = []
  private index = new Map<string, number>()
  private bits: Uint32Array[] = []
  private counts: Int32Array = new Int32Array(0)
  private collapsed: Uint8Array = new Uint8Array(0)
  private tiles: (TileState | null)[] = []
  private links: Link[][] = []
  private maskedCells: number[] = [] // cells narrowed by maskFor, to propagate from

  // Fixed cells, by index. fixedClasses[f][d] = edge class of its edge in direction d.
  private fixedKeys: string[] = []
  private fixedIndex = new Map<string, number>()
  private fixedClasses: number[][] = []
  private fixedLinks: Link[][] = []

  // Propagation stack: n >= 0 is solve cell n, n < 0 is fixed cell -n - 1.
  private stack: number[] = []
  private noChainTypes = new Set<number>()
  private trail: { cell: number; removed: Uint32Array }[] = []
  private decisions: Decision[] = []
  private readonly allowed: Uint32Array

  private neighborData = new Map<string, NeighborCell>()
  private neighborOriginals = new Map<string, PlacedTile>()

  backtracks = 0
  tryCount = 0
  lastConflict: Conflict | null = null
  neighborConflict: Conflict | null = null
  unfixedKeys: string[] = []
  changedFixedCells: PlacedTile[] = []

  constructor(rules: AdjacencyRules, options: SolverOptions) {
    this.rules = rules
    this.rng = options.rng
    this.maxTries = options.maxTries ?? 2
    this.maxBacktracks = options.maxBacktracks ?? 500
    this.maskFor = options.maskFor ?? null
    this.W = rules.words
    this.allowed = new Uint32Array(this.W)
  }

  // Register the fixed cells that may be unfixed on conflict.
  initNeighborData(neighborCells: NeighborCell[]): void {
    this.neighborData = new Map()
    this.neighborOriginals = new Map()
    this.unfixedKeys = []
    this.changedFixedCells = []
    for (const nc of neighborCells) {
      const key = keyOf(nc)
      this.neighborData.set(key, nc)
      this.neighborOriginals.set(key, { q: nc.q, r: nc.r, s: nc.s, type: nc.type, rotation: nc.rotation, level: nc.level })
    }
  }

  // Solve the region. Returns every solve cell's tile (including any unfixed neighbor
  // cells), or null on failure (see neighborConflict / lastConflict).
  solve(solveCells: Cube[], fixedCells: PlacedTile[], initialCollapses: PlacedTile[] = []): PlacedTile[] | null {
    const currentSolve = [...solveCells]
    const currentFixed = [...fixedCells]
    let totalBacktracks = 0
    this.neighborConflict = null

    for (let attempt = 1; attempt <= this.maxTries; attempt++) {
      this.reset(currentSolve, currentFixed, initialCollapses)

      // Propagate from fixed cells and initial collapses; unfix neighbor cells on conflict.
      let seedingOk = true
      if (currentFixed.length > 0 || initialCollapses.length > 0) {
        seedingOk = this.propagate()
        let maxUnfixes = this.neighborData.size
        while (!seedingOk && maxUnfixes > 0) {
          maxUnfixes--
          const conflict = this.lastConflict
          if (!conflict) break
          const candidates = this.findAdjacentNeighbors(conflict.failedKey, conflict.sourceKey)
          if (candidates.length === 0) break
          this.unfixNeighbor(candidates[0], currentSolve, currentFixed)
          this.reset(currentSolve, currentFixed, initialCollapses)
          seedingOk = this.propagate()
        }
      }
      if (!seedingOk) {
        this.neighborConflict = this.lastConflict
        this.backtracks = totalBacktracks
        return null
      }

      // Main loop: collapse the lowest-entropy cell, propagate, backtrack on conflict.
      let solved = false
      for (;;) {
        const target = this.findLowestEntropyCell()
        if (target < 0) {
          solved = true
          break
        }
        this.saveDecision(target)
        const decision = this.decisions[this.decisions.length - 1]
        if (!this.collapseWithExclusions(target, decision.tried)) {
          if (!this.backtrack()) break
          continue
        }
        if (!this.propagate()) {
          if (!this.backtrack()) break
        }
      }

      totalBacktracks += this.backtracks
      this.tryCount = attempt
      if (solved) {
        this.backtracks = totalBacktracks
        return this.extractResult()
      }
    }

    this.backtracks = totalBacktracks
    return null
  }

  // ---- setup ----

  private reset(solveCells: Cube[], fixedCells: PlacedTile[], initialCollapses: PlacedTile[]): void {
    this.init(solveCells, fixedCells)
    this.trail = []
    this.decisions = []
    this.backtracks = 0
    for (const ic of initialCollapses) {
      const n = this.index.get(keyOf(ic))
      if (n === undefined || this.collapsed[n]) continue
      const sn = this.rules.stateIndex.get(`${ic.type}_${ic.rotation}_${ic.level}`)
      if (sn === undefined) continue
      this.collapseTo(n, sn)
      this.stack.push(n)
    }
    for (let f = 0; f < this.fixedKeys.length; f++) this.stack.push(-f - 1)
    for (const n of this.maskedCells) this.stack.push(n)
  }

  private init(solveCells: Cube[], fixedCells: PlacedTile[]): void {
    const n = solveCells.length
    this.keys = solveCells.map(keyOf)
    this.index = new Map(this.keys.map((k, i) => [k, i]))
    this.bits = solveCells.map(() => this.rules.full.slice())
    this.counts = new Int32Array(n).fill(this.rules.stateCount)
    this.maskedCells = []
    if (this.maskFor) {
      for (let i = 0; i < n; i++) {
        const mask = this.maskFor(this.keys[i])
        if (!mask) continue
        let count = 0
        for (let w = 0; w < this.W; w++) count += popcount(this.bits[i][w] & mask[w])
        if (count === 0) continue // an impossible mask is ignored rather than failing the solve
        for (let w = 0; w < this.W; w++) this.bits[i][w] &= mask[w]
        this.counts[i] = count
        this.maskedCells.push(i)
      }
    }
    this.collapsed = new Uint8Array(n)
    this.tiles = new Array(n).fill(null)

    this.fixedKeys = fixedCells.map(keyOf)
    this.fixedIndex = new Map(this.fixedKeys.map((k, i) => [k, i]))
    this.fixedClasses = fixedCells.map((fc) => HEX_DIRS.map((dir) => edgeClass(edgeOf(fc, dir))))

    // Solve cells link to solve neighbors; fixed cells link to solve neighbors. (Solve cells
    // never need to constrain fixed cells, so links to fixed cells aren't kept.)
    const linksFrom = (c: Cube): Link[] => {
      const out: Link[] = []
      CUBE_DIRS.forEach((d, dir) => {
        const cell = this.index.get(cubeKey(c.q + d.dq, c.r + d.dr, c.s + d.ds))
        if (cell !== undefined) out.push({ cell, dir })
      })
      return out
    }
    this.links = solveCells.map(linksFrom)
    this.fixedLinks = fixedCells.map(linksFrom)

    this.stack = []
    this.noChainTypes = new Set(this.rules.tileTypes.filter((t) => TILE_LIST[t]?.preventChaining))
    fixedCells.forEach((fc, f) => {
      if (this.noChainTypes.has(fc.type)) this.pruneChaining(this.fixedLinks[f], fc.type)
    })
  }

  // ---- collapse ----

  private findLowestEntropyCell(): number {
    let min = Infinity
    let minCell = -1
    for (let n = 0; n < this.keys.length; n++) {
      if (this.collapsed[n] || this.counts[n] === 0) continue
      const entropy = Math.log(this.counts[n]) + this.rng() * 0.001
      if (entropy < min) {
        min = entropy
        minCell = n
      }
    }
    return minCell
  }

  private collapseWithExclusions(n: number, tried: Uint32Array): boolean {
    const bits = this.bits[n]
    const { weights } = this.rules
    let total = 0
    let any = false
    for (let w = 0; w < this.W; w++) {
      let word = bits[w] & ~tried[w]
      while (word) {
        const b = 31 - Math.clz32(word & -word)
        total += weights[(w << 5) | b]
        any = true
        word &= word - 1
      }
    }
    if (!any) return false

    let r = this.rng() * total
    let selected = -1
    outer: for (let w = 0; w < this.W; w++) {
      let word = bits[w] & ~tried[w]
      while (word) {
        const b = 31 - Math.clz32(word & -word)
        const sn = (w << 5) | b
        if (selected < 0) selected = sn // fallback, as hex-map-wfc: the first available state
        r -= weights[sn]
        if (r <= 0) {
          selected = sn
          break outer
        }
        word &= word - 1
      }
    }
    tried[selected >>> 5] |= 1 << (selected & 31)

    this.collapseTo(n, selected)
    this.stack.push(n)
    const type = this.rules.stateTypes[selected]
    if (this.noChainTypes.has(type)) this.pruneChaining(this.links[n], type)
    return true
  }

  private collapseTo(n: number, sn: number): void {
    const bits = this.bits[n]
    bits.fill(0)
    bits[sn >>> 5] = 1 << (sn & 31)
    this.counts[n] = 1
    this.collapsed[n] = 1
    this.tiles[n] = this.rules.states[sn]
  }

  // Remove every state of `type` from the uncollapsed solve cells in `links`.
  private pruneChaining(links: Link[], type: number): void {
    const mask = this.rules.typeMask.get(type)
    if (!mask) return
    for (const { cell } of links) {
      if (this.collapsed[cell]) continue
      if (this.removeBits(cell, mask, true) && this.counts[cell] > 0) this.stack.push(cell)
    }
  }

  // Remove states from a cell: those in `mask` when clearMask is true, those NOT in `mask`
  // when it's false. Records what was removed on the trail; returns whether anything changed.
  private removeBits(n: number, mask: Uint32Array, clearMask: boolean): boolean {
    const bits = this.bits[n]
    let removed: Uint32Array | null = null
    let count = 0
    for (let w = 0; w < this.W; w++) {
      const r = clearMask ? bits[w] & mask[w] : bits[w] & ~mask[w]
      if (r) {
        removed ??= new Uint32Array(this.W)
        removed[w] = r
        bits[w] &= ~r
        count += popcount(r)
      }
    }
    if (!removed) return false
    this.counts[n] -= count
    this.trail.push({ cell: n, removed })
    return true
  }

  // ---- propagation ----

  private propagate(): boolean {
    const { classMask } = this.rules
    const allowed = this.allowed
    while (this.stack.length > 0) {
      const item = this.stack.pop()!
      const fixed = item < 0
      const links = fixed ? this.fixedLinks[-item - 1] : this.links[item]

      for (const { cell, dir } of links) {
        if (this.collapsed[cell]) continue
        const back = OPPOSITE_INDEX[dir]

        // States the neighbor may take: those whose returning edge has the same class
        // (type and level) as one of this cell's possible edges in `dir`.
        allowed.fill(0)
        if (fixed) {
          const m = classMask[back][this.fixedClasses[-item - 1][dir]]
          if (m) for (let w = 0; w < this.W; w++) allowed[w] = m[w]
        } else {
          const bits = this.bits[item]
          for (let c = 0; c < EDGE_CLASS_COUNT; c++) {
            const mine = classMask[dir][c]
            const theirs = classMask[back][c]
            if (!mine || !theirs || !intersects(bits, mine, this.W)) continue
            for (let w = 0; w < this.W; w++) allowed[w] |= theirs[w]
          }
        }

        const changed = this.removeBits(cell, allowed, false)
        if (this.counts[cell] === 0) {
          this.lastConflict = {
            failedKey: this.keys[cell],
            sourceKey: fixed ? this.fixedKeys[-item - 1] : this.keys[item],
            dir: HEX_DIRS[dir],
          }
          return false
        }
        if (changed) this.stack.push(cell)
      }
    }
    return true
  }

  // ---- backtracking ----

  private saveDecision(target: number): void {
    this.decisions.push({
      target,
      prevBits: this.bits[target].slice(),
      prevCount: this.counts[target],
      trailStart: this.trail.length,
      tried: new Uint32Array(this.W),
    })
  }

  private undoLastDecision(): Decision | null {
    const decision = this.decisions[this.decisions.length - 1]
    if (!decision) return null
    for (let i = this.trail.length - 1; i >= decision.trailStart; i--) {
      const { cell, removed } = this.trail[i]
      const bits = this.bits[cell]
      let count = 0
      for (let w = 0; w < this.W; w++) {
        bits[w] |= removed[w]
        count += popcount(removed[w])
      }
      this.counts[cell] += count
    }
    this.trail.length = decision.trailStart
    const n = decision.target
    this.bits[n].set(decision.prevBits)
    this.counts[n] = decision.prevCount
    this.collapsed[n] = 0
    this.tiles[n] = null
    this.stack = []
    return decision
  }

  // Undo decisions until one has an untried state left. False when out of decisions or
  // over the backtrack limit.
  private backtrack(): boolean {
    for (;;) {
      this.backtracks++
      if (this.backtracks >= this.maxBacktracks) return false
      const decision = this.undoLastDecision()
      if (!decision) return false
      const bits = this.bits[decision.target]
      for (let w = 0; w < this.W; w++) {
        if (bits[w] & ~decision.tried[w]) return true
      }
      this.decisions.pop()
    }
  }

  // ---- neighbor-cell unfixing ----

  // Unfixable neighbor cells next to a conflict: the conflict's source first (if it's one),
  // then the failed cell's other unfixable neighbors.
  private findAdjacentNeighbors(failedKey: string, sourceKey: string): string[] {
    const out: string[] = []
    if (this.fixedIndex.has(sourceKey) && this.neighborData.has(sourceKey)) out.push(sourceKey)
    const { q, r, s } = parseCubeKey(failedKey)
    for (const d of CUBE_DIRS) {
      const nKey = cubeKey(q + d.dq, r + d.dr, s + d.ds)
      if (nKey !== sourceKey && this.fixedIndex.has(nKey) && this.neighborData.has(nKey)) out.push(nKey)
    }
    return out
  }

  // Turn a neighbor cell into a solve cell; its anchors become fixed cells.
  private unfixNeighbor(key: string, solveCells: Cube[], fixedCells: PlacedTile[]): void {
    const data = this.neighborData.get(key)
    if (!data) return
    const idx = fixedCells.findIndex((fc) => keyOf(fc) === key)
    if (idx !== -1) fixedCells.splice(idx, 1)
    if (!solveCells.some((c) => keyOf(c) === key)) solveCells.push(parseCubeKey(key))
    for (const a of data.anchors) {
      const aKey = keyOf(a)
      if (!fixedCells.some((fc) => keyOf(fc) === aKey) && !solveCells.some((c) => keyOf(c) === aKey)) {
        fixedCells.push({ q: a.q, r: a.r, s: a.s, type: a.type, rotation: a.rotation, level: a.level })
      }
    }
    this.neighborData.delete(key)
    this.unfixedKeys.push(key)
  }

  private extractResult(): PlacedTile[] {
    const result: PlacedTile[] = []
    this.keys.forEach((key, n) => {
      const tile = this.tiles[n]
      if (tile) result.push({ ...parseCubeKey(key), type: tile.type, rotation: tile.rotation, level: tile.level })
    })
    this.changedFixedCells = []
    for (const k of this.unfixedKeys) {
      const n = this.index.get(k)
      const tile = n === undefined ? null : this.tiles[n]
      const original = this.neighborOriginals.get(k)
      if (!tile || !original) continue
      if (tile.type !== original.type || tile.rotation !== original.rotation || tile.level !== original.level) {
        this.changedFixedCells.push({ q: original.q, r: original.r, s: original.s, type: tile.type, rotation: tile.rotation, level: tile.level })
      }
    }
    return result
  }
}

function intersects(a: Uint32Array, b: Uint32Array, words: number): boolean {
  for (let w = 0; w < words; w++) if (a[w] & b[w]) return true
  return false
}

function popcount(x: number): number {
  x -= (x >>> 1) & 0x55555555
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333)
  x = (x + (x >>> 4)) & 0x0f0f0f0f
  return Math.imul(x, 0x01010101) >>> 24
}
