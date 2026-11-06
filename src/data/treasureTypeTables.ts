// Transcribed verbatim from the Basic Fantasy compilation's (core rules + Field Guide) Appendix B: Treasure — "Treasure Types" (lair/
// guarded hoards, letters A-O) and "Individuals' Treasure Type" (letters P-V). Source:
// combined-monsters.md, Appendix B (~line 7121) — not
// previously extracted into docs/osr-appendix-cde-source.txt (that file only covers Appendix
// C/D/E), read directly from the source .md for this table.
//
// This is a DIFFERENT system from src/data/treasureTables.ts (OSR's own separately-numbered
// Tables 9-12, already wired to the core rules' Treasure Room Type) — Treasure Types A-V are the
// classic per-monster letter code, referenced by a monster's own stat-block entry and looked up
// here via monsterTreasureType() (see below). Both systems coexist: a Treasure Room's contents
// still come from Tables 9-12; a Treasure Type is additive flavor/loot for a specific rolled
// monster.
//
// Scope: magic items resolve to a COUNT only, not a specific item name — same abstraction
// treasureTables.ts already uses, and consistent with this project's standing "no specific magic
// items/stat blocks yet" scope line. A handful of rows also specify extra fixed items (e.g. "+ 1
// potion", "1 sword, armor, or weapon") — kept as a flavor `extraNote` string rather than
// separately rolled, since resolving a *specific* sword/potion/scroll would need its own magic
// item sub-tables (out of scope, same reasoning).

import { rollDie, sumDice, type Rng } from '../engine/dice'
import type { CoinType } from './treasureTables'


type CoinChance = { chancePercent: number; diceCount: number; diceSides: number }

export type TreasureTypeRow = {
  letter: string
  // Coin fields undefined = Nil (never present) for this letter.
  copper?: CoinChance
  silver?: CoinChance
  electrum?: CoinChance
  gold?: CoinChance
  platinum?: CoinChance
  // Rolled independently per the source's own footnote ("roll twice, once for each category").
  gems?: CoinChance
  jewelry?: CoinChance
  magicItems?: { chancePercent: number; count: number; extraNote?: string }
  // A-O hoards are given "(1000s)" in the source's own column headers — the rolled dice total is
  // multiplied by 1000. Individuals' Treasure Type (P-V) has no such multiplier.
  coinMultiplier: 1000 | 1
}

// Treasure Types A-O (lair/guarded hoards).
const LAIR_TYPES: TreasureTypeRow[] = [
  { letter: 'A', copper: { chancePercent: 25, diceCount: 1, diceSides: 6 }, silver: { chancePercent: 30, diceCount: 1, diceSides: 6 }, electrum: { chancePercent: 20, diceCount: 1, diceSides: 4 }, gold: { chancePercent: 35, diceCount: 2, diceSides: 12 }, platinum: { chancePercent: 25, diceCount: 1, diceSides: 2 }, gems: { chancePercent: 50, diceCount: 6, diceSides: 36 }, jewelry: { chancePercent: 50, diceCount: 6, diceSides: 36 }, magicItems: { chancePercent: 30, count: 3 }, coinMultiplier: 1000 },
  { letter: 'B', copper: { chancePercent: 50, diceCount: 1, diceSides: 8 }, silver: { chancePercent: 25, diceCount: 1, diceSides: 6 }, electrum: { chancePercent: 25, diceCount: 1, diceSides: 4 }, gold: { chancePercent: 25, diceCount: 1, diceSides: 3 }, gems: { chancePercent: 25, diceCount: 1, diceSides: 6 }, jewelry: { chancePercent: 25, diceCount: 1, diceSides: 6 }, magicItems: { chancePercent: 10, count: 1, extraNote: 'sword, armor, or weapon' }, coinMultiplier: 1000 },
  { letter: 'C', copper: { chancePercent: 20, diceCount: 1, diceSides: 12 }, silver: { chancePercent: 30, diceCount: 1, diceSides: 4 }, electrum: { chancePercent: 10, diceCount: 1, diceSides: 4 }, gems: { chancePercent: 25, diceCount: 1, diceSides: 4 }, jewelry: { chancePercent: 25, diceCount: 1, diceSides: 4 }, magicItems: { chancePercent: 10, count: 2 }, coinMultiplier: 1000 },
  { letter: 'D', copper: { chancePercent: 10, diceCount: 1, diceSides: 8 }, silver: { chancePercent: 15, diceCount: 1, diceSides: 12 }, gold: { chancePercent: 60, diceCount: 1, diceSides: 6 }, gems: { chancePercent: 30, diceCount: 1, diceSides: 8 }, jewelry: { chancePercent: 30, diceCount: 1, diceSides: 8 }, magicItems: { chancePercent: 15, count: 2, extraNote: '+ 1 potion' }, coinMultiplier: 1000 },
  { letter: 'E', copper: { chancePercent: 5, diceCount: 1, diceSides: 10 }, silver: { chancePercent: 30, diceCount: 1, diceSides: 12 }, electrum: { chancePercent: 25, diceCount: 1, diceSides: 4 }, gold: { chancePercent: 25, diceCount: 1, diceSides: 8 }, gems: { chancePercent: 10, diceCount: 1, diceSides: 10 }, jewelry: { chancePercent: 10, diceCount: 1, diceSides: 10 }, magicItems: { chancePercent: 25, count: 3, extraNote: '+ 1 scroll' }, coinMultiplier: 1000 },
  { letter: 'F', silver: { chancePercent: 10, diceCount: 2, diceSides: 20 }, electrum: { chancePercent: 20, diceCount: 1, diceSides: 8 }, gold: { chancePercent: 45, diceCount: 1, diceSides: 12 }, platinum: { chancePercent: 30, diceCount: 1, diceSides: 3 }, gems: { chancePercent: 20, diceCount: 2, diceSides: 24 }, jewelry: { chancePercent: 10, diceCount: 1, diceSides: 12 }, magicItems: { chancePercent: 30, count: 3, extraNote: 'except weapons, + 1 potion + 1 scroll' }, coinMultiplier: 1000 },
  { letter: 'G', gold: { chancePercent: 50, diceCount: 10, diceSides: 40 }, platinum: { chancePercent: 50, diceCount: 1, diceSides: 6 }, gems: { chancePercent: 25, diceCount: 3, diceSides: 18 }, jewelry: { chancePercent: 25, diceCount: 1, diceSides: 10 }, magicItems: { chancePercent: 35, count: 4, extraNote: '+ 1 scroll' }, coinMultiplier: 1000 },
  { letter: 'H', copper: { chancePercent: 25, diceCount: 3, diceSides: 24 }, silver: { chancePercent: 50, diceCount: 1, diceSides: 100 }, electrum: { chancePercent: 50, diceCount: 10, diceSides: 40 }, gold: { chancePercent: 50, diceCount: 10, diceSides: 60 }, platinum: { chancePercent: 25, diceCount: 5, diceSides: 20 }, gems: { chancePercent: 50, diceCount: 1, diceSides: 100 }, jewelry: { chancePercent: 50, diceCount: 10, diceSides: 40 }, magicItems: { chancePercent: 15, count: 4, extraNote: '+ 1 potion + 1 scroll' }, coinMultiplier: 1000 },
  { letter: 'I', platinum: { chancePercent: 30, diceCount: 1, diceSides: 8 }, gems: { chancePercent: 50, diceCount: 2, diceSides: 12 }, jewelry: { chancePercent: 50, diceCount: 2, diceSides: 12 }, magicItems: { chancePercent: 15, count: 1 }, coinMultiplier: 1000 },
  { letter: 'J', copper: { chancePercent: 25, diceCount: 1, diceSides: 4 }, silver: { chancePercent: 10, diceCount: 1, diceSides: 3 }, coinMultiplier: 1000 },
  { letter: 'K', silver: { chancePercent: 30, diceCount: 1, diceSides: 6 }, electrum: { chancePercent: 10, diceCount: 1, diceSides: 2 }, coinMultiplier: 1000 },
  { letter: 'L', gems: { chancePercent: 50, diceCount: 1, diceSides: 4 }, jewelry: { chancePercent: 50, diceCount: 1, diceSides: 4 }, coinMultiplier: 1000 },
  { letter: 'M', gold: { chancePercent: 40, diceCount: 2, diceSides: 8 }, platinum: { chancePercent: 50, diceCount: 5, diceSides: 30 }, gems: { chancePercent: 55, diceCount: 5, diceSides: 20 }, jewelry: { chancePercent: 45, diceCount: 2, diceSides: 12 }, coinMultiplier: 1000 },
  { letter: 'N', magicItems: { chancePercent: 40, count: 2, extraNote: 'potions' }, coinMultiplier: 1000 },
  { letter: 'O', magicItems: { chancePercent: 50, count: 1, extraNote: 'scrolls' }, coinMultiplier: 1000 },
]

// Individuals' Treasure Type (P-V) — a single creature's own personal wealth, not a lair hoard.
// P-T have no percentage in the source (guaranteed, modeled here as chancePercent: 100).
const INDIVIDUAL_TYPES: TreasureTypeRow[] = [
  { letter: 'P', copper: { chancePercent: 100, diceCount: 1, diceSides: 24 }, coinMultiplier: 1 },
  { letter: 'Q', silver: { chancePercent: 100, diceCount: 1, diceSides: 18 }, coinMultiplier: 1 },
  { letter: 'R', electrum: { chancePercent: 100, diceCount: 1, diceSides: 12 }, coinMultiplier: 1 },
  { letter: 'S', gold: { chancePercent: 100, diceCount: 1, diceSides: 8 }, coinMultiplier: 1 },
  { letter: 'T', platinum: { chancePercent: 100, diceCount: 1, diceSides: 6 }, coinMultiplier: 1 },
  { letter: 'U', copper: { chancePercent: 10, diceCount: 1, diceSides: 100 }, silver: { chancePercent: 10, diceCount: 1, diceSides: 100 }, gold: { chancePercent: 5, diceCount: 1, diceSides: 100 }, gems: { chancePercent: 5, diceCount: 1, diceSides: 4 }, jewelry: { chancePercent: 5, diceCount: 1, diceSides: 4 }, magicItems: { chancePercent: 2, count: 1 }, coinMultiplier: 1 },
  { letter: 'V', silver: { chancePercent: 10, diceCount: 1, diceSides: 100 }, electrum: { chancePercent: 5, diceCount: 1, diceSides: 100 }, gold: { chancePercent: 10, diceCount: 1, diceSides: 100 }, platinum: { chancePercent: 5, diceCount: 1, diceSides: 100 }, gems: { chancePercent: 10, diceCount: 1, diceSides: 4 }, jewelry: { chancePercent: 10, diceCount: 1, diceSides: 4 }, magicItems: { chancePercent: 5, count: 1 }, coinMultiplier: 1 },
]

const ALL_TYPES: Record<string, TreasureTypeRow> = {}
for (const row of [...LAIR_TYPES, ...INDIVIDUAL_TYPES]) ALL_TYPES[row.letter] = row

export function treasureTypeRowForLetter(letter: string): TreasureTypeRow | undefined {
  return ALL_TYPES[letter]
}

export type RolledTreasureTypeCoins = { coinType: CoinType; amount: number }
export type RolledTreasureByType = {
  coins: RolledTreasureTypeCoins[]
  gems: boolean
  jewelry: boolean
  magicItemCount: number
  magicItemNote?: string
}

function rollChance(chance: CoinChance | undefined, multiplier: number, rng: Rng): number {
  if (!chance) return 0
  if (rollDie(100, rng) > chance.chancePercent) return 0
  return sumDice(chance.diceCount, chance.diceSides, rng) * multiplier
}

// Combines multiple rolled results into one — needed for a compound raw Treasure Type string
// (e.g. "Q x3, S": three separate Type Q rolls plus one Type S roll, shown to the GM as a single
// loot summary). Coin amounts of the same type are summed; gems/jewelry/magic items OR/add.
export function combineTreasureResults(results: RolledTreasureByType[]): RolledTreasureByType {
  const coinTotals = new Map<CoinType, number>()
  let gems = false
  let jewelry = false
  let magicItemCount = 0
  const notes: string[] = []
  for (const r of results) {
    for (const { coinType, amount } of r.coins) coinTotals.set(coinType, (coinTotals.get(coinType) ?? 0) + amount)
    gems = gems || r.gems
    jewelry = jewelry || r.jewelry
    magicItemCount += r.magicItemCount
    if (r.magicItemNote) notes.push(r.magicItemNote)
  }
  return {
    coins: [...coinTotals.entries()].map(([coinType, amount]) => ({ coinType, amount })),
    gems,
    jewelry,
    magicItemCount,
    magicItemNote: notes.length ? notes.join('; ') : undefined,
  }
}

export function rollTreasureByTypeLetter(letter: string, rng: Rng = Math.random): RolledTreasureByType | undefined {
  const row = treasureTypeRowForLetter(letter)
  if (!row) return undefined

  const coins: RolledTreasureTypeCoins[] = []
  const coinFields: [CoinType, CoinChance | undefined][] = [
    ['cp', row.copper],
    ['sp', row.silver],
    ['ep', row.electrum],
    ['gp', row.gold],
    ['pp', row.platinum],
  ]
  for (const [coinType, chance] of coinFields) {
    const amount = rollChance(chance, row.coinMultiplier, rng)
    if (amount > 0) coins.push({ coinType, amount })
  }

  const gems = row.gems ? rollDie(100, rng) <= row.gems.chancePercent : false
  const jewelry = row.jewelry ? rollDie(100, rng) <= row.jewelry.chancePercent : false
  const magicItemHit = row.magicItems ? rollDie(100, rng) <= row.magicItems.chancePercent : false

  return {
    coins,
    gems,
    jewelry,
    magicItemCount: magicItemHit ? row.magicItems!.count : 0,
    magicItemNote: magicItemHit ? row.magicItems!.extraNote : undefined,
  }
}

// A raw stat-block Treasure Type string (e.g. "C + 1000 gp", "Q x3, S", "R (C)") is often
// compound or annotated beyond a simple letter — see monsterTreasureTypes.ts's header for why
// full parsing of every notation is out of scope. Extracts just the recognizable single-letter
// tokens (A-V), expanding an "x N" multiplier into N repeated rolls of that letter; anything else
// in the string (flat gp bonuses, parenthetical notes, "in lair", "special") is not parsed —
// callers should still show the raw string to the GM regardless of what this returns.
// Full pipeline: parse a raw stat-block Treasure Type string into letters, roll each, and combine
// into one result. Returns undefined if the string has no recognizable letter tokens at all (e.g.
// "Nil", or a string this project's parser can't extract anything from) — callers should still
// surface the raw string to the GM in that case, this only covers the mechanically-rollable part.
export function rollTreasureForRawType(raw: string, rng: Rng = Math.random): RolledTreasureByType | undefined {
  const letters = parseTreasureTypeLetters(raw)
  if (letters.length === 0) return undefined
  const rolled = letters.map((letter) => rollTreasureByTypeLetter(letter, rng)).filter((r): r is RolledTreasureByType => Boolean(r))
  if (rolled.length === 0) return undefined
  return combineTreasureResults(rolled)
}

// Shared GM-facing display string for a monster's Treasure Type — used by every view that shows
// a rolled monster (dungeon rooms via generateDungeonEncounter.ts, wilderness via EncounterRoller).
export function describeRolledTreasure(raw: string, rolled: RolledTreasureByType | undefined): string {
  const parts: string[] = []
  if (rolled) {
    for (const { coinType, amount } of rolled.coins) parts.push(`${amount} ${coinType}`)
    if (rolled.gems) parts.push('gems')
    if (rolled.jewelry) parts.push('jewelry')
    if (rolled.magicItemCount > 0) {
      parts.push(`${rolled.magicItemCount} magic item${rolled.magicItemCount > 1 ? 's' : ''}${rolled.magicItemNote ? ` (${rolled.magicItemNote})` : ''}`)
    }
  }
  return `Treasure Type ${raw} — ${parts.length ? parts.join(', ') : 'none rolled'}`
}

export function parseTreasureTypeLetters(raw: string): string[] {
  const letters: string[] = []
  for (const part of raw.split(',')) {
    const m = part.trim().match(/^([A-V])(?:\s*x\s*(\d+))?$/)
    if (!m) continue
    const count = m[2] ? Number(m[2]) : 1
    for (let i = 0; i < count; i++) letters.push(m[1])
  }
  return letters
}
