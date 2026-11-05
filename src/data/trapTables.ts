// Transcribed from the Basic Fantasy compilation's (core rules + Field Guide) Appendix D: The Encounter Builder — "Random Trap
// Generation" (a 50-entry d% table, 2 rolls per entry). Source text:
// docs/osr-appendix-cde-source.txt, ~lines 2533-2567.
//
// Additive to the core rules' existing Trap Room Type, not a replacement — the existing 2-word
// flavor tag (dungeonTables.ts's TRAP_COLUMN_A/B, e.g. "Hidden Snare") stays; this supplies
// a concrete named mechanism plus a severity tier. See docs/plan-osr-integration.md,
// Phase 2.

const RANDOM_TRAPS: string[] = [
  'acid spray',
  'bolt, crossbow',
  'bridge, collapsing',
  'bridge, illusory',
  'caltrops drop from ceiling',
  'ceiling block drops behind players',
  'ceiling block drops in front of and behind players',
  'ceiling block drops in front of players',
  'ceiling block drops on players',
  'ceiling block seals players in room or area',
  'elevator room',
  'elevator room, deactivates for 24 hours',
  'elevator room, one way',
  'falling door',
  'flame jets',
  'flooding room',
  'gas, blinding',
  'gas, fear',
  'gas, flammable',
  'gas, sleep',
  'gas, slowing',
  'greased chute',
  'lightning bolt',
  'log trap, swinging',
  'obscuring fog',
  'oil-filled pit with dropping lit torch',
  'pit trap triggered by false door',
  'pit with dropping ceiling block',
  'pit with locking trap door',
  'pit, 10 ft',
  'poisoned bolt, crossbow',
  'poisoned caltrops',
  'poisoned spear, ballista',
  'poisoned spike pit',
  'portcullis drops behind players',
  'portcullises drop in front of and behind players',
  'portcullis drops in front of players',
  'rolling stone ball, height and width of corridor',
  'scything blade, ankle-high',
  'scything blade, neck-high',
  'sliding room changes facing or location',
  'spear, ballista',
  'spiked log trap',
  'spiked pit',
  'spring-loaded pile-driver disguised as a door',
  'stairs fold flat into a sliding chute',
  'stairs collapse',
  'teleporter',
  'trip wire',
  'wire, neck high',
]

// d% table, 2 rolls per entry (01-02, 03-04, ... 99-00) — a plain d50 works just as well since
// every entry spans exactly 2 percentile values; expose it as a d% lookup to match the book's
// own framing (matters if a GM wants to cross-reference the printed ranges directly).
export function randomTrapForD100(roll: number): string {
  if (roll < 1 || roll > 100) throw new Error(`randomTrapForD100: roll out of range: ${roll}`)
  const index = Math.ceil(roll / 2) - 1
  return RANDOM_TRAPS[index]
}

// Severity tiers (Nuisance/Hazardous/Dangerous/Fatal) — the book gives no formal roll for
// these, only DM guidance ("a trap on the first dungeon level ... should be a nuisance ... the
// sixteenth level ... should be fatal"). Derived deterministically from dungeon level here,
// mirroring dungeonTables.ts's dungeonLevelBandForDanger, using that same worked example as
// the endpoints.
export type TrapSeverity = 'Nuisance' | 'Hazardous' | 'Dangerous' | 'Fatal'

export function trapSeverityForDungeonLevel(dungeonLevel: number): TrapSeverity {
  if (dungeonLevel <= 4) return 'Nuisance'
  if (dungeonLevel <= 8) return 'Hazardous'
  if (dungeonLevel <= 12) return 'Dangerous'
  return 'Fatal'
}
