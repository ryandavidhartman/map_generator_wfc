import { describe, expect, it } from 'vitest'
import {
  AdjacencyRules,
  allStates,
  edgeClass,
  edgeOf,
  findMismatches,
  getDefaultRules,
  getEdgeLevel,
  parseStateKey,
  stateKey,
} from './rules'
import { HEX_DIRS, LEVELS_COUNT, TILE_LIST, TILE_TYPE, rotateHexEdges } from './tiles'

describe('tile list', () => {
  it('has the 34 active hex-map-wfc tiles, GRASS and WATER first', () => {
    expect(TILE_LIST).toHaveLength(34)
    expect(TILE_TYPE.GRASS).toBe(0)
    expect(TILE_TYPE.WATER).toBe(1)
    expect(new Set(TILE_LIST.map((t) => t.name)).size).toBe(34)
  })

  it('rotates edges clockwise, one 60° step per rotation', () => {
    const edges = TILE_LIST[TILE_TYPE.RIVER_END].edges // river on W only
    expect(rotateHexEdges(edges, 1).NW).toBe('river')
    expect(rotateHexEdges(edges, 2).NE).toBe('river')
    expect(rotateHexEdges(edges, 6)).toEqual(edges)
  })
})

describe('edge levels', () => {
  it('raises a slope\'s high edges by its levelIncrement, rotated with the tile', () => {
    const high = TILE_TYPE.GRASS_SLOPE_HIGH // highEdges NE, E, SE; +2
    expect(getEdgeLevel(high, 0, 'E', 1)).toBe(3)
    expect(getEdgeLevel(high, 0, 'W', 1)).toBe(1)
    expect(getEdgeLevel(high, 3, 'W', 1)).toBe(3) // rotated 180°: E becomes W
    expect(getEdgeLevel(TILE_TYPE.GRASS, 0, 'E', 2)).toBe(2)
  })

  it('never puts an edge above the top level', () => {
    for (const s of allStates(TILE_LIST.map((_, i) => i))) {
      for (const dir of HEX_DIRS) expect(edgeOf(s, dir).level).toBeLessThan(LEVELS_COUNT)
    }
  })
})

describe('AdjacencyRules', () => {
  const rules = getDefaultRules()

  it('indexes every state once', () => {
    expect(rules.stateCount).toBe(rules.states.length)
    expect(rules.stateIndex.size).toBe(rules.stateCount)
    rules.states.forEach((s, n) => expect(rules.stateIndex.get(stateKey(s))).toBe(n))
    expect(parseStateKey('3_4_2')).toEqual({ type: 3, rotation: 4, level: 2 })
  })

  it('puts each state in exactly the class mask of its edge, in every direction', () => {
    rules.states.forEach((s, n) => {
      HEX_DIRS.forEach((dir, d) => {
        const c = edgeClass(edgeOf(s, dir))
        expect(rules.edgeClassOf[d][n]).toBe(c)
        rules.classMask[d].forEach((mask, k) => {
          const has = mask ? (mask[n >>> 5] & (1 << (n & 31))) !== 0 : false
          expect(has).toBe(k === c)
        })
      })
    })
  }, 30000) // slow on a loaded machine (up to ~9 s seen); the default 5 s timeout made it flaky

  it('can be built for a subset of tiles', () => {
    const sub = new AdjacencyRules([TILE_TYPE.GRASS, TILE_TYPE.WATER])
    expect(sub.stateCount).toBe(2 * 6 * LEVELS_COUNT)
  })
})

describe('findMismatches', () => {
  const at = (q: number, r: number, type: number, rotation = 0, level = 0) => ({ q, r, s: -q - r, type, rotation, level })

  it('accepts matching edges and reports mismatched ones once', () => {
    expect(findMismatches([at(0, 0, TILE_TYPE.GRASS), at(1, 0, TILE_TYPE.GRASS)])).toEqual([])
    const bad = findMismatches([at(0, 0, TILE_TYPE.GRASS), at(1, 0, TILE_TYPE.WATER)])
    expect(bad).toHaveLength(1)
  })

  it('requires grass edges to match in level too, as the solver does', () => {
    expect(findMismatches([at(0, 0, TILE_TYPE.GRASS, 0, 0), at(1, 0, TILE_TYPE.GRASS, 0, 1)])).toHaveLength(1)
  })
})
