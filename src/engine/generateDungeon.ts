import { rollDie, rollInRange, type Rng } from './dice'
import { siteSizeForD6, siteTypeForD6, dungeonDangerForD6, dungeonLevelBandForDanger, effectiveDungeonLevel, dungeonScenarioForD10, type SiteType, type SiteSize, type RoomType } from '../data/dungeonTables'
import type { DangerLevel } from '../data/tables'
import { generateDungeonLayout, type Rect } from './dungeonLayout'
import { rollRoomContent, type GeneratedMonster, type GeneratedNpc } from './roomContent'
import type { RolledTreasure } from './generateTreasure'
import type { RolledTrap } from './generateDressing'

export type { GeneratedMonster, GeneratedNpc }

export type Room = {
  id: string
  index: number
  rect: Rect
  roomType: RoomType
  roomTypeRoll: number
  detail?: string
  monster?: GeneratedMonster
  npc?: GeneratedNpc
  treasure?: RolledTreasure
  trap?: RolledTrap
  isObjectiveRoom: boolean
}

export type DungeonSite = {
  kind: 'dungeon'
  siteType: SiteType
  size: SiteSize
  danger: DangerLevel
  dungeonLevel: number
  effectiveDungeonLevel: number
  scenario: string
  rooms: Room[]
  // Room-id pairs for corridor rendering; a room can connect to more than one neighbor
  // (real floor-plan adjacency), unlike the old single-parent tree model.
  connections: [string, string][]
}

// Site Type and Size are rolled fresh here — never derived from the originating hex's POI
// text (see the plan's "Two mechanical points" note). overrideSiteType lets a GM force a
// specific type (e.g. via a "Reroll Site" UI control) without re-rolling size/danger/rooms.
export function generateDungeonSite(rng: Rng = Math.random, overrideSiteType?: SiteType, hexDangerLevel = 1): DungeonSite {
  const sizeSpec = siteSizeForD6(rollDie(6, rng))
  const siteType = overrideSiteType ?? siteTypeForD6(rollDie(6, rng))
  const danger = dungeonDangerForD6(rollDie(6, rng))
  const levelBand = dungeonLevelBandForDanger(danger)
  const dungeonLevel = rollInRange(levelBand.min, levelBand.max, rng)
  const effLevel = effectiveDungeonLevel(dungeonLevel, hexDangerLevel, danger)
  const scenario = dungeonScenarioForD10(rollDie(10, rng))
  const layout = generateDungeonLayout(sizeSpec.roomCount, rng)

  const rooms: Room[] = layout.rooms.map(({ rect, index }) => {
    const content = rollRoomContent(rng, effLevel)

    return {
      id: `room-${index}`,
      index,
      rect,
      ...content,
      isObjectiveRoom: false,
    }
  })

  const connections: [string, string][] = layout.connections.map(([a, b]) => [`room-${a}`, `room-${b}`])

  // The room with the single highest Room Type roll is the objective/boss room (book RAW).
  // First occurrence wins ties.
  let objectiveIndex = 0
  for (let i = 1; i < rooms.length; i++) {
    if (rooms[i].roomTypeRoll > rooms[objectiveIndex].roomTypeRoll) objectiveIndex = i
  }
  if (rooms.length > 0) rooms[objectiveIndex] = { ...rooms[objectiveIndex], isObjectiveRoom: true }

  return { kind: 'dungeon', siteType, size: sizeSpec.size, danger, dungeonLevel, effectiveDungeonLevel: effLevel, scenario, rooms, connections }
}
