import type { Rng } from '../engine/dice'
import {
  generateHexDetails,
  rollDangerLevel,
  rollPointOfInterest,
  type PointOfInterest,
} from '../engine/generateHex'
import { generateSiteForHex, type GeneratedSite } from '../engine/generateSite'
import { dangerLevelDelta, type DangerLevel, type Terrain } from '../data/tables'
import { hexId, neighborsOf, parseHexId, type AxialCoord } from '../hexgrid/hexMath'
import type { WorldParams } from '../world/fields'
import { geoAt, type SavedTiles } from '../world/hexTiles'

export type Hex = {
  id: string
  q: number
  r: number
  terrain: Terrain
  danger: DangerLevel
  // Numeric Danger Level (house rule) — round(average of revealed neighbors' dangerLevel),
  // adjusted by this hex's own qualitative `danger` roll (dangerLevelDelta), floored at 1. The
  // starting hex is always 1. See computeHexDangerLevel below and dungeonTables.ts's
  // effectiveDungeonLevel, which builds on this for dungeon-shaped sites.
  dangerLevel: number
  poi?: PointOfInterest
  site?: GeneratedSite
}

// Bumped when the save format changes in a way old saves can't be read with. A save with any
// other version starts a new map (all saves so far are test data, so nothing is migrated).
export const SAVE_VERSION = 1

export type MapState = {
  version: number
  // The world the map is solved from (null before a campaign starts).
  world: WorldParams | null
  // Solved chunks (chunkKey) and their tiles, keyed by hex id. A hex's terrain, rivers, roads
  // and coast are derived from its tile (world/terrain.ts). Solved isn't revealed: only
  // `hexes` are revealed.
  chunks: string[]
  tiles: SavedTiles
  // Revealed hexes and their game data, rolled at reveal.
  hexes: Record<string, Hex>
  partyHexId: string | null
  selectedHexId: string | null
}

export const EMPTY_MAP_STATE: MapState = {
  version: SAVE_VERSION,
  world: null,
  chunks: [],
  tiles: {},
  hexes: {},
  partyHexId: null,
  selectedHexId: null,
}

// Merges a loaded save over EMPTY_MAP_STATE rather than using it directly — a save from before a
// top-level MapState field existed would otherwise come back `undefined` at runtime despite the
// type saying otherwise. Per-hex fields (e.g. Hex.dangerLevel) aren't covered by this merge; a
// field that's present but needs content needs an explicit backfill here. A save from another
// version (including map_generator-style saves, which have none) starts a new map.
export function withMapStateDefaults(loaded: Partial<MapState> | null): MapState {
  if (!loaded || loaded.version !== SAVE_VERSION) return EMPTY_MAP_STATE
  return { ...EMPTY_MAP_STATE, ...loaded }
}

export type HexEditPatch = Partial<Pick<Hex, 'terrain' | 'danger' | 'dangerLevel' | 'poi'>>

// New hexes' Danger Level is neighbor-relative, not an independent roll: base = the rounded
// average of already-revealed neighbors' own dangerLevel (1 if this hex has none, i.e. the
// starting hex), then nudged by this hex's own qualitative Danger roll via dangerLevelDelta,
// floored at 1 so it never goes non-positive.
function computeHexDangerLevel(state: MapState, coord: AxialCoord, danger: DangerLevel): number {
  const neighborLevels = neighborsOf(coord)
    .map((n) => state.hexes[hexId(n)])
    .filter((h): h is Hex => Boolean(h))
    .map((h) => h.dangerLevel)
  const base = neighborLevels.length
    ? Math.round(neighborLevels.reduce((sum, level) => sum + level, 0) / neighborLevels.length)
    : 1
  return Math.max(1, base + dangerLevelDelta(danger))
}

export type MapAction =
  // The world comes already solved (world/startWorld.ts runs the WFC worker, which a reducer
  // can't wait on). The starting hex's terrain is read from its tile.
  | { type: 'START_MAP'; world: WorldParams; chunks: string[]; tiles: SavedTiles; startHexId: string; rng?: Rng }
  | { type: 'MOVE_PARTY_TO'; hexId: string; rng?: Rng }
  | { type: 'SELECT_HEX'; hexId: string }
  | { type: 'REROLL_HEX'; hexId: string; rng?: Rng }
  | { type: 'EDIT_HEX'; hexId: string; patch: HexEditPatch }
  | { type: 'GENERATE_SITE'; hexId: string; rng?: Rng }
  | { type: 'REROLL_SITE'; hexId: string; rng?: Rng }
  | { type: 'NEW_MAP' }

export function isRevealed(state: MapState, id: string): boolean {
  return id in state.hexes
}

export function isAdjacentToParty(state: MapState, id: string): boolean {
  if (!state.partyHexId) return false
  const party = parseHexId(state.partyHexId)
  return neighborsOf(party).some((n) => hexId(n) === id)
}

export function isSolved(state: MapState, id: string): boolean {
  return id in state.tiles
}

// Whether clicking this (unrevealed) hex right now would generate it. The hex must be solved:
// the party can't walk off the solved map (chunk growth comes in M5).
export function isRevealableNow(state: MapState, id: string): boolean {
  if (isRevealed(state, id)) return false
  return isSolved(state, id) && isAdjacentToParty(state, id)
}

// The terrain a hex reveals as: its tile's derived terrain.
function terrainAt(state: MapState, id: string): Terrain | null {
  if (!state.world) return null
  return geoAt(state.world, state.tiles, id)?.terrain ?? null
}

export function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case 'START_MAP': {
      const id = action.startHexId
      const coord = parseHexId(id)
      const terrain = geoAt(action.world, action.tiles, id)?.terrain
      if (!terrain) return state
      const details = generateHexDetails(terrain, action.rng)
      // No neighbors exist yet — the starting hex is always Danger Level 1, fixed.
      const startHex: Hex = { id, q: coord.q, r: coord.r, ...details, dangerLevel: 1 }
      return {
        version: SAVE_VERSION,
        world: action.world,
        chunks: action.chunks,
        tiles: action.tiles,
        hexes: { [id]: startHex },
        partyHexId: id,
        selectedHexId: id,
      }
    }

    case 'MOVE_PARTY_TO': {
      if (!isAdjacentToParty(state, action.hexId)) return state

      const existing = state.hexes[action.hexId]
      if (existing) {
        return { ...state, partyHexId: action.hexId, selectedHexId: action.hexId }
      }

      const coord = parseHexId(action.hexId)
      const terrain = terrainAt(state, action.hexId)
      if (!terrain) return state

      const details = generateHexDetails(terrain, action.rng)
      const dangerLevel = computeHexDangerLevel(state, coord, details.danger)
      const newHex: Hex = { id: action.hexId, q: coord.q, r: coord.r, ...details, dangerLevel }

      return {
        ...state,
        hexes: { ...state.hexes, [action.hexId]: newHex },
        partyHexId: action.hexId,
        selectedHexId: action.hexId,
      }
    }

    case 'SELECT_HEX': {
      if (!isRevealed(state, action.hexId)) return state
      return { ...state, selectedHexId: action.hexId }
    }

    case 'REROLL_HEX': {
      const hex = state.hexes[action.hexId]
      if (!hex) return state
      const danger = rollDangerLevel(action.rng)
      const poi = rollPointOfInterest(hex.terrain, action.rng)
      const dangerLevel = computeHexDangerLevel(state, { q: hex.q, r: hex.r }, danger)
      return {
        ...state,
        // poi is always re-rolled here, so any previously generated site (derived from the
        // old poi) is now stale — clear it rather than leaving a mismatched site behind.
        hexes: { ...state.hexes, [action.hexId]: { ...hex, danger, dangerLevel, poi, site: undefined } },
      }
    }

    case 'EDIT_HEX': {
      const hex = state.hexes[action.hexId]
      if (!hex) return state
      const patchTouchesPoi = 'poi' in action.patch
      return {
        ...state,
        hexes: {
          ...state.hexes,
          [action.hexId]: {
            ...hex,
            ...action.patch,
            ...(patchTouchesPoi ? { site: undefined } : {}),
          },
        },
      }
    }

    case 'GENERATE_SITE': {
      const hex = state.hexes[action.hexId]
      if (!hex || !hex.poi || hex.site) return state
      const site = generateSiteForHex(hex.poi, action.rng, hex.dangerLevel ?? 1)
      return { ...state, hexes: { ...state.hexes, [action.hexId]: { ...hex, site } } }
    }

    case 'REROLL_SITE': {
      const hex = state.hexes[action.hexId]
      if (!hex || !hex.poi) return state
      const site = generateSiteForHex(hex.poi, action.rng, hex.dangerLevel ?? 1)
      return { ...state, hexes: { ...state.hexes, [action.hexId]: { ...hex, site } } }
    }

    case 'NEW_MAP':
      return EMPTY_MAP_STATE

    default:
      return state
  }
}
