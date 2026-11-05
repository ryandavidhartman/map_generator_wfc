import { describe, expect, it } from 'vitest'
import { rollEncounter, rollEncounterPurpose, checkWildernessEncounterFrequency, rollWildernessMonster, rollOsrUrbanEncounter } from './rollEncounter'
import type { Terrain } from '../data/tables'

function scripted(values: number[]): () => number {
  let i = 0
  return () => values[i++]
}

function forDieResult(n: number, sides: number): number {
  return (n - 1) / sides
}

describe('rollEncounter', () => {
  it('rolls a d100 and looks it up against the given table', () => {
    const rng = scripted([forDieResult(1, 100)])
    expect(rollEncounter('Arctic', rng)).toBe("A white dragon's shed skin, big as a sail, flaps from an ice spire")
  })

  it('is usable with the default Math.random rng', () => {
    expect(rollEncounter('Tavern')).toBeTruthy()
  })
})

describe('rollEncounterPurpose', () => {
  it('rolls a d8 and looks it up', () => {
    const rng = scripted([forDieResult(1, 8)])
    expect(rollEncounterPurpose(rng)).toBe('Guarding a lair, nest, or treasure')
  })
})

describe('checkWildernessEncounterFrequency', () => {
  it('Grassland only triggers on a roll of 6', () => {
    expect(checkWildernessEncounterFrequency('Grassland', scripted([forDieResult(5, 6)]))).toBe(false)
    expect(checkWildernessEncounterFrequency('Grassland', scripted([forDieResult(6, 6)]))).toBe(true)
  })

  it('Mountain triggers on 4, 5, or 6', () => {
    expect(checkWildernessEncounterFrequency('Mountain', scripted([forDieResult(3, 6)]))).toBe(false)
    expect(checkWildernessEncounterFrequency('Mountain', scripted([forDieResult(4, 6)]))).toBe(true)
    expect(checkWildernessEncounterFrequency('Mountain', scripted([forDieResult(6, 6)]))).toBe(true)
  })
})

describe('rollWildernessMonster', () => {
  const TERRAINS: Terrain[] = ['Grassland', 'Forest/jungle', 'River/coast', 'Ocean', 'Mountain', 'Desert/arctic', 'Swamp']

  function seededRng(seed: number): () => number {
    let state = seed >>> 0
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0
      return state / 4294967296
    }
  }

  it('always returns a monster or a traveler, never neither, across every terrain and hex danger level', () => {
    for (const terrain of TERRAINS) {
      for (const hexDangerLevel of [1, 5, 10]) {
        for (const seed of [1, 2, 3, 42, 12345]) {
          const result = rollWildernessMonster(terrain, hexDangerLevel, seededRng(seed))
          if (result.kind === 'monster') {
            expect(result.monster.name.length).toBeGreaterThan(0)
          } else {
            expect(result.npc.race.length).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('a low category roll (Airborne band) still resolves to a monster, not a traveler', () => {
    // roll 1 -> category Airborne for every mapped terrain (every row starts Airborne at 1)
    const rng = scripted([forDieResult(1, 100), 0])
    const result = rollWildernessMonster('Grassland', 1, rng)
    expect(result.kind).toBe('monster')
  })

  // Real OSR procedure (see wildernessMonsterLevelTables.ts): the category roll picks a column,
  // then a die sized by Wilderness Encounter Level (1d8/1d14/1d20, by hex Danger Level) rolls a
  // row down that column. Grassland maps to the Plains table (see
  // encounterFrequencyTables.test.ts's Plains boundary spot-checks: roll 79 -> category Undead).
  // Treasure Type rolling (see treasureTypeTables.test.ts/monsterTreasureTypes.test.ts for that
  // behavior's own coverage) consumes further rng calls after the name/category are decided, so
  // these only assert name/category rather than deep-equaling the whole result.
  it('resolves a named monster from the real per-terrain table', () => {
    const rng = scripted([forDieResult(79, 100), forDieResult(1, 8)])
    const result = rollWildernessMonster('Grassland', 2, rng)
    expect(result.kind).toBe('monster')
    if (result.kind === 'monster') expect(result.monster).toMatchObject({ name: 'Groaning Spirit', category: 'Undead' })
  })

  it('a hex Danger Level of 1-3 (1d8) cannot reach rows beyond 8', () => {
    const rng = scripted([forDieResult(79, 100), forDieResult(8, 8)])
    const result = rollWildernessMonster('Grassland', 2, rng)
    expect(result.kind).toBe('monster')
    if (result.kind === 'monster') expect(result.monster).toMatchObject({ name: 'Mummy', category: 'Undead' })
  })

  it('a hex Danger Level of 7+ (1d20) can reach row 20, unreachable at lower tiers', () => {
    const rng = scripted([forDieResult(79, 100), forDieResult(20, 20)])
    const result = rollWildernessMonster('Grassland', 7, rng)
    expect(result.kind).toBe('monster')
    if (result.kind === 'monster') expect(result.monster).toMatchObject({ name: 'Zombie', category: 'Undead' })
  })

  it('a hex Danger Level of 7+ can land on Dragon (row 1 -> Dragon, Black on Plains)', () => {
    // Grassland/Plains: roll 31 -> category Dragon (within its 30-31 band; 31 chosen over 30 to
    // avoid a floating-point edge case in forDieResult(30, 100) — see dice.ts's rollDie formula).
    const rng = scripted([forDieResult(31, 100), forDieResult(1, 20)])
    const result = rollWildernessMonster('Grassland', 7, rng)
    expect(result.kind).toBe('monster')
    if (result.kind === 'monster') expect(result.monster).toMatchObject({ name: 'Dragon, Black', category: 'Dragon' })
  })
})

describe('rollOsrUrbanEncounter', () => {
  it('a hex Danger Level of 1 never gets a gated (Wererat/Demon/Vampire-tier) result across many rolls', () => {
    for (const key of ['OSR Urban (Daytime)', 'OSR Urban (Nighttime)'] as const) {
      for (const seed of [1, 2, 3, 42, 12345, 777, 2024, 55, 99, 123]) {
        const rng = (() => {
          let state = seed >>> 0
          return () => {
            state = (state * 1664525 + 1013904223) >>> 0
            return state / 4294967296
          }
        })()
        const result = rollOsrUrbanEncounter(key, 1, rng)
        expect(/Wererat|Weretiger|Werewolf|Demon|Devil|Ghost|Night Hag|Rakshasa|Shadow|Spectre|Wight|Will-O-Wisp|Wraith|Vampire or Lich/.test(result)).toBe(
          false,
        )
      }
    }
  })

  it('a hex Danger Level of 8 accepts a gated top-tier result (Vampire or Lich) on the first roll, no reroll needed', () => {
    const rng = scripted([forDieResult(100, 100)]) // roll 100 -> Vampire or Lich, minPartyLevel 8
    const result = rollOsrUrbanEncounter('OSR Urban (Nighttime)', 8, rng)
    expect(result).toContain('Vampire or Lich')
  })

  it('a hex Danger Level of 1 rerolls off a gated row (Vampire or Lich) onto the next roll', () => {
    // First roll (100 -> Vampire or Lich, needs level 8) is rejected; second roll (1 -> Thief,
    // ungated) is accepted.
    const rng = scripted([forDieResult(100, 100), forDieResult(1, 100)])
    const result = rollOsrUrbanEncounter('OSR Urban (Nighttime)', 1, rng)
    expect(result).toContain('Thief')
  })
})
