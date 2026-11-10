import { createContext, useContext, type ReactNode } from 'react'
import type { HexDir } from '../wfc/tiles'

// The /poi review page's water picker (PLAN.md punch-list item 2): the review hex has no world or
// tile, so the page hands SettlementView the water edges of a chosen tile and rotation here,
// and SettlementView sends them through waterForEdges exactly as a real hex with that tile
// would. A context rather than a MapState field, so it can never end up in a save. `label`
// names the tile and rotation, shown with the drawn map so a screenshot says what it shows.
export type ReviewWater = {
  label: string
  // What waterForEdges is told the hex is: Coast when the tile has sea or shoreline edges, else
  // land (only Ocean changes its answer, and a picked tile is never open sea).
  terrain: 'Coast' | 'Grassland'
  edges: { seaEdges: HexDir[]; coastEdges: HexDir[]; riverEdges: HexDir[]; lake: boolean }
}

const ReviewWaterContext = createContext<ReviewWater | null>(null)

export function ReviewWaterProvider({ value, children }: { value: ReviewWater | null; children: ReactNode }) {
  return <ReviewWaterContext.Provider value={value}>{children}</ReviewWaterContext.Provider>
}

// Null everywhere but the /poi review page with a tile picked.
export function useReviewWater(): ReviewWater | null {
  return useContext(ReviewWaterContext)
}
