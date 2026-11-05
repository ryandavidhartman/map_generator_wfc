// Transcribed verbatim from the Basic Fantasy compilation's (core rules + Field Guide) Appendix C: Random Encounters — "Wilderness
// Encounters" section (docs/osr-appendix-cde-source.txt, lines 839-1677; source PDF
// combined-monsters.md, Appendix C). Replaces the old
// category-only wilderness gating (rollEncounter.ts's now-removed excludedCategoriesForHexDangerLevel)
// with the real OSR procedure: roll the Terrain Category Summary (already transcribed in
// encounterFrequencyTables.ts) for a category, then roll the die given by Wilderness Encounter
// Level for the hex's Danger Level down that terrain's own 20-row table to get an actual creature
// name.
//
// Scope: the book has 13 wilderness terrain tables total, but this project's `Terrain` type (7
// values) only needs the 6 that `encounterFrequencyTables.ts` already maps onto —
// Grassland->Plains, Forest/jungle->Jungle, River/coast->Aquatic, Ocean->Marine,
// Mountain->Mountains, Desert/arctic->Desert. Swamp->Wetlands has NO dedicated name table in the
// source ("Wetlands has no further breakdown table in the source material — treat it as a Rural
// or Marine encounter, DM's choice") — Marine is reused here rather than transcribing the
// (otherwise-unneeded) Rural table just for this one fallback. Arctic/Graveyard/Lost
// World/Rural/Tundra (and Lost World's own dinosaur sub-tables) are correspondingly NOT
// transcribed — nothing in this project's Terrain type reaches them, same "closest match" scope
// already established by encounterFrequencyTables.ts's own category-table subset.
//
// Every column is a flat 20-entry array (1d20 row order = the book's own weakest-to-strongest
// ordering — see Wilderness Encounter Level below for how a lower Danger Level only reaches the
// early rows). Wilderness Dragon results (unlike the dungeon Monster Level tables) already name
// a specific dragon type directly — no separate Dragon sub-table roll needed here.

import type { WildernessEncounterCategory } from './encounterFrequencyTables'
import type { Terrain } from './tables'

export type TerrainMonsterTable = Record<WildernessEncounterCategory, string[]>

const AQUATIC: TerrainMonsterTable = {
  Airborne: ['Bat', 'Bat', 'Bat', 'Bat', 'Bat, Giant', 'Bat, Giant', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Eagle, Giant', 'Chimera', 'Cockatrice', 'Shedu', 'Sphinx', 'Sphinx', 'Stirge', 'Stirge', 'Stirge'],
  Animal: ['Baboon', 'Bear, Black', 'Boar', 'Cat, Great', 'Cattle', 'Cat, Great', 'Dog', 'Elephant', 'Horse', 'Horse', 'Hyena', 'Jackal', 'Lizards, Giant', 'Lizards, Giant', 'Rat', 'Rat', 'Rhinoceros', 'Snake, Pit Viper', 'Snake, Rock Python', 'Wolf'],
  Dragon: ['Dragon, Black', 'Dragon, Black', 'Dragon, Black', 'Dragon, Black', 'Dragon, Black', 'Dragon, Black', 'Dragon, Black', 'Dragon, Black', 'Dragon, Bronze', 'Dragon, Bronze', 'Dragon, Gold', 'Dragon, Green', 'Dragon, Green', 'Dragon, Green', 'Dragon, Green', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red'],
  Giant: ['Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Storm', 'Giant, Storm', 'Giant, Storm', 'Giant, Storm', 'Giant, Storm'],
  'Human/Demi-Human': ['Castle', 'Dwarf', 'Elf', 'Fishing Village', 'Gnome', 'Halfling', 'Hamlet', 'Men, Bandit', 'Men, Bandit', 'Men, Brigand', 'Men, Brigand', 'Men, Buccaneer / Pirate', 'Men, Buccaneer / Pirate', 'Men, Merchant', 'Men, Merchant', 'Men, Merchant', 'Men, Nomad', 'Men, Merchant', 'Men, Buccaneer / Pirate', 'Men, Buccaneer / Pirate'],
  Humanoid: ['Bugbear', 'Gnoll', 'Gnoll', 'Gnoll', 'Goblin', 'Troglodyte', 'Hobgoblin', 'Hobgoblin', 'Hobgoblin', 'Kobold', 'Orc', 'Orc', 'Orc', 'Orc', 'Orc', 'Orc', 'Troglodyte', 'Troll', 'Troll', 'Troll'],
  Monster: ['Basilisk', 'Lizards, Giant', 'Blink Dog', 'Blink Dog', 'Bulette', 'Cat, Great', 'Centaur', 'Cyclops', 'Basilisk', 'Hellhound', 'Wererat', 'Naga', 'Lizard Man', 'Lizard Man', 'Lizard Man', 'Lizards, Giant', 'Owl Bear', 'Owl Bear', 'Pseudo-Dragon', 'Wolf'],
  NPC: ['Decoys', 'Decoys', 'Escapees', 'Escapees', 'Escapees', 'Joiners', 'Joiners', 'Joiners', 'Joiners', 'Runners', 'Runners', 'Searchers', 'Searchers', 'Searchers', 'Searchers', 'Searchers', 'Survivors', 'Wolf', 'Wolf', 'Wolf'],
  Undead: ['Ghast', 'Ghast', 'Ghoul', 'Ghoul', 'Ghoul', 'Ghoul', 'Ghoul', 'Skeleton', 'Skeleton', 'Skeleton', 'Skeleton', 'Skeleton', 'Will-O-Wisp', 'Zombie', 'Zombie', 'Zombie', 'Zombie', 'Zombie', 'Zombie', 'Zombie'],
  Invertebrates: ['Ant, Giant', 'Ant, Giant', 'Beetle, Giant', 'Beetle, Giant', 'Beetle, Giant', 'Beetle, Giant', 'Beetle, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Fly, Robber', 'Fly, Robber', 'Spider, Giant', 'Spider, Giant', 'Wasp, Giant', 'Wasp, Giant', 'Wasp, Giant', 'Wasp, Giant', 'Wasp, Giant'],
  Water: ['Beetle, Giant', 'Crayfish, Giant', 'Crocodile', 'Crocodile', 'Eel', 'Eel', 'Fish, Giant', 'Fish, Giant', 'Frog, Giant', 'Hippopotamus', 'Locathah', 'Naga', 'Sea Serpent (Lesser)', 'Toad, Giant', 'Toad, Giant', 'Turtle, Giant', 'Turtle, Giant', 'Termite, Water', 'Triton', 'Dragon Turtle'],
  Special: ['Type I Demon (Vrock)', 'Type II Demon (Hezrou)', 'Type II Demon (Hezrou)', 'Type IV Demon (Nalfeshnee)', 'Barbed Devil', 'Bone Devil', 'Barbed Devil', 'Barbed Devil', 'Elemental, Air', 'Elemental, Air', 'Elemental, Water', 'Elemental, Water', 'Elemental, Water', 'Elemental, Water', 'Homunculus', 'Invisible Stalker', 'Invisible Stalker', 'Night Hag', 'Pixie', 'Rakshasa'],
}

const DESERT: TerrainMonsterTable = {
  Airborne: ['Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Chimera', 'Chimera', 'Cockatrice', 'Cockatrice', 'Cockatrice', 'Manticore', 'Manticore', 'Manticore', 'Nightmare', 'Roc', 'Roc', 'Sphinx', 'Sphinx', 'Sphinx', 'Sphinx', 'Stirge'],
  Animal: ['Camel', 'Camel', 'Camel', 'Cat, Great', 'Cat, Great', 'Dog', 'Horse', 'Jackal', 'Jackal', 'Jackal', 'Jackal', 'Jackal', 'Rat', 'Rat', 'Rat', 'Rat', 'Snake, Pit Viper', 'Snake, Rock Python', 'Snake, Spitting Cobra', 'Snake, Giant Rattler'],
  Dragon: ['Dragon, Blue', 'Dragon, Blue', 'Dragon, Blue', 'Dragon, Blue', 'Dragon, Brass', 'Dragon, Brass', 'Dragon, Brass', 'Dragon, Brass', 'Dragon, Bronze', 'Dragon, Bronze', 'Dragon, Copper', 'Dragon, Copper', 'Dragon, Gold', 'Dragon, Gold', 'Dragon, Green', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Silver'],
  Giant: ['Giant, Cloud', 'Giant, Cloud', 'Giant, Cloud', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre Mage', 'Ogre Mage', 'Ogre Mage', 'Ogre Mage', 'Ogre Mage', 'Ogre Mage'],
  'Human/Demi-Human': ['Men, Bandit', 'Men, Bandit', 'Men, Bandit', 'Men, Brigand', 'Men, Brigand', 'Men, Brigand', 'Men, Dervish', 'Men, Dervish', 'Men, Dervish', 'Men, Dervish', 'Men, Dervish', 'Men, Nomad', 'Men, Nomad', 'Men, Nomad', 'Men, Nomad', 'Men, Merchant', 'Men, Merchant', 'Wereboar', 'Wererat', 'Werewolf'],
  Humanoid: ['Gnoll', 'Gnoll', 'Gnoll', 'Gnoll', 'Gnoll', 'Gnoll', 'Goblin', 'Troglodyte', 'Troglodyte', 'Hobgoblin', 'Orc', 'Orc', 'Orc', 'Troll', 'Troll', 'Troll', 'Troll', 'Troll', 'Troll', 'Troll'],
  Monster: ['Ankheg', 'Basilisk', 'Lizards, Giant', 'Blink Dog', 'Bulette', 'Basilisk', 'Hellhound', 'Wererat', 'Wererat', 'Naga', 'Naga', 'Lizards, Giant', 'Naga', 'Naga', 'Pseudo-Dragon', 'Pseudo-Dragon', 'Purple Worm', 'Purple Worm', 'Wolf', 'Wolf'],
  NPC: ['Decoys', 'Decoys', 'Decoys', 'Escapees', 'Escapees', 'Escapees', 'Escapees', 'Joiners', 'Joiners', 'Runners', 'Runners', 'Searchers', 'Searchers', 'Searchers', 'Searchers', 'Survivors', 'Wolf', 'Wolf', 'Wolf', 'Wolf'],
  Undead: ['Ghast', 'Ghast', 'Ghoul', 'Ghoul', 'Ghoul', 'Ghoul', 'Ghoul', 'Lich', 'Mummy', 'Mummy', 'Mummy', 'Mummy', 'Mummy', 'Skeleton', 'Vampire', 'Vampire', 'Wight', 'Zombie', 'Zombie', 'Zombie'],
  Invertebrates: ['Ant, Giant', 'Ant, Giant', 'Ant, Giant', 'Ant, Giant', 'Ant, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Fly, Robber', 'Fly, Robber', 'Fly, Robber', 'Scorpion, Giant', 'Spider, Giant', 'Spider, Giant', 'Spider, Giant', 'Wasp, Giant', 'Wasp, Giant'],
  Water: ['Beetle, Giant', 'Beetle, Giant', 'Crayfish, Giant', 'Crocodile', 'Crocodile', 'Crocodile', 'Crocodile', 'Eel', 'Fish, Giant', 'Fish, Giant', 'Hippopotamus', 'Hippopotamus', 'Hippopotamus', 'Naga', 'Spider, Giant', 'Spider, Giant', 'Toad, Giant', 'Toad, Giant', 'Toad, Giant', 'Toad, Giant'],
  Special: ['Bear, Cave', 'Elemental, Air', 'Elemental, Earth', 'Elemental, Earth', 'Elemental, Fire', 'Elemental, Fire', 'Elemental, Water', 'Djinni', 'Djinni', 'Invisible Stalker', 'Salamander', 'Salamander', 'Salamander', 'Salamander', 'Skeleton', 'Night Hag', 'Rakshasa', 'Troll', 'Xorn', 'Xorn'],
}

const JUNGLE: TerrainMonsterTable = {
  Airborne: ['Bat', 'Bat', 'Bat', 'Bat, Giant', 'Bat, Giant', 'Bat, Giant', 'Bat, Giant', 'Bat, Giant', 'Bat, Giant', 'Bat, Giant', 'Flightless Bird', 'Flightless Bird', 'Eagle, Giant', 'Chimera', 'Cockatrice', 'Couatl', 'Couatl', 'Stirge', 'Wyvern', 'Wyvern'],
  Animal: ['Ape', 'Ape', 'Ape', 'Ape', 'Ape', 'Baboon', 'Baboon', 'Elephant', 'Elephant', 'Jackal', 'Jackal', 'Jackal', 'Cat, Great', 'Lizards, Giant', 'Lizards, Giant', 'Rat', 'Rat', 'Rat', 'Cat, Great', 'Cat, Great'],
  Dragon: ['Dragon, Black', 'Dragon, Black', 'Dragon, Bronze', 'Dragon, Bronze', 'Dragon, Green', 'Dragon, Green', 'Dragon, Green', 'Dragon, Green', 'Dragon, Green', 'Dragon, Green', 'Dragon, Green', 'Dragon, Green', 'Dragon, Green', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red'],
  Giant: ['Ettin', 'Ettin', 'Ettin', 'Ettin', 'Ettin', 'Ettin', 'Ettin', 'Ettin', 'Giant, Cloud', 'Giant, Cloud', 'Giant, Fire', 'Giant, Fire', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre Mage', 'Ogre Mage'],
  'Human/Demi-Human': ['Men, Bandit', 'Men, Bandit', 'Men, Brigand', 'Men, Brigand', 'Men, Merchant', 'Men, Merchant', 'Men, Merchant', 'Men, Merchant', 'Men, Merchant', 'Men, Merchant', 'Men, Merchant', 'Stronghold', 'Village', 'Village', 'Wereboar', 'Wereboar', 'Weretiger', 'Weretiger', 'Weretiger', 'Werewolf'],
  Humanoid: ['Gnoll', 'Gnoll', 'Gnoll', 'Troglodyte', 'Troglodyte', 'Hobgoblin', 'Orc', 'Orc', 'Orc', 'Men, Bandit', 'Men, Bandit', 'Men, Bandit', 'Men, Bandit', 'Men, Bandit', 'Men, Bandit', 'Troll', 'Troll', 'Troll', 'Troll', 'Troll'],
  Monster: ['Strangle Weed', 'Strangle Weed', 'Strangle Weed', 'Strangle Weed', 'Ankheg', 'Basilisk', 'Basilisk', 'Blink Dog', 'Blink Dog', 'Phase Panther', 'Phase Panther', 'Lizard Man', 'Lizard Man', 'Lizard Man', 'Basilisk', 'Hellhound', 'Hellhound', 'Rot Grub', 'Rot Grub', 'Wolf'],
  NPC: ['Decoys', 'Decoys', 'Decoys', 'Decoys', 'Escapees', 'Escapees', 'Escapees', 'Escapees', 'Joiners', 'Joiners', 'Runners', 'Runners', 'Searchers', 'Searchers', 'Searchers', 'Searchers', 'Survivors', 'Wolf', 'Wolf', 'Wolf'],
  Undead: ['Shadow', 'Skeleton', 'Skeleton', 'Skeleton', 'Skeleton', 'Zombie', 'Zombie', 'Zombie', 'Zombie', 'Zombie', 'Zombie', 'Zombie', 'Zombie', 'Zombie', 'Zombie', 'Zombie', 'Zombie', 'Zombie', 'Zombie', 'Zombie'],
  Invertebrates: ['Ant, Giant', 'Ant, Giant', 'Ant, Giant', 'Ant, Giant', 'Beetle, Giant', 'Beetle, Giant', 'Beetle, Giant', 'Beetle, Giant', 'Beetle, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Fly, Robber', 'Fly, Robber', 'Fly, Robber', 'Scorpion, Giant', 'Spider, Giant', 'Spider, Giant', 'Spider, Giant', 'Spider, Giant', 'Wasp, Giant'],
  Water: ['Crocodile', 'Crocodile', 'Eel', 'Eel', 'Frog, Giant', 'Frog, Giant', 'Frog, Giant', 'Frog, Giant', 'Frog, Giant', 'Hippopotamus', 'Hippopotamus', 'Nixies', 'Spider, Giant', 'Spider, Giant', 'Toad, Giant', 'Toad, Giant', 'Toad, Giant', 'Toad, Giant', 'Toad, Giant', 'Turtle, Giant'],
  Special: ['Efreeti', 'Hellhound', 'Hellhound', 'Manes', 'Type II Demon (Hezrou)', 'Quasit', 'Type I Demon (Vrock)', 'Succubus', 'Night Hag', 'Barbed Devil', 'Bone Devil', 'Pit Fiend', 'Manticore', 'Doppelganger', 'Elemental, Air', 'Elemental, Earth', 'Elemental, Fire', 'Elemental, Water', 'Djinni', 'Mammoth'],
}

const MARINE: TerrainMonsterTable = {
  Airborne: ['Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Eagle, Giant', 'Eagle, Giant', 'Eagle, Giant', 'Chimera', 'Chimera', 'Chimera', 'Cockatrice', 'Cockatrice', 'Harpy', 'Harpy', 'Manticore', 'Nightmare', 'Wyvern'],
  Animal: ['Ape', 'Boar, Giant', 'Boar', 'Dog', 'Horse', 'Jackal', 'Jackal', 'Lizards, Giant', 'Lizards, Giant', 'Lizards, Giant', 'Lizards, Giant', 'Lizards, Giant', 'Rat', 'Rat', 'Rat', 'Rat', 'Rat', 'Snake, Pit Viper', 'Snake, Pit Viper', 'Snake, Pit Viper'],
  Dragon: ['Dragon, Black', 'Dragon, Black', 'Dragon, Blue', 'Dragon, Brass', 'Dragon, Bronze', 'Dragon, Bronze', 'Dragon, Bronze', 'Dragon, Copper', 'Dragon, Gold', 'Dragon, Gold', 'Dragon, Gold', 'Dragon, Gold', 'Dragon, Green', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Silver'],
  Giant: ['Giant, Cloud', 'Giant, Cloud', 'Giant, Storm', 'Giant, Storm', 'Giant, Storm', 'Giant, Storm', 'Giant, Storm', 'Giant, Storm', 'Giant, Storm', 'Giant, Storm', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre Mage', 'Ogre Mage', 'Ogre Mage'],
  'Human/Demi-Human': ['Fishing Village', 'Men, Bandit', 'Men, Bandit', 'Men, Brigand', 'Men, Buccaneer / Pirate', 'Men, Buccaneer / Pirate', 'Men, Buccaneer / Pirate', 'Men, Merchant', 'Men, Merchant', 'Men, Merchant', 'Men, Merchant', 'Men, Merchant', 'Men, Buccaneer / Pirate', 'Men, Buccaneer / Pirate', 'Men, Buccaneer / Pirate', 'Wereboar', 'Wererat', 'Wererat', 'Weretiger', 'Werewolf'],
  Humanoid: ['Gnoll', 'Gnoll', 'Gnoll', 'Gnoll', 'Goblin', 'Goblin', 'Troglodyte', 'Troglodyte', 'Hobgoblin', 'Hobgoblin', 'Hobgoblin', 'Kobold', 'Orc', 'Orc', 'Orc', 'Troll', 'Troll', 'Troll', 'Troll', 'Troll'],
  Monster: ['Basilisk', 'Lizards, Giant', 'Blink Dog', 'Cat, Great', 'Sahuagin', 'Sahuagin', 'Sahuagin', 'Sahuagin', 'Cyclops', 'Cyclops', 'Cyclops', 'Hellhound', 'Wererat', 'Wererat', 'Lizard Man', 'Lizard Man', 'Lizard Man', 'Pseudo-Dragon', 'Unicorn', 'Wolf'],
  NPC: ['Decoys', 'Decoys', 'Escapees', 'Escapees', 'Escapees', 'Joiners', 'Joiners', 'Joiners', 'Joiners', 'Joiners', 'Joiners', 'Joiners', 'Runners', 'Runners', 'Runners', 'Searchers', 'Searchers', 'Survivors', 'Wolf', 'Wolf'],
  Undead: ['Groaning Spirit', 'Lich', 'Shadow', 'Shadow', 'Skeleton', 'Skeleton', 'Skeleton', 'Skeleton', 'Skeleton', 'Spectre', 'Wight', 'Wight', 'Wight', 'Will-O-Wisp', 'Will-O-Wisp', 'Wraith', 'Zombie', 'Zombie', 'Zombie', 'Zombie'],
  Invertebrates: ['Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Fly, Robber', 'Fly, Robber', 'Fly, Robber', 'Fly, Robber', 'Fly, Robber', 'Fly, Robber', 'Scorpion, Giant', 'Scorpion, Giant', 'Scorpion, Giant', 'Spider, Giant', 'Spider, Giant', 'Spider, Giant', 'Spider, Giant', 'Spider, Giant', 'Wasp, Giant'],
  Water: ['Pike, Giant', 'Crab, Giant', 'Crab, Giant', 'Crab, Giant', 'Crab, Giant', 'Eel', 'Eel', 'Octopus, Giant', 'Locathah', 'Locathah', 'Mermen', 'Mermen', 'Sea Serpent (Lesser)', 'Sea Serpent (Lesser)', 'Shark', 'Shark', 'Shark', 'Triton', 'Turtle, Giant', 'Whale'],
  Special: ['Shadow', 'Quasit', 'Quasit', 'Succubus', 'Succubus', 'Imp', 'Elemental, Water', 'Elemental, Water', 'Elemental, Water', 'Homunculus', 'Invisible Stalker', 'Salamander', 'Salamander', 'Salamander', 'Salamander', 'Night Hag', 'Rakshasa', 'Troll', 'Xorn', 'Xorn'],
}

const MOUNTAINS: TerrainMonsterTable = {
  Airborne: ['Bat', 'Bat', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Eagle, Giant', 'Griffon', 'Griffon', 'Griffon', 'Harpy', 'Harpy', 'Hippogriff', 'Hippogriff', 'Nightmare', 'Pegasus', 'Roc', 'Stirge', 'Stirge', 'Stirge'],
  Animal: ['Bear, Black', 'Bear, Brown', 'Bear, Brown', 'Cat, Great', 'Cat, Great', 'Cat, Great', 'Dog', 'Dog', 'Dog', 'Dog', 'Lizards, Giant', 'Lizards, Giant', 'Rat', 'Rat', 'Rat', 'Rat', 'Rat', 'Snake, Pit Viper', 'Snake, Pit Viper', 'Snake, Pit Viper'],
  Dragon: ['Dragon, Bronze', 'Dragon, Bronze', 'Dragon, Bronze', 'Dragon, Bronze', 'Dragon, Gold', 'Dragon, Gold', 'Dragon, Gold', 'Dragon, Gold', 'Dragon, Green', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Silver', 'Dragon, Silver', 'Dragon, Silver', 'Dragon, Silver'],
  Giant: ['Ettin', 'Giant, Cloud', 'Giant, Cloud', 'Giant, Fire', 'Giant, Fire', 'Giant, Fire', 'Giant, Fire', 'Giant, Hill', 'Giant, Stone', 'Giant, Stone', 'Giant, Stone', 'Giant, Stone', 'Giant, Storm', 'Giant, Storm', 'Ogre', 'Ogre', 'Ogre', 'Ogre Mage', 'Ogre Mage', 'Titan'],
  'Human/Demi-Human': ['Dwarf', 'Dwarf', 'Dwarf', 'Dwarf', 'Dwarf', 'Keep, Small', 'Men, Bandit', 'Men, Bandit', 'Men, Bandit', 'Men, Brigand', 'Men, Brigand', 'Men, Merchant', 'Men, Merchant', 'Men, Merchant', 'Men, Merchant', 'Men, Merchant', 'Village, Mining', 'Werebear', 'Werebear', 'Wereboar'],
  Humanoid: ['Bugbear', 'Bugbear', 'Bugbear', 'Bugbear', 'Goblin', 'Goblin', 'Goblin', 'Goblin', 'Goblin', 'Goblin', 'Troglodyte', 'Troglodyte', 'Hobgoblin', 'Hobgoblin', 'Troll', 'Troll', 'Troll', 'Troll', 'Troll', 'Troll'],
  Monster: ['Cyclops', 'Cyclops', 'Cyclops', 'Cyclops', 'Hellhound', 'Hellhound', 'Wererat', 'Wererat', 'Lizard Man', 'Lizard Man', 'Medusa', 'Medusa', 'Medusa', 'Medusa', 'Rust Monster', 'Rust Monster', 'Unicorn', 'Unicorn', 'Wolf', 'Wolf'],
  NPC: ['Decoys', 'Decoys', 'Decoys', 'Escapees', 'Joiners', 'Joiners', 'Joiners', 'Joiners', 'Runners', 'Searchers', 'Searchers', 'Searchers', 'Searchers', 'Survivors', 'Survivors', 'Survivors', 'Wolf', 'Wolf', 'Wolf', 'Wolf'],
  Undead: ['Ghast', 'Ghost', 'Ghost', 'Ghoul', 'Ghoul', 'Ghoul', 'Lich', 'Lich', 'Skeleton', 'Skeleton', 'Skeleton', 'Skeleton', 'Vampire', 'Vampire', 'Vampire', 'Wraith', 'Wraith', 'Wraith', 'Zombie', 'Zombie'],
  Invertebrates: ['Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Fly, Robber', 'Fly, Robber', 'Fly, Robber', 'Scorpion, Giant', 'Scorpion, Giant', 'Spider, Giant', 'Spider, Giant', 'Spider, Giant', 'Spider, Giant', 'Spider, Giant', 'Spider, Giant', 'Spider, Giant', 'Wasp, Giant', 'Wasp, Giant'],
  Water: ['Beetle, Giant', 'Beetle, Giant', 'Beetle, Giant', 'Beetle, Giant', 'Frog, Giant', 'Frog, Giant', 'Frog, Giant', 'Frog, Giant', 'Naga', 'Nixies', 'Nixies', 'Nixies', 'Nixies', 'Toad, Giant', 'Toad, Giant', 'Toad, Giant', 'Toad, Giant', 'Toad, Giant', 'Toad, Giant', 'Turtle, Giant'],
  Special: ['Type VI Demon (Balor)', 'Quasit', 'Quasit', 'Bone Devil', 'Ice Devil', 'Imp', 'Imp', 'Doppelganger', 'Elemental, Air', 'Elemental, Earth', 'Elemental, Earth', 'Elemental, Earth', 'Elemental, Fire', 'Elemental, Water', 'Night Hag', 'Goblin', 'Rakshasa', 'Sabre-Tooth Tiger', 'Troll', 'Xorn'],
}

const PLAINS: TerrainMonsterTable = {
  Airborne: ['Bat', 'Bat, Giant', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Eagle, Giant', 'Eagle, Giant', 'Shedu', 'Sphinx', 'Sphinx', 'Sphinx', 'Sphinx', 'Stirge', 'Stirge', 'Wyvern', 'Wyvern', 'Wyvern'],
  Animal: ['Buffalo', 'Buffalo', 'Bull', 'Cattle', 'Horse', 'Horse', 'Horse', 'Horse', 'Horse', 'Horse', 'Hyena', 'Hyena', 'Cat, Great', 'Rhinoceros', 'Rhinoceros', 'Snake, Pit Viper', 'Snake, Rock Python', 'Snake, Spitting Cobra', 'Snake, Giant Rattler', 'Cat, Great'],
  Dragon: ['Dragon, Black', 'Dragon, Blue', 'Dragon, Blue', 'Dragon, Brass', 'Dragon, Bronze', 'Dragon, Bronze', 'Dragon, Copper', 'Dragon, Gold', 'Dragon, Gold', 'Dragon, Green', 'Dragon, Green', 'Dragon, Green', 'Dragon, Green', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Silver'],
  Giant: ['Ettin', 'Ettin', 'Ettin', 'Ettin', 'Ettin', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre Mage', 'Titan'],
  'Human/Demi-Human': ['Halfling', 'Halfling', 'Halfling', 'Halfling', 'Halfling', 'Men, Bandit', 'Men, Bandit', 'Men, Brigand', 'Men, Brigand', 'Men, Merchant', 'Men, Merchant', 'Men, Merchant', 'Men, Merchant', 'Men, Nomad', 'Men, Nomad', 'Men, Nomad', 'Men, Nomad', 'Men, Merchant', "Wizard's Tower", 'Village, Farming'],
  Humanoid: ['Gnoll', 'Gnoll', 'Gnoll', 'Goblin', 'Goblin', 'Goblin', 'Goblin', 'Troglodyte', 'Troglodyte', 'Hobgoblin', 'Kobold', 'Kobold', 'Kobold', 'Orc', 'Orc', 'Orc', 'Troll', 'Troll', 'Troll', 'Troll'],
  Monster: ['Ankheg', 'Ankheg', 'Ankheg', 'Ankheg', 'Basilisk', 'Blink Dog', 'Blink Dog', 'Bulette', 'Bulette', 'Centaur', 'Centaur', 'Centaur', 'Wererat', 'Owl Bear', 'Pseudo-Dragon', 'Purple Worm', 'Purple Worm', 'Purple Worm', 'Purple Worm', 'Wolf'],
  NPC: ['Decoys', 'Decoys', 'Escapees', 'Escapees', 'Joiners', 'Joiners', 'Joiners', 'Joiners', 'Joiners', 'Runners', 'Runners', 'Searchers', 'Searchers', 'Searchers', 'Survivors', 'Survivors', 'Survivors', 'Survivors', 'Wolf', 'Wolf'],
  Undead: ['Groaning Spirit', 'Ghast', 'Ghost', 'Ghost', 'Ghoul', 'Ghoul', 'Lich', 'Mummy', 'Skeleton', 'Skeleton', 'Skeleton', 'Skeleton', 'Skeleton', 'Spectre', 'Vampire', 'Wight', 'Wraith', 'Zombie', 'Zombie', 'Zombie'],
  Invertebrates: ['Beetle, Giant', 'Beetle, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Fly, Robber', 'Fly, Robber', 'Fly, Robber', 'Fly, Robber', 'Scorpion, Giant', 'Scorpion, Giant', 'Scorpion, Giant', 'Spider, Giant', 'Spider, Giant', 'Spider, Giant', 'Spider, Giant', 'Wasp, Giant', 'Wasp, Giant', 'Wasp, Giant'],
  Water: ['Beetle, Giant', 'Beetle, Giant', 'Beetle, Giant', 'Crayfish, Giant', 'Crayfish, Giant', 'Crocodile', 'Crocodile', 'Eel', 'Eel', 'Fish, Giant', 'Fish, Giant', 'Frog, Giant', 'Frog, Giant', 'Nixies', 'Nixies', 'Spider, Giant', 'Spider, Giant', 'Toad, Giant', 'Toad, Giant', 'Toad, Giant'],
  Special: ['Efreeti', 'Ape', 'Hellhound', 'Type II Demon (Hezrou)', 'Type I Demon (Vrock)', 'Succubus', 'Erinyes', 'Imp', 'Lemure', 'Barbed Devil', 'Bone Devil', 'Bone Devil', 'Barbed Devil', 'Dragon, White', 'Elemental, Earth', 'Golem', 'Imp', 'Goblin', 'Peryton', 'Megalosaurus'],
}

// Wilderness Encounter Level (lines 854-858): the hex's Danger Level determines which die size
// rolls down each terrain table's column — a low-Danger hex only ever reaches the earlier, tamer
// rows (the book's own ordering, weakest to strongest); a Danger Level 7+ hex is "exposed to the
// full table, rare and legendary entries included."
// Hills (added 2026-11-02 for punch-list item 1a, which adds a Hills terrain). Transcribed
// verbatim from the same source section's "Hills" tables. Exported but not yet used: it gets
// wired into TERRAIN_MONSTER_TABLES when the Hills terrain is added to the Terrain type.
export const HILLS: TerrainMonsterTable = {
  Airborne: ['Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Flightless Bird', 'Eagle, Giant', 'Chimera', 'Cockatrice', 'Griffon', 'Harpy', 'Harpy', 'Harpy', 'Nightmare', 'Pegasus', 'Pixie', 'Shedu', 'Stirge', 'Stirge', 'Stirge', 'Wyvern'],
  Animal: ['Cat, Great', 'Cat, Great', 'Dog', 'Dog', 'Horse', 'Rat', 'Rat', 'Rat', 'Rat', 'Rat', 'Snake, Pit Viper', 'Snake, Pit Viper', 'Snake, Rock Python', 'Snake, Spitting Cobra', 'Snake, Giant Rattler', 'Wolf', 'Wolf', 'Wolf', 'Wolf', 'Wolverine'],
  Dragon: ['Dragon, Black', 'Dragon, Bronze', 'Dragon, Bronze', 'Dragon, Bronze', 'Dragon, Bronze', 'Dragon, Gold', 'Dragon, Green', 'Dragon, Green', 'Dragon, Green', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Red', 'Dragon, Silver'],
  Giant: ['Ettin', 'Ettin', 'Ettin', 'Ettin', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Giant, Hill', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre', 'Ogre Mage', 'Ogre Mage', 'Titan', 'Titan'],
  'Human/Demi-Human': ['Elf', 'Halfling', 'Halfling', 'Halfling', 'Halfling', 'Halfling', 'Hamlet', 'Men, Bandit', 'Men, Bandit', 'Men, Bandit', 'Men, Brigand', 'Men, Merchant', 'Men, Merchant', 'Men, Merchant', 'Stronghold', 'Men, Merchant', 'Wereboar', 'Wererat', 'Werewolf', 'Werewolf'],
  Humanoid: ['Bugbear', 'Bugbear', 'Bugbear', 'Bugbear', 'Troglodyte', 'Troglodyte', 'Hobgoblin', 'Hobgoblin', 'Hobgoblin', 'Kobold', 'Kobold', 'Orc', 'Orc', 'Troll', 'Troll', 'Troll', 'Troll', 'Troll', 'Troll', 'Troll'],
  Monster: ['Basilisk', 'Lizards, Giant', 'Blink Dog', 'Cat, Great', 'Phase Panther', 'Basilisk', 'Leprechaun', 'Leprechaun', 'Lizard Man', 'Lizard Man', 'Medusa', 'Minotaur', 'Naga', 'Owl Bear', 'Owl Bear', 'Pseudo-Dragon', 'Rust Monster', 'Treant', 'Unicorn', 'Wolf'],
  NPC: ['Decoys', 'Decoys', 'Decoys', 'Escapees', 'Escapees', 'Escapees', 'Escapees', 'Escapees', 'Joiners', 'Joiners', 'Joiners', 'Joiners', 'Runners', 'Runners', 'Runners', 'Searchers', 'Searchers', 'Survivors', 'Wolf', 'Wolf'],
  Undead: ['Groaning Spirit', 'Ghast', 'Ghost', 'Ghoul', 'Ghoul', 'Ghoul', 'Lich', 'Shadow', 'Shadow', 'Skeleton', 'Skeleton', 'Skeleton', 'Skeleton', 'Spectre', 'Vampire', 'Vampire', 'Wraith', 'Zombie', 'Zombie', 'Zombie'],
  Invertebrates: ['Ant, Giant', 'Ant, Giant', 'Ant, Giant', 'Ant, Giant', 'Ant, Giant', 'Ant, Giant', 'Beetle, Giant', 'Beetle, Giant', 'Beetle, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Centipede, Giant', 'Fly, Robber', 'Fly, Robber', 'Scorpion, Giant', 'Spider, Giant', 'Spider, Giant', 'Spider, Giant', 'Spider, Giant', 'Wasp, Giant'],
  Water: ['Crayfish, Giant', 'Crayfish, Giant', 'Crayfish, Giant', 'Crocodile', 'Crocodile', 'Crocodile', 'Crocodile', 'Eel', 'Fish, Giant', 'Fish, Giant', 'Sea Serpent (Lesser)', 'Frog, Giant', 'Frog, Giant', 'Nixies', 'Nixies', 'Spider, Giant', 'Spider, Giant', 'Toad, Giant', 'Toad, Giant', 'Toad, Giant'],
  Special: ['Hellhound', 'Hellhound', 'Type II Demon (Hezrou)', 'Succubus', 'Bone Devil', 'Barbed Devil', 'Barbed Devil', 'Doppelganger', 'Elemental, Air', 'Elemental, Earth', 'Elemental, Fire', 'Elemental, Water', 'Djinni', 'Golem', 'Golem', 'Homunculus', 'Berserker', 'Goblin', 'Rakshasa', 'Xorn'],
}

export function wildernessEncounterLevelDie(hexDangerLevel: number): 8 | 14 | 20 {
  if (hexDangerLevel <= 3) return 8
  if (hexDangerLevel <= 6) return 14
  return 20
}

const TERRAIN_MONSTER_TABLES: Record<Terrain, TerrainMonsterTable> = {
  Grassland: PLAINS,
  'Forest/jungle': JUNGLE,
  'River/coast': AQUATIC,
  Ocean: MARINE,
  Mountain: MOUNTAINS,
  'Desert/arctic': DESERT,
  // Wetlands (Swamp's OSR counterpart) has no dedicated table in the source — reuses Marine, per
  // the book's own "treat as Rural or Marine, DM's choice" fallback (see header comment).
  Swamp: MARINE,
}

export function wildernessMonsterNameForRoll(terrain: Terrain, category: WildernessEncounterCategory, roll: number): string {
  if (roll < 1 || roll > 20) throw new Error(`wildernessMonsterNameForRoll: roll out of range: ${roll}`)
  return TERRAIN_MONSTER_TABLES[terrain][category][roll - 1]
}
