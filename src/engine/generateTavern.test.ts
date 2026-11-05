import { describe, expect, it } from 'vitest'
import { generateTavern } from './generateTavern'

function scripted(values: number[]): () => number {
  let i = 0
  return () => values[i++]
}

function forDieResult(n: number, sides: number): number {
  return (n - 1) / sides
}

describe('generateTavern', () => {
  it('produces a full tavern for the Poor tier', () => {
    const rng = scripted([
      forDieResult(1, 3), // tier -> Poor
      forDieResult(1, 20), // name col A
      forDieResult(1, 20), // name col B
      forDieResult(1, 20), // known for
      forDieResult(1, 12), // food
      forDieResult(1, 6), // drink (Poor rolls a d6)
    ])
    const tavern = generateTavern(rng)
    expect(tavern.sizeTier).toBe('Poor')
    expect(tavern.name).toBe('The Laughing Goose')
    expect(tavern.knownFor).toBe('Cheap rooms, no questions asked')
    expect(tavern.food).toBe('Turnip mash')
    expect(tavern.drink).toContain('Bilge rum')
  })

  it('is usable with the default Math.random rng across every tier', () => {
    for (let i = 0; i < 20; i++) {
      const tavern = generateTavern()
      expect(['Poor', 'Standard', 'Wealthy']).toContain(tavern.sizeTier)
      expect(tavern.name).toBeTruthy()
      expect(tavern.food).toBeTruthy()
      expect(tavern.drink).toBeTruthy()
    }
  })
})
