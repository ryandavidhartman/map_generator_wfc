// Transcribed from the Basic Fantasy compilation's (core rules + Field Guide) Appendix E: Random Settlement Builder —
// "Equipment and Services" (Weapons and Armor, General Equipment, Food and Lodging, Services,
// At the Tavern). Source text: docs/osr-appendix-cde-source.txt, ~lines 3221-3327.
//
// Static reference data, not a roll table — a GM consults these for prices when a shop or
// tavern comes up, same role the book's own price lists play at the table. Surfaced as a
// reference panel in SettlementView. See docs/plan-osr-integration.md, Phase 3.

export type PriceEntry = { item: string; price: string }

export const WEAPONS: PriceEntry[] = [
  { item: 'Hand Axe', price: '4 gp' },
  { item: 'Battle Axe (two-handed)', price: '7 gp' },
  { item: 'Dagger', price: '3 gp' },
  { item: 'Silver Dagger', price: '30 gp' },
  { item: 'Short Sword', price: '7 gp' },
  { item: 'Sword', price: '10 gp' },
  { item: 'Two-Handed Sword', price: '15 gp' },
  { item: 'Mace', price: '5 gp' },
  { item: 'Club', price: '3 gp' },
  { item: 'Pole Arm (two-handed)', price: '7 gp' },
  { item: 'Spear', price: '3 gp' },
  { item: 'War Hammer', price: '5 gp' },
  { item: 'Short Bow', price: '25 gp' },
  { item: 'Long Bow', price: '40 gp' },
  { item: 'Crossbow', price: '30 gp' },
  { item: 'Sling with 30 Stones', price: '2 gp' },
]

export const ARMOR: PriceEntry[] = [
  { item: 'Leather Armor (AC 12)', price: '20 gp' },
  { item: 'Chain Mail Armor (AC 14)', price: '40 gp' },
  { item: 'Plate Mail Armor (AC 16)', price: '60 gp' },
  { item: 'Shield (+1)', price: '10 gp' },
]

export const GENERAL_EQUIPMENT: PriceEntry[] = [
  { item: 'Backpack', price: '5 gp' },
  { item: 'Bedroll', price: '6 gp' },
  { item: 'Candles (12)', price: '1 gp' },
  { item: 'Chalk, small bag', price: '2 gp' },
  { item: 'Crowbar (3 ft)', price: '2 gp' },
  { item: 'Flask of Oil', price: '1 gp' },
  { item: 'Grappling Hook', price: '2 gp' },
  { item: 'Hammer (small)', price: '2 gp' },
  { item: 'Holy Symbol', price: '25 gp' },
  { item: 'Holy Water (per vial)', price: '10 gp' },
  { item: 'Iron Spikes (12)', price: '1 gp' },
  { item: 'Ladder, 10 ft', price: '1 gp' },
  { item: 'Lantern', price: '10 gp' },
  { item: 'Lock, Poor', price: '20 gp' },
  { item: 'Lock, Good', price: '100 gp' },
  { item: 'Mirror, small steel', price: '7 gp' },
  { item: 'Paper or Parchment (sheet)', price: '1 gp' },
  { item: 'Rope, Hemp (50 ft)', price: '1 gp' },
  { item: 'Sack, Small', price: '1 gp' },
  { item: 'Sack, Large', price: '2 gp' },
  { item: 'Signal Whistle', price: '1 gp' },
  { item: 'Soap (per lb)', price: '5 sp' },
  { item: 'Tent, Small (one man)', price: '5 gp' },
  { item: 'Tent, Large (ten men)', price: '25 gp' },
  { item: "Thieves' Tools", price: '25 gp' },
  { item: 'Tinder Box', price: '3 gp' },
  { item: 'Torches (6)', price: '1 gp' },
  { item: 'Vial, glass', price: '1 gp' },
  { item: 'Waterskin/Wineskin', price: '1 gp' },
  { item: 'Whetstone', price: '1 gp' },
  { item: 'Winter Blanket', price: '1 gp' },
  { item: 'Writing Ink (per vial)', price: '8 gp' },
  { item: 'Journal (blank)', price: '20 gp' },
  { item: 'Map or Scroll Case', price: '1 gp' },
]

export const FOOD_AND_LODGING: PriceEntry[] = [
  { item: 'City room (per month), Common', price: '20 gp' },
  { item: 'City room (per month), Poor', price: '6 sp' },
  { item: 'Grain and stabling for horse (daily)', price: '5 sp' },
  { item: 'Inn lodging (per day/week), Private Room', price: '2 gp / 8 gp' },
  { item: 'Inn lodging (per day/week), Common', price: '5 sp / 3 gp' },
  { item: 'Inn lodging (per day/week), Poor', price: '5 cp / 2 sp' },
  { item: 'Meals (per day), Poor', price: '1 sp' },
  { item: 'Meals (per day), Common', price: '3 sp' },
  { item: 'Meals (per day), Good', price: '5 sp' },
]

export const SERVICES: PriceEntry[] = [
  { item: 'Bath', price: '3 cp' },
  { item: 'Clerk (per letter)', price: '2 sp' },
  { item: 'Guide, in city (per day)', price: '2 sp' },
  { item: 'Lantern or torchbearer (per night)', price: '1 sp' },
  { item: 'Hireling, trained (per day)', price: '3 sp' },
  { item: 'Hireling, untrained (per day)', price: '1 sp' },
  { item: 'Messenger, in city (per message)', price: '1 sp' },
  { item: 'Messenger, overland (per mile)', price: '2 cp' },
  { item: 'Minstrel (per performance)', price: '3 gp' },
  { item: 'Mourner (per funeral)', price: '2 sp' },
  { item: 'Road or gate toll', price: '1 cp' },
  { item: "Ship's passage (per mile)", price: '1 sp' },
  { item: 'Teamster with wagon (per mile)', price: '1 sp' },
]

export type TavernMenuEntry = { item: string; byDrink?: string; byPitcherOrGallon?: string; byBottle?: string }

export const TAVERN_MEALS: PriceEntry[] = [
  { item: 'Poor (dark bread, hard cheese, broth or simple stew)', price: '5 cp' },
  { item: 'Common (good bread and cheese, hearty stew, roast fowl)', price: '1 sp' },
  { item: "Merchant's (roast meats, cheeses, light breads, fruit)", price: '2 sp' },
  { item: 'Rich (several courses, exceptional quality)', price: '1 gp' },
  { item: 'Banquet (per person, multiple courses, service included)', price: '10 gp' },
]

export const TAVERN_DRINKS: TavernMenuEntry[] = [
  { item: 'Small Beer', byDrink: '5 cp', byPitcherOrGallon: '4 sp' },
  { item: 'Beer, common', byDrink: '5 cp', byPitcherOrGallon: '4 sp' },
  { item: 'Beer, quality', byDrink: '2 sp', byPitcherOrGallon: '16 sp' },
  { item: 'Ale/Cider, common', byDrink: '1 sp', byPitcherOrGallon: '8 sp' },
  { item: 'Ale/Cider, quality', byDrink: '4 sp', byPitcherOrGallon: '3 gp' },
  { item: 'Wine, common', byDrink: '2 sp', byPitcherOrGallon: '16 sp', byBottle: '1 gp' },
  { item: 'Wine, quality', byDrink: '1 gp', byPitcherOrGallon: '10 gp', byBottle: '5 gp' },
  { item: 'Mead, common', byDrink: '1 sp', byBottle: '5 sp' },
  { item: 'Spirits, common', byDrink: '1 sp', byBottle: '2 gp' },
  { item: 'Spirits, quality', byDrink: '1 gp', byBottle: '20 gp' },
]
