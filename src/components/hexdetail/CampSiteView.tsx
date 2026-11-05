import { useMemo, useState } from 'react'
import { useMapDispatch } from '../../state/MapContext'
import type { Hex } from '../../state/mapReducer'
import type { CampSite } from '../../engine/generateCamp'
import { computeCampPlan } from '../../engine/campPlan'
import { CampMapSvg, type CampMapFeatureData } from '../../hexgrid/CampMapSvg'
import { HexBaseInfo } from './HexBaseInfo'

export function CampSiteView({ hex, site }: { hex: Hex; site: CampSite }) {
  const dispatch = useMapDispatch()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const plan = useMemo(
    () =>
      computeCampPlan(
        [
          { id: 'central', feature: 'Central', x: site.central.point.x, y: site.central.point.y },
          ...site.peripheralFeatures.map((f) => ({ id: f.id, feature: f.feature, x: f.point.x, y: f.point.y })),
        ],
        site.peripheralFeatures.map((f) => `${f.id}:${f.feature}`).join('|') + `|${site.size}`,
      ),
    [site],
  )
  // Peripheral features are numbered 1..n, matching the list below; the central feature is
  // unnumbered ("C") unless it's the objective, which gets the star.
  const features: Record<string, CampMapFeatureData> = {
    central: { label: 'C', isObjective: site.central.isObjectiveFeature },
    ...Object.fromEntries(site.peripheralFeatures.map((f, i) => [f.id, { label: String(i + 1), isObjective: f.isObjectiveFeature }])),
  }
  const toggle = (id: string) => setSelectedId((current) => (current === id ? null : id))

  return (
    <div className="site-view">
      <HexBaseInfo hex={hex} />

      <section className="site-section">
        <div className="site-section-header">
          <h3>{site.size} Camp</h3>
          <button type="button" onClick={() => dispatch({ type: 'REROLL_SITE', hexId: hex.id })}>
            Reroll Site
          </button>
        </div>

        <div className="site-layout paper-layout">
          <CampMapSvg plan={plan} features={features} selectedId={selectedId} onSelect={toggle} />
        </div>

        <ol className="room-list">
          <li
            data-feature-id="central"
            className={[site.central.isObjectiveFeature ? 'objective-room' : '', selectedId === 'central' ? 'selected-floor-room' : ''].filter(Boolean).join(' ') || undefined}
          >
            <strong>
              C. Central Feature (campfire){site.central.isObjectiveFeature && ' (Objective)'}
            </strong>
          </li>
          {site.peripheralFeatures.map((f, i) => (
            <li
              key={f.id}
              data-feature-id={f.id}
              className={[f.isObjectiveFeature ? 'objective-room' : '', selectedId === f.id ? 'selected-floor-room' : ''].filter(Boolean).join(' ') || undefined}
            >
              <strong>
                {i + 1}. {f.feature}
                {f.isObjectiveFeature && ' (Objective)'}
              </strong>
              <p>{f.description}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
