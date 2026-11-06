import { rollDie, type Rng } from './dice'
import { encounterForD100, minPartyLevelForOsrUrbanEncounter, type EncounterTableKey, type OsrUrbanEncounterTableKey } from '../data/encounterTables'
import { wildernessEncounterChanceForTerrain, encounterPurposeForD8, wildernessCategoryForD100, type WildernessEncounterCategory } from '../data/encounterFrequencyTables'
import { wildernessMonsterNameForRoll, wildernessEncounterLevelDie } from '../data/wildernessMonsterLevelTables'
import type { Terrain } from '../data/tables'
import { rollSettlementNpc, type SettlementNpc } from '../data/npcTables'
import { monsterTreasureType } from '../data/monsterTreasureTypes'
import { rollTreasureForRawType, type RolledTreasureByType } from '../data/treasureTypeTables'

export function rollEncounter(key: EncounterTableKey, rng: Rng = Math.random): string {
  return encounterForD100(key, rollDie(100, rng))
}

export function rollEncounterPurpose(rng: Rng = Math.random): string {
  return encounterPurposeForD8(rollDie(8, rng))
}

// OSR's wilderness Encounter Frequency check: roll 1d6, and only if it lands in the terrain's
// trigger set does a wandering encounter actually occur (see encounterFrequencyTables.ts).
// This is the "sometimes nothing happens" gate this project's manual EncounterRoller didn't
// have before Phase 4 — it always produced a hit.
export function checkWildernessEncounterFrequency(terrain: Terrain, rng: Rng = Math.random): boolean {
  const roll = rollDie(6, rng)
  return wildernessEncounterChanceForTerrain(terrain).includes(roll)
}

// Real OSR procedure (Wilderness Encounters): roll d% on the Terrain Category Summary
// (encounterFrequencyTables.ts) for a category, then roll the die given by Wilderness Encounter
// Level for the hex's Danger Level down that terrain's own 20-row table
// (wildernessMonsterLevelTables.ts) to get an actual creature name. Replaces the old invented
// category-exclusion gate (excludedCategoriesForHexDangerLevel, removed) — a low Danger Level hex
// now can't roll deep into a table at all, rather than having specific categories blocked; a
// 1st-level party's Ghoul complaint (2026-08-23) is fixed at the table level, not by exclusion.
// Human/Demi-Human and NPC still roll a traveler via the existing settlement NPC roller instead
// of a named table entry — a lone human/demi-human on the road isn't a "monster," and the book's
// own Human/NPC column entries are settlements/narrative roles (e.g. "Fishing Village",
// "Escapees"), not persons to name individually.
export type WildernessMonsterResult =
  | {
      kind: 'monster'
      monster: { name: string; category: WildernessEncounterCategory; treasureTypeRaw?: string; treasure?: RolledTreasureByType }
    }
  | { kind: 'traveler'; npc: SettlementNpc }

export function rollWildernessMonster(terrain: Terrain, hexDangerLevel: number, rng: Rng = Math.random): WildernessMonsterResult {
  const category = wildernessCategoryForD100(terrain, rollDie(100, rng))
  if (category === 'Human/Demi-Human' || category === 'NPC') {
    return { kind: 'traveler', npc: rollSettlementNpc(rng) }
  }
  const die = wildernessEncounterLevelDie(hexDangerLevel)
  const name = wildernessMonsterNameForRoll(terrain, category, rollDie(die, rng))
  // Same Treasure Type lookup/roll as the dungeon path (generateDungeonEncounter.ts) — see
  // monsterTreasureTypes.ts's header for scope/judgment-call notes.
  const treasureTypeRaw = monsterTreasureType(name)
  const treasure = treasureTypeRaw ? rollTreasureForRawType(treasureTypeRaw, rng) : undefined
  return { kind: 'monster', monster: { name, category, treasureTypeRaw, treasure } }
}

// Urban Encounter Level (Appendix C): a handful of OSR Urban table rows are "out of place" below
// a party-level threshold (Wererat/Weretiger/Werewolf need 3+; Demon/Devil/Ghost/Night
// Hag/Rakshasa/Shadow/Spectre/Wight/Will-O-Wisp/Wraith need 5+; Vampire/Lich need 8+) — see
// encounterTables.ts's minPartyLevelForOsrUrbanEncounter for the row data. The book offers the DM
// three options for an out-of-place roll (reroll / treat as a rumor / let it stand as a
// dangerous surprise) — implemented here as a bounded reroll, since a single-click roller can't
// ask the GM mid-roll; the ~11-16% of rows gated at all means this essentially always resolves
// well within the attempt cap, but the cap still exists so a pathological rng can't hang.
const MAX_REROLL_ATTEMPTS = 20

export function rollOsrUrbanEncounter(key: OsrUrbanEncounterTableKey, hexDangerLevel: number, rng: Rng = Math.random): string {
  let roll = rollDie(100, rng)
  for (let attempt = 1; attempt < MAX_REROLL_ATTEMPTS; attempt++) {
    const minLevel = minPartyLevelForOsrUrbanEncounter(key, roll)
    if (!minLevel || hexDangerLevel >= minLevel) break
    roll = rollDie(100, rng)
  }
  return encounterForD100(key, roll)
}
