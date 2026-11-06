import { describe, expect, it } from 'vitest'
import { describeDungeonMonster, rollDungeonMonster } from './generateDungeonEncounter'
import { zeroLevelActivityTierForD5, type NpcRace, type SettlementNpc, type UrbanProfession } from '../data/npcTables'
import { describeRolledTreasure } from '../data/treasureTypeTables'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const npc = (race: NpcRace, profession: UrbanProfession): SettlementNpc => ({
  race,
  profession,
  activityTier: zeroLevelActivityTierForD5(3),
})

describe('describeDungeonMonster', () => {
  it('a plain monster shows its name, number appearing and treasure', () => {
    const d = describeDungeonMonster({
      kind: 'monster',
      name: 'Goblin',
      numberAppearing: '2d4',
      treasureTypeRaw: 'R',
      treasure: { coins: [{ coinType: 'ep', amount: 12 }], gems: false, jewelry: false, magicItemCount: 0 },
    })
    expect(d).toEqual({ name: 'Goblin', subtitle: '× 2d4', treasure: 'Treasure Type R — 12 ep' })
  })

  it('a monster with no known Treasure Type has no treasure line', () => {
    expect(describeDungeonMonster({ kind: 'monster', name: 'Ooze', numberAppearing: '1' }).treasure).toBeUndefined()
  })

  it('a dragon shows type, age, HP per HD and count', () => {
    const d = describeDungeonMonster({
      kind: 'dragon',
      type: 'Red Dragon',
      age: 'Adult',
      hitPointsPerHD: '5',
      numberAppearing: '1',
      treasureTypeRaw: 'H',
    })
    expect(d.name).toBe('Red Dragon')
    expect(d.subtitle).toBe('Adult, 5 HD/head — × 1')
    expect(d.treasure).toBe('Treasure Type H — none rolled')
  })

  it('an NPC party lists each member and has no treasure line', () => {
    const d = describeDungeonMonster({ kind: 'npcParty', members: [npc('Dwarf', 'Labourer'), npc('Elf', 'Merchant')] })
    expect(d).toEqual({ name: 'NPC Party', subtitle: 'Dwarf Labourer, Elf Merchant' })
  })
})

describe('describeRolledTreasure', () => {
  it('lists coins, gems, jewelry and magic items in order', () => {
    const text = describeRolledTreasure('A', {
      coins: [
        { coinType: 'gp', amount: 3000 },
        { coinType: 'sp', amount: 500 },
      ],
      gems: true,
      jewelry: true,
      magicItemCount: 3,
      magicItemNote: 'any',
    })
    expect(text).toBe('Treasure Type A — 3000 gp, 500 sp, gems, jewelry, 3 magic items (any)')
  })

  it('uses the singular for one magic item', () => {
    expect(describeRolledTreasure('U', { coins: [], gems: false, jewelry: false, magicItemCount: 1 })).toBe('Treasure Type U — 1 magic item')
  })

  it('says "none rolled" when nothing was rolled or nothing came up', () => {
    expect(describeRolledTreasure('Nil', undefined)).toBe('Treasure Type Nil — none rolled')
    expect(describeRolledTreasure('P', { coins: [], gems: false, jewelry: false, magicItemCount: 0 })).toBe('Treasure Type P — none rolled')
  })
})

describe('rollDungeonMonster', () => {
  // Every kind the OSR matrix can produce (plain monster, dragon, NPC party) must come out
  // well-formed and describable, at every dungeon level.
  it('produces well-formed, describable results of every kind across levels and seeds', () => {
    const kinds = new Set<string>()
    for (let level = 1; level <= 15; level++) {
      for (let seed = 1; seed <= 150; seed++) {
        const m = rollDungeonMonster(seededRng(seed * 31 + level), level)
        kinds.add(m.kind)
        const d = describeDungeonMonster(m)
        expect(d.name.length).toBeGreaterThan(0)
        expect(d.subtitle.length).toBeGreaterThan(0)
        if (m.kind === 'npcParty') {
          expect(m.members.length).toBeGreaterThanOrEqual(1)
          expect(m.members.length).toBeLessThanOrEqual(4)
          expect(d.treasure).toBeUndefined()
        } else {
          expect(m.numberAppearing.length).toBeGreaterThan(0)
          // A treasure line appears exactly when the creature has a known Treasure Type.
          expect(d.treasure === undefined).toBe(m.treasureTypeRaw === undefined)
          if (m.treasure) expect(m.treasureTypeRaw).toBeDefined()
        }
      }
    }
    expect(kinds).toEqual(new Set(['monster', 'dragon', 'npcParty']))
  })
})
