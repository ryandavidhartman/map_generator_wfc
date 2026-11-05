import { afterEach, describe, expect, it, vi } from 'vitest'
import { campaignFileName, campaignFromJson, campaignToJson, hasOutdatedSave, saveMapState, STORAGE_BUDGET_CHARS } from './localStorage'
import { EMPTY_MAP_STATE, mapReducer, SAVE_VERSION } from '../state/mapReducer'
import { startMapAction } from '../state/testWorld'
import { seedFromText } from '../world/startWorld'

const campaign = () => mapReducer(EMPTY_MAP_STATE, { ...startMapAction(), rng: () => 0.5 })

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
}

afterEach(() => vi.unstubAllGlobals())

describe('campaign files', () => {
  it('round-trip a campaign through a file', () => {
    const state = campaign()
    expect(campaignFromJson(campaignToJson(state))).toEqual({ state, error: null })
  })

  it('explain what is wrong with a bad file', () => {
    expect(campaignFromJson('{oops').error).toMatch(/isn't valid JSON/)
    expect(campaignFromJson('[1,2]').error).toMatch(/isn't a campaign file/)
    expect(campaignFromJson(JSON.stringify({ ...campaign(), version: SAVE_VERSION + 1 })).error).toMatch(/another version/)
    expect(campaignFromJson(JSON.stringify({ ...campaign(), world: null })).error).toMatch(/incomplete/)
    expect(campaignFromJson(JSON.stringify(EMPTY_MAP_STATE)).error).toMatch(/incomplete/)
  })

  it('names the file after the world seed and the day', () => {
    expect(campaignFileName(campaign(), new Date('2026-11-05T12:00:00Z'))).toBe('hex-crawl-1-2026-11-05.json')
  })

  it('LOAD_MAP replaces the campaign', () => {
    const loaded = campaign()
    expect(mapReducer(EMPTY_MAP_STATE, { type: 'LOAD_MAP', state: loaded })).toEqual(loaded)
  })
})

describe('the save meter and old saves', () => {
  it('reports the save size, and failure when storage refuses it', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    const state = campaign()
    expect(saveMapState(state)).toEqual({ ok: true, chars: JSON.stringify(state).length })
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('QuotaExceededError') } })
    expect(saveMapState(state).ok).toBe(false)
    expect(STORAGE_BUDGET_CHARS).toBe(5_000_000)
  })

  it('spots a saved map from an older format, but not an empty or current one', () => {
    vi.stubGlobal('localStorage', memoryStorage({ 'wfc-hex-crawl:map': JSON.stringify({ hexes: {}, partyHexId: '0,0' }) }))
    expect(hasOutdatedSave()).toBe(true)
    vi.stubGlobal('localStorage', memoryStorage({ 'wfc-hex-crawl:map': JSON.stringify(campaign()) }))
    expect(hasOutdatedSave()).toBe(false)
    vi.stubGlobal('localStorage', memoryStorage())
    expect(hasOutdatedSave()).toBe(false)
  })
})

describe('seedFromText', () => {
  it('takes whole numbers as they are (wrapped to 32 bits), hashes words, and randomizes blanks', () => {
    expect(seedFromText(' 12345 ')).toBe(12345)
    expect(seedFromText('4294967297')).toBe(1)
    expect(seedFromText('dragonmarch')).toBe(seedFromText('dragonmarch'))
    expect(seedFromText('dragonmarch')).not.toBe(seedFromText('dragonmarsh'))
    expect(seedFromText('')).not.toBe(seedFromText(''))
  })
})
