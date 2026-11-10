import { useNavigate, useParams } from 'react-router-dom'
import { useMapState } from '../state/MapContext'
import { HexSiteContent } from '../components/hexdetail/HexSiteContent'
import { PlannedHexView } from '../components/hexdetail/PlannedHexView'
import { isPlannable } from '../state/mapReducer'

export function HexDetailPage() {
  const { hexId } = useParams<{ hexId: string }>()
  const state = useMapState()
  const navigate = useNavigate()

  const hex = hexId ? state.hexes[hexId] : undefined

  return (
    <div className="hex-detail-page">
      <button type="button" className="back-link" onClick={() => navigate('/')}>
        ← Back to map
      </button>
      {hex ? (
        <HexSiteContent hex={hex} />
      ) : hexId && isPlannable(state, hexId) ? (
        // A solved hex the party hasn't revealed: the GM's planning view (item 3).
        <PlannedHexView hexId={hexId} />
      ) : (
        <p>Hex not found.</p>
      )}
    </div>
  )
}
