import type { Rng } from './dice'
import { SETTLEMENT_LOCATIONS } from '../data/tables'
import type { SiteType } from '../data/dungeonTables'
import type { SettlementType } from '../data/settlementTables'
import { generateDungeonSite, type DungeonSite } from './generateDungeon'
import { generateSettlement, type Settlement } from './generateSettlement'
import { generateTowerSite, type TowerSite } from './generateTower'
import { generateShrineSite, type ShrineSite } from './generateShrine'
import { generateRiftSite, type RiftSite } from './generateRift'
import { generateKeepSite, type KeepSite } from './generateKeep'
import { generateCampSite, type CampSite } from './generateCamp'
import type { PointOfInterest } from './generateHex'

export type GeneratedSite = DungeonSite | Settlement | TowerSite | ShrineSite | RiftSite | KeepSite | CampSite

// Dispatches on the hex's POI. `poi.siteKind` (set by the Location Generator's Feature table,
// src/data/locationTables.ts) drives dispatch directly when present: 'none' means no site is ever
// generated for this hex (Cataclysm/Natural landmark rows); any other SiteKind routes to that
// generator, passing `poi.forcedType` through as the target generator's own overridden Type roll
// (Site Type for 'dungeon', Settlement Type for 'settlement' — the other 5 kinds have no Type
// concept to force). `siteKind` is left undefined for POIs created via the manual hex-edit form
// (freeform location/development text, no routing metadata) — those fall back to the legacy
// location-text heuristic that predates the Location Generator.
export function generateSiteForHex(poi: PointOfInterest, rng: Rng = Math.random, hexDangerLevel = 1): GeneratedSite | undefined {
  const kind = poi.siteKind ?? (SETTLEMENT_LOCATIONS.includes(poi.location) ? 'settlement' : 'dungeon')

  switch (kind) {
    case 'none':
      return undefined
    case 'settlement':
      return generateSettlement(rng, poi.forcedType as SettlementType | undefined)
    case 'dungeon':
      return generateDungeonSite(rng, poi.forcedType as SiteType | undefined, hexDangerLevel)
    case 'tower':
      return generateTowerSite(rng, hexDangerLevel)
    case 'shrine':
      return generateShrineSite(rng)
    case 'rift':
      return generateRiftSite(rng)
    case 'keep':
      return generateKeepSite(rng, hexDangerLevel)
    case 'camp':
      return generateCampSite(rng)
  }
}
