import { describe, expect, it } from 'vitest'
import { treasureTypeRowForLetter, rollTreasureByTypeLetter, parseTreasureTypeLetters, rollTreasureForRawType } from './treasureTypeTables'

function scripted(values: number[]): () => number {
  let i = 0
  return () => values[i++]
}

function forDieResult(n: number, sides: number): number {
  return (n - 1) / sides
}

describe('treasureTypeRowForLetter', () => {
  it('returns a row for every letter A-V', () => {
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUV') {
      expect(treasureTypeRowForLetter(letter)).toBeDefined()
    }
  })

  it('returns undefined for an unknown letter', () => {
    expect(treasureTypeRowForLetter('X')).toBeUndefined()
    expect(treasureTypeRowForLetter('Z')).toBeUndefined()
  })

  it('A-O hoards use a 1000x coin multiplier; P-V individuals do not', () => {
    expect(treasureTypeRowForLetter('A')!.coinMultiplier).toBe(1000)
    expect(treasureTypeRowForLetter('P')!.coinMultiplier).toBe(1)
  })
})

describe('rollTreasureByTypeLetter', () => {
  it('returns undefined for an unrecognized letter', () => {
    expect(rollTreasureByTypeLetter('X')).toBeUndefined()
  })

  it('Type P is guaranteed copper (P has no other fields to roll)', () => {
    // Copper still consumes its own percent-chance roll even though chancePercent is 100 (always
    // passes) — 2 rng calls: the percent check, then the 1d24 dice roll.
    const rng = scripted([forDieResult(1, 100), forDieResult(10, 24)])
    const result = rollTreasureByTypeLetter('P', rng)
    expect(result?.coins).toEqual([{ coinType: 'cp', amount: 10 }])
  })

  it('a failed percentage roll produces no coins for that type', () => {
    // Type J: copper 25% chance. Roll 26 (> 25) -> miss. Silver (10% chance) also rolled next.
    const rng = scripted([forDieResult(26, 100), forDieResult(100, 100)])
    const result = rollTreasureByTypeLetter('J', rng)
    expect(result?.coins.find((c) => c.coinType === 'cp')).toBeUndefined()
  })

  it('a successful percentage roll multiplies the dice total by the coin multiplier', () => {
    // Type I has exactly one coin field (platinum: 30% chance, 1d8, x1000). Roll 1 (hit) -> 1d8
    // roll of 5 -> 5000. Remaining fields (gems/jewelry/magic items) are all scripted to miss.
    const rng = scripted([
      forDieResult(1, 100), forDieResult(5, 8), // platinum: hit, roll 5
      forDieResult(100, 100), // gems: miss
      forDieResult(100, 100), // jewelry: miss
      forDieResult(100, 100), // magic items: miss
    ])
    const result = rollTreasureByTypeLetter('I', rng)
    expect(result?.coins).toEqual([{ coinType: 'pp', amount: 5000 }])
  })

  it('magic items resolve to a count, not a specific item', () => {
    // Type O: 50% chance, 1 scroll.
    const rng = scripted([forDieResult(1, 100)])
    const result = rollTreasureByTypeLetter('O', rng)
    expect(result?.magicItemCount).toBe(1)
    expect(result?.magicItemNote).toBe('scrolls')
  })
})

describe('parseTreasureTypeLetters', () => {
  it('extracts a single letter', () => {
    expect(parseTreasureTypeLetters('C')).toEqual(['C'])
  })

  it('extracts a comma-separated list', () => {
    expect(parseTreasureTypeLetters('B, Q, R, S, T')).toEqual(['B', 'Q', 'R', 'S', 'T'])
  })

  it('expands an "x N" multiplier into repeated letters', () => {
    expect(parseTreasureTypeLetters('Q x3, S')).toEqual(['Q', 'Q', 'Q', 'S'])
  })

  it('ignores unparseable notation without throwing', () => {
    expect(parseTreasureTypeLetters('Nil')).toEqual([])
    expect(parseTreasureTypeLetters('C + 1000 gp')).toEqual([])
    expect(parseTreasureTypeLetters('R (C)')).toEqual([])
    expect(parseTreasureTypeLetters('O, P, Q, X')).toEqual(['O', 'P', 'Q'])
  })
})

describe('rollTreasureForRawType', () => {
  it('returns undefined for a raw string with no recognizable letters', () => {
    expect(rollTreasureForRawType('Nil')).toBeUndefined()
  })

  it('sums coins across a compound type ("Q x3, S")', () => {
    // Q: silver 3-18, guaranteed (percent check + dice roll each). S: gold 2-8, guaranteed.
    const rng = scripted([
      forDieResult(1, 100), forDieResult(5, 18), // Q roll 1: 5 silver
      forDieResult(1, 100), forDieResult(5, 18), // Q roll 2: 5 silver
      forDieResult(1, 100), forDieResult(5, 18), // Q roll 3: 5 silver
      forDieResult(1, 100), forDieResult(3, 8), // S: 3 gold
    ])
    const result = rollTreasureForRawType('Q x3, S', rng)
    expect(result?.coins).toEqual(
      expect.arrayContaining([
        { coinType: 'sp', amount: 15 },
        { coinType: 'gp', amount: 3 },
      ]),
    )
  })
})
