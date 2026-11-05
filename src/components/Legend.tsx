import { ALL_TERRAINS } from '../data/tables'
import { DANGER_COLORS, FEATURE_COLORS, TERRAIN_COLORS } from '../hexgrid/colors'

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
          <li>
            <span className="swatch swatch-dot" style={{ background: '#ffffff' }} />
            Party location
          </li>
        </ul>
      </div>
    </div>
  )
}
