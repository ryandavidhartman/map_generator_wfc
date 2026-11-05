// Rift content tables — house-rule content (not book RAW), confirmed 2026-07-04 as part of
// the Location Generator expansion (see docs/plan-sites-settlements-mongo.md's "Location
// Generator" section for the full design conversation). Original content specified directly
// by the user, table entry by table entry — same provenance as shrineTables.ts.

// Origin entries are short enough to be flat strings — entry 1's "pick or roll again"
// sub-instruction is folded directly into its own label rather than needing a separate note
// field only one entry would use.
export type RiftOrigin =
  | 'Elemental (fire/water/air/earth — pick or roll again)'
  | 'Shadow/Void'
  | 'Feywild'
  | 'Abyss/Infernal'
  | 'Astral'
  | 'Far Realm / aberrant'

const RIFT_ORIGINS: RiftOrigin[] = ['Elemental (fire/water/air/earth — pick or roll again)', 'Shadow/Void', 'Feywild', 'Abyss/Infernal', 'Astral', 'Far Realm / aberrant']

export function riftOriginForD6(roll: number): RiftOrigin {
  if (roll < 1 || roll > 6) throw new Error(`riftOriginForD6: roll out of range: ${roll}`)
  return RIFT_ORIGINS[roll - 1]
}

export type RiftEffect = 'Terrain warps' | 'Color/life drains' | 'Hallucination/whispers' | 'Temperature extreme' | 'Gravity anomaly' | 'Time distortion'

export type RiftEffectEntry = { effect: RiftEffect; note: string }

const RIFT_EFFECTS: RiftEffectEntry[] = [
  { effect: 'Terrain warps', note: "Ground shifts, plants mutate, geometry doesn't stay put" },
  { effect: 'Color/life drains', note: 'Grey, muffled, draining vitality from anything nearby' },
  { effect: 'Hallucination/whispers', note: 'Sanity-fraying, not directly harmful' },
  { effect: 'Temperature extreme', note: 'Searing heat or killing cold radiating outward' },
  { effect: 'Gravity anomaly', note: 'Objects/creatures drift, fall wrong, float' },
  { effect: 'Time distortion', note: 'Motion stutters, echoes of past/future moments repeat' },
]

export function riftEffectForD6(roll: number): RiftEffectEntry {
  if (roll < 1 || roll > 6) throw new Error(`riftEffectForD6: roll out of range: ${roll}`)
  return RIFT_EFFECTS[roll - 1]
}

export type RiftStability = 'Stable' | 'Growing' | 'Pulsing/unstable' | 'Collapsing'

export type RiftStabilityEntry = { stability: RiftStability; note: string }

const RIFT_STABILITIES: RiftStabilityEntry[] = [
  { stability: 'Stable', note: 'Has been this way for years, no urgency' },
  { stability: 'Growing', note: 'Expanding slowly, will matter later if ignored' },
  { stability: 'Pulsing/unstable', note: 'Intermittently surges (effect intensifies on a timer)' },
  { stability: 'Collapsing', note: 'Actively closing, this is a limited-time encounter' },
]

export function riftStabilityForD4(roll: number): RiftStabilityEntry {
  if (roll < 1 || roll > 4) throw new Error(`riftStabilityForD4: roll out of range: ${roll}`)
  return RIFT_STABILITIES[roll - 1]
}
