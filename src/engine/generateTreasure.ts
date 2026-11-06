// Rolls a full treasure result (amount + container + optional guard/hiding-location) per
// OSR's Appendix D tables — see data/treasureTables.ts for the transcribed tables and the
// note on this project's scope (Treasure Room Type outcome only).

import { rollDie, sumDice, type Rng } from './dice'
import {
  treasureAmountRowForD20,
  treasureContainerForD20,
  treasureGuardForD20,
  treasureHiddenInForD20,
  type CoinType,
  type TreasureContainer,
} from '../data/treasureTables'

export type RolledTreasureAmount =
  | { kind: 'coins'; coinType: CoinType; amount: number }
  | { kind: 'gems'; count: number }
  | { kind: 'jewellery' }
  | { kind: 'magicItem'; count: number }
  | { kind: 'none' }

export type RolledTreasure = {
  // Length 2 when guardedByMonster (OSR: "roll twice on the [Amount] table and add 1 to each
  // roll" when a monster guards the treasure), otherwise length 1.
  amounts: RolledTreasureAmount[]
  container: TreasureContainer
  guard?: string
  hiddenIn?: string
}


// dungeonLevel multiplies coin amounts and sets the magic-item count (book RAW: "one item per
// dungeon level, minimum 1"); rollBonus is the +1-per-roll OSR applies when guarded by a
// monster, clamped to the table's max face so it can't overflow past row 20.
function rollTreasureAmount(rng: Rng, dungeonLevel: number, rollBonus: number): RolledTreasureAmount {
  const roll = Math.min(20, rollDie(20, rng) + rollBonus)
  const row = treasureAmountRowForD20(roll)

  if (row.kind === 'coins') {
    const amount = sumDice(row.diceCount, row.diceSides, rng) * row.coinMultiplier * dungeonLevel
    return { kind: 'coins', coinType: row.coinType, amount }
  }
  if (row.kind === 'gemsOrJewellery') {
    const sub = rollDie(8, rng)
    return sub <= 5 ? { kind: 'gems', count: sumDice(1, 3, rng) } : { kind: 'jewellery' }
  }
  // noneOrMagicItem — see treasureAmountRowForD20's comment on folding the source's stray
  // 21st row into a wider 1d10 sub-roll here (1-5 none, 6-10 magic item).
  const sub = rollDie(10, rng)
  return sub <= 5 ? { kind: 'none' } : { kind: 'magicItem', count: Math.max(1, dungeonLevel) }
}

export function rollTreasure(rng: Rng, dungeonLevel: number, guardedByMonster: boolean): RolledTreasure {
  const amounts = guardedByMonster
    ? [rollTreasureAmount(rng, dungeonLevel, 1), rollTreasureAmount(rng, dungeonLevel, 1)]
    : [rollTreasureAmount(rng, dungeonLevel, 0)]

  const container = treasureContainerForD20(rollDie(20, rng))

  let guard: string | undefined
  let hiddenIn: string | undefined
  if (rollDie(2, rng) === 1) {
    guard = treasureGuardForD20(rollDie(20, rng))
    hiddenIn = treasureHiddenInForD20(rollDie(20, rng))
  }

  return { amounts, container, guard, hiddenIn }
}

export function describeTreasureAmount(amount: RolledTreasureAmount): string {
  switch (amount.kind) {
    case 'coins':
      return `${amount.amount.toLocaleString()} ${amount.coinType}`
    case 'gems':
      return `${amount.count} gem${amount.count === 1 ? '' : 's'}`
    case 'jewellery':
      return '1 piece of jewellery'
    case 'magicItem':
      return `${amount.count} magic item${amount.count === 1 ? '' : 's'}`
    case 'none':
      return 'nothing of value'
  }
}
