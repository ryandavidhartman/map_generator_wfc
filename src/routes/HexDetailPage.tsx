import { useNavigate, useParams } from 'react-router-dom'
import { useMapState } from '../state/MapContext'
import { HexSiteContent } from '../components/hexdetail/HexSiteContent'

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
      {!hex ? <p>Hex not found.</p> : <HexSiteContent hex={hex} />}
    </div>
  )
}
