import { describe, expect, it } from 'vitest'
import {
  castleOwnerClassForD3,
  castleOwnerLevelRangeForClass,
  castlePatrolForClass,
  castleReactionForClass,
} from './castleTables'

describe('Castle owner class (1d3)', () => {
  it.each([
    [1, 'Fighter'],
    [2, 'Magic-User'],
    [3, 'Cleric'],
  ] as const)('roll %i -> %s', (roll, ownerClass) => {
    expect(castleOwnerClassForD3(roll)).toBe(ownerClass)
  })

  it('throws out of range', () => {
    expect(() => castleOwnerClassForD3(0)).toThrow()
    expect(() => castleOwnerClassForD3(4)).toThrow()
  })
})

describe('Castle owner level range', () => {
  it.each([
    ['Fighter', { min: 9, max: 14 }],
    ['Magic-User', { min: 11, max: 14 }],
    ['Cleric', { min: 7, max: 14 }],
  ] as const)('%s -> %o', (ownerClass, range) => {
    expect(castleOwnerLevelRangeForClass(ownerClass)).toEqual(range)
  })
})

describe('Castle patrol flavor', () => {
  it.each([
    ['Fighter', '2-12 heavy horsemen'],
    ['Magic-User', '2-12 heavy footmen'],
    ['Cleric', '2-12 medium horsemen'],
  ] as const)('%s -> %s', (ownerClass, patrol) => {
    expect(castlePatrolForClass(ownerClass)).toBe(patrol)
  })
})

describe('Castle reaction (1d6)', () => {
  it.each([
    ['Fighter', 1, 'Pursue'],
    ['Fighter', 3, 'Pursue'],
    ['Fighter', 4, 'Ignore'],
    ['Fighter', 5, 'Ignore'],
    ['Fighter', 6, 'Friendly'],
    ['Magic-User', 1, 'Pursue'],
    ['Magic-User', 2, 'Ignore'],
    ['Magic-User', 5, 'Ignore'],
    ['Magic-User', 6, 'Friendly'],
    ['Cleric', 1, 'Pursue'],
    ['Cleric', 2, 'Pursue'],
    ['Cleric', 3, 'Ignore'],
    ['Cleric', 4, 'Ignore'],
    ['Cleric', 5, 'Friendly'],
    ['Cleric', 6, 'Friendly'],
  ] as const)('%s roll %i -> %s', (ownerClass, roll, reaction) => {
    expect(castleReactionForClass(ownerClass, roll)).toBe(reaction)
  })

  it('throws out of range', () => {
    expect(() => castleReactionForClass('Fighter', 0)).toThrow()
    expect(() => castleReactionForClass('Fighter', 7)).toThrow()
  })
})
