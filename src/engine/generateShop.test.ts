import { describe, expect, it } from 'vitest'
import { generateShop } from './generateShop'

function scripted(values: number[]): () => number {
  let i = 0
  return () => values[i++]
}

function forDieResult(n: number, sides: number): number {
  return (n - 1) / sides
}

describe('generateShop', () => {
  it('produces a full shop for a given tier', () => {
    const rng = scripted([
      forDieResult(1, 12), // Poor shop type (d12)
      forDieResult(1, 20), // name col A
      forDieResult(1, 20), // name col B
      forDieResult(1, 20), // known for
      forDieResult(1, 4), // interesting customer row
      forDieResult(1, 4), // interesting customer col
    ])
    const shop = generateShop('Poor', rng)
    expect(shop.tier).toBe('Poor')
    expect(shop.shopType).toBe('Rag shop')
    expect(shop.name).toBe("Hob's Goods")
    expect(shop.knownFor).toBe('Haggling is an insult')
    expect(shop.interestingCustomer).toBe('Retired sellsword')
  })

  it('is usable with the default Math.random rng across every tier', () => {
    for (const tier of ['Poor', 'Standard', 'Wealthy'] as const) {
      const shop = generateShop(tier)
      expect(shop.shopType).toBeTruthy()
      expect(shop.name).toBeTruthy()
    }
  })
})
