import { useEffect } from 'react'
import { useMapDispatch } from '../../state/MapContext'
import type { Hex } from '../../state/mapReducer'
import { WildernessView } from './WildernessView'
import { DungeonSiteView } from './DungeonSiteView'
import { SettlementView } from './SettlementView'
import { TowerSiteView } from './TowerSiteView'
import { ShrineSiteView } from './ShrineSiteView'
import { RiftSiteView } from './RiftSiteView'
import { KeepSiteView } from './KeepSiteView'
import { CampSiteView } from './CampSiteView'

// Auto-generates + renders the right site view for a hex, keyed off `hex.site?.kind`. Shared by
// HexDetailPage (the real campaign map) and PoiReviewPage (an isolated, non-persisting reducer
// instance forcing a specific POI roll for review) — both just need to hand it a `Hex` sitting in
// whatever MapProvider is nearest in the tree.
export function HexSiteContent({ hex }: { hex: Hex }) {
  const dispatch = useMapDispatch()

  // Idempotent: GENERATE_SITE is a no-op once hex.site is already set, so this safely
  // auto-generates on first visit and does nothing on repeat visits. A poi.siteKind of 'none'
  // (Cataclysm/Natural landmark rows — flavor text only) must never dispatch here: hex.site would
  // stay undefined forever, so gating on it would re-fire every render instead of settling.
  useEffect(() => {
    if (hex.poi && hex.poi.siteKind !== 'none' && !hex.site) {
      dispatch({ type: 'GENERATE_SITE', hexId: hex.id })
    }
  }, [hex, dispatch])

  if (!hex.poi || hex.poi.siteKind === 'none') return <WildernessView hex={hex} />
  if (hex.site?.kind === 'settlement') return <SettlementView hex={hex} site={hex.site} />
  if (hex.site?.kind === 'dungeon') return <DungeonSiteView hex={hex} site={hex.site} />
  if (hex.site?.kind === 'tower') return <TowerSiteView hex={hex} site={hex.site} />
  if (hex.site?.kind === 'shrine') return <ShrineSiteView hex={hex} site={hex.site} />
  if (hex.site?.kind === 'rift') return <RiftSiteView hex={hex} site={hex.site} />
  if (hex.site?.kind === 'keep') return <KeepSiteView hex={hex} site={hex.site} />
  if (hex.site?.kind === 'camp') return <CampSiteView hex={hex} site={hex.site} />
  return <p>Generating site…</p>
}
