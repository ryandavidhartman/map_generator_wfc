import { ALL_TERRAINS } from '../data/tables'
import { DANGER_COLORS, FEATURE_COLORS, TERRAIN_COLORS } from '../hexgrid/colors'
import { POI_ICON_LABELS, POI_ICON_PATHS } from '../render2d/poiIcons'

const DANGER_ORDER = ['Safe', 'Unsafe', 'Risky', 'Deadly'] as const

export function Legend() {
  return (
    <div className="legend">
      <div className="legend-group">
        <h3>Terrain</h3>
        <ul>
          {ALL_TERRAINS.map((terrain) => (
            <li key={terrain}>
              <span className="swatch" style={{ background: TERRAIN_COLORS[terrain] }} />
              {terrain}
            </li>
          ))}
        </ul>
      </div>
      <div className="legend-group">
        <h3>Features</h3>
        <ul>
          <li>
            <span className="swatch swatch-line" style={{ borderColor: FEATURE_COLORS.river }} />
            River
          </li>
          <li>
            <span className="swatch swatch-dot" style={{ background: FEATURE_COLORS.lake }} />
            Lake
          </li>
          <li>
            <span className="swatch swatch-line dashed" style={{ borderColor: FEATURE_COLORS.road }} />
            Road
          </li>
        </ul>
      </div>
      <div className="legend-group">
        <h3>Danger (hex border)</h3>
        <ul>
          {DANGER_ORDER.map((level) => (
            <li key={level}>
              <span className="swatch swatch-ring" style={{ borderColor: DANGER_COLORS[level] }} />
              {level}
            </li>
          ))}
        </ul>
      </div>
      <div className="legend-group">
        <h3>Markers</h3>
        <ul>
          <li>
            <span className="swatch swatch-dot" style={{ background: '#ffd54a' }} />
            Point of interest
          </li>
          {(Object.keys(POI_ICON_PATHS) as (keyof typeof POI_ICON_PATHS)[]).map((kind) => (
            <li key={kind}>
              <svg className="swatch" viewBox="-1.3 -1.3 2.6 2.6" aria-hidden="true">
                <circle r={1.3} fill="#ffd54a" />
                <path d={POI_ICON_PATHS[kind]} fill="#3b2f00" fillRule="evenodd" />
              </svg>
              {POI_ICON_LABELS[kind]}
            </li>
          ))}
          <li>
            <span className="swatch swatch-dot" style={{ background: '#ffffff' }} />
            Party location
          </li>
        </ul>
      </div>
    </div>
  )
}
