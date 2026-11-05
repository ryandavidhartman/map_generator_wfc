import type { DangerLevel, Terrain } from '../data/tables'

export const TERRAIN_COLORS: Record<Terrain, string> = {
  'Desert/arctic': '#d9c088',
  Swamp: '#5b6f4f',
  Grassland: '#7ea55a',
  'Forest/jungle': '#2f5d3a',
  'River/coast': '#4a90c4',
  Ocean: '#1c4f7a',
  Mountain: '#8a7f76',
}

// Hills (added 2026-11-02 for punch-list item 1a): approved by the user. Moves into
// TERRAIN_COLORS when Hills is added to the Terrain type.
export const HILLS_COLOR = '#a39a5c'

export const DANGER_COLORS: Record<DangerLevel, string> = {
  Safe: '#4caf50',
  Unsafe: '#ffc107',
  Risky: '#ff7f0e',
  Deadly: '#e53935',
}
