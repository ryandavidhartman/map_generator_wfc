// Where and how each hex's tile is drawn in the 3D view. Pure (no Three.js), so it's tested in
// Vitest; MapScene.ts turns it into instance matrices and colors.
//
// World units follow hex-map-wfc (see its docs/NOTES.md): the GLB's tiles are 2 units across
// their flat sides, pointy-top, Y up, +X east and +Z south. A level is 0.5 units high. The
// placement and the rotation sign match hex-map-wfc's HexGrid.placeTile / updateMatrices
// (src/hexmap/HexGrid.js), Copyright (c) 2026 Felix Turner, MIT License:
// https://github.com/felixturner/hex-map-wfc/blob/main/LICENSE
// Change: hex-map-wfc works in per-grid offset coordinates; here hexes are placed straight from
// their axial (q, r), which gives the same world positions.

import type { Terrain } from '../data/tables'
import type { SiteKind } from '../data/locationTables'
import { isRevealableNow, type MapState } from '../state/mapReducer'
import { HEX_DIRS, LEVELS_COUNT, TILE_LIST } from '../wfc/tiles'
import { fieldsFor } from '../world/fields'
import { placedTileAt } from '../world/hexTiles'
import { deriveHexGeo } from '../world/terrain'

export const HEX_WORLD_WIDTH = 2
export const LEVEL_HEIGHT = 0.5
// A tile's surface sits 1 unit above its base (hex-map-wfc's NOTES: land at 1.0).
export const SURFACE_HEIGHT = 1

export function hexWorldPosition(q: number, r: number): { x: number; z: number } {
  return { x: HEX_WORLD_WIDTH * (q + r / 2), z: HEX_WORLD_WIDTH * (Math.sqrt(3) / 2) * r }
}

// The axial hex containing a world point (inverse of hexWorldPosition, rounded to the nearest
// hex). Used to place the camera and for tests; picking uses the meshes themselves.
export function worldToHex(x: number, z: number): { q: number; r: number } {
  const fr = z / (HEX_WORLD_WIDTH * (Math.sqrt(3) / 2))
  const fq = x / HEX_WORLD_WIDTH - fr / 2
  let q = Math.round(fq)
  let r = Math.round(fr)
  const s = Math.round(-fq - fr)
  const dq = Math.abs(q - fq)
  const dr = Math.abs(r - fr)
  const ds = Math.abs(s - (-fq - fr))
  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds) r = -q - s
  return { q: q + 0, r: r + 0 }
}

// Tile rotations step 60° clockwise seen from above; with Y up, that's a negative turn about Y.
export function rotationAngle(rotation: number): number {
  return (-rotation * Math.PI) / 3
}

export function tileBaseY(level: number): number {
  return level * LEVEL_HEIGHT
}

// How a tile is shaded. The grass parts of a tile take the biome's tint (the tile set has no
// swamp, desert or forest tiles). Fog modes are for unrevealed hexes in player view (grey
// silhouettes); `dim` darkens unrevealed hexes in GM view.
export const TINT = {
  none: 0,
  swamp: 1,
  desert: 2,
  arctic: 3,
  forest: 4,
  fog: 5, // unrevealed: flat grey silhouette
  fogFrontier: 6, // unrevealed but next to the party: a lighter grey
} as const
export type Tint = (typeof TINT)[keyof typeof TINT]
export const TINT_COUNT = 8

export function biomeTint(terrain: Terrain, temperature: number): Tint {
  if (terrain === 'Swamp') return TINT.swamp
  if (terrain === 'Forest/jungle') return TINT.forest
  if (terrain === 'Desert/arctic') return temperature < 0 ? TINT.arctic : TINT.desert
  return TINT.none
}

export type TileLook = { tint: Tint; dim: boolean }

// `terrain` is the hex's terrain as the game knows it: the revealed hex's own terrain (a GM edit
// can relabel it), else the tile's derived terrain.
export function tileLook(opts: {
  revealed: boolean
  gmView: boolean
  revealable: boolean
  terrain: Terrain
  temperature: number
}): TileLook {
  if (opts.revealed) return { tint: biomeTint(opts.terrain, opts.temperature), dim: false }
  if (opts.gmView) return { tint: biomeTint(opts.terrain, opts.temperature), dim: !opts.revealable }
  return { tint: opts.revealable ? TINT.fogFrontier : TINT.fog, dim: false }
}

// The per-instance color the tile shader reads as data (not as a tint):
// R = level blend (0 at level 0, 1 at the top level), as in hex-map-wfc;
// G = 0 for tiles (hex-map-wfc uses 1 for decorations, M4b);
// B = the look, code / LOOK_CODES with code = tint + 8·dim + 16·sea (+0.5 to sit mid-step).
// `sea` marks a tile with open-water edges: in fog only its water is drawn dark, so a
// silhouette shows coastlines but not rivers.
export const LOOK_CODES = 4 * TINT_COUNT

export function instanceColor(level: number, look: TileLook, sea: boolean): [number, number, number] {
  const r = Math.min(level / (LEVELS_COUNT - 1), 1)
  const code = look.tint + (look.dim ? TINT_COUNT : 0) + (sea ? 2 * TINT_COUNT : 0)
  return [r, 0, (code + 0.5) / LOOK_CODES]
}

export function decodeLook(b: number): TileLook & { sea: boolean } {
  const n = Math.floor(b * LOOK_CODES)
  return { tint: (n % TINT_COUNT) as Tint, dim: Math.floor(n / TINT_COUNT) % 2 === 1, sea: n >= 2 * TINT_COUNT }
}

export function isSeaTile(type: number): boolean {
  return HEX_DIRS.some((d) => TILE_LIST[type].edges[d] === 'water')
}

export type TileDraw = {
  id: string
  q: number
  r: number
  type: number
  rotation: number
  level: number
  look: TileLook
  // The hex's terrain as the game knows it (a revealed hex's own, else the tile's), and whether
  // the world puts a lake here; scenery.ts plans decorations from these.
  terrain: Terrain
  lake: boolean
  // A revealed hex's point of interest (M6: drawn as a model, see scenery.ts).
  poi: { kind: SiteKind | 'none'; settlementType?: string } | null
}

// Every solved hex as the 3D view draws it. Unrevealed hexes are drawn too: as fog silhouettes
// in player view, dimmed in GM view.
export function tileDraws(state: MapState, gmView: boolean): TileDraw[] {
  if (!state.world) return []
  const fields = fieldsFor(state.world)
  const out: TileDraw[] = []
  for (const id of Object.keys(state.tiles)) {
    const t = placedTileAt(state.tiles, id)!
    const hex = state.hexes[id]
    const geo = deriveHexGeo(t, fields)
    const terrain = hex?.terrain ?? geo.terrain
    const look = tileLook({
      revealed: Boolean(hex),
      gmView,
      revealable: isRevealableNow(state, id),
      terrain,
      temperature: fields.sample(t).temperature,
    })
    const poi = hex?.poi
      ? { kind: hex.poi.siteKind ?? ('none' as const), settlementType: hex.poi.forcedType ?? (hex.site?.kind === 'settlement' ? hex.site.settlementType : undefined) }
      : null
    out.push({ id, q: t.q, r: t.r, type: t.type, rotation: t.rotation, level: t.level, look, terrain, lake: geo.lake, poi })
  }
  return out
}
