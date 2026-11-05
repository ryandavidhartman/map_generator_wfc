// Edge levels, compatibility and precomputed adjacency lookups for WFC.
//
// Ported from hex-map-wfc (src/hexmap/HexWFCCore.js and the state enumeration in
// src/workers/wfc.worker.js), Copyright (c) 2026 Felix Turner, MIT License:
// https://github.com/felixturner/hex-map-wfc/blob/main/LICENSE
// Changes: TypeScript types; the unused `allowed` map is dropped; state enumeration lives
// here once instead of being repeated in the worker; `findMismatches` is new.

import { CUBE_DIRS, cubeKey, type Cube } from './cube'
import {
  HEX_DIRS,
  HEX_OPPOSITE,
  LEVELS_COUNT,
  TILE_LIST,
  rotateHexEdges,
  type EdgeType,
  type HexDir,
} from './tiles'

// One placement of a tile: type id, rotation (0-5) and base level.
export type TileState = { type: number; rotation: number; level: number }
export type PlacedTile = Cube & TileState

export type StateKey = string

export function stateKey(s: TileState): StateKey {
  return `${s.type}_${s.rotation}_${s.level}`
}

export function parseStateKey(key: StateKey): TileState {
  const [type, rotation, level] = key.split('_').map(Number)
  return { type, rotation, level }
}

// Touching edges match when both their type and their level are equal. This is the rule the
// solver enforces (propagation looks states up by exact type and level). hex-map-wfc also has
// a looser `edgesCompatible` that lets grass join at any level, but only its renderer's seed
// replacement uses it, so it isn't ported.
export function edgesMatch(a: EdgeInfo, b: EdgeInfo): boolean {
  return a.type === b.type && a.level === b.level
}

const highEdgeCache = new Map<string, Set<HexDir>>()

// The level of one edge of a placed tile: base level, plus levelIncrement on high edges.
export function getEdgeLevel(type: number, rotation: number, dir: HexDir, baseLevel: number): number {
  const def = TILE_LIST[type]
  if (!def?.highEdges) return baseLevel
  const cacheKey = `${type}_${rotation}`
  let high = highEdgeCache.get(cacheKey)
  if (!high) {
    high = new Set(def.highEdges.map((d) => HEX_DIRS[(HEX_DIRS.indexOf(d) + rotation) % 6]))
    highEdgeCache.set(cacheKey, high)
  }
  return high.has(dir) ? baseLevel + (def.levelIncrement ?? 1) : baseLevel
}

// Every placement of the given tile types. Slopes only get base levels that keep their high
// edges within LEVELS_COUNT.
export function allStates(tileTypes: readonly number[]): TileState[] {
  const states: TileState[] = []
  for (const type of tileTypes) {
    const def = TILE_LIST[type]
    if (!def) continue
    const maxLevel = def.highEdges?.length
      ? LEVELS_COUNT - 1 - (def.levelIncrement ?? 1)
      : LEVELS_COUNT - 1
    for (let rotation = 0; rotation < 6; rotation++) {
      for (let level = 0; level <= maxLevel; level++) {
        states.push({ type, rotation, level })
      }
    }
  }
  return states
}

export type EdgeInfo = { type: EdgeType; level: number }

export const EDGE_TYPES: readonly EdgeType[] = ['grass', 'water', 'coast', 'river', 'road']
const MAX_EDGE_LEVEL = LEVELS_COUNT - 1
// An edge class is one (edge type, edge level) pair, numbered type * LEVELS_COUNT + level.
export const EDGE_CLASS_COUNT = EDGE_TYPES.length * LEVELS_COUNT

export function edgeClass(e: EdgeInfo): number {
  return EDGE_TYPES.indexOf(e.type) * LEVELS_COUNT + e.level
}

// Precomputed lookups over every state, as bitsets (Uint32Array, bit n = state n).
// hex-map-wfc stores the same information as Maps of string-keyed Sets; bitsets make
// propagation a few bitwise ORs and ANDs per neighbor instead of rebuilding string sets.
export class AdjacencyRules {
  readonly tileTypes: readonly number[]
  readonly states: readonly TileState[]
  readonly stateCount: number
  readonly words: number // Uint32 words per bitset
  readonly stateIndex = new Map<StateKey, number>()
  readonly weights: Float64Array // weight of each state's tile
  readonly stateTypes: Int32Array // tile type of each state
  // edgeClassOf[dirIndex][state] = edge class of that state's edge in that direction
  readonly edgeClassOf: Int32Array[]
  // classMask[dirIndex][class] = states whose edge in that direction is that class (or null)
  readonly classMask: (Uint32Array | null)[][]
  // typeMask.get(type) = all states of that tile type
  readonly typeMask = new Map<number, Uint32Array>()
  readonly full: Uint32Array // every state

  constructor(tileTypes: readonly number[] = TILE_LIST.map((_, i) => i)) {
    this.tileTypes = tileTypes
    this.states = allStates(tileTypes)
    this.stateCount = this.states.length
    this.words = Math.ceil(this.stateCount / 32)
    this.weights = new Float64Array(this.stateCount)
    this.stateTypes = new Int32Array(this.stateCount)
    this.edgeClassOf = HEX_DIRS.map(() => new Int32Array(this.stateCount))
    this.classMask = HEX_DIRS.map(() => new Array<Uint32Array | null>(EDGE_CLASS_COUNT).fill(null))
    this.full = new Uint32Array(this.words)

    this.states.forEach((state, n) => {
      this.stateIndex.set(stateKey(state), n)
      this.weights[n] = TILE_LIST[state.type].weight
      this.stateTypes[n] = state.type
      setBit(this.full, n)
      let tm = this.typeMask.get(state.type)
      if (!tm) this.typeMask.set(state.type, (tm = new Uint32Array(this.words)))
      setBit(tm, n)
      HEX_DIRS.forEach((dir, d) => {
        const e = edgeOf(state, dir)
        if (e.level > MAX_EDGE_LEVEL) throw new Error(`edge level ${e.level} out of range`)
        const c = edgeClass(e)
        this.edgeClassOf[d][n] = c
        setBit((this.classMask[d][c] ??= new Uint32Array(this.words)), n)
      })
    })
  }
}

export function setBit(bits: Uint32Array, n: number): void {
  bits[n >>> 5] |= 1 << (n & 31)
}

let defaultRules: AdjacencyRules | null = null

// Rules for the full tile list, built once (about 900 states).
export function getDefaultRules(): AdjacencyRules {
  return (defaultRules ??= new AdjacencyRules())
}

export type Mismatch = { a: PlacedTile; b: PlacedTile; dir: HexDir }

// The type and level of one edge of a placed tile.
export function edgeOf(t: TileState, dir: HexDir): EdgeInfo {
  return {
    type: rotateHexEdges(TILE_LIST[t.type].edges, t.rotation)[dir],
    level: getEdgeLevel(t.type, t.rotation, dir, t.level),
  }
}

// Every pair of adjacent tiles whose shared edges don't match. Each pair is reported once.
export function findMismatches(tiles: Iterable<PlacedTile>): Mismatch[] {
  const byKey = new Map<string, PlacedTile>()
  for (const t of tiles) byKey.set(cubeKey(t.q, t.r, t.s), t)
  const out: Mismatch[] = []
  for (const a of byKey.values()) {
    // Check only the first three directions; the other three are the same pairs reversed.
    for (let i = 0; i < 3; i++) {
      const d = CUBE_DIRS[i]
      const b = byKey.get(cubeKey(a.q + d.dq, a.r + d.dr, a.s + d.ds))
      if (!b) continue
      if (!edgesMatch(edgeOf(a, d.name), edgeOf(b, HEX_OPPOSITE[d.name]))) {
        out.push({ a, b, dir: d.name })
      }
    }
  }
  return out
}
