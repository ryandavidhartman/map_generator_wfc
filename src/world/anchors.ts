// Settlement anchors (M6): hexes whose tile makes them a natural place for a settlement. When
// an anchor hex is revealed it becomes a settlement (engine/generateHex.ts
// rollAnchorSettlement), in addition to the settlements the d200 Feature table gives anywhere
// (user decision 2026-11-05: "add", not "replace").
//
// An anchor is a road end (one road edge), a road junction (three or more), or a road crossing
// a river. About 2.2% of land hexes (30 worlds of 19 chunks, after roads were cut to ~10% in
// punch-list item 1; 6.4% before). The rule reads only
// the tile type, which never changes once a hex is revealed, so nothing is saved for it.
// (PLAN.md also named coast hexes with a road; the tile set has no coast tile with a road.)

import { HEX_DIRS, TILE_LIST } from '../wfc/tiles'

export function isSettlementAnchor(tileType: number): boolean {
  const def = TILE_LIST[tileType]
  if (!def) return false
  if (def.name.startsWith('RIVER_CROSSING')) return true
  const roads = HEX_DIRS.filter((d) => def.edges[d] === 'road').length
  return roads === 1 || roads >= 3
}
