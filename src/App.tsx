import './App.css'
import { Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import { HexGridSvg } from './render2d/HexGridSvg'
import { StartMapDialog } from './components/StartMapDialog'
import { Toolbar } from './components/Toolbar'
import { Legend } from './components/Legend'
import { HexDetailPage } from './routes/HexDetailPage'
import { PoiReviewPage } from './routes/PoiReviewPage'
import { MapProvider, useMapState } from './state/MapContext'

const GM_VIEW_KEY = 'wfc-hex-crawl:gmView'

// GM view is a per-browser viewing preference, not campaign data, so it's kept apart from the save.
function loadGmView(): boolean {
  try {
    return localStorage.getItem(GM_VIEW_KEY) === '1'
  } catch {
    return false
  }
}

function OverlandMapScreen() {
  const state = useMapState()
  const [gmView, setGmView] = useState(loadGmView)

  function toggleGmView() {
    setGmView((on) => {
      try {
        localStorage.setItem(GM_VIEW_KEY, on ? '0' : '1')
      } catch {
        // storage unavailable: the toggle still works for this session
      }
      return !on
    })
  }

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
      <Toolbar gmView={gmView} onToggleGmView={toggleGmView} />
      <div className="app-body">
        <div className="map-area">
          <HexGridSvg gmView={gmView} />
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
