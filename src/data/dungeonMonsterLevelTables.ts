// Transcribed verbatim from the Basic Fantasy compilation's (core rules + Field Guide) Appendix C: Random Encounters — "Dungeon
// Random Encounters" section (docs/osr-appendix-cde-source.txt, lines 100-571; source PDF
// combined-monsters.md, Appendix C). This replaces the
// invented category/theme system in monsterTables.ts (rollMonsterTheme, SITE_TYPE_CATEGORY_
// WEIGHTS, BOSS_EXCLUDED_CATEGORIES) for dungeon-shaped sites — see generateDungeonEncounter.ts.
//
// The real procedure has two steps: (1) a dungeon level's row on the Monster Sub-table Matrix
// gives a 1d12 range that selects a Monster Level (1-10) — deeper dungeon levels draw from
// higher Monster Levels on average, but the two numbers don't run 1-to-1; (2) roll d% on that
// Monster Level's own table to find the actual creature. This project's Effective Dungeon Level
// (dungeonTables.ts) is the "dungeon level" input to the matrix.
//
// "Number Appearing" (the # column) and Dragon sub-table Age/Hit Points per HD are kept as raw
// display strings, not parsed dice — several rows have their own quirks (e.g. "1d10x5",
// "1d10+5", "2x Dragon, Black", "8+6") that a generic NdM dice type can't represent cleanly, and
// this project doesn't resolve actual hit points/combat anywhere yet (see monsterTables.ts's own
// header for the same no-stat-blocks scope line).
//
// "NPC Party" rows are a real gap: the book's own procedure ("pick a party archetype... roll
// class and level as described [in the NPC Parties entry earlier in this book]") points at a
// full adventuring-party generator this project has never built and explicitly declined
// (docs/plan-osr-integration.md's "Explicitly out of scope" section: "NPC adventuring-party
// generation"). Rather than reopen that scope, an "NPC Party" result here resolves through the
// existing rollSettlementNpc machinery (npcTables.ts) as a small band of individuals — a
// simplification, not the book's own class/level retinue system.

import type { Rng } from '../engine/dice'
import { rollDie } from '../engine/dice'

export type MonsterLevelEntry = { name: string; numberAppearing: string; isDragon: boolean; isNpcParty: boolean }

type RangeRow = [min: number, max: number, name: string, numberAppearing: string]

function expand(rows: RangeRow[]): MonsterLevelEntry[] {
  const table = new Array<MonsterLevelEntry>(100)
  for (const [min, max, name, numberAppearing] of rows) {
    const isDragon = name.startsWith('Dragon (see sub-table)')
    const isNpcParty = name.startsWith('NPC Party')
    for (let i = min; i <= max; i++) table[i - 1] = { name, numberAppearing, isDragon, isNpcParty }
  }
  return table
}

const ML1: RangeRow[] = [
  [1, 2, 'Lemure', '1d10'],
  [3, 4, 'Halfling', '3d6'],
  [5, 6, 'Acolyte', '1d8'],
  [7, 9, 'NPC Party', 'varies'],
  [10, 13, 'Larva', '1'],
  [14, 17, 'Rat', '1d10x5'],
  [18, 19, 'Shrew, Giant', '1d10'],
  [20, 21, 'Sprite', '3d6'],
  [22, 25, 'Stirge', '1d4'],
  [26, 29, 'Bat', '5d10'],
  [30, 31, 'Bee, Killer', '1d10'],
  [32, 36, 'Goblin', '2d10'],
  [37, 43, 'Men, Bandit', '2d4'],
  [44, 45, 'Trader', '1d8'],
  [46, 52, 'Orc', '3d10'],
  [53, 54, 'Gnome', '1d6'],
  [55, 61, 'Frog, Giant', '1d8'],
  [62, 68, 'Beetle, Giant', '1d4'],
  [69, 73, 'Kobold', '4d10'],
  [74, 78, 'Dog', '1d4'],
  [79, 83, 'Bat, Giant', '1d6'],
  [84, 85, 'Green Slime', '1d4'],
  [86, 89, 'Skeleton', '1d10'],
  [90, 93, 'Rot Grub', '5d4'],
  [94, 96, 'Brain Mole', '1d6'],
  [97, 98, 'Hobgoblin', '4d6'],
  [99, 100, 'Berserker', '1d6'],
]

const ML2: RangeRow[] = [
  [1, 2, 'NPC Party', 'varies'],
  [3, 4, 'Ant, Giant (Worker)', '2d10'],
  [5, 7, 'Shadow', '1'],
  [8, 9, 'Elf', '1d4'],
  [10, 13, 'Gnoll', '1d12'],
  [14, 17, 'Toad, Giant', '1d4'],
  [18, 22, 'Neanderthals', '2d10'],
  [23, 29, 'Troglodyte', '1d10'],
  [30, 31, 'Pixie', '2d4'],
  [32, 36, 'Hobgoblin', '2d10'],
  [37, 41, 'Lizard Man', '1d10'],
  [42, 48, 'Piercer', '3d6'],
  [49, 50, 'Noble', '2d6'],
  [51, 57, 'Giant Badger', '1d2'],
  [58, 64, 'Spider, Giant (see table)', '1d8'],
  [65, 66, 'Fly, Robber', '1d6'],
  [67, 71, 'Bugbear', '1d6'],
  [72, 76, 'Gnoll', '2d10'],
  [77, 78, 'Baboon', '2d6'],
  [79, 83, 'Stirge', '1d10+5'],
  [84, 87, 'Zombie', '1d8'],
  [88, 89, 'Veteran', '2d4'],
  [90, 93, 'Ghoul', '1'],
  [94, 96, 'Troll', '1d6'],
  [97, 98, 'Centipede, Giant', '1d12'],
  [99, 100, 'Dwarf', '4d4'],
]

const ML3: RangeRow[] = [
  [1, 2, 'Ape', '1d3'],
  [3, 4, 'Centipede, Giant', '1d2'],
  [5, 7, 'Rust Monster', '1d2'],
  [8, 11, 'Wolf', '1d4'],
  [12, 13, 'Doppelganger', '1d6'],
  [14, 17, 'Harpy', '1d6'],
  [18, 22, 'Ghoul', '1d6'],
  [23, 27, 'Wererat', '1d8'],
  [28, 32, 'Frog, Giant', '1d8'],
  [33, 37, 'Lemure', '5d6'],
  [38, 42, 'NPC Party', 'varies'],
  [43, 44, 'Ant, Driver', '2d4'],
  [45, 52, 'Lizards, Giant', '1d6'],
  [53, 60, 'Ogre', '1d10'],
  [61, 62, 'Gelatinous Cube', '1'],
  [63, 70, 'Carcass Crawler', '1d6'],
  [71, 75, 'Beetle, Giant', '1d6'],
  [76, 80, 'Bugbear', '2d8'],
  [81, 85, 'Wight', '1d4'],
  [86, 89, 'Fungi, Violet', '1d4'],
  [90, 93, 'Shadow', '1'],
  [94, 96, 'Dragon (see sub-table)', '1'],
  [97, 98, 'Zombie', '1d3'],
  [99, 100, 'Spider, Giant', '1d6'],
]

const ML4: RangeRow[] = [
  [1, 2, 'Strangle Weed', '1'],
  [3, 4, 'Spider, Giant', '1d2'],
  [5, 7, 'Blink Dog', '1d4'],
  [8, 11, 'Ghast', '1d3'],
  [12, 15, 'Zombie', '1d2'],
  [16, 20, 'Piercer', '3d6'],
  [21, 25, 'Cockatrice', '1d3'],
  [26, 30, 'Snake, Rock Python', '1'],
  [31, 35, 'Manes', '2d4'],
  [36, 40, 'NPC Party', 'varies'],
  [41, 42, 'Ochre Jelly', '1'],
  [43, 50, 'Beetle, Giant', '1d6'],
  [51, 58, 'Werewolf', '1d6'],
  [59, 60, 'Caecilia', '1d3'],
  [61, 68, 'Imp', '2d4'],
  [69, 73, 'Snake, Spitting Cobra', '1'],
  [74, 78, 'Gargoyle', '1d8'],
  [79, 80, 'Owl Bear', '1d4'],
  [81, 85, 'Dragon (see sub-table)', '5'],
  [86, 89, 'Shadow', '1d8'],
  [90, 93, 'Wereboar', '1d4'],
  [94, 96, 'Gray Ooze', '1d3'],
  [97, 98, 'Hellhound', '2d6'],
  [99, 100, 'Wight', '1'],
]

const ML5: RangeRow[] = [
  [1, 2, 'Djinni', '1'],
  [3, 4, 'Animated Armor', '1d4'],
  [5, 7, 'Medusa', '1d2'],
  [8, 11, 'Bat, Giant', '1d4'],
  [12, 15, 'Sabre-Tooth Tiger', '1'],
  [16, 20, 'Minotaur', '1d8'],
  [21, 25, 'Scorpion, Giant', '1d2'],
  [26, 30, 'Snake, Rock Python', '1d4'],
  [31, 40, 'Type IV Demon (Nalfeshnee)', '1d4'],
  [41, 48, 'Bear, Cave', '1d2'],
  [49, 50, 'Weasel, Giant', '1d4'],
  [51, 60, 'NPC Party', 'varies'],
  [61, 70, 'Bone Devil', '1d4'],
  [71, 75, 'Dragon (see sub-table)', '1'],
  [76, 80, 'Phase Panther', '1'],
  [81, 85, 'Hydra (5-6 heads)', '1'],
  [86, 89, 'Ogre Mage', '1d3'],
  [90, 93, 'Werebear', '1d4'],
  [94, 96, 'Cat, Great', '1'],
  [97, 98, 'Hellhound', '2d6'],
  [99, 100, 'Snake, Giant Rattler', '1'],
]

const ML6: RangeRow[] = [
  [1, 2, 'Wraith', '1d6'],
  [3, 4, 'Quasit', '1'],
  [5, 7, 'Phase Panther', '1d4'],
  [8, 11, 'Mummy', '1d4'],
  [12, 15, 'Dragon (see sub-table)', '1'],
  [16, 20, 'Erinyes', '1d3'],
  [21, 31, 'Troll', '1d12'],
  [32, 36, 'Otyugh', '1d2'],
  [37, 41, 'Bone Devil', '1d3'],
  [42, 46, 'NPC Party', 'varies'],
  [47, 48, 'Black Pudding', '1'],
  [49, 56, 'Giant, Hill', '1d10'],
  [57, 64, 'Wight', '1d8'],
  [65, 66, 'Weretiger', '1d4'],
  [67, 74, 'Sphinx', '1'],
  [75, 79, 'Wyvern', '1d3'],
  [80, 84, 'Hydra (7-8 heads)', '5'],
  [85, 89, 'Manticore', '1d2'],
  [90, 91, 'Salamander', '2d4'],
  [92, 95, 'Lizards, Giant', '1d4'],
  [96, 98, 'Hellhound', '2d6'],
  [99, 100, 'Groaning Spirit', '1'],
]

const ML7: RangeRow[] = [
  [1, 2, 'Clay Golem (1-3) or Flesh Golem (4-6) on 1d6', '1'],
  [3, 4, 'Ettin', '1d2'],
  [5, 7, 'Chimera', '1d4'],
  [8, 11, 'Spectre', '1d4'],
  [12, 15, 'Basilisk', '1d2'],
  [16, 20, 'Giant, Fire', '1d8'],
  [21, 25, 'Type III Demon (Glabrezu)', '1d3'],
  [26, 30, 'Sphinx', '1'],
  [31, 35, 'Lamia', '1'],
  [36, 40, 'NPC Party', 'varies'],
  [41, 50, 'Lizard Man', '1d2'],
  [51, 55, 'Skeleton', '1'],
  [56, 60, 'Shedu', '1d2'],
  [61, 68, 'Will-O-Wisp', '1'],
  [69, 70, 'Gorgon', '1d2'],
  [71, 75, 'Naga', '1d3'],
  [76, 80, 'Barbed Devil or Bone Devil', '1d2'],
  [81, 85, 'Hydra (9-10 heads)', '1'],
  [86, 89, 'Dragon (see sub-table)', '1'],
  [90, 93, 'Cyclops', '1'],
  [94, 96, 'Hellhound', '1'],
  [97, 98, 'Troll', '1d3'],
  [99, 100, 'Efreeti', '1'],
]

const ML8: RangeRow[] = [
  [1, 3, 'Naga', '1d2'],
  [4, 7, 'Golem', '1'],
  [8, 11, 'Giant, Cloud', '1'],
  [12, 15, 'Vampire', '1d2'],
  [16, 20, 'Ice Devil', '1'],
  [21, 25, 'Barbed Devil', '1d2'],
  [26, 30, 'Otyugh', '1d2'],
  [31, 40, 'Type I Demon (Vrock)', '1d3'],
  [41, 42, 'Devil Swine', '1d3'],
  [43, 52, 'NPC Party', 'varies'],
  [53, 62, 'Manes', '5d4'],
  [63, 72, 'Hydra (11-12 heads)', '1'],
  [73, 80, 'Elemental, Air/Earth/Fire/Water', '1'],
  [81, 89, 'Dragon (see sub-table)', '1'],
  [90, 93, 'Lammasu', '1d4'],
  [94, 100, 'Ghost', '1'],
]

const ML9: RangeRow[] = [
  [1, 7, 'Trapper', '1'],
  [8, 11, 'Pit Fiend', '1'],
  [12, 25, 'Otyugh', '1'],
  [26, 40, 'NPC Party', 'varies'],
  [41, 55, 'Type II Demon (Hezrou)', '1d3'],
  [56, 70, 'Hydra (12 heads)', '1'],
  [71, 80, 'Dragon (see sub-table)', '1 or 2'],
  [81, 89, 'Purple Worm', '1d2'],
  [90, 93, 'Succubus', '1'],
  [94, 96, 'Roper', '1d4'],
  [97, 100, 'Golem', '1'],
]

const ML10: RangeRow[] = [
  [1, 7, 'Type V Demon (Marilith)', '1d3'],
  [8, 11, 'Giant, Storm', '1'],
  [12, 15, 'Otyugh', '1'],
  [16, 20, 'NPC Party', 'varies'],
  [21, 30, 'Type III Demon (Glabrezu)', '1d3'],
  [31, 40, 'Elemental, Earth', '1'],
  [41, 50, 'Elemental, Air', '1'],
  [51, 60, 'Elemental, Fire', '1'],
  [61, 70, 'Elemental, Water', '1'],
  [71, 80, 'Type IV Demon (Nalfeshnee)', '1d3'],
  [81, 89, 'Dragon (see sub-table)', '2'],
  [90, 95, 'Type VI Demon (Balor)', '1d3'],
  [96, 100, 'Lich', '1'],
]

const MONSTER_LEVEL_TABLES: Record<number, MonsterLevelEntry[]> = {
  1: expand(ML1),
  2: expand(ML2),
  3: expand(ML3),
  4: expand(ML4),
  5: expand(ML5),
  6: expand(ML6),
  7: expand(ML7),
  8: expand(ML8),
  9: expand(ML9),
  10: expand(ML10),
}

export function monsterLevelEntryForD100(monsterLevel: number, roll: number): MonsterLevelEntry {
  const table = MONSTER_LEVEL_TABLES[monsterLevel]
  if (!table) throw new Error(`monsterLevelEntryForD100: unknown monster level: ${monsterLevel}`)
  if (roll < 1 || roll > 100) throw new Error(`monsterLevelEntryForD100: roll out of range: ${roll}`)
  return table[roll - 1]
}

// Monster Sub-table Matrix (d12): dungeon-level row -> 1d12 range -> Monster Level (1-10).
// `undefined` cells are unreachable at that dungeon level (see the worked example in the header
// comment). Rows are listed by the dungeon-level band they cover.
type MatrixRow = { dungeonLevelMax: number; ranges: ([number, number] | undefined)[] }

const MONSTER_SUBTABLE_MATRIX: MatrixRow[] = [
  { dungeonLevelMax: 2, ranges: [[1, 8], [9, 11], [12, 12], undefined, undefined, undefined, undefined, undefined, undefined, undefined] },
  { dungeonLevelMax: 3, ranges: [[1, 5], [6, 8], [9, 10], [11, 11], [12, 12], undefined, undefined, undefined, undefined, undefined] },
  { dungeonLevelMax: 4, ranges: [[1, 4], [5, 7], [8, 9], [10, 10], [11, 11], [12, 12], undefined, undefined, undefined, undefined] },
  { dungeonLevelMax: 5, ranges: [[1, 3], [4, 5], [6, 7], [8, 9], [10, 10], [11, 11], [12, 12], undefined, undefined, undefined] },
  { dungeonLevelMax: 6, ranges: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 9], [10, 10], [11, 11], [12, 12], undefined, undefined] },
  { dungeonLevelMax: 7, ranges: [[1, 1], [2, 3], [4, 5], [6, 7], [8, 8], [9, 9], [10, 10], [11, 11], [12, 12], undefined] },
  { dungeonLevelMax: 8, ranges: [[1, 1], [2, 2], [3, 4], [5, 6], [7, 7], [8, 8], [9, 9], [10, 10], [11, 11], [12, 12]] },
  { dungeonLevelMax: 9, ranges: [[1, 1], [2, 2], [3, 3], [4, 5], [6, 7], [8, 8], [9, 9], [10, 10], [11, 11], [12, 12]] },
  { dungeonLevelMax: 11, ranges: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 6], [7, 8], [9, 9], [10, 10], [11, 11], [12, 12]] },
  { dungeonLevelMax: 13, ranges: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 7], [8, 9], [10, 10], [11, 11], [12, 12]] },
  { dungeonLevelMax: 15, ranges: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 8], [9, 10], [11, 11], [12, 12]] },
  { dungeonLevelMax: Infinity, ranges: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 9], [10, 11], [12, 12]] },
]

export function monsterLevelForDungeonLevel(dungeonLevel: number, d12Roll: number): number {
  const row = MONSTER_SUBTABLE_MATRIX.find((r) => dungeonLevel <= r.dungeonLevelMax)!
  const index = row.ranges.findIndex((range) => range && d12Roll >= range[0] && d12Roll <= range[1])
  if (index === -1) throw new Error(`monsterLevelForDungeonLevel: no Monster Level matches dungeon level ${dungeonLevel}, 1d12 roll ${d12Roll}`)
  return index + 1
}

// Dragon sub-tables (rolled as a follow-up whenever an ML table's own roll lands on a bare
// "Dragon (see sub-table)" result). ML1 and ML2 have no Dragon row at all in the source.
export type DragonEntry = { type: string; age: string; hitPointsPerHD: string }
type DragonRangeRow = [min: number, max: number, type: string, age: string, hitPointsPerHD: string]

function expandDragon(rows: DragonRangeRow[]): DragonEntry[] {
  const table = new Array<DragonEntry>(100)
  for (const [min, max, type, age, hitPointsPerHD] of rows) {
    for (let i = min; i <= max; i++) table[i - 1] = { type, age, hitPointsPerHD }
  }
  return table
}

const DRAGON_ML3: DragonRangeRow[] = [
  [1, 30, 'Dragon, Black', 'Very Young', '1'],
  [31, 60, 'Dragon, Brass', 'Very Young', '1'],
  [61, 100, 'Dragon, White', 'Very Young', '1'],
]

const DRAGON_ML4: DragonRangeRow[] = [
  [1, 10, 'Dragon, Black', 'Young/Sub-adult', '2/3'],
  [11, 20, 'Dragon, Blue', 'Very Young/Young', '1/2'],
  [21, 30, 'Dragon, Brass', 'Young/Sub-adult', '2/3'],
  [31, 35, 'Dragon, Bronze', 'Very Young/Young', '1/2'],
  [36, 50, 'Dragon, Copper', 'Very Young/Young', '1/2'],
  [51, 55, 'Dragon, Gold', 'Very Young/Young', '1/2'],
  [56, 70, 'Dragon, Green', 'Very Young/Young', '1/2'],
  [71, 80, 'Dragon, Red', 'Very Young/Young', '1/2'],
  [81, 85, 'Dragon, Silver', 'Very Young/Young', '1/2'],
  [86, 100, 'Dragon, White', 'Young/Sub-adult', '2/3'],
]

const DRAGON_ML5: DragonRangeRow[] = [
  [1, 8, 'Dragon, Black', 'Young Adult/Adult', '4/5'],
  [9, 18, 'Dragon, Blue', 'Sub-Adult/Young Adult', '3/4'],
  [19, 30, 'Dragon, Brass', 'Young Adult/Adult', '4/5'],
  [31, 35, 'Dragon, Bronze', 'Sub-Adult/Young Adult', '3/4'],
  [36, 50, 'Dragon, Copper', 'Sub-Adult/Young Adult', '3/4'],
  [51, 55, 'Dragon, Gold', 'Sub-Adult/Young Adult', '3/4'],
  [56, 70, 'Dragon, Green', 'Sub-Adult/Young Adult', '3/4'],
  [71, 80, 'Dragon, Red', 'Sub-Adult/Young Adult', '3/4'],
  [81, 87, 'Dragon, Silver', 'Sub-Adult/Young Adult', '3/4'],
  [88, 100, 'Dragon, White', 'Young Adult/Adult', '4/5'],
]

const DRAGON_ML6: DragonRangeRow[] = [
  [1, 10, 'Dragon, Black', 'Old', '6'],
  [11, 20, 'Dragon, Blue', 'Adult', '5'],
  [21, 30, 'Dragon, Brass', 'Old', '6'],
  [31, 35, 'Dragon, Bronze', 'Adult', '5'],
  [36, 50, 'Dragon, Copper', 'Adult', '5'],
  [51, 55, 'Dragon, Gold', 'Adult', '5'],
  [56, 70, 'Dragon, Green', 'Adult', '5'],
  [71, 80, 'Dragon, Red', 'Adult', '5'],
  [81, 85, 'Dragon, Silver', 'Adult', '5'],
  [86, 100, 'Dragon, White', 'Old', '6'],
]

const DRAGON_ML7: DragonRangeRow[] = [
  [1, 10, 'Dragon, Black', 'Very Old', '7'],
  [11, 20, 'Dragon, Blue', 'Old', '6'],
  [21, 30, 'Dragon, Brass', 'Very Old', '7'],
  [31, 35, 'Dragon, Bronze', 'Old', '6'],
  [36, 50, 'Dragon, Copper', 'Old', '6'],
  [51, 55, 'Dragon, Gold', 'Old', '6'],
  [56, 70, 'Dragon, Green', 'Old', '6'],
  [71, 80, 'Dragon, Red', 'Old', '6'],
  [81, 85, 'Dragon, Silver', 'Old', '6'],
  [86, 100, 'Dragon, White', 'Very Old', '7'],
]

const DRAGON_ML8: DragonRangeRow[] = [
  [1, 12, 'Dragon, Black', 'Ancient', '8'],
  [13, 25, 'Dragon, Blue', 'Very Old', '7'],
  [26, 30, 'Dragon, Brass', 'Ancient', '8'],
  [31, 35, 'Dragon, Bronze', 'Very Old', '7'],
  [36, 45, 'Dragon, Copper', 'Very Old', '7'],
  [46, 50, 'Dragon, Gold', 'Very Old', '7'],
  [51, 60, 'Dragon, Green', 'Very Old', '7'],
  [61, 80, 'Dragon, Red', 'Very Old', '7'],
  [81, 85, 'Dragon, Silver', 'Very Old', '7'],
  [86, 100, 'Dragon, White', 'Ancient', '8'],
]

const DRAGON_ML9: DragonRangeRow[] = [
  [1, 12, '2x Dragon, Black', 'Ancient + Old', '8+6'],
  [13, 25, 'Dragon, Blue', 'Ancient', '8'],
  [26, 30, '2x Dragon, Brass', 'Ancient + Old', '8+6'],
  [31, 35, 'Dragon, Bronze', 'Ancient', '8'],
  [36, 45, 'Dragon, Copper', 'Ancient', '8'],
  [46, 50, 'Dragon, Gold', 'Ancient', '8'],
  [51, 60, 'Dragon, Green', 'Ancient', '8'],
  [61, 80, 'Dragon, Red', 'Ancient', '8'],
  [81, 85, 'Dragon, Silver', 'Ancient', '8'],
  [86, 100, '2x Dragon, White', 'Ancient + Very Old', '8+7'],
]

const DRAGON_ML10: DragonRangeRow[] = [
  [1, 20, 'Dragon, Blue', 'Ancient + Very Old', '8+7'],
  [21, 25, 'Dragon, Bronze', 'Ancient + Very Old', '8+7'],
  [26, 35, 'Dragon, Copper', 'Ancient + Very Old', '8+7'],
  [36, 40, 'Dragon, Gold', 'Ancient + Old', '8+6'],
  [41, 60, 'Dragon, Green', 'Ancient + Very Old', '8+7'],
  [61, 95, 'Dragon, Red', 'Ancient + Old', '8+6'],
  [96, 100, 'Dragon, Silver', 'Ancient + Old', '8+6'],
]

const DRAGON_SUBTABLES: Partial<Record<number, DragonEntry[]>> = {
  3: expandDragon(DRAGON_ML3),
  4: expandDragon(DRAGON_ML4),
  5: expandDragon(DRAGON_ML5),
  6: expandDragon(DRAGON_ML6),
  7: expandDragon(DRAGON_ML7),
  8: expandDragon(DRAGON_ML8),
  9: expandDragon(DRAGON_ML9),
  10: expandDragon(DRAGON_ML10),
}

export function dragonEntryForMonsterLevel(monsterLevel: number, roll: number): DragonEntry {
  const table = DRAGON_SUBTABLES[monsterLevel]
  if (!table) throw new Error(`dragonEntryForMonsterLevel: no Dragon sub-table for monster level ${monsterLevel}`)
  if (roll < 1 || roll > 100) throw new Error(`dragonEntryForMonsterLevel: roll out of range: ${roll}`)
  return table[roll - 1]
}

export type ResolvedDungeonMonster =
  | { kind: 'monster'; name: string; numberAppearing: string }
  | { kind: 'dragon'; entry: DragonEntry; numberAppearing: string }
  | { kind: 'npcParty' }

// Runs the full Appendix C dungeon procedure: 1d12 -> Monster Sub-table Matrix -> Monster Level
// table -> resolve a bare "Dragon"/"NPC Party" result into its own follow-up roll.
export function rollDungeonMonsterLevelEntry(dungeonLevel: number, rng: Rng = Math.random): ResolvedDungeonMonster {
  const d12Roll = rollDie(12, rng)
  const monsterLevel = monsterLevelForDungeonLevel(dungeonLevel, d12Roll)
  const entry = monsterLevelEntryForD100(monsterLevel, rollDie(100, rng))
  if (entry.isDragon) {
    const dragon = dragonEntryForMonsterLevel(monsterLevel, rollDie(100, rng))
    return { kind: 'dragon', entry: dragon, numberAppearing: entry.numberAppearing }
  }
  if (entry.isNpcParty) return { kind: 'npcParty' }
  return { kind: 'monster', name: entry.name, numberAppearing: entry.numberAppearing }
}
