import { rollDie, roll2d6, type Rng } from './dice'
import { tavernNameForD20, tavernKnownForForD20, tavernFoodForRoll, tavernDrinkForRoll, type TavernSizeTier } from '../data/settlementTables'

export type Tavern = {
  sizeTier: TavernSizeTier
  name: string
  knownFor: string
  food: string
  drink: string
}

const TAVERN_TIERS: TavernSizeTier[] = ['Poor', 'Standard', 'Wealthy']

// Ephemeral, re-rollable generator — not persisted onto a District (see plan assumptions).
// The book doesn't specify how a tavern's size tier is chosen when generating one on demand,
// so it's picked uniformly among the 3 tiers here.
export function generateTavern(rng: Rng = Math.random): Tavern {
  const sizeTier = TAVERN_TIERS[rollDie(3, rng) - 1]
  const name = tavernNameForD20(rollDie(20, rng), rollDie(20, rng))
  const knownFor = tavernKnownForForD20(rollDie(20, rng))
  const food = tavernFoodForRoll(sizeTier, rollDie(12, rng))

  // Drinks table is shared across tiers; the tier only changes which die rolls into it
  // (Poor: d6, Standard: 2d6, Wealthy: d12), per the book's tavern-tier text.
  const drinkRoll = sizeTier === 'Poor' ? rollDie(6, rng) : sizeTier === 'Standard' ? roll2d6(rng) : rollDie(12, rng)
  const drink = tavernDrinkForRoll(drinkRoll)

  return { sizeTier, name, knownFor, food, drink }
}
