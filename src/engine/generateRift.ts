// Rift: a new site kind (house-rule extension, not book RAW), confirmed 2026-07-04 as part of
// expanding the overland Points of Interest table into a d200 "Location Generator" — see
// docs/plan-sites-settlements-mongo.md's "Location Generator" section for the full design
// conversation and routing table. Rift is the lightest of the 5 new kinds: no feature count,
// no topology, no monster population — three independent small rolls (Origin/Effect/Stability)
// combine into the rift's identity, and the rift itself is unambiguously the only thing there
// is to find, so there's no separate objective flag to compute.

import { rollDie, type Rng } from './dice'
import { riftOriginForD6, riftEffectForD6, riftStabilityForD4, type RiftOrigin, type RiftEffect, type RiftStability } from '../data/riftTables'

export type RiftSite = {
  kind: 'rift'
  origin: RiftOrigin
  effect: RiftEffect
  effectNote: string
  stability: RiftStability
  stabilityNote: string
}

export function generateRiftSite(rng: Rng = Math.random): RiftSite {
  const origin = riftOriginForD6(rollDie(6, rng))
  const { effect, note: effectNote } = riftEffectForD6(rollDie(6, rng))
  const { stability, note: stabilityNote } = riftStabilityForD4(rollDie(4, rng))

  return { kind: 'rift', origin, effect, effectNote, stability, stabilityNote }
}
