import { useMapState } from '../state/MapContext'
import { CampaignMenu } from './CampaignMenu'

type ToolbarProps = {
  gmView?: boolean
  onToggleGmView?: () => void
  view3d?: boolean
  onToggleView3d?: () => void
  growing?: boolean // a chunk of the world is being solved
}

export function Toolbar({ gmView, onToggleGmView, view3d, onToggleView3d, growing }: ToolbarProps) {
  const state = useMapState()

  return (
    <header className="toolbar">
      <h1>OSR Hex Crawl Generator</h1>
      <div className="toolbar-actions">
        {growing && <span className="toolbar-seed">Extending the map…</span>}
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
        {state.partyHexId && <CampaignMenu />}
      </div>
    </header>
  )
}
