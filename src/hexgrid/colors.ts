import type { DangerLevel, Terrain } from '../data/tables'

// Hills (added 2026-11-02 for punch-list item 1a): approved by the user.
export const HILLS_COLOR = '#a39a5c'

export const TERRAIN_COLORS: Record<Terrain, string> = {
  'Desert/arctic': '#d9c088',
  Swamp: '#5b6f4f',
  Grassland: '#7ea55a',
  'Forest/jungle': '#2f5d3a',
  Coast: '#4a90c4',
  Ocean: '#1c4f7a',
  Hills: HILLS_COLOR,
  Mountain: '#8a7f76',
}

export const DANGER_COLORS: Record<DangerLevel, string> = {
  Safe: '#4caf50',
  Unsafe: '#ffc107',
  Risky: '#ff7f0e',
  Deadly: '#e53935',
}
