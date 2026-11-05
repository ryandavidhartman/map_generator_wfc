import { describe, expect, it } from 'vitest'
import {
  monsterLevelForDungeonLevel,
  monsterLevelEntryForD100,
  dragonEntryForMonsterLevel,
  rollDungeonMonsterLevelEntry,
} from './dungeonMonsterLevelTables'

function scripted(values: number[]): () => number {
  let i = 0
  return () => values[i++]
}

function forDieResult(n: number, sides: number): number {
  return (n - 1) / sides
}

describe('monsterLevelForDungeonLevel', () => {
  it('matches the book\'s own worked example: dungeon level 5, 1d12 roll 9 -> Monster Level 4', () => {
    expect(monsterLevelForDungeonLevel(5, 9)).toBe(4)
  })

  it('dungeon level 1-2, roll 1-8 -> ML1; roll 12 -> ML3 (the only reachable levels)', () => {
    expect(monsterLevelForDungeonLevel(1, 1)).toBe(1)
    expect(monsterLevelForDungeonLevel(2, 8)).toBe(1)
    expect(monsterLevelForDungeonLevel(2, 9)).toBe(2)
    expect(monsterLevelForDungeonLevel(2, 12)).toBe(3)
  })

  it('dungeon level 16+, roll 12 -> ML10 (the deepest row)', () => {
    expect(monsterLevelForDungeonLevel(16, 12)).toBe(10)
    expect(monsterLevelForDungeonLevel(100, 12)).toBe(10)
  })

  it('dungeon level 10-11 shares one matrix row', () => {
    expect(monsterLevelForDungeonLevel(10, 1)).toBe(1)
    expect(monsterLevelForDungeonLevel(11, 1)).toBe(1)
  })
})

describe('monsterLevelEntryForD100', () => {
  it('ML1 boundary spot-checks', () => {
    expect(monsterLevelEntryForD100(1, 1).name).toBe('Lemure')
    expect(monsterLevelEntryForD100(1, 100).name).toBe('Berserker')
    expect(monsterLevelEntryForD100(1, 14).name).toBe('Rat')
  })

  it('ML3 flags a Dragon result correctly', () => {
    const entry = monsterLevelEntryForD100(3, 95)
    expect(entry.name).toBe('Dragon (see sub-table)')
    expect(entry.isDragon).toBe(true)
    expect(entry.isNpcParty).toBe(false)
  })

  it('ML1 flags an NPC Party result correctly', () => {
    const entry = monsterLevelEntryForD100(1, 8)
    expect(entry.name).toBe('NPC Party')
    expect(entry.isNpcParty).toBe(true)
  })

  it('ML10 boundary spot-checks', () => {
    expect(monsterLevelEntryForD100(10, 1).name).toBe('Type V Demon (Marilith)')
    expect(monsterLevelEntryForD100(10, 100).name).toBe('Lich')
  })
})

describe('dragonEntryForMonsterLevel', () => {
  it('ML3 (the shallowest Dragon sub-table) boundary spot-checks', () => {
    expect(dragonEntryForMonsterLevel(3, 1).type).toBe('Dragon, Black')
    expect(dragonEntryForMonsterLevel(3, 100).type).toBe('Dragon, White')
  })

  it('ML9 doubles up on the oldest dragons (2x notation preserved verbatim)', () => {
    expect(dragonEntryForMonsterLevel(9, 1)).toEqual({ type: '2x Dragon, Black', age: 'Ancient + Old', hitPointsPerHD: '8+6' })
  })

  it('throws for a monster level with no Dragon sub-table (ML1/ML2)', () => {
    expect(() => dragonEntryForMonsterLevel(1, 1)).toThrow()
    expect(() => dragonEntryForMonsterLevel(2, 1)).toThrow()
  })
})

describe('rollDungeonMonsterLevelEntry', () => {
  it('resolves a plain monster with exactly 2 rng calls (1d12, d%)', () => {
    // 1d12 roll 1 -> ML1 at dungeon level 1; d% roll 1 -> Lemure.
    const rng = scripted([forDieResult(1, 12), forDieResult(1, 100)])
    const result = rollDungeonMonsterLevelEntry(1, rng)
    expect(result).toEqual({ kind: 'monster', name: 'Lemure', numberAppearing: '1d10' })
  })

  it('resolves a Dragon result with a third follow-up roll', () => {
    // Dungeon level 3, 1d12 roll 9 -> ML3 (per the matrix's 3-row: ML3 is 9-10); d% roll 95 ->
    // Dragon; d% roll 1 on the ML3 Dragon sub-table -> Dragon, Black.
    const rng = scripted([forDieResult(9, 12), forDieResult(95, 100), forDieResult(1, 100)])
    const result = rollDungeonMonsterLevelEntry(3, rng)
    expect(result.kind).toBe('dragon')
    if (result.kind === 'dragon') expect(result.entry.type).toBe('Dragon, Black')
  })

  it('resolves an NPC Party result without a follow-up roll', () => {
    const rng = scripted([forDieResult(1, 12), forDieResult(8, 100)])
    const result = rollDungeonMonsterLevelEntry(1, rng)
    expect(result).toEqual({ kind: 'npcParty' })
  })

  it('a Level 1 dungeon can never roll a Demogorgon (ML1 has no Demon entries at all)', () => {
    for (let d12 = 1; d12 <= 12; d12++) {
      for (let pct = 1; pct <= 100; pct += 7) {
        const rng = scripted([forDieResult(d12, 12), forDieResult(pct, 100), 0])
        const result = rollDungeonMonsterLevelEntry(1, rng)
        if (result.kind === 'monster') expect(result.name).not.toBe('Demogorgon')
      }
    }
  })
})
