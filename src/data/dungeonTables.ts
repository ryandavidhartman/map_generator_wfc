// Dungeon/site tables. The dice structure (Site Type, Size, Room Type d10, d6 detail tables)
// follows the core rules; the detail tables' text is original to this project (replaced
// 2026-11-01). Site type, size and room type names are kept as plain generic labels.
// Site Type/Size are rolled fresh at generation time (never derived from an overland POI's
// location text — see the plan's "Two mechanical points" note). Room/detail sub-tables follow
// the same private-const + exported-pure-lookup-function pattern as src/data/tables.ts.

import { dangerLevelDelta, type DangerLevel } from './tables'

// Site Size table (d6) — dice count IS the room count (one die per room), never summed.
export type SiteSize = 'Small' | 'Medium' | 'Large'
export type SiteSizeSpec = { size: SiteSize; roomCount: number }

const SITE_SIZE_SPECS: Record<SiteSize, SiteSizeSpec> = {
  Small: { size: 'Small', roomCount: 5 },
  Medium: { size: 'Medium', roomCount: 8 },
  Large: { size: 'Large', roomCount: 12 },
}

export function siteSizeForD6(roll: number): SiteSizeSpec {
  if (roll < 1 || roll > 6) throw new Error(`siteSizeForD6: roll out of range: ${roll}`)
  if (roll <= 2) return SITE_SIZE_SPECS.Small
  if (roll <= 5) return SITE_SIZE_SPECS.Medium
  return SITE_SIZE_SPECS.Large
}

// Tower level count by Size — a house-rule extension (not book RAW), confirmed 2026-07-04:
// reuses the same Size roll every other site kind uses rather than inventing a second size
// axis, remapped to a level count instead of a room count. Each tier spans exactly 2 values,
// so engine/generateTower.ts picks within the range with a single d2 roll. Raised by one floor
// across the board on 2026-10-31 (was 1-2/3-4/5-6): the user ruled a 1-floor tower isn't a
// tower, so every tower has at least 2 floors.
export type TowerLevelRange = { min: number; max: number }

const TOWER_LEVEL_RANGES: Record<SiteSize, TowerLevelRange> = {
  Small: { min: 2, max: 3 },
  Medium: { min: 4, max: 5 },
  Large: { min: 6, max: 7 },
}

export function towerLevelRangeForSize(size: SiteSize): TowerLevelRange {
  return TOWER_LEVEL_RANGES[size]
}

// Keep above-ground room count by Size (excludes the courtyard hub) — another house-rule
// extension reusing the Size roll, confirmed 2026-07-04. Same "each tier spans exactly 2
// values" shape as Tower, so engine/generateKeep.ts also picks within the range with one d2
// roll.
export type KeepRoomCountRange = { min: number; max: number }

const KEEP_ROOM_COUNT_RANGES: Record<SiteSize, KeepRoomCountRange> = {
  Small: { min: 3, max: 4 },
  Medium: { min: 5, max: 6 },
  Large: { min: 7, max: 8 },
}

export function keepRoomCountRangeForSize(size: SiteSize): KeepRoomCountRange {
  return KEEP_ROOM_COUNT_RANGES[size]
}

// Site Type table (d6).
export type SiteType = 'Cave' | 'Tomb' | 'Deep tunnels' | 'Ruins'

export function siteTypeForD6(roll: number): SiteType {
  if (roll < 1 || roll > 6) throw new Error(`siteTypeForD6: roll out of range: ${roll}`)
  if (roll <= 2) return 'Cave'
  if (roll === 3) return 'Tomb'
  if (roll === 4) return 'Deep tunnels'
  return 'Ruins'
}

// Room Type table (d10). Each room's die also serves as the room-type roll — see engine.
export type RoomType =
  | 'Empty'
  | 'Trap'
  | 'Minor Hazard'
  | 'Solo Monster'
  | 'NPC'
  | 'Monster Mob'
  | 'Major Hazard'
  | 'Treasure'
  | 'Boss Monster'

export function roomTypeForD10(roll: number): RoomType {
  if (roll < 1 || roll > 10) throw new Error(`roomTypeForD10: roll out of range: ${roll}`)
  if (roll <= 2) return 'Empty'
  if (roll === 3) return 'Trap'
  if (roll === 4) return 'Minor Hazard'
  if (roll === 5) return 'Solo Monster'
  if (roll === 6) return 'NPC'
  if (roll === 7) return 'Monster Mob'
  if (roll === 8) return 'Major Hazard'
  if (roll === 9) return 'Treasure'
  return 'Boss Monster'
}

// Room-type detail sub-tables (all d6). Some are two independent-roll "mix and match"
// columns (an adjective and a noun, like the Tavern/Shop name generators); others are a single
// "Details" column.
export const ROOM_TYPE_NEEDS_TWO_ROLLS: Record<RoomType, boolean> = {
  Empty: false,
  Trap: true,
  'Minor Hazard': false,
  'Solo Monster': true,
  NPC: false,
  'Monster Mob': true,
  'Major Hazard': false,
  Treasure: false,
  'Boss Monster': false,
}

const TRAP_COLUMN_A = ['Hidden', 'Cunning', 'Brutal', 'Ancient', 'Lethal', 'Delayed']
const TRAP_COLUMN_B = ['Pit', 'Snare', 'Dart', 'Blade', 'Gas', 'Glyph']

const MONSTER_MOB_COLUMN_A = ['Hungry', 'Frightened', 'Disciplined', 'Quarrelsome', 'Cursed', 'Fanatical']
const MONSTER_MOB_COLUMN_B = ['Pack', 'Band', 'Warband', 'Brood', 'Gang', 'Cult']

const SOLO_MONSTER_COLUMN_A = ['Patient', 'Wounded', 'Ancient', 'Cunning', 'Enraged', 'Lonely']
const SOLO_MONSTER_COLUMN_B = ['Hunter', 'Guardian', 'Lurker', 'Tyrant', 'Scavenger', 'Sorcerer']

const MINOR_HAZARD_DETAILS = ['Slippery floor', 'Jammed door', 'Loose rubble', 'Low ceiling', 'Rotten floorboards', 'Choking dust']

const MAJOR_HAZARD_DETAILS = ['Deep pit', 'Flooding chamber', 'Collapsing ceiling', 'Poisonous fumes', 'Spell-draining field', 'Sucking mud']

// Slots 3-4 are the guarded result: engine/roomContent.ts rolls the treasure Amount twice for it.
export const TREASURE_GUARDED_DETAIL = 'Watched by a monster'

const TREASURE_DETAILS = [
  'Tucked out of sight',
  'Lying in the open',
  TREASURE_GUARDED_DETAIL,
  TREASURE_GUARDED_DETAIL,
  'Behind a trap',
  'Beyond a hazard',
]

const NPC_DETAILS = ['Lost', 'Held prisoner', 'Trapped', 'Injured', 'Deserter', 'Rival treasure hunter']

const BOSS_MONSTER_DETAILS = ['Chieftain of the lair', 'High priest', 'Surrounded by bodyguards', 'Ancient and cunning', 'Wielding a magic weapon', 'Master of magic']

function lookupD6(table: string[], roll: number, tableName: string): string {
  if (roll < 1 || roll > 6) throw new Error(`${tableName}: roll out of range: ${roll}`)
  return table[roll - 1]
}

export function trapDetailForD6(rollA: number, rollB: number): string {
  return `${lookupD6(TRAP_COLUMN_A, rollA, 'trapDetailForD6 (a)')} ${lookupD6(TRAP_COLUMN_B, rollB, 'trapDetailForD6 (b)')}`
}

export function monsterMobDetailForD6(rollA: number, rollB: number): string {
  return `${lookupD6(MONSTER_MOB_COLUMN_A, rollA, 'monsterMobDetailForD6 (a)')} ${lookupD6(MONSTER_MOB_COLUMN_B, rollB, 'monsterMobDetailForD6 (b)')}`
}

export function soloMonsterDetailForD6(rollA: number, rollB: number): string {
  return `${lookupD6(SOLO_MONSTER_COLUMN_A, rollA, 'soloMonsterDetailForD6 (a)')} ${lookupD6(SOLO_MONSTER_COLUMN_B, rollB, 'soloMonsterDetailForD6 (b)')}`
}

export function minorHazardForD6(roll: number): string {
  return lookupD6(MINOR_HAZARD_DETAILS, roll, 'minorHazardForD6')
}

export function majorHazardForD6(roll: number): string {
  return lookupD6(MAJOR_HAZARD_DETAILS, roll, 'majorHazardForD6')
}

export function treasureDetailForD6(roll: number): string {
  return lookupD6(TREASURE_DETAILS, roll, 'treasureDetailForD6')
}

export function npcDetailForD6(roll: number): string {
  return lookupD6(NPC_DETAILS, roll, 'npcDetailForD6')
}

export function bossMonsterDetailForD6(roll: number): string {
  return lookupD6(BOSS_MONSTER_DETAILS, roll, 'bossMonsterDetailForD6')
}

// Dispatch used by the engine: given a room type and its already-rolled d6(s), return the
// detail string (or undefined for Empty rooms, which have no sub-table).
export function roomDetailForType(type: RoomType, rollA: number, rollB?: number): string | undefined {
  switch (type) {
    case 'Empty':
      return undefined
    case 'Trap':
      return trapDetailForD6(rollA, rollB!)
    case 'Minor Hazard':
      return minorHazardForD6(rollA)
    case 'Solo Monster':
      return soloMonsterDetailForD6(rollA, rollB!)
    case 'NPC':
      return npcDetailForD6(rollA)
    case 'Monster Mob':
      return monsterMobDetailForD6(rollA, rollB!)
    case 'Major Hazard':
      return majorHazardForD6(rollA)
    case 'Treasure':
      return treasureDetailForD6(rollA)
    case 'Boss Monster':
      return bossMonsterDetailForD6(rollA)
  }
}

// Dungeon Danger Level table (d6) — distinct from the overland hex Danger Level table
// (no "Safe" outcome here). Reuses the shared DangerLevel type for color-map/UI consistency.
export function dungeonDangerForD6(roll: number): DangerLevel {
  if (roll < 1 || roll > 6) throw new Error(`dungeonDangerForD6: roll out of range: ${roll}`)
  if (roll <= 3) return 'Unsafe'
  if (roll <= 5) return 'Risky'
  return 'Deadly'
}

// Numeric Dungeon Level — a house-rule bridge (2026-08-23, OSR integration) letting
// OSR's depth-scaled tables (Monster Sub-table Matrix, Treasure Amount multiplier) apply to
// core-rules sites, which otherwise have no depth concept at all. Rather than adding a second
// independent roll, the level is derived from the site's already-rolled Danger Level — the
// project's existing "how dangerous is this place" knob — banded to loosely track OSR's own
// matrix rows (1-16+). 'Safe' never actually occurs for a dungeon-shaped site
// (dungeonDangerForD6 has no Safe outcome) but is included so the Record stays total against
// the shared DangerLevel type.
export type DungeonLevelBand = { min: number; max: number }

const DUNGEON_LEVEL_BANDS: Record<DangerLevel, DungeonLevelBand> = {
  Safe: { min: 1, max: 3 },
  Unsafe: { min: 1, max: 4 },
  Risky: { min: 5, max: 9 },
  Deadly: { min: 10, max: 16 },
}

export function dungeonLevelBandForDanger(danger: DangerLevel): DungeonLevelBand {
  return DUNGEON_LEVEL_BANDS[danger]
}

// House-rule "Effective Dungeon Level" (see state/mapReducer.ts's Hex.dangerLevel): the real
// scaling number for a dungeon-shaped site's Treasure/Trap content (and, eventually, its OSR
// Monster Sub-table Matrix row) — the raw dungeonLevel roll above, pushed by the hex it sits on
// and by the site's own Danger roll (same delta table as hex generation). Floored at 1.
export function effectiveDungeonLevel(dungeonLevel: number, hexDangerLevel: number, siteDanger: DangerLevel): number {
  return Math.max(1, dungeonLevel + hexDangerLevel + dangerLevelDelta(siteDanger))
}

// Scenarios (d10) — transcribed verbatim from the Basic Fantasy compilation's (core rules + Field Guide) Appendix D: The Encounter
// Builder (docs/osr-appendix-cde-source.txt, ~lines 1978-1988). A dungeon's "reason to exist" —
// the dungeon-side equivalent of nothing this project had before (OSR integration,
// round 2). Rolled once per dungeon-shaped site (Cave/Tomb/Deep tunnels/Ruins/Tower/Keep — the
// same set that already carries dungeonLevel), shown as a flavor line, purely descriptive: it
// doesn't feed any other roll or bias any table.
const DUNGEON_SCENARIOS: string[] = [
  'Exploring the Unknown',
  'Investigating a Chaotic Outpost',
  'Recovering Ruins',
  'Destroying an Ancient Evil',
  'Visiting a Lost Shrine',
  'Fulfilling a Quest',
  'Escaping from Enemies',
  'Rescuing Prisoners',
  'Using a Magic Portal',
  'Finding a Lost Race',
]

export function dungeonScenarioForD10(roll: number): string {
  if (roll < 1 || roll > 10) throw new Error(`dungeonScenarioForD10: roll out of range: ${roll}`)
  return DUNGEON_SCENARIOS[roll - 1]
}
