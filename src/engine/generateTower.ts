// Tower: a new site kind (house-rule extension, not book RAW), confirmed 2026-07-04 as part of
// expanding the overland Points of Interest table into a d200 "Location Generator" — see
// docs/plan-sites-settlements-mongo.md's "Location Generator" section for the full design
// conversation and routing table. Tower's identity is structural: a vertical climb, floor by
// floor, with the climax hard-coded at the top rather than wherever the highest Room Type roll
// happens to land.
//
// Spec (multi-room floors added 2026-10-31 for the floor-plan map overhaul — reference image
// in CLAUDE.md's punch list):
// - Level count reuses the Size roll (siteSizeForD6) remapped via towerLevelRangeForSize,
//   rather than inventing a second size axis.
// - Ground floor always has exactly 2 rooms: the entry hall (holds the stair up) and a guard
//   room (a side room off the entry hall).
// - Every floor above has a stair room (floorRoomIndex 0, id `level-N`) plus extra rooms:
//   middle floors roll d3 rooms in total, the top floor d2. Extra rooms open only onto their
//   own floor's stair room, and stair rooms chain floor to floor — so the climb itself is still
//   strictly linear; floors just have side rooms off the landing.
// - Content reuses the existing Room Type d10 table unmodified (roomContent.ts) — Tower's
//   differentiator is shape, not bespoke content.
// - The top floor's stair room is always the objective, regardless of its own Room Type roll —
//   overriding the "highest roll wins" rule every other kind uses. Room Type is still rolled
//   normally for it; it decides *what kind* of climax, not *whether* it's the climax. Every
//   tower has at least 2 floors (towerLevelRangeForSize), so the objective is never on the
//   ground floor.

import { rollDie, rollInRange, type Rng } from './dice'
import { siteSizeForD6, towerLevelRangeForSize, dungeonDangerForD6, dungeonLevelBandForDanger, effectiveDungeonLevel, dungeonScenarioForD10, type SiteSize } from '../data/dungeonTables'
import type { DangerLevel } from '../data/tables'
import { rollRoomContent, type GeneratedMonster, type GeneratedNpc } from './roomContent'
import type { RoomType } from '../data/dungeonTables'
import type { RolledTreasure } from './generateTreasure'
import type { RolledTrap } from './generateDressing'

export type TowerRoom = {
  id: string
  levelIndex: number // 0 = ground floor; the guard room shares levelIndex 0 with the entry hall
  // Position within its floor: 0 = the floor's stair room (entry hall on the ground floor),
  // 1+ = side rooms off it (the guard room is 1).
  floorRoomIndex: number
  isGuardRoom: boolean
  roomType: RoomType
  roomTypeRoll: number
  detail?: string
  monster?: GeneratedMonster
  npc?: GeneratedNpc
  treasure?: RolledTreasure
  trap?: RolledTrap
  isObjectiveRoom: boolean
}

export type TowerSite = {
  kind: 'tower'
  size: SiteSize
  danger: DangerLevel
  dungeonLevel: number
  effectiveDungeonLevel: number
  scenario: string
  levelCount: number
  rooms: TowerRoom[]
  connections: [string, string][]
}

function rollTowerLevelCount(size: SiteSize, rng: Rng): number {
  const range = towerLevelRangeForSize(size)
  // Each tier spans exactly 2 values (1-2, 3-4, 5-6) — a d2 roll picks within it.
  return range.min + rollDie(2, rng) - 1
}

export function generateTowerSite(rng: Rng = Math.random, hexDangerLevel = 1): TowerSite {
  const size = siteSizeForD6(rollDie(6, rng)).size
  const danger = dungeonDangerForD6(rollDie(6, rng))
  const levelBand = dungeonLevelBandForDanger(danger)
  const dungeonLevel = rollInRange(levelBand.min, levelBand.max, rng)
  const effLevel = effectiveDungeonLevel(dungeonLevel, hexDangerLevel, danger)
  const scenario = dungeonScenarioForD10(rollDie(10, rng))
  const levelCount = rollTowerLevelCount(size, rng)

  const rooms: TowerRoom[] = []
  const connections: [string, string][] = []

  function rollRoom(id: string, levelIndex: number, floorRoomIndex: number, isGuardRoom: boolean): TowerRoom {
    const content = rollRoomContent(rng, effLevel)
    return { id, levelIndex, floorRoomIndex, isGuardRoom, ...content, isObjectiveRoom: false }
  }

  const entryHallId = 'entry-hall'
  const guardRoomId = 'guard-room'
  rooms.push(rollRoom(entryHallId, 0, 0, false))
  rooms.push(rollRoom(guardRoomId, 0, 1, true))
  connections.push([entryHallId, guardRoomId])

  let previousStairRoomId = entryHallId
  for (let level = 1; level < levelCount; level++) {
    const isTop = level === levelCount - 1
    const floorRoomCount = rollDie(isTop ? 2 : 3, rng)
    const stairRoomId = `level-${level}`
    rooms.push(rollRoom(stairRoomId, level, 0, false))
    connections.push([previousStairRoomId, stairRoomId])
    for (let i = 1; i < floorRoomCount; i++) {
      const sideRoomId = `level-${level}-${i}`
      rooms.push(rollRoom(sideRoomId, level, i, false))
      connections.push([stairRoomId, sideRoomId])
    }
    previousStairRoomId = stairRoomId
  }

  // The top floor's stair room is always the objective, regardless of its Room Type roll.
  const topIndex = rooms.findIndex((r) => r.id === previousStairRoomId)
  rooms[topIndex] = { ...rooms[topIndex], isObjectiveRoom: true }

  return { kind: 'tower', size, danger, dungeonLevel, effectiveDungeonLevel: effLevel, scenario, levelCount, rooms, connections }
}
