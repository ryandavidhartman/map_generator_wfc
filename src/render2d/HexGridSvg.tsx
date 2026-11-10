import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMapDispatch, useMapState } from '../state/MapContext'
import { isPlannable, isRevealableNow } from '../state/mapReducer'
import { axialToPixel, hexId, parseHexId, type AxialCoord } from '../hexgrid/hexMath'
import { HexTile } from './HexTile'
import { geoByHex, HEX_SIZE, mapCoords } from './mapData'
const HEX_WIDTH = HEX_SIZE * Math.sqrt(3) // pointy-top: one hex step east
const INITIAL_VIEW_HEXES = 16 // hexes across the first view, centered on the party
const MIN_VIEW_HEXES = 4
const MAX_VIEW_HEXES = 80 // enough for the whole starting world (about 51 hexes across)

type ViewBox = { x: number; y: number; w: number; h: number }

function viewAround(center: AxialCoord, hexesAcross: number): ViewBox {
  const p = axialToPixel(center, HEX_SIZE)
  const w = hexesAcross * HEX_WIDTH
  const h = w * 0.65
  return { x: p.x - w / 2, y: p.y - h / 2, w, h }
}

// Player view: revealed hexes and their unexplored frontier. GM view (`gmView`): every solved
// hex too, unrevealed ones dimmed.
export function HexGridSvg({ gmView = false }: { gmView?: boolean }) {
  const state = useMapState()
  const dispatch = useMapDispatch()
  const navigate = useNavigate()
  const svgRef = useRef<SVGSVGElement>(null)
  const dragOrigin = useRef<{ x: number; y: number } | null>(null)
  // Every solved hex's geography, worked out from its tile (only when the tiles change).
  const geo = useMemo(() => geoByHex(state), [state.world, state.tiles]) // eslint-disable-line react-hooks/exhaustive-deps
  const coords = useMemo(() => mapCoords(state, gmView), [state.hexes, state.tiles, gmView]) // eslint-disable-line react-hooks/exhaustive-deps
  // Set once per mount (lazy initializer), not on every reveal: re-centering every time the
  // party moves would keep yanking the view out from under a GM who has panned or zoomed.
  const [viewBox, setViewBox] = useState<ViewBox>(() =>
    viewAround(state.partyHexId ? parseHexId(state.partyHexId) : { q: 0, r: 0 }, INITIAL_VIEW_HEXES),
  )

  function handlePointerDown(e: PointerEvent<SVGSVGElement>) {
    dragOrigin.current = { x: e.clientX, y: e.clientY }
  }

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    if (!dragOrigin.current || !svgRef.current) return
    const dx = e.clientX - dragOrigin.current.x
    const dy = e.clientY - dragOrigin.current.y
    dragOrigin.current = { x: e.clientX, y: e.clientY }
    const rect = svgRef.current.getBoundingClientRect()
    setViewBox((vb) => ({
      ...vb,
      x: vb.x - (dx / rect.width) * vb.w,
      y: vb.y - (dy / rect.height) * vb.h,
    }))
  }

  function handlePointerUp() {
    dragOrigin.current = null
  }

  // React attaches onWheel as a passive listener, which silently ignores
  // preventDefault. Use a native listener so scroll-to-zoom doesn't also
  // scroll the page.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    function handleWheelNative(e: globalThis.WheelEvent) {
      e.preventDefault()
      const rect = svg!.getBoundingClientRect()
      const mouseXRatio = (e.clientX - rect.left) / rect.width
      const mouseYRatio = (e.clientY - rect.top) / rect.height
      const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1

      setViewBox((vb) => {
        const minW = MIN_VIEW_HEXES * HEX_WIDTH
        const maxW = MAX_VIEW_HEXES * HEX_WIDTH
        const newW = Math.min(maxW, Math.max(minW, vb.w * factor))
        const scale = newW / vb.w
        const newH = vb.h * scale
        const dw = vb.w - newW
        const dh = vb.h - newH
        return {
          x: vb.x + dw * mouseXRatio,
          y: vb.y + dh * mouseYRatio,
          w: newW,
          h: newH,
        }
      })
    }

    svg.addEventListener('wheel', handleWheelNative, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheelNative)
  }, [])

  return (
    <svg
      ref={svgRef}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ width: '100%', height: '100%', background: '#0d0d0d', touchAction: 'none' }}
    >
      {coords.map((coord) => {
        const id = hexId(coord)
        const hex = state.hexes[id]
        return (
          <HexTile
            key={id}
            coord={coord}
            size={HEX_SIZE}
            hex={hex}
            geo={geo.get(id) ?? null}
            showHidden={gmView}
            isParty={state.partyHexId === id}
            isSelected={state.selectedHexId === id}
            isRevealable={isRevealableNow(state, id)}
            plan={gmView ? (state.planned[id] ?? null) : null}
            isPlannable={gmView && isPlannable(state, id)}
            onSingleClick={() => {
              // MOVE_PARTY_TO itself guards on adjacency, and handles both an
              // already-revealed hex (just relocate) and an unrevealed one (reveal + move),
              // so a single click can always just dispatch it unconditionally.
              dispatch({ type: 'MOVE_PARTY_TO', hexId: id })
            }}
            onDoubleClick={() => {
              if (hex) {
                // Revealed hex: navigate to its full view (SELECT_HEX also fires so the
                // grid keeps highlighting whichever hex is currently being viewed).
                dispatch({ type: 'SELECT_HEX', hexId: id })
                navigate(`/hex/${id}`)
              } else if (gmView && isPlannable(state, id)) {
                // GM view: an unrevealed hex opens its planning view (item 3).
                navigate(`/hex/${id}`)
              } else if (isRevealableNow(state, id)) {
                dispatch({ type: 'MOVE_PARTY_TO', hexId: id })
              }
            }}
          />
        )
      })}
    </svg>
  )
}
