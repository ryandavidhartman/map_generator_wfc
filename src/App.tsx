import './App.css'
import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense, useState } from 'react'
import { HexGridSvg } from './render2d/HexGridSvg'
import { StartMapDialog } from './components/StartMapDialog'
import { Toolbar } from './components/Toolbar'
import { Legend } from './components/Legend'
import { HexDetailPage } from './routes/HexDetailPage'
import { PoiReviewPage } from './routes/PoiReviewPage'
import { MapProvider, useMapState } from './state/MapContext'

// Three.js and the 3D models load only when the 3D view is first opened.
const ThreeMapView = lazy(() => import('./render3d/ThreeMapView'))

// GM view and 2D/3D are per-browser viewing preferences, not campaign data, so they're kept
// apart from the save.
function usePreference(key: string): [boolean, () => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })
  function toggle() {
    setOn((was) => {
      try {
        localStorage.setItem(key, was ? '0' : '1')
      } catch {
        // storage unavailable: the toggle still works for this session
      }
      return !was
    })
  }
  return [on, toggle]
}

function OverlandMapScreen() {
  const state = useMapState()
  const [gmView, toggleGmView] = usePreference('wfc-hex-crawl:gmView')
  const [view3d, toggleView3d] = usePreference('wfc-hex-crawl:view3d')

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
      <Toolbar gmView={gmView} onToggleGmView={toggleGmView} view3d={view3d} onToggleView3d={toggleView3d} />
      <div className="app-body">
        <div className="map-area">
          {view3d ? (
            <Suspense fallback={<div className="three-map-status">Loading the 3D map…</div>}>
              <ThreeMapView gmView={gmView} />
            </Suspense>
          ) : (
            <HexGridSvg gmView={gmView} />
          )}
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
