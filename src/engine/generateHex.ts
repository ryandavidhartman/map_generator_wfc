import { rollDie, roll2d6, type Rng } from './dice'
import { type Terrain, type DangerLevel, terrainFor2d6, newHexResultFor2d6, stepTerrain, dangerForD6, settlementNameForD20, settlementNameColumnFor } from '../data/tables'
import { type SiteKind, locationFeatureForD200, cataclysmForTerrain, naturalLandmarkForTerrain } from '../data/locationTables'

export type PointOfInterest = {
  location: string
  development: string
  cataclysm?: string
  naturalLandmark?: string
  settlementName?: string
  // Set for every POI rolled via the Location Generator's Feature table: 'none' means no site is
  // ever generated for this hex (Cataclysm/Natural landmark rows — flavor text only); a real
  // SiteKind means generateSiteForHex routes to that generator. Left undefined for POIs created
  // via the manual hex-edit form (freeform location/development text) — generateSiteForHex falls
  // back to its legacy location-text heuristic in that case.
  siteKind?: SiteKind | 'none'
  // Forces the target generator's own Type roll (SiteType for 'dungeon', SettlementType for
  // 'settlement') — see the Feature table's "Forced Type" column. Unset means that generator
  // still rolls its own Type fresh (e.g. the generic "Dungeon" row).
  forcedType?: string
}

export type GeneratedHexDetails = {
  terrain: Terrain
  danger: DangerLevel
  poi?: PointOfInterest
}

export function rollStartingTerrain(rng: Rng = Math.random): Terrain {
  return terrainFor2d6(roll2d6(rng))
}

export function rollNextTerrain(currentTerrain: Terrain, rng: Rng = Math.random): Terrain {
  const result = newHexResultFor2d6(roll2d6(rng))
  if (result.kind === 'same') return currentTerrain
  if (result.kind === 'step') return stepTerrain(currentTerrain, result.steps)
  return rollStartingTerrain(rng)
}

export function rollDangerLevel(rng: Rng = Math.random): DangerLevel {
  return dangerForD6(rollDie(6, rng))
}

// Location Generator (house-rule expansion — see docs/plan-sites-settlements-mongo.md's
// "Location Generator expansion" section for the full locked table + provenance). Builds the POI
// for an already-decided Feature roll (1-200) — split out of rollPointOfInterest so a review tool
// (src/routes/PoiReviewPage.tsx) can force a specific roll without going through the outer 1-in-6
// gate. Terrain is not a fresh roll here — it reuses the hex's own already-rolled `terrain`, per
// that section's note that the two 2d6 tables are identical by design.
export function pointOfInterestForFeatureRoll(terrain: Terrain, featureRoll: number, rng: Rng = Math.random): PointOfInterest {
  const entry = locationFeatureForD200(featureRoll)

  if (entry.routesTo === 'cataclysm') {
    const cataclysm = cataclysmForTerrain(terrain, rollDie(8, rng))
    return { location: entry.feature, development: '', cataclysm, siteKind: 'none' }
  }

  if (entry.routesTo === 'landmark') {
    const landmark = naturalLandmarkForTerrain(terrain)
    return { location: entry.feature, development: '', naturalLandmark: landmark, siteKind: 'none' }
  }

  const poi: PointOfInterest = {
    location: entry.feature,
    development: entry.flavor ?? '',
    siteKind: entry.routesTo,
    forcedType: entry.forcedType,
  }

  if (entry.routesTo === 'settlement' && entry.forcedType) {
    poi.settlementName = settlementNameForD20(rollDie(20, rng), settlementNameColumnFor(entry.forcedType))
  }

  return poi
}

export function rollPointOfInterest(terrain: Terrain, rng: Rng = Math.random): PointOfInterest | undefined {
  if (rollDie(6, rng) !== 1) return undefined
  return pointOfInterestForFeatureRoll(terrain, rollDie(200, rng), rng)
}

export function generateStartingHexDetails(terrain: Terrain, rng: Rng = Math.random): GeneratedHexDetails {
  return {
    terrain,
    danger: rollDangerLevel(rng),
    poi: rollPointOfInterest(terrain, rng),
  }
}

export function generateNextHexDetails(currentTerrain: Terrain, rng: Rng = Math.random): GeneratedHexDetails {
  const terrain = rollNextTerrain(currentTerrain, rng)
  return {
    terrain,
    danger: rollDangerLevel(rng),
    poi: rollPointOfInterest(terrain, rng),
  }
}
