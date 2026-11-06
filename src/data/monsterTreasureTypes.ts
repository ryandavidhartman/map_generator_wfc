// Per-monster Treasure Type letter, cross-referenced from each creature's own stat-block entry in
// combined-monsters.md (its "Treasure Type" field — see
// that file's `## Explanations` section: "gives the letter code used to determine the treasure
// associated with a monster, as described on the Treasure Types table"). Covers every distinct
// monster name that appears in dungeonMonsterLevelTables.ts and wildernessMonsterLevelTables.ts —
// kept as a separate name-keyed lookup rather than a field threaded through those two (already
// large) table files, so neither needed restructuring for this.
//
// Values are the RAW stat-block string, not just a single letter — several are compound (e.g.
// "Q x3, S": roll Q three times and S once) or carry a flat bonus / parenthetical note the
// Treasure Types table itself can't express (e.g. "C + 1000 gp", "R (C)", "in lair", "special").
// treasureTypeTables.ts's parseTreasureTypeLetters() extracts and rolls just the recognizable
// letter tokens; anything else in the string is intentionally left unparsed — display the raw
// string to the GM regardless of what mechanically resolves. Two entries (Xorn: "...X", Will-O-
// Wisp: "Z") reference letters outside the standard A-V range documented in Appendix B — both are
// conversion-source entries whose own treasure-type letters weren't reconciled with
// OSR's Appendix B table by the compilation itself; kept verbatim rather than guessed at, and
// simply don't parse to a roll (X/Z fall outside parseTreasureTypeLetters' A-V pattern).
//
// A handful of entries needed a documented judgment call, not a direct 1:1 heading match:
// - "Ape", "Baboon", "Beetle, Giant", "Eel", "Lizards, Giant", "Naga", "Rat", "Salamander",
//   "Sphinx", "Whale": the source heading covers multiple named sub-variants (e.g. Rat's own
//   table has separate Normal/Giant columns) with genuinely different Treasure Types, but this
//   project's own table entries use the bare species name with no sub-variant specified — the
//   FIRST listed column's value is used as the default, consistently.
// - "Bear, Brown": the source's own Bear entry has Black/Grizzly/Polar/Dire columns, no "Brown" —
//   mapped to Grizzly (real-world brown bears are grizzlies), same "closest match" latitude this
//   project already grants terrain mapping elsewhere.
// - "Dragon, Brass/Bronze/Copper/Silver": the source's own Dragon entry only lists White/Black/
//   Green/Blue/Red/Gold columns (all six share Treasure Type H) — Brass/Bronze/Copper/Silver have
//   no dedicated entry in this compilation at all; H is applied to them too as a well-supported
//   extrapolation (every listed dragon color already shares the same type), not a guess.
// - "Men, Bandit": the source's own "Men" entry covers Brigand/Buccaneer/Dervish/Merchant/Nomad
//   only — Bandit is its own separate top-level NPC entry, used directly instead.
const MONSTER_TREASURE_TYPES: Record<string, string> = {
  'Ankheg': 'C',
  'Ant, Giant': 'Q x3, S',
  'Ape': 'Nil',
  'Baboon': 'Nil',
  'Barbed Devil': 'Nil',
  'Basilisk': 'F',
  'Bat': 'Nil',
  'Bat, Giant': 'Nil',
  'Bear, Black': 'U',
  'Bear, Brown': 'U',
  'Bear, Cave': 'V',
  'Beetle, Giant': 'Nil',
  'Blink Dog': 'C',
  'Boar': 'Nil',
  'Boar, Giant': 'Nil',
  'Bone Devil': 'Nil',
  'Buffalo': 'Nil',
  'Bugbear': 'B',
  'Bulette': 'Nil',
  'Bull': 'Nil',
  'Camel': 'Nil',
  'Cat, Great': 'U',
  'Cattle': 'Nil',
  'Centaur': 'A',
  'Centipede, Giant': 'Nil',
  'Chimera': 'F',
  'Cockatrice': 'D',
  'Couatl': 'B, I',
  'Crab, Giant': 'Nil',
  'Crayfish, Giant': 'Nil',
  'Crocodile': 'Nil',
  'Cyclops': 'E + 5000 gp',
  'Djinni': 'Nil',
  'Dog': 'Nil',
  'Doppelganger': 'E',
  'Dragon Turtle': 'H',
  'Dragon, Black': 'H',
  'Dragon, Blue': 'H',
  'Dragon, Brass': 'H',
  'Dragon, Bronze': 'H',
  'Dragon, Copper': 'H',
  'Dragon, Gold': 'H',
  'Dragon, Green': 'H',
  'Dragon, Red': 'H',
  'Dragon, Silver': 'H',
  'Dragon, White': 'H',
  'Dwarf': 'G',
  'Eagle, Giant': 'Q, C magic only',
  'Eel': 'Nil',
  'Efreeti': 'Nil',
  'Elemental, Air': 'Nil',
  'Elemental, Earth': 'Nil',
  'Elemental, Fire': 'Nil',
  'Elemental, Water': 'Nil',
  'Elephant': 'See below',
  'Elf': 'E',
  'Ettin': 'O; C, Y in lair',
  'Fish, Giant': 'Nil',
  'Flightless Bird': 'Nil',
  'Fly, Robber': 'U',
  'Frog, Giant': 'Nil',
  'Ghast': 'B, Q, R, S, T',
  'Ghost': 'E, S',
  'Ghoul': 'B',
  'Giant, Cloud': 'E + 5000 gp',
  'Giant, Fire': 'E + 5000 gp',
  'Giant, Hill': 'E + 5000 gp',
  'Giant, Stone': 'E + 5000 gp',
  'Giant, Storm': 'E + 5000 gp',
  'Gnoll': 'D',
  'Gnome': 'C',
  'Goblin': 'R (C)',
  'Griffon': 'E',
  'Groaning Spirit': 'D',
  'Halfling': 'V (or B)',
  'Harpy': 'C weapon + special',
  'Hellhound': 'C',
  'Hippogriff': 'Nil',
  'Hippopotamus': 'Nil',
  'Hobgoblin': 'D',
  'Homunculus': 'Nil',
  'Horse': 'Nil',
  'Hyena': 'Nil',
  'Ice Devil': 'Q, R',
  'Imp': 'Nil',
  'Invisible Stalker': 'Nil',
  'Jackal': 'Nil',
  'Kobold': 'P (J)',
  'Lich': 'A',
  'Lizard Man': 'D',
  'Lizards, Giant': 'U',
  'Locathah': 'A',
  'Mammoth': 'Nil',
  'Manes': 'Nil',
  'Manticore': 'D',
  'Medusa': 'F special',
  'Men, Bandit': 'U (A)',
  'Men, Brigand': 'A',
  'Men, Buccaneer / Pirate': 'A',
  'Men, Dervish': 'A',
  'Men, Merchant': 'A',
  'Men, Nomad': 'A',
  'Mermen': 'A',
  'Mummy': 'D',
  'Naga': 'H',
  'Night Hag': 'A',
  'Nightmare': 'Nil',
  'Nixies': 'B',
  'Octopus, Giant': 'Nil',
  'Ogre': 'C + 1000 gp',
  'Ogre Mage': 'G',
  'Orc': 'D',
  'Owl Bear': 'C',
  'Pegasus': 'Nil',
  'Phase Panther': 'D',
  'Pike, Giant': 'Nil',
  'Pit Fiend': 'J, R',
  'Pixie': 'R + S',
  'Pseudo-Dragon': 'Nil',
  'Purple Worm': 'D',
  'Quasit': 'Nil',
  'Rakshasa': 'F',
  'Rat': 'L',
  'Rhinoceros': 'Nil',
  'Roc': 'I',
  'Rot Grub': 'Nil',
  'Rust Monster': 'Nil',
  'Sabre-Tooth Tiger': 'V',
  'Sahuagin': 'A',
  'Salamander': 'F',
  'Scorpion, Giant': 'V',
  'Sea Serpent (Lesser)': 'Nil',
  'Shadow': 'F',
  'Shark': 'Nil',
  'Shedu': 'Nil',
  'Skeleton': 'Nil',
  'Snake, Giant Rattler': 'U',
  'Snake, Pit Viper': 'Nil',
  'Snake, Rock Python': 'U',
  'Snake, Spitting Cobra': 'Nil',
  'Spectre': 'E',
  'Sphinx': 'R',
  'Spider, Giant': 'U',
  'Stirge': 'L',
  'Strangle Weed': 'Nil',
  'Succubus': 'I, Q',
  'Termite, Water': 'Nil',
  'Titan': 'E, Q, R, S, T',
  'Toad, Giant': 'Nil',
  'Triton': 'A',
  'Troglodyte': 'A',
  'Troll': 'C + 1000 gp',
  'Turtle, Giant': 'Nil',
  'Type I Demon (Vrock)': 'B',
  'Type II Demon (Hezrou)': 'C',
  'Type IV Demon (Nalfeshnee)': 'E',
  'Type VI Demon (Balor)': 'F',
  'Unicorn': 'Nil',
  'Vampire': 'F',
  'Wasp, Giant': 'Nil',
  'Werebear': 'C',
  'Wereboar': 'C',
  'Wererat': 'C',
  'Weretiger': 'C',
  'Werewolf': 'C',
  'Whale': 'V',
  'Wight': 'B',
  'Will-O-Wisp': 'Z',
  'Wolf': 'Nil',
  'Wraith': 'E',
  'Wyvern': 'E',
  'Xorn': 'O, P, Q, X',
  'Zombie': 'Nil',
}

// Returns the monster's raw Treasure Type string, or undefined if this name has no known mapping
// (e.g. a Dragon sub-table's "2x Dragon, Black" combined notation, or a name not yet covered by
// the tables above). 'Nil' is returned as-is (a real book value meaning "no Treasure Type") rather
// than filtered out — callers should treat 'Nil' as "nothing to roll," same as any other raw value
// parseTreasureTypeLetters can't extract a letter from.
export function monsterTreasureType(name: string): string | undefined {
  return MONSTER_TREASURE_TYPES[name]
}
