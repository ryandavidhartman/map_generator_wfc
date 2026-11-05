import type { Hex } from '../../state/mapReducer'
import { HexBaseInfo } from './HexBaseInfo'

// A revealed hex with no site to generate — either no Point of Interest at all, or a POI whose
// Location Generator feature routes to `siteKind: 'none'` (Cataclysm/Natural landmark rows: flavor
// text only, see src/data/locationTables.ts). Just the shared base info (terrain/danger,
// move/reroll/edit, and the standalone random-encounter roller).
export function WildernessView({ hex }: { hex: Hex }) {
  return (
    <div className="site-view">
      <HexBaseInfo hex={hex} />
      <p className="wilderness-note">
        {hex.poi
          ? 'A notable feature, but nothing here to delve into.'
          : 'Just wilderness here — nothing to explore beyond the road.'}
      </p>
    </div>
  )
}
