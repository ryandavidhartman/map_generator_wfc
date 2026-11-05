import { describe, expect, it } from 'vitest'
import { axialToPixel } from '../hexgrid/hexMath'
import { mapReducer, EMPTY_MAP_STATE } from '../state/mapReducer'
import { FIXTURE_WATER_HEX, startMapAction } from '../state/testWorld'
import { CUBE_DIRS } from '../wfc/cube'
import { TILE_TYPE } from '../wfc/tiles'
import {
  biomeTint,
  decodeLook,
  hexWorldPosition,
  instanceColor,
  isSeaTile,
  rotationAngle,
  TINT,
  tileDraws,
  tileLook,
  worldToHex,
} from './layout'

describe('3D placement', () => {
  it('puts neighbors one tile width (2 units) apart, matching the 2D layout scaled', () => {
    for (const d of CUBE_DIRS) {
      const p = hexWorldPosition(d.dq, d.dr)
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(2, 9)
      // Same direction as the 2D map (screen y down = world +Z south).
      const s = axialToPixel({ q: d.dq, r: d.dr }, 1)
      expect(Math.atan2(p.z, p.x)).toBeCloseTo(Math.atan2(s.y, s.x), 9)
    }
    expect(hexWorldPosition(0, -1).z).toBeLessThan(0) // north is -Z
  })

  it('worldToHex inverts hexWorldPosition, and rounds points inside a hex to it', () => {
    for (const [q, r] of [[0, 0], [3, -2], [-5, 7], [12, 4]]) {
      const p = hexWorldPosition(q, r)
      expect(worldToHex(p.x, p.z)).toEqual({ q, r })
      expect(worldToHex(p.x + 0.6, p.z - 0.4)).toEqual({ q, r })
    }
  })

  it('turns tiles clockwise seen from above (negative about +Y)', () => {
    expect(rotationAngle(0)).toBe(-0)
    expect(rotationAngle(1)).toBeCloseTo(-Math.PI / 3, 9)
  })
})

describe('tile looks', () => {
  it('tints the biomes the tile set lacks, desert or arctic by temperature', () => {
    expect(biomeTint('Swamp', 0)).toBe(TINT.swamp)
    expect(biomeTint('Forest/jungle', 0)).toBe(TINT.forest)
    expect(biomeTint('Desert/arctic', 0.8)).toBe(TINT.desert)
    expect(biomeTint('Desert/arctic', -0.8)).toBe(TINT.arctic)
    for (const t of ['Grassland', 'Hills', 'Mountain', 'Coast', 'Ocean'] as const) expect(biomeTint(t, 0)).toBe(TINT.none)
  })

  it('draws unrevealed hexes as fog in player view, the frontier lighter, and dims them in GM view', () => {
    const base = { terrain: 'Swamp' as const, temperature: 0 }
    expect(tileLook({ ...base, revealed: true, gmView: false, revealable: false })).toEqual({ tint: TINT.swamp, dim: false })
    expect(tileLook({ ...base, revealed: false, gmView: false, revealable: false })).toEqual({ tint: TINT.fog, dim: false })
    expect(tileLook({ ...base, revealed: false, gmView: false, revealable: true })).toEqual({ tint: TINT.fogFrontier, dim: false })
    expect(tileLook({ ...base, revealed: false, gmView: true, revealable: false })).toEqual({ tint: TINT.swamp, dim: true })
    expect(tileLook({ ...base, revealed: false, gmView: true, revealable: true })).toEqual({ tint: TINT.swamp, dim: false })
  })

  it('encodes the look in the instance color and decodes it back', () => {
    for (const tint of Object.values(TINT))
      for (const dim of [false, true])
        for (const sea of [false, true]) {
          const [r, g, b] = instanceColor(4, { tint, dim }, sea)
          expect([r, g]).toEqual([1, 0])
          expect(decodeLook(b)).toEqual({ tint, dim, sea })
        }
    expect(instanceColor(0, { tint: TINT.none, dim: false }, false)[0]).toBe(0)
  })

  it('marks tiles with open-water edges as sea (rivers are not)', () => {
    expect(isSeaTile(TILE_TYPE.WATER)).toBe(true)
    expect(isSeaTile(TILE_TYPE.COAST_A)).toBe(true)
    expect(isSeaTile(TILE_TYPE.RIVER_INTO_COAST)).toBe(true)
    expect(isSeaTile(TILE_TYPE.RIVER_A)).toBe(false)
    expect(isSeaTile(TILE_TYPE.GRASS)).toBe(false)
  })
})

describe('tileDraws', () => {
  it('draws every solved hex: revealed in color, the rest as fog, the party\'s neighbors as frontier', () => {
    const state = mapReducer(EMPTY_MAP_STATE, { ...startMapAction(), rng: () => 0.99 })
    const draws = new Map(tileDraws(state, false).map((d) => [d.id, d]))
    expect(draws.size).toBe(Object.keys(state.tiles).length)
    expect(draws.get('0,0')!.look.tint).not.toBe(TINT.fog)
    expect(draws.get('1,0')!.look.tint).toBe(TINT.fogFrontier)
    expect(draws.get('5,5')!.look.tint).toBe(TINT.fog)
    expect(draws.get(FIXTURE_WATER_HEX)!.type).toBe(TILE_TYPE.WATER)
    const gm = new Map(tileDraws(state, true).map((d) => [d.id, d]))
    expect(gm.get('5,5')!.look.dim).toBe(true)
  })

  it('is empty before a map is started', () => {
    expect(tileDraws(EMPTY_MAP_STATE, true)).toEqual([])
  })
})
