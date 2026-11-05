// Settlement tables. The dice structure (Settlement Type d6, district dice pools, d6 district
// points of interest, d20 tavern/shop name pieces, d12 food and drinks, d4 x d4 customers) follows
// the core rules; every entry's text is original to this project (replaced 2026-11-01), as are the
// drinks' OSR-style effects. District and settlement type names are kept as plain generic labels.
// Settlement Type is rolled fresh at generation time (never derived from an overland POI's
// location text — see the plan's "Two mechanical points" note). Each settlement-type tier's
// dice (3d4/4d4/6d6/8d8) give the literal district count (one die per district, never
// summed) — the same die's face value also indexes the Districts table directly, which is
// why smaller tiers (d4) can only ever reach the first 4 of 8 district types. Preserve this
// tiering exactly; it's intentional.

// Settlement Type table (d6).
export type SettlementType = 'Village' | 'Town' | 'City' | 'Metropolis'
export type SettlementTypeSpec = { type: SettlementType; diceCount: number; diceSides: 4 | 6 | 8 }

const SETTLEMENT_TYPE_SPECS: Record<SettlementType, SettlementTypeSpec> = {
  Village: { type: 'Village', diceCount: 3, diceSides: 4 },
  Town: { type: 'Town', diceCount: 4, diceSides: 4 },
  City: { type: 'City', diceCount: 6, diceSides: 6 },
  Metropolis: { type: 'Metropolis', diceCount: 8, diceSides: 8 },
}

export function settlementTypeForD6(roll: number): SettlementTypeSpec {
  if (roll < 1 || roll > 6) throw new Error(`settlementTypeForD6: roll out of range: ${roll}`)
  if (roll === 1) return SETTLEMENT_TYPE_SPECS.Village
  if (roll <= 3) return SETTLEMENT_TYPE_SPECS.Town
  if (roll <= 5) return SETTLEMENT_TYPE_SPECS.City
  return SETTLEMENT_TYPE_SPECS.Metropolis
}

export function settlementTypeSpecFor(type: SettlementType): SettlementTypeSpec {
  return SETTLEMENT_TYPE_SPECS[type]
}

// Districts table (d8) — indexed 1..sides directly by a district's placement die.
export type DistrictType =
  | 'Slums'
  | 'Low District'
  | 'Artisan District'
  | 'Market'
  | 'High District'
  | 'Temple District'
  | 'University District'
  | 'Castle District'

const DISTRICT_TYPES_ORDER: DistrictType[] = [
  'Slums',
  'Low District',
  'Artisan District',
  'Market',
  'High District',
  'Temple District',
  'University District',
  'Castle District',
]

export function districtTypeForRoll(roll: number, sides: 4 | 6 | 8): DistrictType {
  if (roll < 1 || roll > sides) throw new Error(`districtTypeForRoll: roll out of range for d${sides}: ${roll}`)
  return DISTRICT_TYPES_ORDER[roll - 1]
}

// Alignment table (d6) — used for the overall settlement or per-district.
export type Alignment = 'Lawful' | 'Neutral' | 'Chaotic'

export function alignmentForD6(roll: number): Alignment {
  if (roll < 1 || roll > 6) throw new Error(`alignmentForD6: roll out of range: ${roll}`)
  if (roll <= 3) return 'Lawful'
  if (roll <= 5) return 'Neutral'
  return 'Chaotic'
}

// Per-district Points of Interest tables (d6 each).
const DISTRICT_POI: Record<DistrictType, string[]> = {
  Slums: ['Crowded boarding house', 'Rag-and-bone yard', 'Gang hideout', 'Cheap tavern', 'Charity hospice', 'Rat-pit arena'],
  'Low District': ["Pauper's cemetery", 'Cheap tavern', "Workers' tenements", 'Secondhand stall', 'Common shop', 'Dockside storehouses'],
  'Artisan District': ['Public pillory', 'Guild chapel', "Craftsmen's alehouse", 'Workshop row', "Master's showroom", 'Fine shop'],
  Market: ["Seer's tent", 'Exotic goods stall', 'Spice and silk bazaar', 'Livestock pens', 'Herbalist', "Hidden smugglers' market"],
  'High District': ['Merchant guildhall', 'Fine inn', 'Walled townhouse', 'Private gardens', 'Fine shop', 'Watch station'],
  'Temple District': ['Burned-out temple', 'Wayside chapel', 'Monastery', 'Hidden cult shrine', 'Great temple', "Pilgrims' holy well"],
  'University District': ['Great library', 'Debating hall', 'Student alehouse', "Alchemist's laboratory", 'Observatory', "Mage's tower"],
  'Castle District': ["Courtiers' steam baths", 'Garrison barracks', 'Tourney grounds', 'Royal arena', 'Hall of records', "Ruler's citadel"],
}

export function districtPoiForD6(district: DistrictType, roll: number): string {
  if (roll < 1 || roll > 6) throw new Error(`districtPoiForD6: roll out of range: ${roll}`)
  return DISTRICT_POI[district][roll - 1]
}

// Government table (d6) — transcribed from the Basic Fantasy compilation's (core rules + Field Guide) Appendix E: Random
// Settlement Builder (docs/osr-appendix-cde-source.txt, ~lines 3140-3152). Who actually runs
// this settlement, layered on top of the core rules' existing district/POI/alignment system
// (not a replacement for it) — see docs/plan-osr-integration.md, Phase 3.
export type Government = { authority: string; notes: string }

const GOVERNMENTS: Government[] = [
  {
    authority: 'Sheriff appointed by a noble or baron',
    notes: "Law is enforced on the noble's behalf; taxes and tolls fund the noble's own ends.",
  },
  {
    authority: 'Town council with a charter',
    notes: 'Decisions and disputes move slowly, through debate; bribery of individual council members is a live option.',
  },
  {
    authority: 'A powerful merchant prince',
    notes: 'The settlement is run like a business; trade is easy, but everything has a price, including favors.',
  },
  {
    authority: 'A high-level NPC adventurer',
    notes: 'Rules personally, backed by loyal retainers and whatever magic they returned from adventuring with.',
  },
]

export function governmentForD6(roll: number): Government {
  if (roll < 1 || roll > 6) throw new Error(`governmentForD6: roll out of range: ${roll}`)
  if (roll <= 2) return GOVERNMENTS[0]
  if (roll <= 4) return GOVERNMENTS[1]
  if (roll === 5) return GOVERNMENTS[2]
  return GOVERNMENTS[3]
}

// Population bands — transcribed from OSR's Settlement Size table (Appendix E), mapped onto
// the core rules' own SettlementType (which already governs district count/roll, unchanged) since
// this project has no separate "Settlement Size" concept of its own: Village->Village,
// Town->Small Town, City->Large Town, Metropolis->Major City. OSR's own Major City band is
// open-ended ("15,000+"); capped at 60,000 here so it's a concrete rollable range rather than
// leaving Metropolis population unbounded.
export type PopulationRange = { min: number; max: number }

const POPULATION_RANGES: Record<SettlementType, PopulationRange> = {
  Village: { min: 50, max: 999 },
  Town: { min: 1000, max: 4999 },
  City: { min: 5000, max: 14999 },
  Metropolis: { min: 15000, max: 60000 },
}

export function populationRangeForSettlementType(type: SettlementType): PopulationRange {
  return POPULATION_RANGES[type]
}

// Tavern Generator (d20) — two independent name-fragment columns + a "Known For" column.
const TAVERN_NAME_A = [
  'The Laughing', 'The Sleepy', 'The Broken', 'The Golden', 'The Wandering', 'The Hungry', 'The Black', 'The Lucky',
  'The Green', 'The Old', 'The Hanged', 'The Crooked', 'The Salty', 'The Brass', 'The Howling', 'The Painted',
  'The Lame', 'The Fat', 'The Weeping', 'The Sly',
]
const TAVERN_NAME_B = [
  'Goose', 'Mare', 'Kettle', 'Owl', 'Badger', 'Fiddle', 'Stag', 'Barrel',
  'Hound', 'Crow', 'Bucket', 'Ox', 'Lamb', 'Cauldron', 'Harp', 'Wolf',
  'Mule', 'Moon', 'Hart', 'Herring',
]
const TAVERN_KNOWN_FOR = [
  'Cheap rooms, no questions asked', 'A cook who once served a king', 'Nightly knife-throwing', 'A mercenary hiring board',
  'A cellar door no one opens', 'Smuggled foreign brandy', 'A retired adventurer behind the bar', 'Rigged card games',
  'A resident ghost who tips', 'Arm-wrestling tournaments', 'Rumors for sale', 'Watered-down drinks',
  'Sailors and dockhands', 'An owner who hates elves', 'Bards who play for a free meal', 'A huge stuffed bear by the door',
  'Secret meetings in the back room', 'The best stew in town', 'Bets on anything, at any odds', 'Locals only after dark',
]

function lookupD20(table: string[], roll: number, tableName: string): string {
  if (roll < 1 || roll > 20) throw new Error(`${tableName}: roll out of range: ${roll}`)
  return table[roll - 1]
}

export function tavernNameForD20(rollA: number, rollB: number): string {
  return `${lookupD20(TAVERN_NAME_A, rollA, 'tavernNameForD20 (a)')} ${lookupD20(TAVERN_NAME_B, rollB, 'tavernNameForD20 (b)')}`
}

export function tavernKnownForForD20(roll: number): string {
  return lookupD20(TAVERN_KNOWN_FOR, roll, 'tavernKnownForForD20')
}

// Food (d12) — one column per tavern size tier.
export type TavernSizeTier = 'Poor' | 'Standard' | 'Wealthy'

const FOOD_TABLE: Record<TavernSizeTier, string[]> = {
  Poor: [
    'Turnip mash', 'Black bread and drippings', 'Pease porridge', 'Eel pie', 'Fried tripe', 'Onion soup',
    'Barley gruel', 'Blood sausage', 'Salt herring', 'Leek and potato stew', 'Fried dough', 'Mystery meat skewer',
  ],
  Standard: [
    'Roast chicken and leeks', 'Mutton chops', 'Trout in butter', 'Rabbit pie', 'Beef and ale stew', 'Smoked ham hock',
    'Venison sausages', 'Pork with apples', 'Mushroom tart', 'Lamb and barley', 'Spiced lentils', 'Honey cakes',
  ],
  Wealthy: [
    'Peacock in its feathers', 'Griffon egg omelet', 'Swan in cherry sauce', 'Saffron rice with figs', 'Owlbear ribs', 'Sugared violets',
    'Oysters on ice', 'Wild boar head', 'Stuffed quail', 'Roast giant crab', 'Gilded marzipan', 'Hydra tail soup',
  ],
}

export function tavernFoodForRoll(tier: TavernSizeTier, roll: number): string {
  if (roll < 1 || roll > 12) throw new Error(`tavernFoodForRoll: roll out of range: ${roll}`)
  return FOOD_TABLE[tier][roll - 1]
}

// Drinks (d12) — single shared table across all tiers; tier only changes how many/which die
// is rolled (Poor: d6, Standard: 2d6, Wealthy: d12) — that dice-mechanics decision belongs to
// the engine, not this pure lookup.
const DRINKS_TABLE = [
  'Bilge rum. 1 cp, harsh, save vs. poison or retch for 1 turn',
  'Small beer. 2 cp, weak and sour, harmless',
  'Turnip spirits. 4 cp, -1 to hit for 1 hour',
  'Rough cider. 5 cp, cloudy, makes the drinker talkative',
  "Brown ale. 8 cp, nutty, guarantees a good night's sleep",
  'Spiced wine. 1 sp, served hot, wards off a cold night',
  'Black stout. 2 sp, thick as soup, counts as a meal',
  'Honey mead. 3 sp, sweet, loosens tongues',
  'Southern red wine. 5 sp, rich, a favorite of merchants',
  'Elven green wine. 1 gp, faintly glowing, heals 1 hp',
  'Dwarven fire whiskey. 2 gp, burns blue, save or pass out',
  'Mountain ice wine. 10 gp a glass, rare, heals 1d4 hp',
]

export function tavernDrinkForRoll(roll: number): string {
  if (roll < 1 || roll > 12) throw new Error(`tavernDrinkForRoll: roll out of range: ${roll}`)
  return DRINKS_TABLE[roll - 1]
}

// Shops.
export type ShopTier = 'Poor' | 'Standard' | 'Wealthy'

const SHOP_TYPES: Record<ShopTier, string[]> = {
  Poor: [
    'Rag shop', 'Secondhand weapons', 'Gravedigger', 'Junk dealer', 'Loan shark', 'Soap boiler',
    'Tallow chandler', 'Tooth-puller', 'Bone carver', 'Tinker', 'Dice den', 'Fortune teller',
  ],
  Standard: [
    'Baker', 'Cooper', 'Weaver', 'Farrier', 'Outfitter',
    'Saddler', 'Wheelwright', 'Potter', 'Chandler', 'Bowyer and fletcher',
  ],
  Wealthy: [
    'Silk merchant', 'Perfumer', 'Gem cutter', 'Alchemist', 'Portrait painter',
    'Map maker', 'Bookbinder', 'Silversmith', 'Armorer', 'Clockmaker',
  ],
}

export function shopTypeForRoll(tier: ShopTier, roll: number): string {
  const max = tier === 'Poor' ? 12 : 10
  if (roll < 1 || roll > max) throw new Error(`shopTypeForRoll: roll out of range for ${tier}: ${roll}`)
  return SHOP_TYPES[tier][roll - 1]
}

// Shop Generator (d20) — same two-column-name + Known For shape as the Tavern Generator.
const SHOP_NAME_A = [
  "Hob's", 'The Honest', 'Old', "Brannoc's", 'The Lucky', "Two Brothers'", 'The Busy', "Widow Gale's",
  'The Painted', 'Harbor', 'Copper', 'The Blue', "Tamsin's", 'Lantern Street', 'The Thrifty', 'Silverleaf',
  "Merrow's", 'The Little', 'Northgate', 'The Hidden',
]
const SHOP_NAME_B = [
  'Goods', 'Emporium', 'Trading Post', 'Supply', 'Provisions', 'Notions', 'Bargains', 'Treasures',
  'Necessities', 'Exchange', 'Shelf', 'Counter', 'Workshop', 'Warehouse', 'Bazaar', 'Trinkets',
  'Curios', 'Cabinet', 'Barrow', 'Chest',
]
const SHOP_KNOWN_FOR = [
  'Haggling is an insult', "Prices that change with the owner's mood", 'A three-legged dog guarding the door', 'Never closing',
  'Taking barter only', 'Rumored cursed stock', "The owner's twin running a rival shop", 'Free tea for customers',
  'Goods wrapped in old maps', 'Selling nothing on holy days', 'A tiny door for halfling customers', 'Lending gear for a share of loot',
  'Everything being secondhand', 'An apprentice who never stops talking', 'Strange smells from the back room', 'A bell that rings when thieves enter',
  "Goods salvaged from the city's ruins", 'Giving credit to adventurers', 'Being closed half the time', 'A collection of shrunken heads',
]

export function shopNameForD20(rollA: number, rollB: number): string {
  return `${lookupD20(SHOP_NAME_A, rollA, 'shopNameForD20 (a)')} ${lookupD20(SHOP_NAME_B, rollB, 'shopNameForD20 (b)')}`
}

export function shopKnownForForD20(roll: number): string {
  return lookupD20(SHOP_KNOWN_FOR, roll, 'shopKnownForForD20')
}

// Interesting Customer (d4, d4) — 4x4 grid, row = first d4, column = second d4.
const INTERESTING_CUSTOMER: string[][] = [
  ['Retired sellsword', 'Lost pilgrim', 'Gossiping washerwoman', 'Bored noble'],
  ['Half-elf minstrel', 'Tax collector', '1d4 off-duty guards', 'Nervous apprentice'],
  ['Gnome tinkerer', 'Hooded stranger', 'Grieving widow', 'Rival merchant'],
  ['Rowdy sailors', 'Monster hunter', 'Runaway child', 'Traveling priest'],
]

export function interestingCustomerFor2D4(rollRow: number, rollCol: number): string {
  if (rollRow < 1 || rollRow > 4 || rollCol < 1 || rollCol > 4) {
    throw new Error(`interestingCustomerFor2D4: roll out of range: ${rollRow}, ${rollCol}`)
  }
  return INTERESTING_CUSTOMER[rollRow - 1][rollCol - 1]
}
