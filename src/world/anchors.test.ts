import { describe, expect, it } from 'vitest'
import { locationFeatureForD200 } from '../data/locationTables'
import { rollAnchorSettlement } from '../engine/generateHex'
import { EMPTY_MAP_STATE, mapReducer } from '../state/mapReducer'
import { FIXTURE_TILES, startMapAction } from '../state/testWorld'
import { mulberry32 } from '../wfc/rng'
import { TILE_LIST, TILE_TYPE } from '../wfc/tiles'
import { isSettlementAnchor } from './anchors'

describe('isSettlementAnchor', () => {
  it('is a road end, a road junction, or a river crossing', () => {
    const anchors = TILE_LIST.filter((_, i) => isSettlementAnchor(i)).map((t) => t.name).sort()
    expect(anchors).toEqual(['RIVER_CROSSING_A', 'RIVER_CROSSING_B', 'ROAD_D', 'ROAD_E', 'ROAD_END', 'ROAD_F'].sort())
  })

  it('is not a plain road, a river or open ground', () => {
    for (const t of ['ROAD_A', 'ROAD_B', 'ROAD_A_SLOPE_HIGH', 'RIVER_A', 'GRASS', 'WATER', 'COAST_A']) expect(isSettlementAnchor(TILE_TYPE[t])).toBe(false)
  })
})

describe('rollAnchorSettlement', () => {
  it("always gives a settlement, with the d200 table's type odds", () => {
    const rng = mulberry32(5)
    const counts: Record<string, number> = {}
    for (let i = 0; i < 4000; i++) {
      const poi = rollAnchorSettlement('Grassland', rng)
      expect(poi.siteKind).toBe('settlement')
      counts[poi.location] = (counts[poi.location] ?? 0) + 1
    }
    // The table's settlement rows, by width.
    const rows: Record<string, number> = {}
    for (let r = 1; r <= 200; r++) {
      const e = locationFeatureForD200(r)
      if (e.routesTo === 'settlement') rows[e.feature] = (rows[e.feature] ?? 0) + 1
    }
    const total = Object.values(rows).reduce((a, b) => a + b, 0)
    for (const [feature, n] of Object.entries(rows)) expect((counts[feature] ?? 0) / 4000).toBeCloseTo(n / total, 1)
  })
})

describe('revealing an anchor hex', () => {
  const tiles = { ...FIXTURE_TILES, '1,0': [TILE_TYPE.ROAD_END, 0, 0] as [number, number, number] }

  it('makes it a settlement, on reveal and on reroll, while other hexes roll as before', () => {
    let state = mapReducer(EMPTY_MAP_STATE, { ...startMapAction(), tiles, rng: mulberry32(1) })
    state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: () => 0.99 })
    expect(state.hexes['1,0'].poi?.siteKind).toBe('settlement')
    state = mapReducer(state, { type: 'REROLL_HEX', hexId: '1,0', rng: mulberry32(9) })
    expect(state.hexes['1,0'].poi?.siteKind).toBe('settlement')
    // Not an anchor: the 1-in-6 gate fails on a high roll, so no POI.
    state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,-1', rng: () => 0.99 })
    expect(state.hexes['1,-1'].poi).toBeUndefined()
  })

  it('applies to the starting hex too', () => {
    const state = mapReducer(EMPTY_MAP_STATE, { ...startMapAction('1,0'), tiles, rng: () => 0.99 })
    expect(state.hexes['1,0'].poi?.siteKind).toBe('settlement')
  })
})
