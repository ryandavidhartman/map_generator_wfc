// Shrine content tables — house-rule content (not book RAW), confirmed 2026-07-04 as part of
// the Location Generator expansion (see docs/plan-sites-settlements-mongo.md's "Location
// Generator" section for the full design conversation). Unlike monsterTables.ts, there's no
// source document to transcribe from — this is original content the user specified directly,
// table entry by table entry, rather than something to invent or approximate.

export type Disposition = 'Hostile' | 'Wary' | 'Testing' | 'Indifferent' | 'Helpful' | 'Desperate'

export type DispositionEntry = { disposition: Disposition; note: string }

const DISPOSITIONS: DispositionEntry[] = [
  { disposition: 'Hostile', note: 'Attacks or expels on sight; core feature is a fight, not a conversation' },
  { disposition: 'Wary', note: 'Withholds help/info until tested or bribed; needs to be won over' },
  { disposition: 'Testing', note: 'Poses a riddle, task, or trial before revealing anything useful' },
  { disposition: 'Indifferent', note: "Won't help unprompted, but won't stop the party either — pure obstacle-free flavor" },
  { disposition: 'Helpful', note: 'Gives aid, info, or a boon freely, possibly with a minor cost or warning' },
  { disposition: 'Desperate', note: 'Needs something from the party first (rescue, an item, a message) before it can help back' },
]

export function dispositionForD6(roll: number): DispositionEntry {
  if (roll < 1 || roll > 6) throw new Error(`dispositionForD6: roll out of range: ${roll}`)
  return DISPOSITIONS[roll - 1]
}

export type ApproachFeatureType = 'Guardian beast' | 'Warning totem/marker' | 'Blessed/cursed threshold' | 'Offering pile' | 'False lead' | 'Physical obstacle'

export type ApproachFeatureEntry = { feature: ApproachFeatureType; note: string }

const APPROACH_FEATURES: ApproachFeatureEntry[] = [
  { feature: 'Guardian beast', note: "A creature bound to the site, not necessarily hostile — its stance is independent of the core NPC's Disposition" },
  { feature: 'Warning totem/marker', note: 'Old sign, carved ward, or bones warning off intruders — pure atmosphere, no mechanical gate' },
  { feature: 'Blessed/cursed threshold', note: 'Crossing it triggers a minor effect (blessing, ward, curse) before the core is even reached' },
  { feature: 'Offering pile', note: 'Left by past visitors — can be looted (with consequence) or added to (for favor)' },
  { feature: 'False lead', note: "A decoy — something that looks like the core feature but isn't (a second altar, an empty niche)" },
  { feature: 'Physical obstacle', note: 'Narrow crossing, collapsed step, locked gate — a small non-combat challenge, not a monster' },
]

// Duplicates are allowed by design (confirmed) — e.g. two "Warning totem" rolls on a 3-feature
// Shrine reads as a stronger signal, not a bug. No dedup/reroll logic here on purpose.
export function approachFeatureForD6(roll: number): ApproachFeatureEntry {
  if (roll < 1 || roll > 6) throw new Error(`approachFeatureForD6: roll out of range: ${roll}`)
  return APPROACH_FEATURES[roll - 1]
}
