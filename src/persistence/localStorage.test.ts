import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadMapState, saveMapState } from './localStorage'
import { EMPTY_MAP_STATE, mapReducer, withMapStateDefaults, type MapState } from '../state/mapReducer'
import { locationFeatureForD200 } from '../data/locationTables'
import { pointOfInterestForFeatureRoll } from '../engine/generateHex'
import { generateSiteForHex } from '../engine/generateSite'

const STORAGE_KEY = 'wfc-hex-crawl:map'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

// Minimal in-memory Storage stand-in (the test environment is Node, which has no localStorage).
function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  }
}

// A map with one revealed hex per site kind (plus a no-site hex), every site fully generated —
// the realistic shape of a save, so the round-trip test covers every generator's output.
function mapWithEverySiteKind(): MapState {
  let state = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: seededRng(1) })
  const seen = new Set<string>()
  let q = 1
  for (let roll = 1; roll <= 200; roll++) {
    const kind = locationFeatureForD200(roll).routesTo
    if (seen.has(kind)) continue
    seen.add(kind)
    const rng = seededRng(roll)
    const poi = pointOfInterestForFeatureRoll('Grassland', roll, rng)
    const site = poi.siteKind === 'none' ? undefined : generateSiteForHex(poi, rng, 3)
    const id = `${q},0`
    state = {
      ...state,
      hexes: { ...state.hexes, [id]: { id, q, r: 0, terrain: 'Grassland', danger: 'Risky', dangerLevel: 3, poi, site } },
    }
    q++
  }
  return state
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('withMapStateDefaults', () => {
  it('returns the empty state for no save', () => {
    expect(withMapStateDefaults(null)).toEqual(EMPTY_MAP_STATE)
  })

  it('fills top-level fields missing from an older save, keeping the ones it has', () => {
    const hexes: MapState['hexes'] = { '0,0': { id: '0,0', q: 0, r: 0, terrain: 'Forest/jungle', danger: 'Safe', dangerLevel: 1 } }
    const merged = withMapStateDefaults({ hexes, partyHexId: '0,0' })
    expect(merged.hexes).toBe(hexes)
    expect(merged.partyHexId).toBe('0,0')
    expect(merged.selectedHexId).toBe(EMPTY_MAP_STATE.selectedHexId)
    expect(Object.keys(merged).sort()).toEqual(Object.keys(EMPTY_MAP_STATE).sort())
  })

  it('lets saved values win over the defaults', () => {
    const merged = withMapStateDefaults({ hexes: {}, partyHexId: '1,0', selectedHexId: '1,0' })
    expect(merged.selectedHexId).toBe('1,0')
  })
})

describe('saveMapState / loadMapState', () => {
  it('round-trips a map holding every site kind without losing data', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    const state = mapWithEverySiteKind()
    const kinds = Object.values(state.hexes).map((h) => h.site?.kind).filter(Boolean)
    expect(new Set(kinds)).toEqual(new Set(['dungeon', 'settlement', 'tower', 'keep', 'camp', 'shrine', 'rift']))

    saveMapState(state)
    expect(loadMapState()).toEqual(state)
  })

  it('writes under the single save key', () => {
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)
    saveMapState(EMPTY_MAP_STATE)
    expect([...storage.data.keys()]).toEqual([STORAGE_KEY])
  })

  it('returns null when there is no save', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    expect(loadMapState()).toBeNull()
  })

  it('returns null for a corrupt save instead of throwing', () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, '{not json')
    vi.stubGlobal('localStorage', storage)
    expect(loadMapState()).toBeNull()
  })

  it('fails silently when storage is unavailable or full', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })
    expect(() => saveMapState(EMPTY_MAP_STATE)).not.toThrow()
    expect(loadMapState()).toBeNull()
  })

  it('fails silently when localStorage does not exist at all', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(() => saveMapState(EMPTY_MAP_STATE)).not.toThrow()
    expect(loadMapState()).toBeNull()
  })

  it('a save missing a top-level field loads with that field defaulted', () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ hexes: {}, partyHexId: null }))
    vi.stubGlobal('localStorage', storage)
    expect(withMapStateDefaults(loadMapState())).toEqual(EMPTY_MAP_STATE)
  })
})
