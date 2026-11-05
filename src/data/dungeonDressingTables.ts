// Transcribed from the Basic Fantasy compilation's (core rules + Field Guide) Appendix D: The Encounter Builder — "Dungeon
// Dressing" (sensory detail tables: sights, sounds, smells). Source text:
// docs/osr-appendix-cde-source.txt, ~lines 2061-2397.
//
// The book has 13 dressing tables total; only the 5 below are wired into automatic per-room
// rolling (see generateDressing.ts) — Air Currents/Odours/Noises/General/Furnishings are
// universal atmosphere, appropriate for any room. The remaining 8 (Religious, Torture
// Chamber, Alchemy Lab, Container Contents, Personal and Miscellaneous, Clothing and
// Footwear, Food and Drink, Seasonings) are narrative-specific to a particular room's story —
// auto-rolling those onto random Empty rooms would produce noise, not flavor (a random
// "Torture Chamber" item in an ordinary storeroom reads as nonsensical) — so they're
// deliberately left as a GM's manual reference, not wired up, same "additive not automatic"
// scoping call as the trap catalog. See docs/plan-osr-integration.md, Phase 2.

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

const AIR_CURRENTS_ENTRIES: RangeEntry[] = [
  { min: 1, max: 5, text: 'slight breeze' },
  { min: 6, max: 10, text: 'damp slight breeze' },
  { min: 11, max: 12, text: 'gusting breeze' },
  { min: 13, max: 18, text: 'cold current of air' },
  { min: 19, max: 20, text: 'slight downdraft' },
  { min: 21, max: 22, text: 'strong downdraft' },
  { min: 23, max: 69, text: 'still' },
  { min: 70, max: 75, text: 'still, cold air' },
  { min: 76, max: 85, text: 'still, warm air' },
  { min: 86, max: 87, text: 'slight updraft' },
  { min: 88, max: 89, text: 'strong updraft' },
  { min: 90, max: 93, text: 'strong wind' },
  { min: 94, max: 95, text: 'strong gusting wind' },
  { min: 96, max: 100, text: 'strong moaning wind' },
]

const ODOURS_ENTRIES: RangeEntry[] = [
  { min: 1, max: 3, text: 'acrid' },
  { min: 4, max: 5, text: 'chlorine' },
  { min: 6, max: 39, text: 'dank and mouldy' },
  { min: 40, max: 49, text: 'earthy' },
  { min: 50, max: 57, text: 'manure' },
  { min: 58, max: 61, text: 'metallic' },
  { min: 62, max: 65, text: 'ozone' },
  { min: 66, max: 70, text: 'putrid' },
  { min: 71, max: 75, text: 'rotting vegetation' },
  { min: 76, max: 77, text: 'salty wet' },
  { min: 78, max: 82, text: 'smoky' },
  { min: 83, max: 89, text: 'stale, foetid' },
  { min: 90, max: 95, text: 'sulphur' },
  { min: 96, max: 100, text: 'urine' },
]

const NOISES_ENTRIES: RangeEntry[] = [
  { min: 1, max: 5, text: 'bang or slam' },
  { min: 6, max: 6, text: 'bellow or bellowing' },
  { min: 7, max: 7, text: 'bong' },
  { min: 8, max: 8, text: 'buzzing' },
  { min: 9, max: 10, text: 'chanting' },
  { min: 11, max: 11, text: 'chiming' },
  { min: 12, max: 12, text: 'chirping' },
  { min: 13, max: 13, text: 'clanking' },
  { min: 14, max: 14, text: 'clashing' },
  { min: 15, max: 15, text: 'clicking' },
  { min: 16, max: 16, text: 'coughing' },
  { min: 17, max: 18, text: 'creaking' },
  { min: 19, max: 19, text: 'drumming' },
  { min: 20, max: 23, text: 'footsteps ahead' },
  { min: 24, max: 26, text: 'footsteps approaching' },
  { min: 27, max: 29, text: 'footsteps behind' },
  { min: 30, max: 31, text: 'footsteps receding' },
  { min: 32, max: 33, text: 'footsteps to the side' },
  { min: 34, max: 35, text: 'faint giggling' },
  { min: 36, max: 36, text: 'gong' },
  { min: 37, max: 39, text: 'grating' },
  { min: 40, max: 41, text: 'groaning' },
  { min: 42, max: 42, text: 'grunting' },
  { min: 43, max: 44, text: 'hissing' },
  { min: 45, max: 45, text: 'hooting' },
  { min: 46, max: 46, text: 'trumpet sounding' },
  { min: 47, max: 47, text: 'howling' },
  { min: 48, max: 48, text: 'humming' },
  { min: 49, max: 49, text: 'jingling' },
  { min: 50, max: 53, text: 'knocking' },
  { min: 54, max: 55, text: 'laughter' },
  { min: 56, max: 57, text: 'moaning' },
  { min: 58, max: 60, text: 'murmuring' },
  { min: 61, max: 61, text: 'music' },
  { min: 62, max: 62, text: 'rattling' },
  { min: 63, max: 63, text: 'ringing' },
  { min: 64, max: 64, text: 'roar or roaring' },
  { min: 65, max: 68, text: 'rustling' },
  { min: 69, max: 72, text: 'scratching or scrabbling' },
  { min: 73, max: 74, text: 'scream or screaming' },
  { min: 75, max: 77, text: 'scuttling' },
  { min: 78, max: 78, text: 'shuffling' },
  { min: 79, max: 80, text: 'slithering' },
  { min: 81, max: 81, text: 'snapping' },
  { min: 82, max: 82, text: 'sneezing' },
  { min: 83, max: 83, text: 'sobbing' },
  { min: 84, max: 84, text: 'splashing' },
  { min: 85, max: 85, text: 'splintering' },
  { min: 86, max: 87, text: 'squeaking' },
  { min: 88, max: 88, text: 'squeal or squealing' },
  { min: 89, max: 90, text: 'tapping' },
  { min: 91, max: 92, text: 'thud' },
  { min: 93, max: 94, text: 'thumping' },
  { min: 95, max: 95, text: 'tinkling' },
  { min: 96, max: 96, text: 'twanging' },
  { min: 97, max: 97, text: 'whining' },
  { min: 98, max: 98, text: 'whispering' },
  { min: 99, max: 100, text: 'whistling' },
]

const GENERAL_ENTRIES: RangeEntry[] = [
  { min: 1, max: 1, text: 'ashes' },
  { min: 2, max: 4, text: 'badly dented helmet' },
  { min: 5, max: 6, text: 'bent iron bar' },
  { min: 7, max: 7, text: 'bits of hair or fur' },
  { min: 8, max: 8, text: 'blunted javelin head' },
  { min: 9, max: 9, text: 'bones' },
  { min: 10, max: 19, text: 'broken arrow' },
  { min: 20, max: 20, text: 'broken bottle' },
  { min: 21, max: 22, text: 'ceiling damp' },
  { min: 23, max: 24, text: 'corroded chain' },
  { min: 25, max: 26, text: 'cobwebs' },
  { min: 27, max: 27, text: 'copper coin, bent' },
  { min: 28, max: 29, text: 'cracks in ceiling' },
  { min: 30, max: 33, text: 'cracks in floor' },
  { min: 34, max: 40, text: 'cracks in wall' },
  { min: 41, max: 41, text: 'cracked flask' },
  { min: 42, max: 44, text: 'cracked hammer head' },
  { min: 45, max: 49, text: 'dagger hilt' },
  { min: 50, max: 50, text: 'dripping water' },
  { min: 51, max: 51, text: 'dried blood' },
  { min: 52, max: 52, text: 'dry leaves and twigs' },
  { min: 53, max: 55, text: 'dung' },
  { min: 56, max: 56, text: 'dust' },
  { min: 57, max: 57, text: 'floor damp' },
  { min: 58, max: 58, text: 'food item' },
  { min: 59, max: 59, text: 'fungi' },
  { min: 60, max: 60, text: 'guano' },
  { min: 61, max: 61, text: 'leather boot' },
  { min: 62, max: 64, text: 'lantern' },
  { min: 65, max: 68, text: 'mould' },
  { min: 69, max: 69, text: 'pick handle' },
  { min: 70, max: 70, text: 'pole or rope (broken)' },
  { min: 71, max: 71, text: 'pottery shards' },
  { min: 72, max: 73, text: 'rags' },
  { min: 74, max: 74, text: 'rats' },
  { min: 75, max: 76, text: 'rubble' },
  { min: 77, max: 77, text: 'sack' },
  { min: 78, max: 78, text: 'scattered teeth or fangs' },
  { min: 79, max: 79, text: 'scratches on wall' },
  { min: 80, max: 80, text: 'slime on ceiling' },
  { min: 81, max: 81, text: 'slime on floor' },
  { min: 82, max: 83, text: 'slime on wall' },
  { min: 84, max: 84, text: 'spike' },
  { min: 85, max: 85, text: 'sticks' },
  { min: 86, max: 86, text: 'straw' },
  { min: 87, max: 88, text: 'stones' },
  { min: 89, max: 89, text: 'sword hilt' },
  { min: 90, max: 91, text: 'torch stub' },
  { min: 92, max: 93, text: 'wall damp' },
  { min: 94, max: 95, text: 'water (puddle or trickle)' },
  { min: 96, max: 96, text: 'wax drippings' },
  { min: 97, max: 97, text: 'wax blob or candle stub' },
  { min: 98, max: 100, text: 'wood' },
]

const FURNISHINGS_ENTRIES: RangeEntry[] = [
  { min: 1, max: 1, text: 'altar' },
  { min: 2, max: 2, text: 'armchair' },
  { min: 3, max: 3, text: 'armoire' },
  { min: 4, max: 4, text: 'arras' },
  { min: 5, max: 5, text: 'bag' },
  { min: 6, max: 6, text: 'barrel' },
  { min: 7, max: 8, text: 'bed' },
  { min: 9, max: 9, text: 'bench' },
  { min: 10, max: 10, text: 'blanket' },
  { min: 11, max: 11, text: 'box' },
  { min: 12, max: 12, text: 'brazier' },
  { min: 13, max: 13, text: 'bucket' },
  { min: 14, max: 14, text: 'buffet' },
  { min: 15, max: 15, text: 'bunks' },
  { min: 16, max: 16, text: 'cabinet' },
  { min: 17, max: 17, text: 'candelabrum' },
  { min: 18, max: 18, text: 'carpet' },
  { min: 19, max: 19, text: 'cask' },
  { min: 20, max: 20, text: 'cauldron' },
  { min: 21, max: 21, text: 'chandelier' },
  { min: 22, max: 22, text: 'charcoal' },
  { min: 23, max: 23, text: 'chair' },
  { min: 24, max: 25, text: 'chair with straps' },
  { min: 26, max: 26, text: 'chest' },
  { min: 27, max: 27, text: 'chest of drawers' },
  { min: 28, max: 28, text: 'coal' },
  { min: 29, max: 29, text: 'couch' },
  { min: 30, max: 30, text: 'crate' },
  { min: 31, max: 31, text: 'cresset' },
  { min: 32, max: 33, text: 'cupboard' },
  { min: 34, max: 34, text: 'cushion' },
  { min: 35, max: 35, text: 'dais' },
  { min: 36, max: 36, text: 'desk' },
  { min: 37, max: 37, text: 'fireplace with wood' },
  { min: 38, max: 38, text: 'fireplace and mantle' },
  { min: 39, max: 39, text: 'firkin' },
  { min: 40, max: 42, text: 'fountain' },
  { min: 43, max: 43, text: 'fresco' },
  { min: 44, max: 44, text: 'grindstone' },
  { min: 45, max: 45, text: 'hammock' },
  { min: 46, max: 46, text: 'hamper' },
  { min: 47, max: 47, text: 'hogshead' },
  { min: 48, max: 49, text: 'idol' },
  { min: 50, max: 50, text: 'kettle' },
  { min: 51, max: 51, text: 'loom' },
  { min: 52, max: 52, text: 'mat' },
  { min: 53, max: 53, text: 'mattress' },
  { min: 54, max: 54, text: 'mural' },
  { min: 55, max: 55, text: 'oven' },
  { min: 56, max: 56, text: 'pail' },
  { min: 57, max: 57, text: 'painting' },
  { min: 58, max: 60, text: 'pallet' },
  { min: 61, max: 61, text: 'pans' },
  { min: 62, max: 64, text: 'pedestal' },
  { min: 65, max: 65, text: 'pegs' },
  { min: 66, max: 66, text: 'pillow' },
  { min: 67, max: 67, text: 'pots' },
  { min: 68, max: 70, text: 'quilt' },
  { min: 71, max: 71, text: 'rug' },
  { min: 72, max: 72, text: 'rushes' },
  { min: 73, max: 73, text: 'sack' },
  { min: 74, max: 74, text: 'sconce' },
  { min: 75, max: 75, text: 'screen' },
  { min: 76, max: 77, text: 'sheet' },
  { min: 78, max: 78, text: 'shelf' },
  { min: 79, max: 79, text: 'shrine' },
  { min: 80, max: 80, text: 'sideboard' },
  { min: 81, max: 81, text: 'sofa' },
  { min: 82, max: 82, text: 'spinning wheel' },
  { min: 83, max: 83, text: 'staff' },
  { min: 84, max: 84, text: 'stand' },
  { min: 85, max: 85, text: 'statue' },
  { min: 86, max: 86, text: 'stool' },
  { min: 87, max: 88, text: 'table' },
  { min: 89, max: 89, text: 'tapestry' },
  { min: 90, max: 90, text: 'throne' },
  { min: 91, max: 91, text: 'trestle' },
  { min: 92, max: 92, text: 'trunk' },
  { min: 93, max: 93, text: 'tub' },
  { min: 94, max: 94, text: 'tun' },
  { min: 95, max: 95, text: 'utensil (cooking etc.)' },
  { min: 96, max: 96, text: 'urn' },
  { min: 97, max: 97, text: 'wall basin and font' },
  { min: 98, max: 98, text: 'wardrobe' },
  { min: 99, max: 99, text: 'wood billets' },
  { min: 100, max: 100, text: 'workbench' },
]

const AIR_CURRENTS = expandD100(AIR_CURRENTS_ENTRIES)
const ODOURS = expandD100(ODOURS_ENTRIES)
const NOISES = expandD100(NOISES_ENTRIES)
const GENERAL = expandD100(GENERAL_ENTRIES)
const FURNISHINGS = expandD100(FURNISHINGS_ENTRIES)

export function airCurrentForD100(roll: number): string {
  return lookupD100(AIR_CURRENTS, roll, 'airCurrentForD100')
}
export function odourForD100(roll: number): string {
  return lookupD100(ODOURS, roll, 'odourForD100')
}
export function noiseForD100(roll: number): string {
  return lookupD100(NOISES, roll, 'noiseForD100')
}
export function generalDressingForD100(roll: number): string {
  return lookupD100(GENERAL, roll, 'generalDressingForD100')
}
export function furnishingForD100(roll: number): string {
  return lookupD100(FURNISHINGS, roll, 'furnishingForD100')
}
