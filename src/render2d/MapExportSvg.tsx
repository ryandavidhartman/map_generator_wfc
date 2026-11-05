// The 2D map as a standalone SVG for the PNG export (M8): the player map (what the party has
// seen, as in the player view) or the GM map (every solved hex, unrevealed ones dimmed),
// cropped to its content, on the map's dark background. Drawn with the same HexTile as the
// interactive map, without clicks.

import { axialToPixel, hexId } from '../hexgrid/hexMath'
import { isRevealableNow, type MapState } from '../state/mapReducer'
import { HexTile } from './HexTile'
import { geoByHex, HEX_SIZE, mapCoords } from './mapData'

export const EXPORT_BACKGROUND = '#0d0d0d'
const PAD = HEX_SIZE * 1.2

export function exportBounds(state: MapState, gmView: boolean) {
  const points = mapCoords(state, gmView).map((c) => axialToPixel(c, HEX_SIZE))
  if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 }
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x = Math.min(...xs) - PAD
  const y = Math.min(...ys) - PAD
  return { x, y, width: Math.max(...xs) + PAD - x, height: Math.max(...ys) + PAD - y }
}

export function MapExportSvg({ state, gmView }: { state: MapState; gmView: boolean }) {
  const coords = mapCoords(state, gmView)
  const geo = geoByHex(state)
  const b = exportBounds(state, gmView)
  const none = () => {}
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={b.width} height={b.height} viewBox={`${b.x} ${b.y} ${b.width} ${b.height}`}>
      <rect x={b.x} y={b.y} width={b.width} height={b.height} fill={EXPORT_BACKGROUND} />
      {coords.map((coord) => {
        const id = hexId(coord)
        return (
          <HexTile
            key={id}
            coord={coord}
            size={HEX_SIZE}
            hex={state.hexes[id]}
            geo={geo.get(id) ?? null}
            showHidden={gmView}
            isParty={state.partyHexId === id}
            isSelected={false}
            isRevealable={isRevealableNow(state, id)}
            onSingleClick={none}
            onDoubleClick={none}
          />
        )
      })}
    </svg>
  )
}
