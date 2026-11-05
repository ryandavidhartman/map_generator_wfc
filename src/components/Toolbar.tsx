import { useMapDispatch, useMapState } from '../state/MapContext'

type ToolbarProps = {
  gmView?: boolean
  onToggleGmView?: () => void
  view3d?: boolean
  onToggleView3d?: () => void
}

export function Toolbar({ gmView, onToggleGmView, view3d, onToggleView3d }: ToolbarProps) {
  const state = useMapState()
  const dispatch = useMapDispatch()

  function handleNewMap() {
    if (state.partyHexId && !window.confirm('Start a new map? This clears the current one.')) {
      return
    }
    dispatch({ type: 'NEW_MAP' })
  }

  return (
    <header className="toolbar">
      <h1>OSR Hex Crawl Generator</h1>
      <div className="toolbar-actions">
        {state.world && <span className="toolbar-seed">World seed {state.world.seed}</span>}
        {state.partyHexId && onToggleView3d && (
          <button
            type="button"
            className={view3d ? 'active' : undefined}
            aria-pressed={view3d}
            title="Switch between the flat 2D map and the 3D map"
            onClick={onToggleView3d}
          >
            {view3d ? '3D' : '2D'} map
          </button>
        )}
        {state.partyHexId && onToggleGmView && (
          <button
            type="button"
            className={gmView ? 'active' : undefined}
            aria-pressed={gmView}
            title="Show the whole solved map, dimmed where the party hasn't been"
            onClick={onToggleGmView}
          >
            GM view: {gmView ? 'on' : 'off'}
          </button>
        )}
        {state.partyHexId && (
          <button type="button" onClick={handleNewMap}>
            New Map
          </button>
        )}
      </div>
    </header>
  )
}
