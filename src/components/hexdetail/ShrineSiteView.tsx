import { useMapDispatch } from '../../state/MapContext'
import type { Hex } from '../../state/mapReducer'
import type { ShrineSite } from '../../engine/generateShrine'
import { HexBaseInfo } from './HexBaseInfo'

// No map/SVG here on purpose — Shrine has no spatial information to show (it isn't navigated,
// it's arrived at), so this renders as a scene card: an ordered list of approach beats leading
// to the core feature, reusing the existing room-list/objective-room styling for consistency
// with the other site views rather than a bespoke look.
export function ShrineSiteView({ hex, site }: { hex: Hex; site: ShrineSite }) {
  const dispatch = useMapDispatch()

  return (
    <div className="site-view">
      <HexBaseInfo hex={hex} />

      <section className="site-section">
        <div className="site-section-header">
          <h3>Shrine</h3>
          <button type="button" onClick={() => dispatch({ type: 'REROLL_SITE', hexId: hex.id })}>
            Reroll Site
          </button>
        </div>

        <ol className="room-list">
          {site.approachFeatures.map((feature) => (
            <li key={feature.id}>
              <strong>Approach: {feature.feature}</strong>
              <p>{feature.note}</p>
            </li>
          ))}
          <li className="objective-room">
            <strong>Core Feature — Disposition: {site.core.disposition} (Objective)</strong>
            <p>{site.core.dispositionNote}</p>
          </li>
        </ol>
      </section>
    </div>
  )
}
