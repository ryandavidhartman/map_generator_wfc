import { SAVE_VERSION, type MapState } from '../state/mapReducer'

const STORAGE_KEY = 'wfc-hex-crawl:map'

// Browsers give a page about 5 million characters of localStorage (Chrome and Firefox count
// UTF-16 code units). The save meter compares against this.
export const STORAGE_BUDGET_CHARS = 5_000_000

export type SaveResult = { ok: boolean; chars: number }

// Fails silently (private browsing, quota, no storage): in-memory state still works. The result
// says whether it was stored and how big the save is.
export function saveMapState(state: MapState): SaveResult {
  const json = JSON.stringify(state)
  try {
    localStorage.setItem(STORAGE_KEY, json)
    return { ok: true, chars: json.length }
  } catch {
    return { ok: false, chars: json.length }
  }
}

export function loadMapState(): MapState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as MapState
  } catch {
    return null
  }
}

// True when there's a saved map this version can't read (from an older format), so the start
// screen can say why it's starting fresh instead of loading it.
export function hasOutdatedSave(): boolean {
  const saved = loadMapState() as (Partial<MapState> & { partyHexId?: string | null }) | null
  return Boolean(saved && saved.partyHexId && saved.version !== SAVE_VERSION)
}

// --- Campaign files ---------------------------------------------------------------------

// The file is the save itself, as JSON.
export function campaignToJson(state: MapState): string {
  return JSON.stringify(state)
}

// Parse a campaign file. Returns the campaign, or an error to show.
export function campaignFromJson(text: string): { state: MapState | null; error: string | null } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { state: null, error: "That file isn't a campaign file (it isn't valid JSON)." }
  }
  const s = data as Partial<MapState>
  if (!s || typeof s !== 'object' || typeof s.version !== 'number') {
    return { state: null, error: "That file isn't a campaign file." }
  }
  if (s.version !== SAVE_VERSION) {
    return { state: null, error: `That campaign was saved by another version of the app (format ${s.version}; this one reads ${SAVE_VERSION}).` }
  }
  if (!s.world || !s.tiles || !s.hexes || !s.partyHexId || !Array.isArray(s.chunks)) {
    return { state: null, error: 'That campaign file is incomplete.' }
  }
  return { state: s as MapState, error: null }
}

export function campaignFileName(state: MapState, date = new Date()): string {
  const day = date.toISOString().slice(0, 10)
  return `hex-crawl-${state.world?.seed ?? 'map'}-${day}.json`
}
