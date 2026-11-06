import { describe, expect, it } from 'vitest'
import { siteSizeForD6, siteTypeForD6, roomTypeForD10, roomDetailForType, ROOM_TYPE_NEEDS_TWO_ROLLS, dungeonDangerForD6, dungeonLevelBandForDanger, effectiveDungeonLevel, dungeonScenarioForD10, type RoomType } from './dungeonTables'

describe('Site Size table (d6)', () => {
  it.each([
    [1, 'Small', 5],
    [2, 'Small', 5],
    [3, 'Medium', 8],
    [4, 'Medium', 8],
    [5, 'Medium', 8],
    [6, 'Large', 12],
  ] as const)('roll %i -> %s (%i rooms)', (roll, size, roomCount) => {
    expect(siteSizeForD6(roll)).toEqual({ size, roomCount })
  })

  it('throws out of range', () => {
    expect(() => siteSizeForD6(0)).toThrow()
    expect(() => siteSizeForD6(7)).toThrow()
  })
})

describe('Site Type table (d6)', () => {
  it.each([
    [1, 'Cave'],
    [2, 'Cave'],
    [3, 'Tomb'],
    [4, 'Deep tunnels'],
    [5, 'Ruins'],
    [6, 'Ruins'],
  ] as const)('roll %i -> %s', (roll, type) => {
    expect(siteTypeForD6(roll)).toBe(type)
  })
})

describe('Room Type table (d10)', () => {
  it.each([
    [1, 'Empty'],
    [2, 'Empty'],
    [3, 'Trap'],
    [4, 'Minor Hazard'],
    [5, 'Solo Monster'],
    [6, 'NPC'],
    [7, 'Monster Mob'],
    [8, 'Major Hazard'],
    [9, 'Treasure'],
    [10, 'Boss Monster'],
  ] as const)('roll %i -> %s', (roll, type) => {
    expect(roomTypeForD10(roll)).toBe(type)
  })

  it('throws out of range', () => {
    expect(() => roomTypeForD10(0)).toThrow()
    expect(() => roomTypeForD10(11)).toThrow()
  })
})

describe('room detail sub-tables', () => {
  it('Empty has no detail', () => {
    expect(roomDetailForType('Empty', 1)).toBeUndefined()
  })

  it('two-roll types combine both columns independently', () => {
    expect(ROOM_TYPE_NEEDS_TWO_ROLLS.Trap).toBe(true)
    expect(roomDetailForType('Trap', 1, 6)).toBe('Hidden Glyph')
  })

  it('single-roll types use one column', () => {
    expect(ROOM_TYPE_NEEDS_TWO_ROLLS['Minor Hazard']).toBe(false)
    expect(roomDetailForType('Minor Hazard', 1)).toBe('Slippery floor')
  })

  it('every non-Empty room type produces a detail for every roll 1-6', () => {
    const types: RoomType[] = ['Trap', 'Minor Hazard', 'Solo Monster', 'NPC', 'Monster Mob', 'Major Hazard', 'Treasure', 'Boss Monster']
    for (const type of types) {
      for (let roll = 1; roll <= 6; roll++) {
        const detail = ROOM_TYPE_NEEDS_TWO_ROLLS[type] ? roomDetailForType(type, roll, 1) : roomDetailForType(type, roll)
        expect(detail).toBeTruthy()
      }
    }
  })
})

describe('dungeon Danger Level table (d6)', () => {
  it.each([
    [1, 'Unsafe'],
    [2, 'Unsafe'],
    [3, 'Unsafe'],
    [4, 'Risky'],
    [5, 'Risky'],
    [6, 'Deadly'],
  ] as const)('roll %i -> %s (no Safe outcome, unlike the overland table)', (roll, level) => {
    expect(dungeonDangerForD6(roll)).toBe(level)
  })
})

describe('Dungeon Level band by Danger', () => {
  it.each([
    ['Safe', { min: 1, max: 3 }],
    ['Unsafe', { min: 1, max: 4 }],
    ['Risky', { min: 5, max: 9 }],
    ['Deadly', { min: 10, max: 16 }],
  ] as const)('%s -> %o', (danger, band) => {
    expect(dungeonLevelBandForDanger(danger)).toEqual(band)
  })
})

describe('effectiveDungeonLevel', () => {
  it('sums dungeonLevel, hexDangerLevel, and the site danger delta', () => {
    // Risky delta is +2 (see data/tables.ts's dangerLevelDelta).
    expect(effectiveDungeonLevel(5, 3, 'Risky')).toBe(5 + 3 + 2)
  })

  it('floors at 1 even when the deltas would push it non-positive', () => {
    // Safe delta is -1: 1 + 1 + (-1) = 1, still exactly the floor.
    expect(effectiveDungeonLevel(1, 1, 'Safe')).toBe(1)
    // A small dungeonLevel/hexDangerLevel with a Safe delta doesn't dip below the floor either.
    expect(effectiveDungeonLevel(1, 0, 'Safe')).toBe(1)
  })
})

describe('Scenario table (d10)', () => {
  it.each([
    [1, 'Exploring the Unknown'],
    [2, 'Investigating a Chaotic Outpost'],
    [3, 'Recovering Ruins'],
    [4, 'Destroying an Ancient Evil'],
    [5, 'Visiting a Lost Shrine'],
    [6, 'Fulfilling a Quest'],
    [7, 'Escaping from Enemies'],
    [8, 'Rescuing Prisoners'],
    [9, 'Using a Magic Portal'],
    [10, 'Finding a Lost Race'],
  ] as const)('roll %i -> %s', (roll, scenario) => {
    expect(dungeonScenarioForD10(roll)).toBe(scenario)
  })

  it('throws out of range', () => {
    expect(() => dungeonScenarioForD10(0)).toThrow()
    expect(() => dungeonScenarioForD10(11)).toThrow()
  })
})
