// Wires the real OSR Appendix C dungeon-monster procedure (dungeonMonsterLevelTables.ts) into
// this project's room/wandering-encounter content — replaces the old invented category/theme
// system (monsterTables.ts's rollMonsterTheme/rollMonster) for dungeon-shaped sites.

import type { Rng } from './dice'
import { rollInRange } from './dice'
import { rollDungeonMonsterLevelEntry, type DragonEntry } from '../data/dungeonMonsterLevelTables'
import { rollSettlementNpc, type SettlementNpc } from '../data/npcTables'
import { monsterTreasureType } from '../data/monsterTreasureTypes'
import { rollTreasureForRawType, describeRolledTreasure, type RolledTreasureByType } from '../data/treasureTypeTables'

export type GeneratedDungeonMonster =
  | { kind: 'monster'; name: string; numberAppearing: string; treasureTypeRaw?: string; treasure?: RolledTreasureByType }
  | { kind: 'dragon'; type: string; age: string; hitPointsPerHD: string; numberAppearing: string; treasureTypeRaw?: string; treasure?: RolledTreasureByType }
  // The book's own NPC Party procedure needs a full adventuring-party class/level generator this
  // project has never built and explicitly declined (see dungeonMonsterLevelTables.ts's header) —
  // simplified here to a small band of individuals via the existing settlement NPC roller.
  | { kind: 'npcParty'; members: SettlementNpc[] }

const NPC_PARTY_MIN_SIZE = 1
const NPC_PARTY_MAX_SIZE = 4

// Looks up the rolled creature's own Treasure Type (monsterTreasureTypes.ts) and, where the raw
// string has at least one mechanically-rollable letter, rolls it (treasureTypeTables.ts). The raw
// string is always returned when known, even if nothing rolled from it (e.g. "Nil", or a note
// this project's parser can't extract a letter from) — see treasureTypeTables.ts's header for why
// full parsing of every book notation is out of scope.
function rollMonsterTreasure(name: string, rng: Rng): { treasureTypeRaw?: string; treasure?: RolledTreasureByType } {
  const raw = monsterTreasureType(name)
  if (!raw) return {}
  return { treasureTypeRaw: raw, treasure: rollTreasureForRawType(raw, rng) }
}

export function rollDungeonMonster(rng: Rng, effectiveDungeonLevel: number): GeneratedDungeonMonster {
  const resolved = rollDungeonMonsterLevelEntry(effectiveDungeonLevel, rng)
  if (resolved.kind === 'dragon') {
    const entry: DragonEntry = resolved.entry
    return {
      kind: 'dragon',
      type: entry.type,
      age: entry.age,
      hitPointsPerHD: entry.hitPointsPerHD,
      numberAppearing: resolved.numberAppearing,
      ...rollMonsterTreasure(entry.type, rng),
    }
  }
  if (resolved.kind === 'npcParty') {
    const size = rollInRange(NPC_PARTY_MIN_SIZE, NPC_PARTY_MAX_SIZE, rng)
    const members = Array.from({ length: size }, () => rollSettlementNpc(rng))
    return { kind: 'npcParty', members }
  }
  return { kind: 'monster', name: resolved.name, numberAppearing: resolved.numberAppearing, ...rollMonsterTreasure(resolved.name, rng) }
}

function describeTreasure(monster: Extract<GeneratedDungeonMonster, { kind: 'monster' | 'dragon' }>): string | undefined {
  if (!monster.treasureTypeRaw) return undefined
  return describeRolledTreasure(monster.treasureTypeRaw, monster.treasure)
}

// Shared display shape for every hex-detail view that renders a dungeon monster.
export function describeDungeonMonster(monster: GeneratedDungeonMonster): { name: string; subtitle: string; treasure?: string } {
  if (monster.kind === 'dragon') {
    return {
      name: monster.type,
      subtitle: `${monster.age}, ${monster.hitPointsPerHD} HD/head — × ${monster.numberAppearing}`,
      treasure: describeTreasure(monster),
    }
  }
  if (monster.kind === 'npcParty') {
    return { name: 'NPC Party', subtitle: monster.members.map((m) => `${m.race} ${m.profession}`).join(', ') }
  }
  return { name: monster.name, subtitle: `× ${monster.numberAppearing}`, treasure: describeTreasure(monster) }
}
