import { useMapDispatch, useMapState } from '../state/MapContext'

export function Toolbar() {
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
        {state.partyHexId && (
          <button type="button" onClick={handleNewMap}>
            New Map
          </button>
        )}
      </div>
    </header>
  )
}
