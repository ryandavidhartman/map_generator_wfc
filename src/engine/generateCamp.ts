// Camp: a new site kind (house-rule extension, not book RAW), confirmed 2026-07-04 as part of
// expanding the overland Points of Interest table into a d200 "Location Generator" — see
// docs/plan-sites-settlements-mongo.md's "Location Generator expansion" section for the full
// design conversation and routing table. Camp's identity is a flat, unordered cluster: a central
// feature plus N peripheral features scattered around it with NO connective topology at all —
// looser even than Keep's hub-and-spoke. Explicitly flagged by the user as the scope-creep risk
// of the 5 new kinds, since it needs a genuinely new "scatter/zone" renderer rather than reusing
// an existing one.
//
// Confirmed spec:
// - Feature count (central + peripheral together) is Size-driven via campFeatureCountRangeForSize
//   — unlike Shrine's flat d3 (which deliberately doesn't scale), Camp does scale with Size, same
//   as Tower/Keep.
// - The central feature's specific identity (campfire/war-tent/totem) is intentionally left as a
//   generic placeholder here — no formal table for it was specified, only illustrative examples;
//   real flavor is deferred to the POI-table cutover, same as dungeon Site Type not deriving from
//   POI text today.
// - Peripheral features roll against their own small table (campTables.ts), not the dungeon Room
//   Type d10 table — same reasoning as Shrine: a table built for room-by-room pacing produces a
//   diluted result rolled only a handful of times.
// - No monster/NPC engine attachment (unlike dungeon/Tower/Keep rooms) — threats are embedded as
//   flavor text directly in the Peripheral Feature table (e.g. "Watch post: armed NPCs"), same
//   choice already made for Shrine's core/approach features.
// - Objective placement is a soft fallback, not a hard override (same shape as Keep's bias, looser
//   than Tower's hard rule): whichever peripheral feature rolls "Ritual/leader's space" (first
//   occurrence) becomes the objective; if none rolled, the central feature is the objective by
//   default.
// - No Danger Level roll — not specified for Camp (unlike Tower/Keep/dungeons), consistent with
//   Shrine/Rift also having no danger roll; don't add one without being asked.

import { rollDie, type Rng } from './dice'
import { siteSizeForD6, type SiteSize } from '../data/dungeonTables'
import { campFeatureCountRangeForSize, campPeripheralFeatureForD6, type CampPeripheralFeature } from '../data/campTables'
import { computeCampLayout, type CampPoint } from './campLayout'

export type CampCentralFeature = {
  isObjectiveFeature: boolean
  point: CampPoint
}

export type CampPeripheralFeatureData = {
  id: string
  feature: CampPeripheralFeature
  description: string
  isObjectiveFeature: boolean
  point: CampPoint
}

export type CampSite = {
  kind: 'camp'
  size: SiteSize
  central: CampCentralFeature
  peripheralFeatures: CampPeripheralFeatureData[]
}

export function generateCampSite(rng: Rng = Math.random): CampSite {
  const size = siteSizeForD6(rollDie(6, rng)).size
  const range = campFeatureCountRangeForSize(size)
  const totalFeatureCount = range.min + rollDie(range.max - range.min + 1, rng) - 1
  const peripheralCount = totalFeatureCount - 1

  const layout = computeCampLayout(peripheralCount)

  const peripheralFeatures: CampPeripheralFeatureData[] = []
  for (let i = 0; i < peripheralCount; i++) {
    const { feature, description } = campPeripheralFeatureForD6(rollDie(6, rng))
    peripheralFeatures.push({ id: `feature-${i}`, feature, description, isObjectiveFeature: false, point: layout.peripheral[i] })
  }

  const ritualIndex = peripheralFeatures.findIndex((f) => f.feature === "Ritual/leader's space")
  if (ritualIndex !== -1) {
    peripheralFeatures[ritualIndex] = { ...peripheralFeatures[ritualIndex], isObjectiveFeature: true }
  }

  return {
    kind: 'camp',
    size,
    central: { isObjectiveFeature: ritualIndex === -1, point: layout.central },
    peripheralFeatures,
  }
}
