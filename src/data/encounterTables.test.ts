import { describe, expect, it } from 'vitest'
import {
  encounterForD100,
  TERRAIN_TO_ENCOUNTER_KEYS,
  SITE_TYPE_TO_ENCOUNTER_KEY,
  DISTRICT_TYPE_TO_ENCOUNTER_KEY,
  minPartyLevelForOsrUrbanEncounter,
  type EncounterTableKey,
} from './encounterTables'

const ALL_KEYS: EncounterTableKey[] = [
  'Arctic',
  'Artisan District',
  'OSR Urban (Daytime)',
  'OSR Urban (Nighttime)',
  'Castle District',
  'Cave',
  'Deep Tunnels',
  'Desert',
  'Forest',
  'Grassland',
  'High District',
  'Jungle',
  'Low District',
  'Market',
  'Mountain',
  'Ocean',
  'River and Coast',
  'Ruins',
  'Slums',
  'Swamp',
  'Tavern',
  'Temple District',
  'University District',
]

describe('encounterForD100', () => {
  it('every table has exactly 100 non-empty entries', () => {
    for (const key of ALL_KEYS) {
      for (let roll = 1; roll <= 100; roll++) {
        expect(encounterForD100(key, roll)).toBeTruthy()
      }
    }
  })

  it('throws out of range', () => {
    expect(() => encounterForD100('Arctic', 0)).toThrow()
    expect(() => encounterForD100('Arctic', 101)).toThrow()
  })

  it('spot-checks roll 1 and 100 (the "00" entry) for a couple of tables', () => {
    expect(encounterForD100('Arctic', 1)).toBe("A white dragon's shed skin, big as a sail, flaps from an ice spire")
    expect(encounterForD100('Arctic', 100)).toBe('A glacier splits open, revealing a stone city beneath the ice')
    expect(encounterForD100('Tavern', 1)).toBe('A hooded stranger slides a map across the table and leaves')
    expect(encounterForD100('Tavern', 100)).toBe('A traveler from another world asks the party what year it is')
  })

  it('spot-checks boundary rows on the new OSR urban tables', () => {
    expect(encounterForD100('OSR Urban (Daytime)', 1)).toContain('Thief (as Assassin)')
    expect(encounterForD100('OSR Urban (Daytime)', 100)).toContain('Werewolf')
    expect(encounterForD100('OSR Urban (Nighttime)', 1)).toContain('Thief (as Assassin)')
    expect(encounterForD100('OSR Urban (Nighttime)', 100)).toContain('Vampire or Lich')
  })
})

describe('TERRAIN_TO_ENCOUNTER_KEYS', () => {
  it('maps every overland terrain to at least one table', () => {
    const terrains = ['Desert/arctic', 'Swamp', 'Grassland', 'Forest/jungle', 'River/coast', 'Ocean', 'Mountain'] as const
    for (const terrain of terrains) {
      expect(TERRAIN_TO_ENCOUNTER_KEYS[terrain].length).toBeGreaterThan(0)
    }
  })

  it('merges two book terrains for the combined overland terrains', () => {
    expect(TERRAIN_TO_ENCOUNTER_KEYS['Desert/arctic']).toEqual(['Desert', 'Arctic'])
    expect(TERRAIN_TO_ENCOUNTER_KEYS['Forest/jungle']).toEqual(['Forest', 'Jungle'])
  })
})

describe('SITE_TYPE_TO_ENCOUNTER_KEY', () => {
  it('Tomb falls back to Ruins (the book has no dedicated Tomb encounter table)', () => {
    expect(SITE_TYPE_TO_ENCOUNTER_KEY.Tomb).toBe('Ruins')
  })

  it('Cave/Deep tunnels/Ruins map to their own tables', () => {
    expect(SITE_TYPE_TO_ENCOUNTER_KEY.Cave).toBe('Cave')
    expect(SITE_TYPE_TO_ENCOUNTER_KEY['Deep tunnels']).toBe('Deep Tunnels')
    expect(SITE_TYPE_TO_ENCOUNTER_KEY.Ruins).toBe('Ruins')
  })
})

describe('DISTRICT_TYPE_TO_ENCOUNTER_KEY', () => {
  it('maps every district type to its own identically-named table', () => {
    expect(DISTRICT_TYPE_TO_ENCOUNTER_KEY.Slums).toBe('Slums')
    expect(DISTRICT_TYPE_TO_ENCOUNTER_KEY['Castle District']).toBe('Castle District')
  })
})

describe('minPartyLevelForOsrUrbanEncounter', () => {
  it('gates the documented Urban Encounter Level rows on Daytime', () => {
    expect(minPartyLevelForOsrUrbanEncounter('OSR Urban (Daytime)', 98)).toBe(3) // Wererat
    expect(minPartyLevelForOsrUrbanEncounter('OSR Urban (Daytime)', 100)).toBe(3) // Werewolf
    expect(minPartyLevelForOsrUrbanEncounter('OSR Urban (Daytime)', 64)).toBe(5) // Night Hag
    expect(minPartyLevelForOsrUrbanEncounter('OSR Urban (Daytime)', 1)).toBeUndefined() // Thief, ungated
  })

  it('gates the documented Urban Encounter Level rows on Nighttime, including the 8+ tier', () => {
    expect(minPartyLevelForOsrUrbanEncounter('OSR Urban (Nighttime)', 91)).toBe(3) // Wererat
    expect(minPartyLevelForOsrUrbanEncounter('OSR Urban (Nighttime)', 23)).toBe(5) // Demon
    expect(minPartyLevelForOsrUrbanEncounter('OSR Urban (Nighttime)', 100)).toBe(8) // Vampire or Lich
    expect(minPartyLevelForOsrUrbanEncounter('OSR Urban (Nighttime)', 36)).toBeUndefined() // Ghast or Ghoul, ungated
  })

  it('throws out of range', () => {
    expect(() => minPartyLevelForOsrUrbanEncounter('OSR Urban (Daytime)', 0)).toThrow()
    expect(() => minPartyLevelForOsrUrbanEncounter('OSR Urban (Daytime)', 101)).toThrow()
  })
})
