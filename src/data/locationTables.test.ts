import { describe, expect, it } from 'vitest'
import { TERRAIN_ORDER } from './tables'
import { locationFeatureForD200, cataclysmForTerrain, naturalLandmarkForTerrain } from './locationTables'

describe('Location Generator Feature table (d200)', () => {
  it('has 200 entries, all populated, every roll resolving to exactly one feature', () => {
    for (let roll = 1; roll <= 200; roll++) {
      const entry = locationFeatureForD200(roll)
      expect(entry).toBeDefined()
      expect(entry.feature).toBeTruthy()
      expect(entry.routesTo).toBeTruthy()
    }
  })

  it('throws out of range', () => {
    expect(() => locationFeatureForD200(0)).toThrow()
    expect(() => locationFeatureForD200(201)).toThrow()
  })

  // Spot-checks against the locked table in docs/plan-sites-settlements-mongo.md — one per
  // range boundary, confirming both the routing and (where relevant) the forced type/flavor.
  it.each([
    [1, { feature: 'Cataclysm', routesTo: 'cataclysm' }],
    [2, { feature: 'Tower', routesTo: 'tower' }],
    [13, { feature: 'Tower', routesTo: 'tower' }],
    [14, { feature: 'Fortified keep', routesTo: 'keep' }],
    [19, { feature: 'Fortified keep', routesTo: 'keep' }],
    [20, { feature: 'Large tomb', routesTo: 'dungeon', forcedType: 'Tomb', flavor: 'Large tomb' }],
    [25, { feature: 'Tomb', routesTo: 'dungeon', forcedType: 'Tomb' }],
    [31, { feature: 'Dungeon', routesTo: 'dungeon' }],
    [40, { feature: 'Dungeon', routesTo: 'dungeon' }],
    [41, { feature: 'Deep tunnels', routesTo: 'dungeon', forcedType: 'Deep tunnels' }],
    [47, { feature: 'Cave', routesTo: 'dungeon', forcedType: 'Cave' }],
    [55, { feature: 'Mine (active)', routesTo: 'dungeon', forcedType: 'Deep tunnels', flavor: 'Active mine' }],
    [61, { feature: 'Mine (abandoned)', routesTo: 'dungeon', forcedType: 'Deep tunnels', flavor: 'Abandoned mine' }],
    [67, { feature: 'Sinkhole/chasm', routesTo: 'dungeon', forcedType: 'Cave', flavor: 'Sinkhole/chasm (vertical drop)' }],
    [71, { feature: 'Natural landmark', routesTo: 'landmark' }],
    [83, { feature: 'Natural landmark', routesTo: 'landmark' }],
    [84, { feature: 'Temple (oracle)', routesTo: 'shrine' }],
    [88, { feature: 'Ruins (temple)', routesTo: 'dungeon', forcedType: 'Ruins', flavor: 'Temple ruins' }],
    [94, { feature: 'Barrow mounds', routesTo: 'dungeon', forcedType: 'Tomb', flavor: 'Barrow mounds' }],
    [100, { feature: 'Necropolis/catacombs', routesTo: 'dungeon', forcedType: 'Tomb', flavor: 'Necropolis/catacombs' }],
    [104, { feature: 'Sunken ruins', routesTo: 'dungeon', forcedType: 'Ruins', flavor: 'Flooded' }],
    [106, { feature: 'Village (ruins)', routesTo: 'settlement', forcedType: 'Village', flavor: 'Abandoned and in ruins' }],
    [114, { feature: 'Town (siege)', routesTo: 'settlement', forcedType: 'Town', flavor: 'Under siege' }],
    [118, { feature: 'Ravine (cult)', routesTo: 'dungeon', forcedType: 'Cave', flavor: 'Ravine — religious cult lair' }],
    [122, { feature: 'Goblin/orc warren', routesTo: 'dungeon', forcedType: 'Deep tunnels', flavor: 'Goblin/orc warren' }],
    [126, { feature: 'Bandit hideout', routesTo: 'camp' }],
    [130, { feature: 'Monster nest', routesTo: 'dungeon', forcedType: 'Cave', flavor: 'Monster nest' }],
    [131, { feature: "Hermit's abode", routesTo: 'shrine' }],
    [132, { feature: 'Cave formation', routesTo: 'dungeon', forcedType: 'Cave', flavor: 'Cave formation' }],
    [133, { feature: 'Ancient dolmens', routesTo: 'dungeon', forcedType: 'Tomb', flavor: 'Ancient dolmens — guardian' }],
    [134, { feature: 'Barbarian camp', routesTo: 'camp' }],
    [135, { feature: 'Holy shrine (door to another plane)', routesTo: 'rift' }],
    [136, { feature: "Dragon's lair", routesTo: 'dungeon', forcedType: 'Cave', flavor: "Dragon's lair" }],
    [138, { feature: 'Planar rift/portal', routesTo: 'rift' }],
    [140, { feature: 'Lost library/arcane archive', routesTo: 'dungeon', forcedType: 'Ruins', flavor: 'Arcane archive' }],
    [142, { feature: 'Village', routesTo: 'settlement', forcedType: 'Village' }],
    [174, { feature: 'Village', routesTo: 'settlement', forcedType: 'Village' }],
    [175, { feature: 'Town', routesTo: 'settlement', forcedType: 'Town' }],
    [193, { feature: 'Town', routesTo: 'settlement', forcedType: 'Town' }],
    [194, { feature: 'City', routesTo: 'settlement', forcedType: 'City' }],
    [199, { feature: 'City', routesTo: 'settlement', forcedType: 'City' }],
    [200, { feature: 'Metropolis', routesTo: 'settlement', forcedType: 'Metropolis' }],
  ] as const)('roll %i -> %o', (roll, expected) => {
    expect(locationFeatureForD200(roll)).toEqual(expected)
  })
})

describe('Cataclysm table (d8, terrain-keyed)', () => {
  it('has exactly 8 entries per terrain, all populated', () => {
    for (const terrain of TERRAIN_ORDER) {
      for (let roll = 1; roll <= 8; roll++) {
        expect(cataclysmForTerrain(terrain, roll)).toBeTruthy()
      }
    }
  })

  it('throws out of range', () => {
    expect(() => cataclysmForTerrain('Grassland', 0)).toThrow()
    expect(() => cataclysmForTerrain('Grassland', 9)).toThrow()
  })

  it('spot-checks a couple of entries', () => {
    expect(cataclysmForTerrain('Mountain', 1)).toBe('Eruption reshaped peaks, buried valleys')
    expect(cataclysmForTerrain('Ocean', 8)).toBe('Ritual summoned a kraken/maelstrom, drowned a civilization')
  })
})

describe('Natural Landmark table (terrain-keyed, no roll)', () => {
  it('has exactly one entry per terrain', () => {
    for (const terrain of TERRAIN_ORDER) {
      expect(naturalLandmarkForTerrain(terrain)).toBeTruthy()
    }
  })

  it('spot-checks an entry', () => {
    expect(naturalLandmarkForTerrain('Swamp')).toBe(
      'Massive, hollowed-out cypress tree wide enough to serve as shelter, rising from the mire',
    )
  })
})
