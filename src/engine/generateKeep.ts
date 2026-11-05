// Keep: a new site kind (house-rule extension, not book RAW), confirmed 2026-07-04 as part of
// expanding the overland Points of Interest table into a d200 "Location Generator" — see
// docs/plan-sites-settlements-mongo.md's "Location Generator" section for the full design
// conversation and routing table. Keep's identity is a fortified compound: a walled courtyard
// around a multi-floor keep building.
//
// Spec (floors added 2026-10-31 for the keep map overhaul — reference image in CLAUDE.md's
// punch list; replaces the old single-floor hub-and-spoke model and its fixed room rects):
// - Ground floor: the Courtyard (outdoors, always room #1) plus the building's ground-floor
//   rooms. Their count reuses the Size roll via keepRoomCountRangeForSize (Small 3-4, Medium
//   5-6, Large 7-8); the first three are named Hall, Barracks, Armory, the rest are generic.
// - Upper floors: 1 (Small/Medium) or 2 (Large), each with d3+1 rooms. The top one's first
//   room is the Lord's Quarters.
// - Cellar: every keep has one, d3+1 rooms; the first two are the Storeroom and the Cells.
// - Room positions, doors and the corner stair turret linking the floors are NOT generated
//   here — engine/keepPlan.ts derives them at render time from the room list (nothing extra is
//   persisted, same approach as towerPlan.ts).
// - Content reuses the existing Room Type d10 table everywhere. Armory and Lord's Quarters get
//   a "reroll-toward" bias (see roomContent.ts's rollBiasedRoomContent) toward Treasure and
//   NPC/Boss Monster respectively — a soft nudge, not a hard override.
// - Objective placement uses the *normal* "highest Room Type roll wins" rule, unlike Tower.

import { rollDie, rollInRange, type Rng } from './dice'
import { siteSizeForD6, keepRoomCountRangeForSize, dungeonDangerForD6, dungeonLevelBandForDanger, effectiveDungeonLevel, dungeonScenarioForD10, type SiteSize, type RoomType } from '../data/dungeonTables'
import type { DangerLevel } from '../data/tables'
import { rollRoomContent, rollBiasedRoomContent, type GeneratedMonster, type GeneratedNpc } from './roomContent'
import type { RolledTreasure } from './generateTreasure'
import type { RolledTrap } from './generateDressing'
import {
  castleOwnerClassForD3,
  castleOwnerLevelRangeForClass,
  castlePatrolForClass,
  castleReactionForClass,
  type CastleOwnerClass,
  type CastleReaction,
} from '../data/castleTables'

const GROUND_NAMES = ['Hall', 'Barracks', 'Armory']
const TOP_FLOOR_NAMES = ["Lord's Quarters"]
const CELLAR_NAMES = ['Storeroom', 'Cells']

const NAMED_ROOM_BIAS: Record<string, RoomType[]> = {
  Armory: ['Treasure'],
  "Lord's Quarters": ['NPC', 'Boss Monster'],
}

export const CELLAR_FLOOR = -1

const UPPER_FLOOR_COUNT: Record<SiteSize, number> = { Small: 1, Medium: 1, Large: 2 }

export type KeepRoom = {
  id: string
  name: string
  // -1 = cellar (CELLAR_FLOOR), 0 = ground floor, 1+ = upper floors.
  floor: number
  isCourtyard: boolean
  isNamed: boolean
  roomType: RoomType
  roomTypeRoll: number
  detail?: string
  monster?: GeneratedMonster
  npc?: GeneratedNpc
  treasure?: RolledTreasure
  trap?: RolledTrap
  isObjectiveRoom: boolean
}

export type KeepApproach = {
  ownerClass: CastleOwnerClass
  ownerLevel: number
  patrol: string
  reaction: CastleReaction
}

export type KeepSite = {
  kind: 'keep'
  size: SiteSize
  danger: DangerLevel
  dungeonLevel: number
  effectiveDungeonLevel: number
  scenario: string
  approach: KeepApproach
  upperFloorCount: number
  rooms: KeepRoom[]
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z]+/g, '-')
}

export function generateKeepSite(rng: Rng = Math.random, hexDangerLevel = 1): KeepSite {
  const size = siteSizeForD6(rollDie(6, rng)).size
  const danger = dungeonDangerForD6(rollDie(6, rng))
  const levelBand = dungeonLevelBandForDanger(danger)
  const dungeonLevel = rollInRange(levelBand.min, levelBand.max, rng)
  const effLevel = effectiveDungeonLevel(dungeonLevel, hexDangerLevel, danger)
  const scenario = dungeonScenarioForD10(rollDie(10, rng))
  // Castle Encounters (Appendix C) — who rules this keep and how they react to the party
  // approaching. Rolled once per site, independent of room contents (not tied to the Lord's
  // Quarters room, which may resolve to an NPC, a monster, or nothing at all).
  const ownerClass = castleOwnerClassForD3(rollDie(3, rng))
  const ownerLevelRange = castleOwnerLevelRangeForClass(ownerClass)
  const ownerLevel = rollInRange(ownerLevelRange.min, ownerLevelRange.max, rng)
  const reaction = castleReactionForClass(ownerClass, rollDie(6, rng))
  const approach: KeepApproach = { ownerClass, ownerLevel, patrol: castlePatrolForClass(ownerClass), reaction }
  const range = keepRoomCountRangeForSize(size)
  const groundRoomCount = range.min + rollDie(2, rng) - 1
  const upperFloorCount = UPPER_FLOOR_COUNT[size]

  const rooms: KeepRoom[] = []
  const courtyardContent = rollRoomContent(rng, effLevel)
  rooms.push({ id: 'courtyard', name: 'Courtyard', floor: 0, isCourtyard: true, isNamed: true, ...courtyardContent, isObjectiveRoom: false })

  // Rolls one building floor's rooms: named rooms first (in order), then generic ones.
  function rollFloor(floor: number, count: number, names: string[], idPrefix: string) {
    for (let i = 0; i < count; i++) {
      const name = names[i]
      const bias = name ? NAMED_ROOM_BIAS[name] : undefined
      const content = bias ? rollBiasedRoomContent(rng, bias, effLevel) : rollRoomContent(rng, effLevel)
      const id = name ? `room-${slugify(name)}` : `room-${idPrefix}-${i + 1}`
      rooms.push({ id, name: name ?? `Room ${i + 1}`, floor, isCourtyard: false, isNamed: Boolean(name), ...content, isObjectiveRoom: false })
    }
  }

  rollFloor(0, groundRoomCount, GROUND_NAMES, 'ground')
  for (let floor = 1; floor <= upperFloorCount; floor++) {
    rollFloor(floor, rollDie(3, rng) + 1, floor === upperFloorCount ? TOP_FLOOR_NAMES : [], `floor${floor}`)
  }
  rollFloor(CELLAR_FLOOR, rollDie(3, rng) + 1, CELLAR_NAMES, 'cellar')

  // Normal "highest roll wins" rule (book-RAW dungeon convention) — Keep's shape doesn't have
  // Tower's anticlimactic-walk failure mode, so no hard override is needed here.
  let objectiveIndex = 0
  for (let i = 1; i < rooms.length; i++) {
    if (rooms[i].roomTypeRoll > rooms[objectiveIndex].roomTypeRoll) objectiveIndex = i
  }
  rooms[objectiveIndex] = { ...rooms[objectiveIndex], isObjectiveRoom: true }

  return { kind: 'keep', size, danger, dungeonLevel, effectiveDungeonLevel: effLevel, scenario, approach, upperFloorCount, rooms }
}
