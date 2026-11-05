import { describe, expect, it } from 'vitest'
import { rollBiasedRoomContent, rollRoomContent } from './roomContent'
import type { RoomType } from '../data/dungeonTables'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const SAMPLES = 4000

function hitRate(roll: (rng: () => number) => { roomType: RoomType }, wanted: RoomType[]): number {
  let hits = 0
  for (let seed = 1; seed <= SAMPLES; seed++) {
    if (wanted.includes(roll(seededRng(seed * 7919)).roomType)) hits++
  }
  return hits / SAMPLES
}

describe('rollBiasedRoomContent', () => {
  // Room Type d10: Treasure is 1 face in 10; NPC + Boss Monster are 2 in 10. One second chance on
  // a miss gives 1 - (1 - p)^2: 19% for the Armory, 36% for the Lord's Quarters.
  it.each([
    { label: 'Armory → Treasure', wanted: ['Treasure'] as RoomType[], plain: 0.1, biased: 0.19 },
    { label: "Lord's Quarters → NPC/Boss", wanted: ['NPC', 'Boss Monster'] as RoomType[], plain: 0.2, biased: 0.36 },
  ])('$label lands on the wanted types about 1 - (1 - p)^2 of the time', ({ wanted, plain, biased }) => {
    const plainRate = hitRate((rng) => rollRoomContent(rng), wanted)
    const biasedRate = hitRate((rng) => rollBiasedRoomContent(rng, wanted), wanted)
    expect(plainRate).toBeCloseTo(plain, 1)
    expect(biasedRate).toBeCloseTo(biased, 1)
    expect(biasedRate).toBeGreaterThan(plainRate + 0.05)
  })

  it('keeps a first roll that already hits, consuming exactly what a plain roll would', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const plain = rollRoomContent(seededRng(seed))
      if (plain.roomType !== 'Treasure') continue
      expect(rollBiasedRoomContent(seededRng(seed), ['Treasure'])).toEqual(plain)
    }
  })

  it('on a miss, takes the second roll only if it hits, otherwise keeps the first', () => {
    const wanted: RoomType[] = ['Treasure']
    let sawSecondHit = false
    let sawDoubleMiss = false
    for (let seed = 1; seed <= 500; seed++) {
      const rng = seededRng(seed)
      const first = rollRoomContent(rng)
      if (wanted.includes(first.roomType)) continue
      const second = rollRoomContent(rng)
      const biased = rollBiasedRoomContent(seededRng(seed), wanted)
      if (wanted.includes(second.roomType)) {
        sawSecondHit = true
        expect(biased).toEqual(second)
      } else {
        sawDoubleMiss = true
        expect(biased).toEqual(first)
      }
    }
    expect(sawSecondHit && sawDoubleMiss).toBe(true)
  })
})

describe('rollRoomContent', () => {
  // Cross-axis validity: each room type carries exactly its own attachment and no other.
  it('attaches a monster, NPC, treasure or trap only to the room types that should have one', () => {
    const monsterTypes: RoomType[] = ['Solo Monster', 'Monster Mob', 'Boss Monster']
    for (let seed = 1; seed <= 2000; seed++) {
      const c = rollRoomContent(seededRng(seed), 1 + (seed % 12))
      expect(Boolean(c.monster)).toBe(monsterTypes.includes(c.roomType))
      expect(Boolean(c.npc)).toBe(c.roomType === 'NPC')
      expect(Boolean(c.treasure)).toBe(c.roomType === 'Treasure')
      expect(Boolean(c.trap)).toBe(c.roomType === 'Trap')
      expect(c.detail === undefined).toBe(c.roomType === 'Empty')
    }
  })
})
