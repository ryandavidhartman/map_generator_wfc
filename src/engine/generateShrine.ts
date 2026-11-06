// Shrine: a new site kind (house-rule extension, not book RAW), confirmed 2026-07-04 as part of
// expanding the overland Points of Interest table into a d200 "Location Generator" — see
// docs/plan-sites-settlements-mongo.md's "Location Generator" section for the full design
// conversation and routing table. Shrine's identity is that it's deliberately NOT a delve: a
// single mandatory core feature (the NPC or focal object) optionally preceded by 1-2 framing
// "approach" beats, encountered in order — not a room graph, not a floor plan.
//
// Confirmed spec:
// - Feature count is its own flat d3 roll, deliberately NOT tied to the Size axis Tower/
//   dungeons use — Shrine's whole premise is that it doesn't scale like a delve does.
// - The core feature is always present and is always the objective — there's nothing else to
//   compete with it, so there's no "highest roll wins" step at all (simpler than Tower here).
// - Approach features (when the d3 roll is 2 or 3) use their own small Disposition/Approach
//   Feature tables (shrineTables.ts) rather than the dungeon Room Type d10 table — a table
//   built for pacing across many rolls produces a diluted, arbitrary result when rolled once
//   or twice.
// - Duplicate approach features are allowed by design — no dedup/reroll logic.

import { rollDie, type Rng } from './dice'
import { dispositionForD6, approachFeatureForD6, type Disposition, type ApproachFeatureType } from '../data/shrineTables'

export type ShrineCoreFeature = {
  disposition: Disposition
  dispositionNote: string
}

export type ShrineApproachFeature = {
  id: string
  feature: ApproachFeatureType
  note: string
}

export type ShrineSite = {
  kind: 'shrine'
  core: ShrineCoreFeature
  // Ordered: encountered before the core, in this order — not a graph, there's no traversal.
  approachFeatures: ShrineApproachFeature[]
}

export function generateShrineSite(rng: Rng = Math.random): ShrineSite {
  const featureCount = rollDie(3, rng)
  const approachCount = featureCount - 1

  const approachFeatures: ShrineApproachFeature[] = []
  for (let i = 0; i < approachCount; i++) {
    const { feature, note } = approachFeatureForD6(rollDie(6, rng))
    approachFeatures.push({ id: `approach-${i}`, feature, note })
  }

  const { disposition, note: dispositionNote } = dispositionForD6(rollDie(6, rng))

  return {
    kind: 'shrine',
    core: { disposition, dispositionNote },
    approachFeatures,
  }
}
