import { locationFeatureForD200, locationFeatureRows, type LocationFeatureEntry } from '../../data/locationTables'

// The d200 Feature table as a pick list, for the planning view and the revealed-hex Edit form
// (PLAN.md punch-list item 3): each row says what it becomes, so the GM needn't know the table.

// What a row becomes, in a few words: "settlement: Town", "dungeon: Tomb".
export function featureKind(entry: LocationFeatureEntry): string {
  if (entry.routesTo === 'cataclysm') return 'flavor only: a cataclysm for the terrain'
  if (entry.routesTo === 'landmark') return 'flavor only: a landmark for the terrain'
  return entry.forcedType ? `${entry.routesTo}: ${entry.forcedType}` : entry.routesTo
}

// One option per row, valued by the row's first roll.
export const FEATURE_OPTIONS = locationFeatureRows().map((r) => ({
  roll: r.min,
  label: `${r.entry.feature} (${featureKind(r.entry)}; d200 ${r.min === r.max ? r.min : `${r.min}-${r.max}`})`,
}))

// The option (first roll of its row) for any roll in that row.
export function featureOptionFor(roll: number): number {
  return FEATURE_OPTIONS.findLast((o) => o.roll <= roll)?.roll ?? FEATURE_OPTIONS[0].roll
}

export function featureSummary(roll: number): string {
  const entry = locationFeatureForD200(roll)
  return `${entry.feature} (${featureKind(entry)})`
}

// The hint for a custom (free-text) point of interest: what generateSiteForHex makes of it.
export const CUSTOM_POI_HINT =
  "A point of interest that isn't on the Feature table. Its site page shows a dungeon (or a settlement if the name is exactly Village, Town, City or Metropolis); for a tower, keep, camp, shrine or rift, pick it from the Feature table instead."
