// Transcribed from the Basic Fantasy compilation's (core rules + Field Guide) Appendix D: The Encounter Builder — Tables 9-12
// (Treasure Container, Guards & Wards, Hidden By/In, Treasure Amount). Source text:
// docs/osr-appendix-cde-source.txt, ~lines 2858-2909 (extracted from
// combined-monsters.pdf's Appendix D).
//
// This is the first treasure system this project has had at all — the core rules' own
// "Treasure" room type (dungeonTables.ts) gives only a 2-word flavor tag ("Hidden",
// "Watched by a monster"), never a GP amount. See docs/plan-osr-integration.md, Phase 1.
//
// Scoped to the "Treasure" Room Type outcome only (not retroactively onto Solo/Monster
// Mob/Boss Monster rooms) — the core rules' own d10 already keeps Treasure as a distinct
// outcome from monster rooms, so this doesn't need touching monster-room logic at all. OSR's
// own "guarded by a monster" bonus (roll the Amount table twice, +1 to each roll) maps
// directly onto the Treasure room type's own "Watched by a monster" detail-table result — see
// engine/generateTreasure.ts.

export type CoinType = 'cp' | 'sp' | 'ep' | 'gp' | 'pp'

// Table 12: Treasure Amount (1d20). Dice notation for the coin rows; the two special rows
// (19, 20) need their own d8/d10 sub-roll — see engine/generateTreasure.ts.
export type TreasureAmountRow =
  | { kind: 'coins'; coinType: CoinType; diceCount: number; diceSides: number; coinMultiplier: number }
  | { kind: 'gemsOrJewellery' }
  | { kind: 'noneOrMagicItem' }

// The source table is captioned "(1d20)" but its printed rows run 1-21 (row 21 is "1 magic
// item", printed as a separate line from row 20's "roll 1d8: ... 6-8 = 1 magic item") — an
// off-by-one in the source document itself, not a transcription choice. Folded row 21 into
// row 20 here: on a roll of 20, the sub-roll widens from 1d8 to 1d10 (1-5 no treasure, 6-10
// magic item) so the extra "guaranteed magic item" case from row 21 is still represented as
// a wider hit-chance on the same 1d20 bucket, rather than inventing an unreachable 21st die
// face.
export function treasureAmountRowForD20(roll: number): TreasureAmountRow {
  if (roll < 1 || roll > 20) throw new Error(`treasureAmountRowForD20: roll out of range: ${roll}`)
  if (roll <= 5) return { kind: 'coins', coinType: 'cp', diceCount: 2, diceSides: 10, coinMultiplier: 100 }
  if (roll <= 10) return { kind: 'coins', coinType: 'sp', diceCount: 2, diceSides: 10, coinMultiplier: 100 }
  if (roll <= 13) return { kind: 'coins', coinType: 'ep', diceCount: 2, diceSides: 8, coinMultiplier: 100 }
  if (roll <= 16) return { kind: 'coins', coinType: 'gp', diceCount: 1, diceSides: 4, coinMultiplier: 100 }
  if (roll <= 18) return { kind: 'coins', coinType: 'pp', diceCount: 2, diceSides: 10, coinMultiplier: 100 }
  if (roll === 19) return { kind: 'gemsOrJewellery' }
  return { kind: 'noneOrMagicItem' }
}

// Table 9: Treasure Container (1d20).
export type TreasureContainer =
  | 'Bags'
  | 'Sacks'
  | 'Coffers'
  | 'Chests'
  | 'Large Chests'
  | 'Pottery Jars'
  | 'Metal Urns'
  | 'Stone Containers'
  | 'Iron Trunks'
  | 'None, loose'

const TREASURE_CONTAINERS: TreasureContainer[] = [
  'Bags',
  'Sacks',
  'Coffers',
  'Chests',
  'Large Chests',
  'Pottery Jars',
  'Metal Urns',
  'Stone Containers',
  'Iron Trunks',
  'None, loose',
]

export function treasureContainerForD20(roll: number): TreasureContainer {
  if (roll < 1 || roll > 20) throw new Error(`treasureContainerForD20: roll out of range: ${roll}`)
  return TREASURE_CONTAINERS[Math.ceil(roll / 2) - 1]
}

// Table 10: Treasure Guards & Wards (1d20) — a trap on the container itself, rolled only when
// the treasure is (per the book's "optional, or on a 50% chance") hidden/warded at all.
const TREASURE_GUARDS: [number, number, string][] = [
  [1, 2, 'Blade scything across inside'],
  [3, 4, 'Contact poison on container'],
  [5, 6, 'Contact poison on treasure'],
  [7, 7, 'Gas released by opening container'],
  [8, 8, 'Explosive runes'],
  [9, 10, 'Poisoned needles in lock'],
  [11, 11, 'Poisoned needles in handles'],
  [12, 12, 'Poisonous insect or reptile living inside container'],
  [13, 13, 'Spears released from walls when container opened'],
  [14, 14, 'Spring darts firing from front of container'],
  [15, 15, 'Spring darts firing from top of container'],
  [16, 16, 'Spring darts firing up from inside bottom of container'],
  [17, 17, 'Stone block dropping in front of container'],
  [18, 18, 'Symbol'],
  [19, 19, 'Trapdoor opening in front of container'],
  [20, 20, 'Trapdoor opening 6 ft in front of container'],
]

export function treasureGuardForD20(roll: number): string {
  const row = TREASURE_GUARDS.find(([lo, hi]) => roll >= lo && roll <= hi)
  if (!row) throw new Error(`treasureGuardForD20: roll out of range: ${roll}`)
  return row[2]
}

// Table 11: Treasure Hidden By or In (1d20).
const TREASURE_HIDDEN_IN: [number, number, string][] = [
  [1, 2, 'Behind a loose wall stone'],
  [3, 4, 'Illusion to change appearance or hide item'],
  [5, 7, 'Invisibility'],
  [8, 11, 'In a nearby secret room'],
  [12, 12, 'In an ordinary container in plain view'],
  [13, 13, 'Inside or under trash or dung heap'],
  [14, 14, 'Non-magically disguised'],
  [15, 15, 'Secret space under container'],
  [16, 17, 'Secret compartment in container'],
  [18, 20, 'Under a loose flooring stone'],
]

export function treasureHiddenInForD20(roll: number): string {
  const row = TREASURE_HIDDEN_IN.find(([lo, hi]) => roll >= lo && roll <= hi)
  if (!row) throw new Error(`treasureHiddenInForD20: roll out of range: ${roll}`)
  return row[2]
}
