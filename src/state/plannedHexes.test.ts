// GM planning of unrevealed hexes (PLAN.md punch-list item 3): PLAN_HEX / CLEAR_PLAN, the reveal
// using the plan, and planned hexes locked like revealed ones.
import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../wfc/rng'
import { TILE_TYPE } from '../wfc/tiles'
import { geoAt, type SavedTiles } from '../world/hexTiles'
import { isPlannable, lockedHexIds, mapReducer, withMapStateDefaults, type MapState } from './mapReducer'
import { FIXTURE_WORLD, startMapAction } from './testWorld'

const start = () => mapReducer(withMapStateDefaults(null), { ...startMapAction(), rng: mulberry32(1) })
const tileOf = (s: MapState, id: string) => s.tiles[id]
const terrainOf = (tiles: SavedTiles, id: string) => geoAt(FIXTURE_WORLD, tiles, id)!.terrain

describe('PLAN_HEX and CLEAR_PLAN', () => {
  it('plans a solved, unrevealed hex; refuses revealed, unsolved and no-map hexes', () => {
    const s = start()
    expect(s.planned).toEqual({})
    expect(isPlannable(s, '3,0')).toBe(true)
    expect(isPlannable(s, '0,0')).toBe(false) // revealed
    expect(isPlannable(s, '99,0')).toBe(false) // unsolved
    const planned = mapReducer(s, { type: 'PLAN_HEX', hexId: '3,0', plan: { danger: 'Deadly' } })
    expect(planned.planned['3,0']).toEqual({ danger: 'Deadly' })
    expect(mapReducer(s, { type: 'PLAN_HEX', hexId: '0,0', plan: { danger: 'Deadly' } })).toBe(s)
    expect(mapReducer(s, { type: 'PLAN_HEX', hexId: '99,0', plan: { danger: 'Deadly' } })).toBe(s)
    const empty = withMapStateDefaults(null)
    expect(mapReducer(empty, { type: 'PLAN_HEX', hexId: '3,0', plan: {} })).toBe(empty)
  })

  it('a new plan replaces the old one; CLEAR_PLAN drops it', () => {
    let s = start()
    s = mapReducer(s, { type: 'PLAN_HEX', hexId: '3,0', plan: { danger: 'Deadly', poi: null } })
    s = mapReducer(s, { type: 'PLAN_HEX', hexId: '3,0', plan: { dangerLevel: 7 } })
    expect(s.planned['3,0']).toEqual({ dangerLevel: 7 })
    s = mapReducer(s, { type: 'CLEAR_PLAN', hexId: '3,0' })
    expect(s.planned).toEqual({})
    expect(mapReducer(s, { type: 'CLEAR_PLAN', hexId: '3,0' })).toBe(s)
  })

  it('a flat-land terrain change is a label only: the tile stays', () => {
    const s = start()
    const label = terrainOf(s.tiles, '3,0') === 'Swamp' ? 'Grassland' : 'Swamp'
    const planned = mapReducer(s, { type: 'PLAN_HEX', hexId: '3,0', plan: { terrain: label } })
    expect(planned.tiles).toBe(s.tiles)
    expect(planned.planned['3,0']).toEqual({ terrain: label })
  })

  it('a change of shape reshapes the tile (or flags a mismatch), never touching revealed or planned hexes', () => {
    let s = start()
    s = mapReducer(s, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: mulberry32(2) })
    s = mapReducer(s, { type: 'PLAN_HEX', hexId: '3,-1', plan: { danger: 'Safe' } })
    const before = { revealed: tileOf(s, '1,0'), planned: tileOf(s, '3,-1') }
    const after = mapReducer(s, { type: 'PLAN_HEX', hexId: '3,0', plan: { terrain: 'Mountain' }, rng: mulberry32(3) })
    expect(tileOf(after, '1,0')).toEqual(before.revealed)
    expect(tileOf(after, '3,-1')).toEqual(before.planned)
    const shaped = terrainOf(after.tiles, '3,0')
    if (after.planned['3,0'].tileMismatch) expect(shaped).not.toBe('Mountain')
    else expect(shaped).toBe('Mountain')
    expect(after.tiles).not.toBe(s.tiles) // something changed: the hex, or its fallback shape
  })
})

describe('revealing a planned hex', () => {
  it('uses what the plan sets and rolls the rest, then drops the plan', () => {
    let s = start()
    s = mapReducer(s, {
      type: 'PLAN_HEX',
      hexId: '1,0',
      plan: { terrain: 'Swamp', danger: 'Deadly', dangerLevel: 9, poi: { location: 'Witch hut', development: 'Abandoned' } },
    })
    s = mapReducer(s, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: mulberry32(4) })
    expect(s.hexes['1,0']).toMatchObject({ terrain: 'Swamp', danger: 'Deadly', dangerLevel: 9, poi: { location: 'Witch hut', development: 'Abandoned' } })
    expect(s.planned).toEqual({})
  })

  it('a planned Feature table row reveals as that row, routed to its site generator', () => {
    for (const [roll, siteKind, forcedType] of [
      [180, 'settlement', 'Town'],
      [95, 'dungeon', 'Tomb'],
      [5, 'tower', undefined],
      [127, 'camp', undefined],
    ] as const) {
      let s = start()
      s = mapReducer(s, { type: 'PLAN_HEX', hexId: '1,0', plan: { poiFeature: roll } })
      s = mapReducer(s, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: mulberry32(roll) })
      expect(s.hexes['1,0'].poi?.siteKind, String(roll)).toBe(siteKind)
      expect(s.hexes['1,0'].poi?.forcedType, String(roll)).toBe(forcedType)
    }
  })

  it('a planned "no point of interest" reveals with none', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let s = start()
      s = mapReducer(s, { type: 'PLAN_HEX', hexId: '1,0', plan: { poi: null } })
      s = mapReducer(s, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: mulberry32(seed) })
      expect(s.hexes['1,0'].poi).toBeUndefined()
    }
  })

  it('an empty plan reveals exactly as an unplanned hex would', () => {
    const plain = mapReducer(start(), { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: mulberry32(5) })
    let s = start()
    s = mapReducer(s, { type: 'PLAN_HEX', hexId: '1,0', plan: {} })
    s = mapReducer(s, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: mulberry32(5) })
    expect(s.hexes['1,0']).toEqual(plain.hexes['1,0'])
  })

  it('a planned danger feeds the neighbor-relative Danger Level when none is planned', () => {
    let s = start()
    s = mapReducer(s, { type: 'PLAN_HEX', hexId: '1,0', plan: { danger: 'Deadly' } })
    s = mapReducer(s, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: mulberry32(6) })
    expect(s.hexes['1,0'].danger).toBe('Deadly')
    expect(s.hexes['1,0'].dangerLevel).toBeGreaterThanOrEqual(1)
  })

  it('a planned mismatch carries over to the revealed hex', () => {
    let s = start()
    s = { ...s, planned: { '1,0': { terrain: 'Ocean', tileMismatch: true } } }
    s = mapReducer(s, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: mulberry32(7) })
    expect(s.hexes['1,0'].tileMismatch).toBe(true)
  })
})

describe('planned hexes are locked', () => {
  it('lockedHexIds lists revealed and planned hexes', () => {
    let s = start()
    s = mapReducer(s, { type: 'PLAN_HEX', hexId: '4,0', plan: {} })
    expect(lockedHexIds(s).sort()).toEqual(['0,0', '4,0'])
  })

  it('a GM edit of a revealed hex never reshapes a planned hex nearby', () => {
    let s = start()
    // Plan every unrevealed hex within 2 of the start but one, so the re-solve has room only there.
    const near = ['1,0', '-1,0', '0,1', '0,-1', '1,-1', '-1,1', '2,-2', '2,-1', '1,1', '0,2', '-1,2', '-2,2', '-2,1', '-2,0', '-1,-1', '0,-2', '1,-2']
    for (const id of near) s = mapReducer(s, { type: 'PLAN_HEX', hexId: id, plan: {} })
    const before = Object.fromEntries(near.map((id) => [id, tileOf(s, id)]))
    const edited = mapReducer(s, { type: 'EDIT_HEX', hexId: '0,0', patch: { terrain: 'Mountain' }, rng: mulberry32(8) })
    for (const id of near) expect(tileOf(edited, id), id).toEqual(before[id])
    // Control: the same edit with nothing planned does reshape some of those hexes.
    const unplanned = mapReducer(start(), { type: 'EDIT_HEX', hexId: '0,0', patch: { terrain: 'Mountain' }, rng: mulberry32(8) })
    expect(near.some((id) => JSON.stringify(tileOf(unplanned, id)) !== JSON.stringify(before[id]))).toBe(true)
  })

  it('a grown chunk never changes a planned hex (ADD_CHUNK skips it)', () => {
    let s = start()
    s = mapReducer(s, { type: 'PLAN_HEX', hexId: '5,0', plan: {} })
    const changed = mapReducer(s, {
      type: 'ADD_CHUNK',
      chunk: '1,0',
      updates: [
        { q: 5, r: 0, s: -5, type: TILE_TYPE.WATER, rotation: 0, level: 0 },
        { q: 6, r: 0, s: -6, type: TILE_TYPE.WATER, rotation: 0, level: 0 },
      ],
    })
    expect(tileOf(changed, '5,0')).toEqual(tileOf(s, '5,0'))
    expect(tileOf(changed, '6,0')[0]).toBe(TILE_TYPE.WATER)
  })
})

describe('saves', () => {
  it('an older save without plans loads with none', () => {
    const s = start()
    const { planned: _omit, ...old } = s
    void _omit
    expect(withMapStateDefaults(old as MapState).planned).toEqual({})
  })
})
