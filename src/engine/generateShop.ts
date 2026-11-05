import { rollDie, type Rng } from './dice'
import { shopTypeForRoll, shopNameForD20, shopKnownForForD20, interestingCustomerFor2D4, type ShopTier } from '../data/settlementTables'

export type Shop = {
  tier: ShopTier
  shopType: string
  name: string
  knownFor: string
  interestingCustomer: string
}

// Ephemeral, re-rollable generator — not persisted onto a District (see plan assumptions).
export function generateShop(tier: ShopTier, rng: Rng = Math.random): Shop {
  const sides = tier === 'Poor' ? 12 : 10
  const shopType = shopTypeForRoll(tier, rollDie(sides, rng))
  const name = shopNameForD20(rollDie(20, rng), rollDie(20, rng))
  const knownFor = shopKnownForForD20(rollDie(20, rng))
  const interestingCustomer = interestingCustomerFor2D4(rollDie(4, rng), rollDie(4, rng))
  return { tier, shopType, name, knownFor, interestingCustomer }
}
