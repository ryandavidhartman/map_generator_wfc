import { describe, expect, it } from 'vitest'
import { randomTrapForD100, trapSeverityForDungeonLevel } from './trapTables'

describe('Random Trap table (1d100)', () => {
  it('covers the full 1-100 range with no gaps', () => {
    for (let roll = 1; roll <= 100; roll++) {
      expect(randomTrapForD100(roll)).toBeTruthy()
    }
  })

  it('spot-checks a couple of rows', () => {
    expect(randomTrapForD100(1)).toBe('acid spray')
    expect(randomTrapForD100(2)).toBe('acid spray')
    expect(randomTrapForD100(100)).toBe('wire, neck high')
  })

  it('throws out of range', () => {
    expect(() => randomTrapForD100(0)).toThrow()
    expect(() => randomTrapForD100(101)).toThrow()
  })
})

describe('Trap severity by dungeon level', () => {
  it.each([
    [1, 'Nuisance'],
    [4, 'Nuisance'],
    [5, 'Hazardous'],
    [8, 'Hazardous'],
    [9, 'Dangerous'],
    [12, 'Dangerous'],
    [13, 'Fatal'],
    [16, 'Fatal'],
  ] as const)('level %i -> %s', (level, severity) => {
    expect(trapSeverityForDungeonLevel(level)).toBe(severity)
  })
})
