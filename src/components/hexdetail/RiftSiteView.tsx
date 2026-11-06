import { useMapDispatch } from '../../state/MapContext'
import type { Hex } from '../../state/mapReducer'
import type { RiftSite } from '../../engine/generateRift'
import { HexBaseInfo } from './HexBaseInfo'

// Scene card, same family as ShrineSiteView — no map/SVG, no spatial diagram. Unlike Shrine
// (approach beats leading to a separate core feature), Rift has no sub-components competing
// for "objective" status — the rift itself, as a single whole, is the only thing there is to
// find — so this renders as one highlighted block carrying all three axes, not a list of
// separate entries.
export function RiftSiteView({ hex, site }: { hex: Hex; site: RiftSite }) {
  const dispatch = useMapDispatch()

  return (
    <div className="site-view">
      <HexBaseInfo hex={hex} />

      <section className="site-section">
        <div className="site-section-header">
          <h3>Planar Rift</h3>
          <button type="button" onClick={() => dispatch({ type: 'REROLL_SITE', hexId: hex.id })}>
            Reroll Site
          </button>
        </div>

        <ul className="room-list">
          <li className="objective-room">
            <strong>Origin: {site.origin}</strong>
            <p>
              <strong>Effect:</strong> {site.effect} — {site.effectNote}
            </p>
            <p className="room-tag">Effect radius: roughly 30ft, scaling with Stability below</p>
            <p>
              <strong>Stability:</strong> {site.stability} — {site.stabilityNote}
            </p>
          </li>
        </ul>
      </section>
    </div>
  )
}
