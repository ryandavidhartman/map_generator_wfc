// React wrapper for the 3D overland map. Owns the canvas and the MapScene's lifecycle, pushes
// the map state into it, and turns its clicks into the same actions as the 2D map. Loaded lazily
// (App.tsx), so Three.js and the models only download when the 3D view is opened.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMapDispatch, useMapState } from '../state/MapContext'
import { MapScene, type MarkerView } from './MapScene'
import { tileDraws } from './layout'

export default function ThreeMapView({ gmView }: { gmView: boolean }) {
  const state = useMapState()
  const dispatch = useMapDispatch()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<MapScene | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  // Latest state for the click handlers, which the scene keeps for its whole life.
  const latest = useRef({ state, dispatch, navigate })
  latest.current = { state, dispatch, navigate }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scene = new MapScene(canvas, {
      onClick: (id) => latest.current.dispatch({ type: 'MOVE_PARTY_TO', hexId: id }),
      onDoubleClick: (id) => {
        const { state: s, dispatch: d, navigate: nav } = latest.current
        if (s.hexes[id]) {
          d({ type: 'SELECT_HEX', hexId: id })
          nav(`/hex/${id}`)
        } else {
          d({ type: 'MOVE_PARTY_TO', hexId: id })
        }
      },
    })
    let cancelled = false
    scene
      .init()
      .then(() => {
        if (cancelled) return
        sceneRef.current = scene
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        console.error('3D map failed to start', e)
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      })
    return () => {
      cancelled = true
      sceneRef.current = null
      scene.dispose()
    }
  }, [])

  const draws = useMemo(() => tileDraws(state, gmView), [state, gmView])
  const markers = useMemo<MarkerView>(
    () => ({
      partyHexId: state.partyHexId,
      selectedHexId: state.selectedHexId,
      poiHexIds: Object.values(state.hexes)
        .filter((h) => h.poi)
        .map((h) => h.id),
      danger: Object.values(state.hexes).map((h) => ({ hexId: h.id, danger: h.danger })),
    }),
    [state.hexes, state.partyHexId, state.selectedHexId],
  )

  // Rebuild the tiles when the solved map changes (and once the scene is ready), then look at
  // the party.
  useEffect(() => {
    const scene = sceneRef.current
    if (status !== 'ready' || !scene) return
    const st = latest.current.state
    scene.setTiles(tileDraws(st, gmView), st.tiles, st.world?.seed ?? 0)
    if (latest.current.state.partyHexId) scene.focus(latest.current.state.partyHexId)
    // gmView changes are handled by setView below; only tiles/world rebuild the mesh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, state.tiles, state.world])

  useEffect(() => {
    if (status === 'ready') sceneRef.current?.setView(draws, markers)
  }, [status, draws, markers])

  return (
    <div className="three-map">
      <canvas ref={canvasRef} data-map-3d={status} />
      {status === 'loading' && <div className="three-map-status">Loading the 3D map…</div>}
      {status === 'error' && (
        <div className="three-map-status">
          The 3D map couldn't start{error ? `: ${error}` : ''}. The 2D map still works.
        </div>
      )}
    </div>
  )
}
