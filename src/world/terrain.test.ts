import { describe, expect, it } from 'vitest'
import { TILE_LIST, TILE_TYPE } from '../wfc/tiles'
import type { FieldSample, WorldFields } from './fields'
import { BIOME_TUNING, deriveHexGeo, tileWaterEdges } from './terrain'

// Fields with fixed values everywhere, to test the terrain rules directly.
function fixedFields(sample: Partial<FieldSample> = {}, seed = 1): WorldFields {
  const s: FieldSample = { continent: 0.5, elevation: 1, moisture: -0.3, temperature: 0, ...sample }
  return { params: { seed, offsetX: 0, offsetY: 0 }, sample: () => s, samplePlane: () => s, isSea: () => false }
}

const tile = (name: string, rotation = 0, level = 0) => ({ q: 3, r: -1, s: -2, type: TILE_TYPE[name], rotation, level })

describe('deriveHexGeo terrain', () => {
  const dry = fixedFields()

  it('reads Ocean and Coast from water', () => {
    expect(deriveHexGeo(tile('WATER'), dry)).toMatchObject({ terrain: 'Ocean', seaEdges: ['NE', 'E', 'SE', 'SW', 'W', 'NW'] })
    expect(deriveHexGeo(tile('COAST_A'), dry)).toMatchObject({ terrain: 'Coast', seaEdges: ['SE'] })
    expect(deriveHexGeo(tile('COAST_A', 1), dry).seaEdges).toEqual(['SW']) // rotated one step
    expect(deriveHexGeo(tile('RIVER_INTO_COAST'), dry)).toMatchObject({ terrain: 'Coast', riverEdges: ['NW'] })
  })

  it('reads Hills and Mountain from height, with steep tiles one class higher', () => {
    expect(deriveHexGeo(tile('GRASS', 0, 4), dry).terrain).toBe('Mountain')
    expect(deriveHexGeo(tile('GRASS', 0, 3), dry).terrain).toBe('Hills')
    expect(deriveHexGeo(tile('GRASS', 0, 2), dry).terrain).toBe('Grassland')
    // GRASS_SLOPE_HIGH rises two levels: from base 0 its top is 2, steep, so Hills.
    expect(deriveHexGeo(tile('GRASS_SLOPE_HIGH', 0, 0), dry)).toMatchObject({ terrain: 'Hills', level: 2 })
    // From base 1 its top is 3, steep, so Mountain.
    expect(deriveHexGeo(tile('GRASS_SLOPE_HIGH', 0, 1), dry).terrain).toBe('Mountain')
    // A gentle slope (one level) to 2 is not Hills.
    expect(deriveHexGeo(tile('GRASS_SLOPE_LOW', 0, 1), dry)).toMatchObject({ terrain: 'Grassland', level: 2 })
  })

  it('picks the lowland biome from moisture and temperature', () => {
    const at = (s: Partial<FieldSample>, level = 0) => deriveHexGeo(tile('GRASS', 0, level), fixedFields(s)).terrain
    expect(at({ moisture: BIOME_TUNING.swampMoisture + 0.1 })).toBe('Swamp')
    expect(at({ moisture: BIOME_TUNING.swampMoisture + 0.1 }, 1)).toBe('Forest/jungle') // swamps only at level 0
    expect(at({ moisture: BIOME_TUNING.forestMoisture + 0.05 })).toBe('Forest/jungle')
    expect(at({ moisture: BIOME_TUNING.dryMoisture - 0.1 })).toBe('Desert/arctic')
    expect(at({ temperature: BIOME_TUNING.extremeTemperature + 0.1 })).toBe('Desert/arctic')
    expect(at({ temperature: -BIOME_TUNING.extremeTemperature - 0.1 })).toBe('Desert/arctic')
    expect(at({ moisture: BIOME_TUNING.forestMoisture - 0.1 })).toBe('Grassland')
  })
})

describe('deriveHexGeo features', () => {
  const f = fixedFields()

  it('tileWaterEdges gives the same water edges as a placed tile, for every tile and rotation', () => {
    for (const def of TILE_LIST) {
      for (let rotation = 0; rotation < 6; rotation++) {
        const geo = deriveHexGeo(tile(def.name, rotation), f)
        expect(tileWaterEdges(TILE_TYPE[def.name], rotation), `${def.name}@${rotation}`).toEqual({
          seaEdges: geo.seaEdges,
          coastEdges: geo.coastEdges,
          riverEdges: geo.riverEdges,
        })
      }
    }
  })

  it('lists river and road edges, rotated with the tile', () => {
    expect(deriveHexGeo(tile('RIVER_B'), f).riverEdges).toEqual(['NE', 'W'])
    expect(deriveHexGeo(tile('RIVER_B', 2), f).riverEdges).toEqual(['SE', 'NE'].sort(byDir))
    const crossing = deriveHexGeo(tile('RIVER_CROSSING_A'), f)
    expect(crossing.riverEdges).toEqual(['E', 'W'])
    expect(crossing.roadEdges).toEqual(['SE', 'NW'])
  })

  it('puts lakes only on inland hexes, deterministically', () => {
    expect(deriveHexGeo(tile('WATER'), f).lake).toBe(false)
    expect(deriveHexGeo(tile('COAST_B'), f).lake).toBe(false)
    expect(deriveHexGeo(tile('ROAD_A'), f).lake).toBe(false) // only grass-only tiles and river ends
    const a = deriveHexGeo(tile('GRASS'), f).lake
    expect(deriveHexGeo(tile('GRASS'), f).lake).toBe(a)
  })

  it('gives lakes to about the tuned share of eligible hexes', () => {
    let lakes = 0
    const n = 4000
    for (let i = 0; i < n; i++) {
      if (deriveHexGeo({ q: i, r: -2 * i, s: i, type: TILE_TYPE.GRASS, rotation: 0, level: 0 }, f).lake) lakes++
    }
    expect(lakes / n).toBeGreaterThan(BIOME_TUNING.lakeChance * 0.7)
    expect(lakes / n).toBeLessThan(BIOME_TUNING.lakeChance * 1.3)
  })
})

const ORDER = ['NE', 'E', 'SE', 'SW', 'W', 'NW']
function byDir(a: string, b: string) {
  return ORDER.indexOf(a) - ORDER.indexOf(b)
}
