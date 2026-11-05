import { describe, expect, it } from 'vitest'
import { generateDungeonSite } from './generateDungeon'
import { dungeonLevelBandForDanger, TREASURE_GUARDED_DETAIL } from '../data/dungeonTables'

// A scripted RNG: each call to Math.random() returns the next queued value.
// rollDie(sides) computes floor(rng() * sides) + 1, so to force a specific die result `n`
// (1-indexed) supply (n - 1) / sides. dungeonLayout.ts calls rng() directly (not via
// rollDie) once per BSP split — a raw 0 always picks the minimum split position — and
// consumes exactly `roomCount - 1` calls total (see dungeonLayout.ts).
function scripted(values: number[]): () => number {
  let i = 0
  return () => {
    if (i >= values.length) throw new Error('scripted rng ran out of values')
    return values[i++]
  }
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

describe('generateDungeonSite', () => {
  it('rolls size, type, danger, then one room per die of the site size', () => {
    const rng = scripted([
      forDieResult(1, 6), // size d6 -> Small (5 rooms)
      forDieResult(3, 6), // type d6 -> Tomb
      forDieResult(6, 6), // danger d6 -> Deadly
      0, // dungeon level roll (rollInRange within Deadly's 10-16 band)
      0, // scenario roll (d10) — value irrelevant to this test
      0, 0, 0, 0, // BSP layout: 5 rooms needs 4 splits, 1 rng call each
      forDieResult(1, 10), // room 0 -> Empty
      forDieResult(1, 10), // room 1 -> Empty
      forDieResult(1, 10), // room 2 -> Empty
      forDieResult(1, 10), // room 3 -> Empty
      forDieResult(9, 10), // room 4 -> Treasure
      forDieResult(1, 6), // room 4 detail roll -> 'Tucked out of sight' (not the guarded result, so a single Amount roll)
      forDieResult(14, 20), // treasure amount roll -> gp row (1d4x100 gp)
      forDieResult(1, 4), // gp dice roll
      forDieResult(1, 20), // treasure container roll
      forDieResult(2, 2), // container guard/hidden 50% check -> no guard
    ])
    const site = generateDungeonSite(rng)
    expect(site.kind).toBe('dungeon')
    expect(site.size).toBe('Small')
    expect(site.siteType).toBe('Tomb')
    expect(site.danger).toBe('Deadly')
    expect(site.rooms).toHaveLength(5)
    expect(site.rooms[4].roomType).toBe('Treasure')
    expect(site.rooms[4].detail).toBe('Tucked out of sight')
    expect(site.rooms[4].treasure?.amounts).toEqual([{ kind: 'coins', coinType: 'gp', amount: 100 * site.effectiveDungeonLevel }])
  })

  it('marks the single highest room-type roll as the objective room, first occurrence wins ties', () => {
    const rng = scripted([
      forDieResult(1, 6), // size -> Small (5 rooms)
      forDieResult(1, 6), // type -> Cave
      forDieResult(1, 6), // danger -> Unsafe
      0, // dungeon level roll (rollInRange within Unsafe's 1-4 band) -> 1
      0, // scenario roll (d10) — value irrelevant to this test
      0, 0, 0, 0, // BSP layout: 4 splits
      forDieResult(1, 10), // room 0 -> Empty
      forDieResult(10, 10), // room 1 -> Boss Monster (tied max)
      forDieResult(1, 6), // room 1 detail
      // room 1 monster (real OSR procedure): dungeonLevel 1 + hexDangerLevel 1 + Unsafe delta 0 =
      // effective level 2 -> Monster Sub-table Matrix row for dungeon level <=2, 1d12 roll 1 ->
      // ML1; d% roll 1 -> Lemure (a plain monster, no Dragon/NPC Party follow-up needed).
      forDieResult(1, 12), forDieResult(1, 100),
      forDieResult(1, 10), // room 2 -> Empty
      forDieResult(10, 10), // room 3 -> Boss Monster (tied max, later index)
      forDieResult(1, 6), // room 3 detail
      forDieResult(1, 12), forDieResult(1, 100), // room 3 monster, same as room 1
      forDieResult(1, 10), // room 4 -> Empty
    ])
    const site = generateDungeonSite(rng)
    expect(site.rooms.filter((r) => r.isObjectiveRoom)).toHaveLength(1)
    expect(site.rooms[1].isObjectiveRoom).toBe(true)
    expect(site.rooms[1].monster).toEqual({ kind: 'monster', name: 'Lemure', numberAppearing: '1d10' })
    expect(site.rooms[3].monster).toEqual({ kind: 'monster', name: 'Lemure', numberAppearing: '1d10' })
    expect(site.rooms[3].isObjectiveRoom).toBe(false)
  })

  it('an override site type skips the type roll entirely', () => {
    const rng = scripted([
      forDieResult(1, 6), // size -> Small
      // no type roll consumed — overridden
      forDieResult(1, 6), // danger -> Unsafe
      0, // dungeon level roll (rollInRange within Unsafe's 1-4 band)
      0, // scenario roll (d10) — value irrelevant to this test
      0, 0, 0, 0, // BSP layout: 4 splits
      forDieResult(1, 10),
      forDieResult(1, 10),
      forDieResult(1, 10),
      forDieResult(1, 10),
      forDieResult(1, 10),
    ])
    const site = generateDungeonSite(rng, 'Ruins')
    expect(site.siteType).toBe('Ruins')
  })

  it('holds structural invariants across many seeds', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      const site = generateDungeonSite(seededRng(seed))
      expect([5, 8, 12]).toContain(site.rooms.length)
      expect(['Cave', 'Tomb', 'Deep tunnels', 'Ruins']).toContain(site.siteType)
      expect(['Unsafe', 'Risky', 'Deadly']).toContain(site.danger)
      const band = dungeonLevelBandForDanger(site.danger)
      expect(site.dungeonLevel).toBeGreaterThanOrEqual(band.min)
      expect(site.dungeonLevel).toBeLessThanOrEqual(band.max)
      expect(site.effectiveDungeonLevel).toBeGreaterThanOrEqual(1)
      expect(site.scenario.length).toBeGreaterThan(0)

      const objectiveRooms = site.rooms.filter((r) => r.isObjectiveRoom)
      expect(objectiveRooms).toHaveLength(1)
      const maxRoll = Math.max(...site.rooms.map((r) => r.roomTypeRoll))
      expect(objectiveRooms[0].roomTypeRoll).toBe(maxRoll)

      for (const room of site.rooms) {
        expect(room.rect.width).toBeGreaterThan(0)
        expect(room.rect.height).toBeGreaterThan(0)
      }

      const roomIds = new Set(site.rooms.map((r) => r.id))
      for (const [a, b] of site.connections) {
        expect(roomIds.has(a)).toBe(true)
        expect(roomIds.has(b)).toBe(true)
      }

      for (const room of site.rooms) {
        const isMonsterType = room.roomType === 'Solo Monster' || room.roomType === 'Monster Mob' || room.roomType === 'Boss Monster'
        expect(Boolean(room.monster)).toBe(isMonsterType)
        expect(Boolean(room.npc)).toBe(room.roomType === 'NPC')
        expect(Boolean(room.treasure)).toBe(room.roomType === 'Treasure')
        expect(Boolean(room.trap)).toBe(room.roomType === 'Trap')
        if (room.treasure) {
          const expectedRolls = room.detail === TREASURE_GUARDED_DETAIL ? 2 : 1
          expect(room.treasure.amounts).toHaveLength(expectedRolls)
        }
        if (room.monster) {
          if (room.monster.kind === 'monster') expect(room.monster.name.length).toBeGreaterThan(0)
          else if (room.monster.kind === 'dragon') expect(room.monster.type.length).toBeGreaterThan(0)
          else expect(room.monster.members.length).toBeGreaterThan(0)
        }
        if (room.npc) {
          expect(room.npc.type.length).toBeGreaterThan(0)
        }
      }
    }
  })

  // Regression coverage for the real OSR procedure now driving monster selection (replacing the
  // old invented category/theme system that let a Boss Monster room roll a Demogorgon in a
  // Level 1 dungeon — see dungeonMonsterLevelTables.test.ts for the table-level version of this
  // same guarantee).
  it('a Level 1 dungeon (minimum hex Danger Level, Unsafe site danger) never rolls a monster above Monster Level 3', () => {
    for (const seed of [1, 2, 3, 42, 12345, 777, 2024, 55, 99, 123]) {
      const site = generateDungeonSite(seededRng(seed))
      if (site.danger !== 'Unsafe' || site.effectiveDungeonLevel > 2) continue
      for (const room of site.rooms) {
        if (room.monster?.kind === 'monster') {
          expect(['Demogorgon', 'Vampire', 'Lich', 'Balor']).not.toContain(room.monster.name)
        }
      }
    }
  })
})
