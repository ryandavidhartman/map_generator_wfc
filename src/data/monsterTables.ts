// NPC archetype names for the core rules' own dungeon "NPC" Room Type (a captive/hiding/wounded
// person, per the book-RAW descriptor table) — not personal names, and not monsters. Transcribed
// from the Basic Fantasy compilation's (core rules + Field Guide) "NPCs" category:
// combined-monsters.md. "Men"'s five named sub-types
// (Brigand, Buccaneer/Pirate, Dervish, Merchant, Nomad) are listed individually rather than kept
// as one generic "Men" entry.
//
// This file used to also hold a 148-entry hand-curated monster/category pool
// (MONSTERS/MonsterEntry/MonsterCategory/rollMonster) used by both dungeon-shaped sites (via a
// site-wide "theme" lock) and wilderness encounters. Both call sites have since migrated to real,
// verbatim OSR procedures — dungeons to the Monster Sub-table Matrix
// (dungeonMonsterLevelTables.ts / generateDungeonEncounter.ts), wilderness to the per-terrain
// Wilderness Encounters tables (wildernessMonsterLevelTables.ts / rollEncounter.ts) — so the old
// invented pool was removed as fully superseded, not left in place unused.

import type { Rng } from '../engine/dice'

export const NPC_TYPES: string[] = [
  'Acolyte',
  'Bandit',
  'Berserker',
  'Dwarf',
  'Elf',
  'Gnome',
  'Halfling',
  'Medium',
  'Brigand',
  'Buccaneer / Pirate',
  'Dervish',
  'Merchant',
  'Nomad',
  'Noble',
  'Normal Human',
  'Trader',
  'Veteran',
]

export function rollNpcType(rng: Rng = Math.random): string {
  return NPC_TYPES[Math.floor(rng() * NPC_TYPES.length)]
}
