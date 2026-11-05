import { describe, expect, it } from 'vitest'
import { trickObjectForD100, trickAttributeForD100 } from './trickTables'

describe('Trick Object table (1d100)', () => {
  it('covers the full 1-100 range with no gaps', () => {
    for (let roll = 1; roll <= 100; roll++) {
      expect(trickObjectForD100(roll)).toBeTruthy()
    }
  })

  it('spot-checks boundary rows', () => {
    expect(trickObjectForD100(1)).toBe('altar')
    expect(trickObjectForD100(3)).toBe('altar')
    expect(trickObjectForD100(4)).toBe('arch')
    expect(trickObjectForD100(100)).toBe('well')
  })

  it('throws out of range', () => {
    expect(() => trickObjectForD100(0)).toThrow()
    expect(() => trickObjectForD100(101)).toThrow()
  })
})

describe('Trick Attribute table (1d100)', () => {
  it('covers the full 1-100 range with no gaps', () => {
    for (let roll = 1; roll <= 100; roll++) {
      expect(trickAttributeForD100(roll)).toBeTruthy()
    }
  })

  it('spot-checks boundary rows', () => {
    expect(trickAttributeForD100(1)).toBe('ages')
    expect(trickAttributeForD100(50)).toBe('increases constitution')
    expect(trickAttributeForD100(51)).toBe('increases Dexterity')
    expect(trickAttributeForD100(100)).toBe('yells and screams')
  })

  it('throws out of range', () => {
    expect(() => trickAttributeForD100(0)).toThrow()
    expect(() => trickAttributeForD100(101)).toThrow()
  })
})
