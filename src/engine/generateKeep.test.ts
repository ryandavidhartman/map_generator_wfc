import { describe, expect, it } from 'vitest'
import { generateKeepSite, CELLAR_FLOOR } from './generateKeep'

// Scripted values first, then a seeded stream — for tests that pin down the early rolls but
// don't care about the rest of the site.
function scriptedThen(values: number[], fallback: () => number): () => number {
  let i = 0
  return () => (i < values.length ? values[i++] : fallback())
}

function forDieResult(n: number, sides: number): number {
  return (n - 1) / sides
}

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('generateKeepSite', () => {
  it('a Small roll (3 ground rooms) gets Hall/Barracks/Armory on the ground floor, Lord\'s Quarters upstairs', () => {
    const rng = scriptedThen([
      forDieResult(1, 6), // size -> Small (range 3-4)
      forDieResult(1, 6), // danger
      0, // dungeon level roll (rollInRange within the danger-derived band)
      0, // scenario roll (d10) — value irrelevant to this test
      0, // castle owner class d3 -> Fighter
      0, // owner level roll (rollInRange within Fighter's 9-14 band) -> 9
      0, // castle reaction d6 -> 1, Fighter's Pursue range (1-3)
      forDieResult(1, 2), // ground-floor room count d2 -> range.min(3) + 1 - 1 = 3
      forDieResult(1, 10), // courtyard -> Empty
      forDieResult(1, 10), // Hall -> Empty
      forDieResult(1, 10), // Barracks -> Empty
      forDieResult(3, 10), // Armory roll 1 -> Trap (not Treasure)
      forDieResult(1, 6), forDieResult(1, 6), // Trap needs 2 detail rolls
      forDieResult(1, 100), // concrete trap name roll (consumed even though this roll is discarded by the bias)
      forDieResult(9, 10), // Armory biased reroll -> Treasure
      forDieResult(1, 6), // Treasure detail roll -> 'Tucked out of sight' (not the guarded result)
      forDieResult(14, 20), // treasure amount roll -> gp row (1d4x100 gp)
      forDieResult(1, 4), // gp dice roll
      forDieResult(1, 20), // treasure container roll
      forDieResult(2, 2), // container guard/hidden 50% check -> no guard
    ], seededRng(5))
    const site = generateKeepSite(rng)
    expect(site.rooms.filter((r) => r.floor === 0).map((r) => r.name)).toEqual(['Courtyard', 'Hall', 'Barracks', 'Armory'])
    expect(site.upperFloorCount).toBe(1)
    expect(site.rooms.find((r) => r.name === "Lord's Quarters")!.floor).toBe(1)
    expect(site.rooms.find((r) => r.name === 'Armory')!.roomType).toBe('Treasure')
    expect(site.rooms.find((r) => r.name === 'Armory')!.treasure).toBeDefined()
  })

  it('has upper floors by size (1 for Small/Medium, 2 for Large) and always a cellar', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const site = generateKeepSite(seededRng(seed * 7919))
      expect(site.upperFloorCount).toBe(site.size === 'Large' ? 2 : 1)
      for (let floor = 1; floor <= site.upperFloorCount; floor++) {
        const count = site.rooms.filter((r) => r.floor === floor).length
        expect(count).toBeGreaterThanOrEqual(2)
        expect(count).toBeLessThanOrEqual(4)
      }
      const cellar = site.rooms.filter((r) => r.floor === CELLAR_FLOOR)
      expect(cellar.length).toBeGreaterThanOrEqual(2)
      expect(cellar.length).toBeLessThanOrEqual(4)
      expect(cellar.slice(0, 2).map((r) => r.name)).toEqual(['Storeroom', 'Cells'])
    }
  })

  it('puts the Lord\'s Quarters first on the top floor, and keeps room ids unique', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const site = generateKeepSite(seededRng(seed * 7919))
      const top = site.rooms.filter((r) => r.floor === site.upperFloorCount)
      expect(top[0].name).toBe("Lord's Quarters")
      expect(new Set(site.rooms.map((r) => r.id)).size).toBe(site.rooms.length)
    }
  })

  it('holds structural invariants across many seeds: single objective, valid ground-floor room counts', () => {
    for (const seed of [1, 2, 3, 42, 12345, 999999]) {
      const site = generateKeepSite(seededRng(seed))
      const aboveGroundCount = site.rooms.filter((r) => r.floor === 0 && !r.isCourtyard).length
      if (site.size === 'Small') expect([3, 4]).toContain(aboveGroundCount)
      if (site.size === 'Medium') expect([5, 6]).toContain(aboveGroundCount)
      if (site.size === 'Large') expect([7, 8]).toContain(aboveGroundCount)

      const objectiveRooms = site.rooms.filter((r) => r.isObjectiveRoom)
      expect(objectiveRooms).toHaveLength(1)
      const maxRoll = Math.max(...site.rooms.map((r) => r.roomTypeRoll))
      expect(objectiveRooms[0].roomTypeRoll).toBe(maxRoll)
      expect(site.scenario.length).toBeGreaterThan(0)
      expect(['Fighter', 'Magic-User', 'Cleric']).toContain(site.approach.ownerClass)
      expect(['Pursue', 'Ignore', 'Friendly']).toContain(site.approach.reaction)
      expect(site.approach.patrol.length).toBeGreaterThan(0)

      for (const room of site.rooms) {
        expect(Boolean(room.treasure)).toBe(room.roomType === 'Treasure')
        expect(Boolean(room.trap)).toBe(room.roomType === 'Trap')
      }
    }
  })

  it('every monster room (including the Lord\'s Quarters slot) resolves to a well-formed monster/dragon/npcParty result', () => {
    for (const seed of [1, 2, 3, 42, 12345, 999999]) {
      const site = generateKeepSite(seededRng(seed))
      for (const room of site.rooms) {
        if (!room.monster) continue
        if (room.monster.kind === 'monster') expect(room.monster.name.length).toBeGreaterThan(0)
        else if (room.monster.kind === 'dragon') expect(room.monster.type.length).toBeGreaterThan(0)
        else expect(room.monster.members.length).toBeGreaterThan(0)
      }
    }
  })
})
