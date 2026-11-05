import './App.css'
import { Routes, Route } from 'react-router-dom'
import { HexGridSvg } from './hexgrid/HexGridSvg'
import { StartMapDialog } from './components/StartMapDialog'
import { Toolbar } from './components/Toolbar'
import { Legend } from './components/Legend'
import { HexDetailPage } from './routes/HexDetailPage'
import { PoiReviewPage } from './routes/PoiReviewPage'
import { MapProvider, useMapState } from './state/MapContext'

function OverlandMapScreen() {
  const state = useMapState()

  if (!state.partyHexId) {
    return (
      <>
        <Toolbar />
        <div className="start-screen">
          <StartMapDialog />
        </div>
      </>
    )
  }

  return (
    <>
      <Toolbar />
      <div className="app-body">
        <div className="map-area">
          <HexGridSvg />
          <Legend />
        </div>
      </div>
    </>
  )
}

function App() {
  return (
    <MapProvider>
      <Routes>
        <Route path="/" element={<OverlandMapScreen />} />
        <Route path="/hex/:hexId" element={<HexDetailPage />} />
        <Route path="/poi/:n" element={<PoiReviewPage />} />
      </Routes>
    </MapProvider>
  )
}

export default App
