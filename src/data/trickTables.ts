// Transcribed from the Basic Fantasy compilation's (core rules + Field Guide) Appendix D: The Encounter Builder — "Tricks" (two
// d100 tables: Trick Object + Trick Attribute). Source text: docs/osr-appendix-cde-source.txt,
// ~lines 2576-2663. OSR integration, round 2, Phase 2 — see
// docs/plan-osr-integration.md.
//
// A trick makes something harmless appear dangerous, or something dangerous appear harmless —
// roll both tables and combine (e.g. "idol, intelligent": a carved idol holding a departed
// adventurer's mind). Purely a flavor generator, same "rolled on demand, not baked into
// generation" shape as dungeonDressingTables.ts's 5 wired tables — a trick is a GM's occasional
// twist on a room, not something every room needs.

type RangeEntry = { min: number; max: number; text: string }

function expandD100(entries: RangeEntry[]): string[] {
  const table = new Array<string>(100)
  for (const { min, max, text } of entries) {
    for (let i = min; i <= max; i++) table[i - 1] = text
  }
  return table
}

function lookupD100(table: string[], roll: number, tableName: string): string {
  if (roll < 1 || roll > 100) throw new Error(`${tableName}: roll out of range: ${roll}`)
  return table[roll - 1]
}

const TRICK_OBJECT_ENTRIES: RangeEntry[] = [
  { min: 1, max: 3, text: 'altar' },
  { min: 4, max: 6, text: 'arch' },
  { min: 7, max: 10, text: 'ceiling' },
  { min: 11, max: 13, text: 'container' },
  { min: 14, max: 16, text: 'dome' },
  { min: 17, max: 20, text: 'door' },
  { min: 21, max: 23, text: 'fire' },
  { min: 24, max: 26, text: 'fireplace' },
  { min: 27, max: 30, text: 'force field' },
  { min: 31, max: 33, text: 'fountain' },
  { min: 34, max: 36, text: 'furnishing' },
  { min: 37, max: 40, text: 'idol' },
  { min: 41, max: 43, text: 'illusion' },
  { min: 44, max: 46, text: 'machine' },
  { min: 47, max: 50, text: 'mirror' },
  { min: 51, max: 53, text: 'monster' },
  { min: 54, max: 56, text: 'mosaic' },
  { min: 57, max: 60, text: 'painting' },
  { min: 61, max: 63, text: 'passage' },
  { min: 64, max: 66, text: 'pedestal' },
  { min: 67, max: 70, text: 'pillar/column' },
  { min: 71, max: 73, text: 'pit' },
  { min: 74, max: 76, text: 'pool' },
  { min: 77, max: 80, text: 'room' },
  { min: 81, max: 83, text: 'stairway' },
  { min: 84, max: 86, text: 'statue' },
  { min: 87, max: 90, text: 'tapestry' },
  { min: 91, max: 93, text: 'vegetation' },
  { min: 94, max: 96, text: 'wall' },
  { min: 97, max: 100, text: 'well' },
]

const TRICK_OBJECTS = expandD100(TRICK_OBJECT_ENTRIES)

export function trickObjectForD100(roll: number): string {
  return lookupD100(TRICK_OBJECTS, roll, 'trickObjectForD100')
}

// One entry per roll (no ranges in the source table).
const TRICK_ATTRIBUTES: string[] = [
  'ages', 'animated', 'anti-Magic', 'appearing', 'asks', 'attacks', 'changes class',
  'changes minds from one body to another', 'changes sex', 'collapsing', 'combination', 'dances',
  'decreases charisma', 'decreases constitution', 'decreases dexterity', 'decreases intelligence',
  'decreases strength', 'decreases wisdom', 'directs', 'disappearing', 'disintegrates',
  'dispenses coins', 'dispenses counterfeit coins', 'dispenses counterfeit gems',
  'dispenses counterfeit jewellery', 'dispenses counterfeit magic item', 'dispenses counterfeit map',
  'dispenses gems', 'dispenses jewellery', 'dispenses magic item', 'dispenses map',
  'distorted depth', 'distorted height', 'distorted length', 'distorted width', 'electric shock',
  'enlarges', 'enrages', 'false', 'flesh to stone', 'foretells', 'fruit', 'gaseous', 'geas',
  'gravity decreased', 'gravity increased', 'greed inducing', 'hovers', 'increases charisma',
  'increases constitution', 'increases Dexterity', 'increases Intelligence', 'increases Strength',
  'increases Wisdom', 'intelligent', 'invisible', 'laughs', 'magnetic', 'makes younger', 'moves',
  'null gravity', 'one way', 'opposite alignment', 'pivots', 'plays games', 'points', 'poison',
  'polymorphing', 'random alignment', 'randomly acts', 'reduces', 'repellent/repulses',
  'resists magic', 'reverse gravity', 'reverse wish fulfilment', 'riddles', 'rising', 'rolls',
  'shifting', 'shoots', 'sings', 'sinking', 'sliding', 'sloping', 'spinning', 'steals', 'suggests',
  'suspends animation', 'symbiotic', 'takes', 'talks', 'talks in poetry and rhymes',
  'talks nonsense', 'talks very intelligently', 'talks, spell casting', 'teleports',
  'unusual colour/texture/material', 'variable gravity', 'wish fulfilment', 'yells and screams',
]

export function trickAttributeForD100(roll: number): string {
  return lookupD100(TRICK_ATTRIBUTES, roll, 'trickAttributeForD100')
}
