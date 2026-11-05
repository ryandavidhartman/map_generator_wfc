import { TERRAIN_ORDER } from '../data/tables'
import { DANGER_COLORS, TERRAIN_COLORS } from '../hexgrid/colors'

const DANGER_ORDER = ['Safe', 'Unsafe', 'Risky', 'Deadly'] as const

export function Legend() {
  return (
    <div className="legend">
      <div className="legend-group">
        <h3>Terrain</h3>
        <ul>
          {TERRAIN_ORDER.map((terrain) => (
            <li key={terrain}>
              <span className="swatch" style={{ background: TERRAIN_COLORS[terrain] }} />
              {terrain}
            </li>
          ))}
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
