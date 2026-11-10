import type { Rng } from '../engine/dice'
import {
  generateHexDetails,
  pointOfInterestForFeatureRoll,
  rollAnchorSettlement,
  rollDangerLevel,
  rollPointOfInterest,
  type PointOfInterest,
} from '../engine/generateHex'
import { generateSiteForHex, type GeneratedSite } from '../engine/generateSite'
import { dangerLevelDelta, type DangerLevel, type Terrain } from '../data/tables'
import { hexId, neighborsOf, parseHexId, type AxialCoord } from '../hexgrid/hexMath'
import type { WorldParams } from '../world/fields'
import { applyChunkResult } from '../world/growth'
import { pinHex } from '../world/pin'
import { isSettlementAnchor } from '../world/anchors'
import { geoAt, type SavedTiles } from '../world/hexTiles'
import type { PlacedTile } from '../wfc/rules'

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
  // Set when a GM edit gave the hex a terrain its tile couldn't be reshaped to (world/pin.ts):
  // the terrain is then a label over a tile of another shape. Shown in GM view.
  tileMismatch?: boolean
}

// A GM's plan for a solved hex the party hasn't revealed yet (PLAN.md punch-list item 3). Used
// at reveal instead of rolling; anything left out still rolls then. A planned hex is locked like
// a revealed one: chunk growth and nearby GM edits never reshape it (lockedHexIds).
export type PlannedHex = {
  terrain?: Terrain // the terrain label; left out, the tile's own terrain
  danger?: DangerLevel
  dangerLevel?: number // left out, worked out from the revealed neighbors at reveal
  poi?: PointOfInterest | null // left out: rolled at reveal; null: none; else this custom POI
  // A row of the d200 Feature table (any roll in it): at reveal its POI is built from that row
  // exactly as a rolled one would be (pointOfInterestForFeatureRoll), so it routes to the right
  // site generator. Takes the place of `poi` when set.
  poiFeature?: number
  tileMismatch?: boolean // as on Hex: the tile couldn't be reshaped to `terrain`
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
  // The GM's plans for unrevealed solved hexes, by hex id (item 3). Older saves have none
  // (withMapStateDefaults fills it in).
  planned: Record<string, PlannedHex>
  partyHexId: string | null
  selectedHexId: string | null
}

export const EMPTY_MAP_STATE: MapState = {
  version: SAVE_VERSION,
  world: null,
  chunks: [],
  tiles: {},
  hexes: {},
  planned: {},
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

// `poiFeature`: a row of the d200 Feature table (any roll in it); the hex's POI is built from it
// as a rolled one would be (pointOfInterestForFeatureRoll), in place of `poi`.
export type HexEditPatch = Partial<Pick<Hex, 'terrain' | 'danger' | 'dangerLevel' | 'poi'>> & { poiFeature?: number }

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
  // A chunk solved by the worker (world/growth.ts): its tiles, plus any unrevealed hexes nearby
  // that the solve adjusted. Never changes a revealed or planned hex.
  | { type: 'ADD_CHUNK'; chunk: string; updates: PlacedTile[] }
  | { type: 'SELECT_HEX'; hexId: string }
  | { type: 'REROLL_HEX'; hexId: string; rng?: Rng }
  // A terrain change also reshapes the hex's tile and the unrevealed hexes near it (world/pin.ts).
  | { type: 'EDIT_HEX'; hexId: string; patch: HexEditPatch; rng?: Rng }
  // Plan a solved, unrevealed hex (replacing any earlier plan); a terrain change reshapes its
  // tile as EDIT_HEX does. CLEAR_PLAN drops the plan (the tile keeps any reshaping).
  | { type: 'PLAN_HEX'; hexId: string; plan: PlannedHex; rng?: Rng }
  | { type: 'CLEAR_PLAN'; hexId: string }
  | { type: 'GENERATE_SITE'; hexId: string; rng?: Rng }
  | { type: 'REROLL_SITE'; hexId: string; rng?: Rng }
  | { type: 'NEW_MAP' }
  // Replace the campaign with one loaded from a file (persistence/localStorage.ts
  // campaignFromJson has already checked it).
  | { type: 'LOAD_MAP'; state: MapState }

export function isRevealed(state: MapState, id: string): boolean {
  return id in state.hexes
}

// Hexes no solve may change: revealed ones and the GM's planned ones.
export function isLockedHex(state: MapState, id: string): boolean {
  return id in state.hexes || id in state.planned
}

export function lockedHexIds(state: MapState): string[] {
  return [...Object.keys(state.hexes), ...Object.keys(state.planned)]
}

// Whether the GM can plan this hex: solved and not revealed (item 3).
export function isPlannable(state: MapState, id: string): boolean {
  return Boolean(state.world) && isSolved(state, id) && !isRevealed(state, id)
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

// Whether a hex's tile makes it a settlement anchor (world/anchors.ts).
function isAnchorHex(tiles: SavedTiles, id: string): boolean {
  const t = tiles[id]
  return Boolean(t) && isSettlementAnchor(t[0])
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
      const details = generateHexDetails(terrain, action.rng, isAnchorHex(action.tiles, id))
      // No neighbors exist yet — the starting hex is always Danger Level 1, fixed.
      const startHex: Hex = { id, q: coord.q, r: coord.r, ...details, dangerLevel: 1 }
      return {
        version: SAVE_VERSION,
        world: action.world,
        chunks: action.chunks,
        tiles: action.tiles,
        hexes: { [id]: startHex },
        planned: {},
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
      // A GM's plan (item 3) stands in for whatever it sets; the rest rolls as usual.
      const plan = state.planned[action.hexId]
      const terrain = plan?.terrain ?? terrainAt(state, action.hexId)
      if (!terrain) return state

      const rolled = generateHexDetails(terrain, action.rng, isAnchorHex(state.tiles, action.hexId))
      const danger = plan?.danger ?? rolled.danger
      const poi = plan?.poiFeature
        ? pointOfInterestForFeatureRoll(terrain, plan.poiFeature, action.rng)
        : plan && plan.poi !== undefined
          ? (plan.poi ?? undefined)
          : rolled.poi
      const dangerLevel = plan?.dangerLevel ?? computeHexDangerLevel(state, coord, danger)
      const newHex: Hex = {
        id: action.hexId,
        q: coord.q,
        r: coord.r,
        terrain,
        danger,
        dangerLevel,
        ...(poi ? { poi } : {}),
        ...(plan?.tileMismatch ? { tileMismatch: true } : {}),
      }
      const planned = { ...state.planned }
      delete planned[action.hexId]

      return {
        ...state,
        planned,
        hexes: { ...state.hexes, [action.hexId]: newHex },
        partyHexId: action.hexId,
        selectedHexId: action.hexId,
      }
    }

    case 'ADD_CHUNK': {
      if (!state.world || state.chunks.includes(action.chunk)) return state
      const { tiles } = applyChunkResult(state.tiles, action.updates, (id) => isLockedHex(state, id))
      return { ...state, chunks: [...state.chunks, action.chunk], tiles }
    }

    case 'SELECT_HEX': {
      if (!isRevealed(state, action.hexId)) return state
      return { ...state, selectedHexId: action.hexId }
    }

    case 'REROLL_HEX': {
      const hex = state.hexes[action.hexId]
      if (!hex) return state
      const danger = rollDangerLevel(action.rng)
      // An anchor hex stays a settlement (only which one is re-rolled).
      const poi = isAnchorHex(state.tiles, action.hexId)
        ? rollAnchorSettlement(hex.terrain, action.rng)
        : rollPointOfInterest(hex.terrain, action.rng)
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
      const { poiFeature, ...patch } = action.patch
      if (poiFeature) patch.poi = pointOfInterestForFeatureRoll(patch.terrain ?? hex.terrain, poiFeature, action.rng ?? Math.random)
      const patchTouchesPoi = 'poi' in patch
      let tiles = state.tiles
      let tileMismatch = hex.tileMismatch
      const terrain = action.patch.terrain
      if (terrain && terrain !== hex.terrain && state.world && hex.id in state.tiles) {
        const pin = pinHex(state.world, state.tiles, hex.id, terrain, (id) => isLockedHex(state, id), action.rng ?? Math.random)
        // An exact fit, or the closest shape that fits (the label then stays a mismatch).
        if (pin.ok || pin.approximate) tiles = applyChunkResult(state.tiles, pin.updates, (id) => id !== hex.id && isLockedHex(state, id)).tiles
        tileMismatch = pin.ok ? undefined : true
      }
      return {
        ...state,
        tiles,
        hexes: {
          ...state.hexes,
          [action.hexId]: {
            ...hex,
            ...patch,
            ...(patchTouchesPoi ? { site: undefined } : {}),
            tileMismatch,
          },
        },
      }
    }

    case 'PLAN_HEX': {
      if (!state.world || !isPlannable(state, action.hexId)) return state
      const id = action.hexId
      let tiles = state.tiles
      let tileMismatch = state.planned[id]?.tileMismatch
      const terrain = action.plan.terrain
      if (terrain) {
        // As EDIT_HEX: reshape the tile when the shape class changes; other planned and
        // revealed hexes are locked, this one isn't.
        const pin = pinHex(state.world, state.tiles, id, terrain, (other) => other !== id && isLockedHex(state, other), action.rng ?? Math.random)
        if (pin.ok || pin.approximate) tiles = applyChunkResult(state.tiles, pin.updates, (other) => other !== id && isLockedHex(state, other)).tiles
        tileMismatch = pin.ok ? undefined : true
      } else {
        tileMismatch = undefined
      }
      const plan: PlannedHex = { ...action.plan }
      if (tileMismatch) plan.tileMismatch = true
      else delete plan.tileMismatch
      return { ...state, tiles, planned: { ...state.planned, [id]: plan } }
    }

    case 'CLEAR_PLAN': {
      if (!(action.hexId in state.planned)) return state
      const planned = { ...state.planned }
      delete planned[action.hexId]
      return { ...state, planned }
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

    case 'LOAD_MAP':
      return withMapStateDefaults(action.state)

    default:
      return state
  }
}
