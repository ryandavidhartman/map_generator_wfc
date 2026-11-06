// Transcribed from the Basic Fantasy compilation's (core rules + Field Guide) Appendix C: Random Encounters — "Castle Encounters"
// (docs/osr-appendix-cde-source.txt, ~lines 1904-1927). OSR integration, round 2, Phase 3
// — see docs/plan-osr-integration.md. Wired to this project's Keep site kind only (the
// book's "castle" is exactly what Keep already models: a fortified compound with a lord and a
// garrison) — Tower/Camp/Shrine/Rift/dungeon-shaped sites don't have an owner-with-a-reaction
// concept and are unaffected.
//
// The book gives no odds for which class owns a given castle — elves/dwarves/halflings are
// explicitly excluded ("their strongholds are special cases the DM should detail individually"),
// leaving only Fighter/Magic-User/Cleric. Picked uniformly here (1d3), a documented house-rule
// choice, same latitude as this project's other "book gives no die, DM's choice" gaps (e.g.
// Camp's central-feature placeholder).

export type CastleOwnerClass = 'Fighter' | 'Magic-User' | 'Cleric'
export type CastleReaction = 'Pursue' | 'Ignore' | 'Friendly'

const CASTLE_OWNER_CLASSES: CastleOwnerClass[] = ['Fighter', 'Magic-User', 'Cleric']

export function castleOwnerClassForD3(roll: number): CastleOwnerClass {
  if (roll < 1 || roll > 3) throw new Error(`castleOwnerClassForD3: roll out of range: ${roll}`)
  return CASTLE_OWNER_CLASSES[roll - 1]
}

export type LevelRange = { min: number; max: number }

const CASTLE_OWNER_LEVEL_RANGES: Record<CastleOwnerClass, LevelRange> = {
  Fighter: { min: 9, max: 14 },
  'Magic-User': { min: 11, max: 14 },
  Cleric: { min: 7, max: 14 },
}

export function castleOwnerLevelRangeForClass(ownerClass: CastleOwnerClass): LevelRange {
  return CASTLE_OWNER_LEVEL_RANGES[ownerClass]
}

// "Patrol" per the book's own table — a flavor description of part of the garrison, not the
// owner's full forces ("the rest of the garrison may include other troop types, or even special
// creatures"). Kept as the book's literal "2-12" range wording rather than converted to dice
// notation, since the source table doesn't give it as a formula either.
const CASTLE_PATROLS: Record<CastleOwnerClass, string> = {
  Fighter: '2-12 heavy horsemen',
  'Magic-User': '2-12 heavy footmen',
  Cleric: '2-12 medium horsemen',
}

export function castlePatrolForClass(ownerClass: CastleOwnerClass): string {
  return CASTLE_PATROLS[ownerClass]
}

// Reaction (1d6), verbatim per-class ranges from the book's own table.
const CASTLE_REACTIONS: Record<CastleOwnerClass, [number, number, CastleReaction][]> = {
  Fighter: [
    [1, 3, 'Pursue'],
    [4, 5, 'Ignore'],
    [6, 6, 'Friendly'],
  ],
  'Magic-User': [
    [1, 1, 'Pursue'],
    [2, 5, 'Ignore'],
    [6, 6, 'Friendly'],
  ],
  Cleric: [
    [1, 2, 'Pursue'],
    [3, 4, 'Ignore'],
    [5, 6, 'Friendly'],
  ],
}

export function castleReactionForClass(ownerClass: CastleOwnerClass, roll: number): CastleReaction {
  const row = CASTLE_REACTIONS[ownerClass].find(([lo, hi]) => roll >= lo && roll <= hi)
  if (!row) throw new Error(`castleReactionForClass: roll out of range: ${roll}`)
  return row[2]
}
