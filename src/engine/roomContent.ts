// Shared per-room content rolling (Room Type d10 + detail sub-table + monster/NPC attachment),
// factored out of generateDungeon.ts so generateTower.ts can reuse the exact same book-RAW
// content table without duplicating the logic — per the confirmed design, Tower's identity is
// its shape, not bespoke content ("reuse the existing d10 Room Type table, unmodified").

import { rollDie, type Rng } from './dice'
import { roomTypeForD10, roomDetailForType, ROOM_TYPE_NEEDS_TWO_ROLLS, TREASURE_GUARDED_DETAIL, type RoomType } from '../data/dungeonTables'
import { rollNpcType } from '../data/monsterTables'
import { rollDungeonMonster, type GeneratedDungeonMonster } from './generateDungeonEncounter'
import { rollTreasure, type RolledTreasure } from './generateTreasure'
import { rollTrap, type RolledTrap } from './generateDressing'

// Room types that get a rolled creature attached, on top of their existing book-RAW flavor
// descriptor (e.g. "Cunning Lurker") — see dungeonMonsterLevelTables.ts for the real OSR procedure
// this now rolls on (name-only/no-stats scope, same as before).
const MONSTER_ROOM_TYPES: RoomType[] = ['Solo Monster', 'Monster Mob', 'Boss Monster']

export type GeneratedMonster = GeneratedDungeonMonster
export type GeneratedNpc = { type: string }

export type RolledRoomContent = {
  roomType: RoomType
  roomTypeRoll: number
  detail?: string
  monster?: GeneratedMonster
  npc?: GeneratedNpc
  treasure?: RolledTreasure
  trap?: RolledTrap
}

// `effectiveDungeonLevel` (this project's house-rule scaling number — see dungeonTables.ts) is
// the real OSR "dungeon level" input to both the Monster Sub-table Matrix (dungeonMonsterLevelTables.ts,
// every monster-room roll below) and Treasure's amount/magic-item-count scaling (OSR Table 12 —
// see generateTreasure.ts). No more site-wide theme lock or Boss-Monster category exclusion —
// every monster roll here is independent, exactly as the book's own procedure specifies. Defaults
// to 1 (the minimum) so callers that don't care about scaling don't need to thread it.
export function rollRoomContent(rng: Rng, effectiveDungeonLevel = 1): RolledRoomContent {
  const roomTypeRoll = rollDie(10, rng)
  const roomType = roomTypeForD10(roomTypeRoll)
  const detail: string | undefined =
    roomType === 'Empty'
      ? undefined
      : ROOM_TYPE_NEEDS_TWO_ROLLS[roomType]
        ? roomDetailForType(roomType, rollDie(6, rng), rollDie(6, rng))
        : roomDetailForType(roomType, rollDie(6, rng))

  const monster: GeneratedMonster | undefined = MONSTER_ROOM_TYPES.includes(roomType)
    ? rollDungeonMonster(rng, effectiveDungeonLevel)
    : undefined
  const npc: GeneratedNpc | undefined = roomType === 'NPC' ? { type: rollNpcType(rng) } : undefined
  // Treasure is its own distinct Room Type outcome (not retroactively rolled for monster
  // rooms) — the "guarded by a monster" bonus (roll the Amount table twice, +1 each) maps onto
  // this room's own "Watched by a monster" detail result instead. See treasureTables.ts's header.
  const treasure: RolledTreasure | undefined =
    roomType === 'Treasure' ? rollTreasure(rng, effectiveDungeonLevel, detail === TREASURE_GUARDED_DETAIL) : undefined
  // A concrete named mechanism + severity, additive to the core rules' existing 2-word Trap
  // flavor tag above — see data/trapTables.ts's header.
  const trap: RolledTrap | undefined = roomType === 'Trap' ? rollTrap(rng, effectiveDungeonLevel) : undefined

  return { roomType, roomTypeRoll, detail, monster, npc, treasure, trap }
}

// A "reroll-toward" bias, not a hard override (confirmed 2026-07-04, for Keep's Armory/Lord's
// Quarters slots): roll normally, and only if that miss the desired type(s) get a single second
// chance to land on one of them. A second full roll (detail/monster/npc included) is only ever
// consumed when the first roll needs it — same conditional-consumption shape as the detail
// sub-roll above, not a fixed extra cost every time.
export function rollBiasedRoomContent(rng: Rng, biasedTowardTypes: RoomType[], effectiveDungeonLevel = 1): RolledRoomContent {
  const first = rollRoomContent(rng, effectiveDungeonLevel)
  if (biasedTowardTypes.includes(first.roomType)) return first
  const second = rollRoomContent(rng, effectiveDungeonLevel)
  return biasedTowardTypes.includes(second.roomType) ? second : first
}
