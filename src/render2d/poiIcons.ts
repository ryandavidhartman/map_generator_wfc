// Glyphs for points of interest on the 2D map (M6), drawn dark inside the yellow POI badge.
// Paths are in a box from -1 to 1 (y down), filled with the even-odd rule so holes cut out.
// Landmarks, cataclysms and hand-edited POIs (no site kind) keep the plain badge.

import type { SiteKind } from '../data/locationTables'

export const POI_ICON_PATHS: Record<SiteKind, string> = {
  // A house.
  settlement: 'M-0.8,0.75 L-0.8,-0.1 L0,-0.85 L0.8,-0.1 L0.8,0.75 Z M-0.22,0.75 L-0.22,0.2 L0.22,0.2 L0.22,0.75 Z',
  // A tall crenellated tower.
  tower:
    'M-0.42,0.85 L-0.42,-0.45 L-0.6,-0.45 L-0.6,-0.9 L-0.32,-0.9 L-0.32,-0.68 L-0.12,-0.68 L-0.12,-0.9 L0.12,-0.9 L0.12,-0.68 L0.32,-0.68 L0.32,-0.9 L0.6,-0.9 L0.6,-0.45 L0.42,-0.45 L0.42,0.85 Z',
  // A wide crenellated keep with a gate.
  keep:
    'M-0.9,0.75 L-0.9,-0.6 L-0.6,-0.6 L-0.6,-0.35 L-0.3,-0.35 L-0.3,-0.6 L0.3,-0.6 L0.3,-0.35 L0.6,-0.35 L0.6,-0.6 L0.9,-0.6 L0.9,0.75 Z M-0.2,0.75 L-0.2,0.25 Q0,0.05 0.2,0.25 L0.2,0.75 Z',
  // A cave mouth in a mound.
  dungeon: 'M-0.95,0.7 Q0,-1.4 0.95,0.7 Z M-0.38,0.7 Q0,-0.25 0.38,0.7 Z',
  // Standing stones.
  shrine: 'M-0.78,0.75 L-0.78,-0.35 L-0.42,-0.35 L-0.42,0.75 Z M-0.18,0.75 L-0.18,-0.75 L0.18,-0.75 L0.18,0.75 Z M0.42,0.75 L0.42,-0.35 L0.78,-0.35 L0.78,0.75 Z',
  // A tent.
  camp: 'M-0.9,0.75 L0,-0.85 L0.9,0.75 Z M-0.22,0.75 L0,0.2 L0.22,0.75 Z',
  // A jagged crack of light.
  rift: 'M-0.15,-0.9 L0.4,-0.9 L0.08,-0.15 L0.48,-0.15 L-0.32,0.92 L-0.04,0.12 L-0.46,0.12 Z',
}

export const POI_ICON_LABELS: Record<SiteKind, string> = {
  settlement: 'Settlement',
  tower: 'Tower',
  keep: 'Keep',
  dungeon: 'Dungeon',
  shrine: 'Shrine',
  camp: 'Camp',
  rift: 'Rift',
}
