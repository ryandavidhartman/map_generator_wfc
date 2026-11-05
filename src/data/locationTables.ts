// House-rule "Location Generator" expansion (not book RAW — layered on top of verified RAW
// mechanics). Replaces the old d20 Points of Interest table with a richer d200 Feature table so
// dungeon-site variety matches the overland POI table's 20+ flavors, plus terrain-keyed Cataclysm
// and Natural Landmark tables. Locked table content, verbatim, lives in
// docs/plan-sites-settlements-mongo.md's "Location Generator expansion" → "Locked table content"
// section — that section is the single source of truth; if this table is ever revised, edit it
// there first, then mirror the change here.

import type { Terrain } from './tables'

export type SiteKind = 'settlement' | 'dungeon' | 'tower' | 'shrine' | 'rift' | 'keep' | 'camp'

export type LocationFeatureEntry = {
  feature: string
  // 'cataclysm'/'landmark' mean no site is generated — the hex instead carries terrain-keyed
  // flavor text (see Step 3a/3b below).
  routesTo: SiteKind | 'cataclysm' | 'landmark'
  forcedType?: string
  flavor?: string
}

type FeatureRange = { min: number; max: number; entry: LocationFeatureEntry }

function expandD200(ranges: FeatureRange[]): LocationFeatureEntry[] {
  const table = new Array<LocationFeatureEntry>(200)
  for (const { min, max, entry } of ranges) {
    for (let i = min; i <= max; i++) table[i - 1] = entry
  }
  return table
}

// Step 2: Feature (d200) — locked, with final routing. See the plan doc for full provenance of
// the less-obvious routing calls (Mine -> Deep tunnels flavor, Holy shrine -> Rift not Shrine, etc).
const FEATURE_RANGES: FeatureRange[] = [
  { min: 1, max: 1, entry: { feature: 'Cataclysm', routesTo: 'cataclysm' } },
  { min: 2, max: 13, entry: { feature: 'Tower', routesTo: 'tower' } },
  { min: 14, max: 19, entry: { feature: 'Fortified keep', routesTo: 'keep' } },
  { min: 20, max: 24, entry: { feature: 'Large tomb', routesTo: 'dungeon', forcedType: 'Tomb', flavor: 'Large tomb' } },
  { min: 25, max: 30, entry: { feature: 'Tomb', routesTo: 'dungeon', forcedType: 'Tomb' } },
  { min: 31, max: 40, entry: { feature: 'Dungeon', routesTo: 'dungeon' } },
  { min: 41, max: 46, entry: { feature: 'Deep tunnels', routesTo: 'dungeon', forcedType: 'Deep tunnels' } },
  { min: 47, max: 54, entry: { feature: 'Cave', routesTo: 'dungeon', forcedType: 'Cave' } },
  {
    min: 55,
    max: 60,
    entry: { feature: 'Mine (active)', routesTo: 'dungeon', forcedType: 'Deep tunnels', flavor: 'Active mine' },
  },
  {
    min: 61,
    max: 66,
    entry: { feature: 'Mine (abandoned)', routesTo: 'dungeon', forcedType: 'Deep tunnels', flavor: 'Abandoned mine' },
  },
  {
    min: 67,
    max: 70,
    entry: {
      feature: 'Sinkhole/chasm',
      routesTo: 'dungeon',
      forcedType: 'Cave',
      flavor: 'Sinkhole/chasm (vertical drop)',
    },
  },
  { min: 71, max: 83, entry: { feature: 'Natural landmark', routesTo: 'landmark' } },
  { min: 84, max: 87, entry: { feature: 'Temple (oracle)', routesTo: 'shrine' } },
  {
    min: 88,
    max: 93,
    entry: { feature: 'Ruins (temple)', routesTo: 'dungeon', forcedType: 'Ruins', flavor: 'Temple ruins' },
  },
  {
    min: 94,
    max: 99,
    entry: { feature: 'Barrow mounds', routesTo: 'dungeon', forcedType: 'Tomb', flavor: 'Barrow mounds' },
  },
  {
    min: 100,
    max: 103,
    entry: {
      feature: 'Necropolis/catacombs',
      routesTo: 'dungeon',
      forcedType: 'Tomb',
      flavor: 'Necropolis/catacombs',
    },
  },
  { min: 104, max: 105, entry: { feature: 'Sunken ruins', routesTo: 'dungeon', forcedType: 'Ruins', flavor: 'Flooded' } },
  {
    min: 106,
    max: 113,
    entry: {
      feature: 'Village (ruins)',
      routesTo: 'settlement',
      forcedType: 'Village',
      flavor: 'Abandoned and in ruins',
    },
  },
  {
    min: 114,
    max: 117,
    entry: { feature: 'Town (siege)', routesTo: 'settlement', forcedType: 'Town', flavor: 'Under siege' },
  },
  {
    min: 118,
    max: 121,
    entry: { feature: 'Ravine (cult)', routesTo: 'dungeon', forcedType: 'Cave', flavor: 'Ravine — religious cult lair' },
  },
  {
    min: 122,
    max: 125,
    entry: { feature: 'Goblin/orc warren', routesTo: 'dungeon', forcedType: 'Deep tunnels', flavor: 'Goblin/orc warren' },
  },
  // Confirmed: no terrain-keyed exception (e.g. a Cave-lair variant on Mountain) in v1.
  { min: 126, max: 129, entry: { feature: 'Bandit hideout', routesTo: 'camp' } },
  { min: 130, max: 130, entry: { feature: 'Monster nest', routesTo: 'dungeon', forcedType: 'Cave', flavor: 'Monster nest' } },
  { min: 131, max: 131, entry: { feature: "Hermit's abode", routesTo: 'shrine' } },
  { min: 132, max: 132, entry: { feature: 'Cave formation', routesTo: 'dungeon', forcedType: 'Cave', flavor: 'Cave formation' } },
  {
    min: 133,
    max: 133,
    entry: { feature: 'Ancient dolmens', routesTo: 'dungeon', forcedType: 'Tomb', flavor: 'Ancient dolmens — guardian' },
  },
  { min: 134, max: 134, entry: { feature: 'Barbarian camp', routesTo: 'camp' } },
  // Distinguishing text is "door to another plane" — the portal case, not the lightweight Shrine.
  { min: 135, max: 135, entry: { feature: 'Holy shrine (door to another plane)', routesTo: 'rift' } },
  { min: 136, max: 137, entry: { feature: "Dragon's lair", routesTo: 'dungeon', forcedType: 'Cave', flavor: "Dragon's lair" } },
  { min: 138, max: 139, entry: { feature: 'Planar rift/portal', routesTo: 'rift' } },
  {
    min: 140,
    max: 141,
    entry: { feature: 'Lost library/arcane archive', routesTo: 'dungeon', forcedType: 'Ruins', flavor: 'Arcane archive' },
  },
  { min: 142, max: 174, entry: { feature: 'Village', routesTo: 'settlement', forcedType: 'Village' } },
  { min: 175, max: 193, entry: { feature: 'Town', routesTo: 'settlement', forcedType: 'Town' } },
  { min: 194, max: 199, entry: { feature: 'City', routesTo: 'settlement', forcedType: 'City' } },
  { min: 200, max: 200, entry: { feature: 'Metropolis', routesTo: 'settlement', forcedType: 'Metropolis' } },
]

const LOCATION_FEATURES: LocationFeatureEntry[] = expandD200(FEATURE_RANGES)

export function locationFeatureForD200(roll: number): LocationFeatureEntry {
  if (roll < 1 || roll > 200) {
    throw new Error(`locationFeatureForD200: roll out of range: ${roll}`)
  }
  return LOCATION_FEATURES[roll - 1]
}

// Step 3a: Cataclysm (d8, keyed to terrain).
const CATACLYSM_BY_TERRAIN: Record<Terrain, string[]> = {
  'Desert/arctic': [
    'Ash-buried dunes / fire-mountain melting ice',
    'Wildfire raced through scrub / firestorm melted permafrost',
    'Shifting dunes swallowed an oasis / ice shelves collapsed',
    'Sandstorm/blizzard buried a settlement in days',
    'Flash flood through a dry wash / glacial melt',
    'Bones of a battle still bleach in sun/snow',
    'Plague spread along a caravan route',
    'Spell turned fertile land to endless sand/ice',
  ],
  Swamp: [
    'Ash poisoned the wetland waters',
    'Peat fire smoldered underground for years',
    'Villages sunk into the mire',
    'Hurricane-driven surge drowned the lowlands',
    'Swamp overflowed its banks and never receded',
    'Armies bogged down and slaughtered in the mud',
    'Disease bred in stagnant, fetid water',
    'Ritual corrupted the water and life within it',
  ],
  Grassland: [
    'Distant eruption blanketed the plains in ash',
    'Wildfire consumed leagues of open grass',
    'Fissures split the plains, swallowing herds and homes',
    'Supernatural tempest or endless tornado outbreak',
    'River burst its banks and remade the land',
    'A decisive battlefield, now littered with ruins',
    'Blight killed livestock and herders alike',
    'Spell summoned endless storms or twisted wildlife',
  ],
  'Forest/jungle': [
    'Ash buried the canopy, killing old growth',
    'Great burning reduced ancient trees to char',
    'Toppled forests, opened sinkholes',
    'Hurricane or magical gale flattened the canopy',
    'Monsoon or dam-break drowned the undergrowth',
    'Battle scarred the woods with old fortifications',
    'Blight or fungal rot spread tree to tree',
    'Wild magic twisted the flora and fauna',
  ],
  'River/coast': [
    'Ashfall poisoned the water, killed the fish',
    'Burning swept a coastal town or delta reeds',
    'Quake rerouted the river or sank the coastline',
    'Hurricane or tidal storm reshaped the shore',
    'River drowned everything along its banks',
    'Naval battle or siege whose wreckage lines the shore',
    'Disease carried in on ships or fishing communities',
    'Ritual summoned a tsunami or cursed the waters',
  ],
  Ocean: [
    'Undersea eruption birthed (or sank) an island',
    'A burning fleet, or fire that burns on water',
    'Seaquake triggered a tsunami',
    'Legendary hurricane sank a fleet or coastline',
    'Rising seas swallowed islands or ports',
    'Great naval battle, wrecks litter the seabed',
    'Plague ship or cursed contagion spread by sailors',
    'Ritual summoned a kraken/maelstrom, drowned a civilization',
  ],
  Mountain: [
    'Eruption reshaped peaks, buried valleys',
    'Firestorm sparked by lava or lightning',
    'Quake leveled cliffside settlements',
    'Avalanche-triggering blizzard or lightning storm',
    'Burst dam or glacial lake flooded the valley',
    'Siege fought over a mountain pass or fortress',
    'Plague spread through isolated mining communities',
    'Ritual awoke something in the depths, cursed the stone',
  ],
}

// Hills (added 2026-11-02 for punch-list item 1a, which adds a Hills terrain): the user's
// approved Cataclysm d8 rows and Natural landmark. Exported but not yet used; they move into
// CATACLYSM_BY_TERRAIN / NATURAL_LANDMARK_BY_TERRAIN when Hills is added to the Terrain type.
export const HILLS_CATACLYSMS: string[] = [
  'Landslide buried a hillside village',
  'Wildfire stripped the slopes bare',
  'Earthquake split a ridge in two',
  'Collapsed mine shafts left the hills hollow and unstable',
  'Flash floods carved deep gullies through the farmland',
  'Bones of a battle still lie on a scarred hilltop',
  "Plague emptied the shepherds' hamlets",
  'A curse turned the green slopes to barren rock',
]
export const HILLS_NATURAL_LANDMARK =
  'A great barrow-shaped hill crowned by a ring of ancient oaks, with a cave mouth on its eastern slope'

export function cataclysmForTerrain(terrain: Terrain, roll: number): string {
  if (roll < 1 || roll > 8) {
    throw new Error(`cataclysmForTerrain: roll out of range: ${roll}`)
  }
  return CATACLYSM_BY_TERRAIN[terrain][roll - 1]
}

// Step 3b: Natural Landmark (keyed to terrain, no roll — one fixed entry per terrain).
const NATURAL_LANDMARK_BY_TERRAIN: Record<Terrain, string> = {
  'Desert/arctic': 'Field of towering rock spires (or ice pinnacles) carved by wind, hiding ancient petroglyphs',
  Swamp: 'Massive, hollowed-out cypress tree wide enough to serve as shelter, rising from the mire',
  Grassland: 'Lone standing stone circle, weathered and half-sunken into the earth',
  'Forest/jungle': 'Colossal "mother tree," centuries old, roots forming natural tunnels and archways',
  'River/coast': 'Natural rock arch or sea cave carved by centuries of tidal erosion',
  Ocean: 'Ring of jagged sea stacks marking a sunken reef or old wreck',
  Mountain: 'Natural amphitheater or crater lake in a dormant volcanic caldera',
}

export function naturalLandmarkForTerrain(terrain: Terrain): string {
  return NATURAL_LANDMARK_BY_TERRAIN[terrain]
}
