import { useEffect, useRef } from 'react'
import type { Hex } from '../state/mapReducer'
import { axialToPixel, hexCornersPointsAttr, hexId, type AxialCoord } from './hexMath'
import { DANGER_COLORS, TERRAIN_COLORS } from './colors'

const UNREVEALED_FILL_REVEALABLE = '#3a3a3a'
const UNREVEALED_FILL_FOG = '#1a1a1a'
const UNREVEALED_STROKE_REVEALABLE = '#9a9a9a'
const UNREVEALED_STROKE_FOG = '#2c2c2c'

// Single click moves the party; double click opens the full-view details page. A single
// click's action is delayed by this long so a second click arriving in time can cancel it
// and fire the double-click action instead, rather than both firing.
const DOUBLE_CLICK_DELAY_MS = 250

export type HexTileProps = {
  coord: AxialCoord
  size: number
  hex?: Hex
  isParty: boolean
  isSelected: boolean
  isRevealable: boolean
  onSingleClick: () => void
  onDoubleClick: () => void
}

export function HexTile({ coord, size, hex, isParty, isSelected, isRevealable, onSingleClick, onDoubleClick }: HexTileProps) {
  const pendingClick = useRef<number | null>(null)
  const center = axialToPixel(coord, size)
  const points = hexCornersPointsAttr(center, size * 0.96)
  const clickable = Boolean(hex) || isRevealable

  useEffect(() => {
    return () => {
      if (pendingClick.current !== null) window.clearTimeout(pendingClick.current)
    }
  }, [])

  const fill = hex ? TERRAIN_COLORS[hex.terrain] : isRevealable ? UNREVEALED_FILL_REVEALABLE : UNREVEALED_FILL_FOG
  const stroke = hex
    ? DANGER_COLORS[hex.danger]
    : isRevealable
      ? UNREVEALED_STROKE_REVEALABLE
      : UNREVEALED_STROKE_FOG

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

  return (
    <g
      onClick={clickable ? handleClick : undefined}
      onDoubleClick={clickable ? handleDoubleClick : undefined}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      data-hex-clickable={clickable}
      data-hex-id={hexId(coord)}
    >
      <polygon points={points} fill={fill} stroke={isSelected ? '#ffffff' : stroke} strokeWidth={isSelected ? 3 : 2} />
      {hex?.poi && <circle cx={center.x} cy={center.y} r={size * 0.22} fill="#ffd54a" stroke="#00000088" strokeWidth={1} />}
      {isParty && <circle cx={center.x} cy={center.y} r={size * 0.14} fill="#ffffff" stroke="#000000" strokeWidth={1.5} />}
    </g>
  )
}
