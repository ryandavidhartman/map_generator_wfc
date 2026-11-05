import { describe, expect, it } from 'vitest'
import { generateTowerSite } from './generateTower'

// Scripted RNG matching this project's convention (see generateDungeon.test.ts): each call to
// Math.random() returns the next queued value. rollDie(sides) computes floor(rng() * sides) + 1.
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

describe('generateTowerSite', () => {
  it('rolls size, danger, level count, then entry hall + guard room, then each upper floor\'s room count + rooms', () => {
    const rng = scripted([
      forDieResult(1, 6), // size d6 -> Small (level range 2-3)
      forDieResult(6, 6), // danger d6 -> Deadly
      0, // dungeon level roll (rollInRange within Deadly's 10-16 band)
      0, // scenario roll (d10) — value irrelevant to this test
      forDieResult(1, 2), // level count d2 -> range.min(2) + 1 - 1 = 2 levels
      forDieResult(1, 10), // entry hall room type -> Empty
      forDieResult(1, 10), // guard room room type -> Empty
      forDieResult(1, 2), // level 1 (top floor) room count d2 -> 1 room
      forDieResult(9, 10), // level 1 (top) room type -> Treasure
      forDieResult(1, 6), // level 1 detail roll -> 'Tucked out of sight' (not the guarded result)
      forDieResult(14, 20), // treasure amount roll -> gp row (1d4x100 gp)
      forDieResult(1, 4), // gp dice roll
      forDieResult(1, 20), // treasure container roll
      forDieResult(2, 2), // container guard/hidden 50% check -> no guard
    ])
    const site = generateTowerSite(rng)
    expect(site.kind).toBe('tower')
    expect(site.size).toBe('Small')
    expect(site.danger).toBe('Deadly')
    expect(site.levelCount).toBe(2)
    expect(site.rooms).toHaveLength(3) // entry hall + guard room + a 1-room top floor
    expect(site.rooms.map((r) => r.id)).toEqual(['entry-hall', 'guard-room', 'level-1'])
  })

  it('the ground floor has exactly 2 rooms (entry hall + guard room) connected to each other', () => {
    const site = generateTowerSite(seededRng(1))
    const groundRooms = site.rooms.filter((r) => r.levelIndex === 0)
    expect(groundRooms).toHaveLength(2)
    expect(groundRooms.filter((r) => r.isGuardRoom)).toHaveLength(1)
    expect(groundRooms.filter((r) => !r.isGuardRoom)).toHaveLength(1)
    expect(site.connections).toContainEqual(['entry-hall', 'guard-room'])
  })

  it('every upper floor has exactly one stair room, plus side rooms: 1-3 rooms on middle floors, 1-2 on top', () => {
    for (const seed of [1, 2, 3, 42, 12345, 777, 2024]) {
      const site = generateTowerSite(seededRng(seed))
      for (let level = 1; level < site.levelCount; level++) {
        const roomsAtLevel = site.rooms.filter((r) => r.levelIndex === level)
        const isTop = level === site.levelCount - 1
        expect(roomsAtLevel.length).toBeGreaterThanOrEqual(1)
        expect(roomsAtLevel.length).toBeLessThanOrEqual(isTop ? 2 : 3)
        expect(roomsAtLevel.filter((r) => r.floorRoomIndex === 0).map((r) => r.id)).toEqual([`level-${level}`])
      }
    }
  })

  it('multi-room upper floors actually occur across seeds', () => {
    let sawMultiRoomFloor = false
    for (let seed = 1; seed <= 200 && !sawMultiRoomFloor; seed++) {
      const site = generateTowerSite(seededRng(seed * 7919))
      for (let level = 1; level < site.levelCount; level++) {
        if (site.rooms.filter((r) => r.levelIndex === level).length > 1) sawMultiRoomFloor = true
      }
    }
    expect(sawMultiRoomFloor).toBe(true)
  })

  it('level count always falls within the Size-derived range', () => {
    for (const seed of [1, 2, 3, 42, 12345, 999999]) {
      const site = generateTowerSite(seededRng(seed))
      if (site.size === 'Small') expect([2, 3]).toContain(site.levelCount)
      if (site.size === 'Medium') expect([4, 5]).toContain(site.levelCount)
      if (site.size === 'Large') expect([6, 7]).toContain(site.levelCount)
    }
  })

  it('always has a non-empty scenario', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      const site = generateTowerSite(seededRng(seed))
      expect(site.scenario.length).toBeGreaterThan(0)
    }
  })

  it('stair rooms form a single linear climb; every side room hangs off its own floor\'s stair room', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      const site = generateTowerSite(seededRng(seed))
      const adjacency = new Map<string, string[]>()
      for (const room of site.rooms) adjacency.set(room.id, [])
      for (const [a, b] of site.connections) {
        adjacency.get(a)!.push(b)
        adjacency.get(b)!.push(a)
      }
      // Every room is reachable from the entry hall (fully connected).
      const visited = new Set(['entry-hall'])
      const queue = ['entry-hall']
      while (queue.length > 0) {
        const current = queue.shift()!
        for (const n of adjacency.get(current)!) {
          if (!visited.has(n)) {
            visited.add(n)
            queue.push(n)
          }
        }
      }
      expect(visited.size).toBe(site.rooms.length)

      // Side rooms (guard room included) are dead ends attached to their own floor's stair room.
      const stairRoomIdForLevel = (level: number) => (level === 0 ? 'entry-hall' : `level-${level}`)
      for (const room of site.rooms) {
        if (room.floorRoomIndex === 0) continue
        expect(adjacency.get(room.id)).toEqual([stairRoomIdForLevel(room.levelIndex)])
      }
      // Stair rooms only connect to the stair rooms directly above/below plus their own side rooms.
      for (const room of site.rooms) {
        if (room.floorRoomIndex !== 0) continue
        for (const n of adjacency.get(room.id)!) {
          const neighbor = site.rooms.find((r) => r.id === n)!
          if (neighbor.floorRoomIndex === 0) expect(Math.abs(neighbor.levelIndex - room.levelIndex)).toBe(1)
          else expect(neighbor.levelIndex).toBe(room.levelIndex)
        }
      }
    }
  })

  it('the top of the main chain is always the objective, regardless of its Room Type roll, and it is the only objective room', () => {
    for (const seed of [1, 2, 3, 42, 12345, 999999]) {
      const site = generateTowerSite(seededRng(seed))
      const objectiveRooms = site.rooms.filter((r) => r.isObjectiveRoom)
      expect(objectiveRooms).toHaveLength(1)

      const topRoomId = `level-${site.levelCount - 1}`
      expect(objectiveRooms[0].id).toBe(topRoomId)
      // Never the guard room, regardless of roll.
      expect(objectiveRooms[0].isGuardRoom).toBe(false)
    }
  })

  it('every room has treasure/trap iff its Room Type matches', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      const site = generateTowerSite(seededRng(seed))
      for (const room of site.rooms) {
        expect(Boolean(room.treasure)).toBe(room.roomType === 'Treasure')
        expect(Boolean(room.trap)).toBe(room.roomType === 'Trap')
      }
    }
  })

  it('every tower has at least 2 floors, so the objective is never on the ground floor', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const site = generateTowerSite(seededRng(seed * 7919))
      expect(site.levelCount).toBeGreaterThanOrEqual(2)
      expect(site.rooms.find((r) => r.isObjectiveRoom)!.levelIndex).toBeGreaterThan(0)
    }
  })

  it('every monster room resolves to a well-formed monster/dragon/npcParty result', () => {
    for (const seed of [1, 2, 3, 42, 12345, 777, 2024]) {
      const site = generateTowerSite(seededRng(seed))
      for (const room of site.rooms) {
        if (!room.monster) continue
        if (room.monster.kind === 'monster') expect(room.monster.name.length).toBeGreaterThan(0)
        else if (room.monster.kind === 'dragon') expect(room.monster.type.length).toBeGreaterThan(0)
        else expect(room.monster.members.length).toBeGreaterThan(0)
      }
    }
  })
})
