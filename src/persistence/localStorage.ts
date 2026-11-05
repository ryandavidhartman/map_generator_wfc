import type { MapState } from '../state/mapReducer'

const STORAGE_KEY = 'wfc-hex-crawl:map'

export function saveMapState(state: MapState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — in-memory state still works.
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
