// Settlement NPC population — transcribed verbatim from the Basic Fantasy compilation (core rules + Field Guide),
// Appendix C: Random Encounters' "Urban Encounters" section:
// combined-monsters.pdf (pp. 162-163). Confirmed scope
// (2026-07-06, same pattern as the dungeon monster/NPC population phase): name-only flavor
// (race + profession + a 0-Level activity descriptor), no combat stats — real stat blocks are
// the same deferred future MongoDB integration noted in monsterTables.ts. Appendix C's
// "Red-Light Professions" sub-table was deliberately excluded (confirmed with the user) as not
// fitting this project's tone. Appendix D ("Random Dungeons") was also reviewed but contains no
// NPC content at all — it's dungeon-layout/dressing/trap tooling, not applicable here.
//
// The book gives no explicit die for choosing among the five 0-Level activity tiers (they're a
// GM-reference grouping, not a roll table) — rolling 1d5 uniformly here is this project's own
// addition on top of otherwise-verbatim data, kept independent of profession/race to avoid
// inventing a profession-to-tier mapping the source doesn't provide.

import { rollDie, type Rng } from '../engine/dice'

export type NpcRace = 'Dwarf' | 'Elf' | 'Gnome' | 'Half-Elf' | 'Halfling' | 'Half-Orc' | 'Human'

const RACE_RANGES: { max: number; race: NpcRace }[] = [
  { max: 10, race: 'Dwarf' },
  { max: 15, race: 'Elf' },
  { max: 20, race: 'Gnome' },
  { max: 28, race: 'Half-Elf' },
  { max: 34, race: 'Halfling' },
  { max: 40, race: 'Half-Orc' },
  { max: 100, race: 'Human' },
]

export function npcRaceForD100(roll: number): NpcRace {
  if (roll < 1 || roll > 100) throw new Error(`npcRaceForD100: roll out of range: ${roll}`)
  return RACE_RANGES.find((r) => roll <= r.max)!.race
}

export type UrbanProfession =
  | 'Bandit'
  | 'Brigand'
  | 'City Guard'
  | 'City Official'
  | 'City Watchman'
  | 'Cleric'
  | 'Fighter'
  | 'Gentleman'
  | 'Labourer'
  | 'Magic-User'
  | 'Mercenary'
  | 'Merchant'
  | 'Noble'
  | 'Rake'
  | 'Ruffian'
  | 'Thief'
  | 'Tradesman'

const URBAN_PROFESSION_RANGES: { max: number; profession: UrbanProfession }[] = [
  { max: 8, profession: 'Bandit' },
  { max: 16, profession: 'Brigand' },
  { max: 18, profession: 'City Guard' },
  { max: 20, profession: 'City Official' },
  { max: 23, profession: 'City Watchman' },
  { max: 27, profession: 'Cleric' },
  { max: 36, profession: 'Fighter' },
  { max: 43, profession: 'Gentleman' },
  { max: 58, profession: 'Labourer' },
  { max: 63, profession: 'Magic-User' },
  { max: 71, profession: 'Mercenary' },
  { max: 78, profession: 'Merchant' },
  { max: 80, profession: 'Noble' },
  { max: 88, profession: 'Rake' },
  { max: 93, profession: 'Ruffian' },
  { max: 97, profession: 'Thief' },
  { max: 100, profession: 'Tradesman' },
]

export function urbanProfessionForD100(roll: number): UrbanProfession {
  if (roll < 1 || roll > 100) throw new Error(`urbanProfessionForD100: roll out of range: ${roll}`)
  return URBAN_PROFESSION_RANGES.find((r) => roll <= r.max)!.profession
}

// Only consulted when the Urban Profession roll lands on "Noble" (book RAW: "Noble Professions").
export type NobleClass = 'Normal Human' | 'Fighter' | 'Cleric'

export function nobleClassForD100(roll: number): NobleClass {
  if (roll < 1 || roll > 100) throw new Error(`nobleClassForD100: roll out of range: ${roll}`)
  if (roll <= 50) return 'Normal Human'
  if (roll <= 85) return 'Fighter'
  return 'Cleric'
}

export type ZeroLevelActivityTier = {
  tier: 'Infirm' | 'Sedentary' | 'Active' | 'Fit' | 'Very Fit'
  hitDice: string
  combatAbility: string
  examples: string
}

const ZERO_LEVEL_ACTIVITY_TIERS: ZeroLevelActivityTier[] = [
  { tier: 'Infirm', hitDice: '1d3', combatAbility: '-3 to hit/damage', examples: 'Elders, children, beggars, plague victims' },
  { tier: 'Sedentary', hitDice: '1d4', combatAbility: '-2 to hit/damage', examples: 'Clerks, scribes, shopkeepers, minor officials' },
  { tier: 'Active', hitDice: '1d4+1', combatAbility: 'as 0-level Normal Human', examples: 'Craftsmen, servants, merchants, boatmen' },
  { tier: 'Fit', hitDice: '1d4+2', combatAbility: 'as 0-level Normal Human', examples: 'Farmers, miners, labourers, sailors, militiamen' },
  { tier: 'Very Fit', hitDice: '1d6+1', combatAbility: 'as 0-level Normal Human', examples: 'Soldiers, watchmen, bodyguards, men-at-arms' },
]

export function zeroLevelActivityTierForD5(roll: number): ZeroLevelActivityTier {
  const tier = ZERO_LEVEL_ACTIVITY_TIERS[roll - 1]
  if (!tier) throw new Error(`zeroLevelActivityTierForD5: roll out of range: ${roll}`)
  return tier
}

export type SettlementNpc = {
  race: NpcRace
  profession: UrbanProfession
  nobleClass?: NobleClass
  nobleLevel?: number
  activityTier: ZeroLevelActivityTier
}

// Composes Race + Urban Profession + (if Noble) Noble Class/Level + a 0-Level activity
// descriptor. Every roll is independent — no cross-referencing between them, same shape as the
// Rift generator's independent Origin/Effect/Stability rolls.
export function rollSettlementNpc(rng: Rng = Math.random): SettlementNpc {
  const race = npcRaceForD100(rollDie(100, rng))
  const profession = urbanProfessionForD100(rollDie(100, rng))
  const activityTier = zeroLevelActivityTierForD5(rollDie(5, rng))

  if (profession === 'Noble') {
    const nobleClass = nobleClassForD100(rollDie(100, rng))
    const nobleLevel = nobleClass === 'Normal Human' ? undefined : rollDie(8, rng) + 4
    return { race, profession, nobleClass, nobleLevel, activityTier }
  }

  return { race, profession, activityTier }
}
