import { useEffect, useRef } from 'react'
import type { Hex } from '../state/mapReducer'
import type { HexGeo } from '../world/terrain'
import { axialToPixel, hexCornersPointsAttr, hexId, type AxialCoord } from '../hexgrid/hexMath'
import { DANGER_COLORS, FEATURE_COLORS, TERRAIN_COLORS } from '../hexgrid/colors'
import { coastWaterPath, linePath } from './tileShapes'
import { POI_ICON_PATHS } from './poiIcons'

const UNREVEALED_FILL_REVEALABLE = '#3a3a3a'
const UNREVEALED_FILL_FOG = '#1a1a1a'
const UNREVEALED_STROKE_REVEALABLE = '#9a9a9a'
const UNREVEALED_STROKE_FOG = '#2c2c2c'
const GM_HIDDEN_STROKE = '#00000055'
const MISMATCH_COLOR = '#ff3b3b'
const GM_HIDDEN_DIM = 0.45 // opacity of the dark veil over unrevealed hexes in GM view

// Single click moves the party; double click opens the full-view details page. A single
// click's action is delayed by this long so a second click arriving in time can cancel it
// and fire the double-click action instead, rather than both firing.
const DOUBLE_CLICK_DELAY_MS = 250

export type HexTileProps = {
  coord: AxialCoord
  size: number
  hex?: Hex
  // The hex's tile geography, if it's solved.
  geo: HexGeo | null
  // GM view: draw this unrevealed hex's solved terrain, dimmed.
  showHidden: boolean
  isParty: boolean
  isSelected: boolean
  isRevealable: boolean
  onSingleClick: () => void
  onDoubleClick: () => void
}

export function HexTile({ coord, size, hex, geo, showHidden, isParty, isSelected, isRevealable, onSingleClick, onDoubleClick }: HexTileProps) {
  const pendingClick = useRef<number | null>(null)
  const center = axialToPixel(coord, size)
  const inner = size * 0.96
  const points = hexCornersPointsAttr(center, inner)
  // Full size, so the GM-view veil also covers the river and road ends crossing the gap
  // between hexes.
  const outerPoints = hexCornersPointsAttr(center, size)
  const clickable = Boolean(hex) || isRevealable
  const drawn = hex ? 'revealed' : showHidden && geo ? 'hidden' : 'fog'

  useEffect(() => {
    return () => {
      if (pendingClick.current !== null) window.clearTimeout(pendingClick.current)
    }
  }, [])

  function handleClick() {
    if (pendingClick.current !== null) {
      window.clearTimeout(pendingClick.current)
      pendingClick.current = null
      return
    }
    pendingClick.current = window.setTimeout(() => {
      pendingClick.current = null
      onSingleClick()
    }, DOUBLE_CLICK_DELAY_MS)
  }

  function handleDoubleClick() {
    if (pendingClick.current !== null) {
      window.clearTimeout(pendingClick.current)
      pendingClick.current = null
    }
    onDoubleClick()
  }

  let fill: string
  let stroke: string
  if (drawn === 'revealed') {
    fill = TERRAIN_COLORS[hex!.terrain]
    stroke = DANGER_COLORS[hex!.danger]
  } else if (drawn === 'hidden') {
    fill = TERRAIN_COLORS[geo!.terrain]
    stroke = isRevealable ? UNREVEALED_STROKE_REVEALABLE : GM_HIDDEN_STROKE
  } else {
    fill = isRevealable ? UNREVEALED_FILL_REVEALABLE : UNREVEALED_FILL_FOG
    stroke = isRevealable ? UNREVEALED_STROKE_REVEALABLE : UNREVEALED_STROKE_FOG
  }

  const mismatch = drawn === 'revealed' && showHidden && hex!.tileMismatch
  const title =
    drawn === 'revealed'
      ? `${hex!.terrain} · ${hex!.danger} (level ${hex!.dangerLevel})${hex!.poi ? ` · ${hex!.poi.location}` : ''}${mismatch ? ' · tile mismatch' : ''}`
      : drawn === 'hidden'
        ? `Unrevealed: ${geo!.terrain}`
        : isRevealable
          ? 'Unexplored'
          : undefined

  // Features are drawn from the tile. The fill follows the hex's own terrain (a GM edit can
  // relabel a revealed hex), but rivers, roads and coast stay where the tile has them.
  const showFeatures = drawn !== 'fog' && geo
  const water = showFeatures && geo.terrain !== 'Ocean' ? coastWaterPath(center, inner, geo.seaEdges, geo.coastEdges) : null
  const rivers = showFeatures ? linePath(center, size, geo.riverEdges) : null
  const roads = showFeatures ? linePath(center, size, geo.roadEdges) : null

  return (
    <g
      onClick={clickable ? handleClick : undefined}
      onDoubleClick={clickable ? handleDoubleClick : undefined}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      data-hex-clickable={clickable}
      data-hex-id={hexId(coord)}
    >
      {title && <title>{title}</title>}
      <polygon points={points} fill={fill} />
      {water && <path d={water} fill={TERRAIN_COLORS.Ocean} />}
      {showFeatures && geo.lake && (
        <ellipse cx={center.x} cy={center.y} rx={size * 0.3} ry={size * 0.2} fill={FEATURE_COLORS.lake} />
      )}
      {rivers && <path d={rivers} fill="none" stroke={FEATURE_COLORS.river} strokeWidth={size * 0.13} />}
      {roads && (
        <path
          d={roads}
          fill="none"
          stroke={FEATURE_COLORS.road}
          strokeWidth={size * 0.07}
          strokeDasharray={`${size * 0.16} ${size * 0.1}`}
        />
      )}
      {drawn === 'hidden' && <polygon points={outerPoints} fill="#000000" opacity={GM_HIDDEN_DIM} />}
      <polygon points={points} fill="none" stroke={isSelected ? '#ffffff' : stroke} strokeWidth={isSelected ? 3 : 2} />
      {mismatch && (
        // GM view: the hex's terrain is a label its tile couldn't be reshaped to (world/pin.ts).
        <polygon
          points={hexCornersPointsAttr(center, size * 0.78)}
          fill="none"
          stroke={MISMATCH_COLOR}
          strokeWidth={2.5}
          strokeDasharray={`${size * 0.12} ${size * 0.08}`}
          data-tile-mismatch="true"
        />
      )}
      {hex?.poi && (
        <>
          <circle cx={center.x} cy={center.y} r={size * 0.3} fill="#ffd54a" stroke="#00000088" strokeWidth={1} />
          {hex.poi.siteKind && hex.poi.siteKind !== 'none' && (
            <path
              d={POI_ICON_PATHS[hex.poi.siteKind]}
              transform={`translate(${center.x} ${center.y}) scale(${size * 0.19})`}
              fill="#3b2f00"
              fillRule="evenodd"
              data-poi-icon={hex.poi.siteKind}
            />
          )}
        </>
      )}
      {isParty && (
        // Beside the POI badge when there is one, so the icon stays readable.
        <circle
          cx={center.x + (hex?.poi ? size * 0.42 : 0)}
          cy={center.y + (hex?.poi ? size * 0.3 : 0)}
          r={size * 0.14}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={1.5}
        />
      )}
    </g>
  )
}
