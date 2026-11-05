import { useMapDispatch, useMapState } from '../state/MapContext'

export function Toolbar({ gmView, onToggleGmView }: { gmView?: boolean; onToggleGmView?: () => void }) {
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
