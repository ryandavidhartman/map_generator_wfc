import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react'
import { mapReducer, withMapStateDefaults, type MapAction, type MapState } from './mapReducer'
import { loadMapState, saveMapState } from '../persistence/localStorage'

const MapStateContext = createContext<MapState | null>(null)
const MapDispatchContext = createContext<Dispatch<MapAction> | null>(null)

function initMapState(): MapState {
  // See withMapStateDefaults for why a loaded save is merged over the empty state.
  return withMapStateDefaults(loadMapState())
}

// `initialState`/`persist` let a caller run an isolated, throwaway reducer instance instead of the
// real campaign map — used by PoiReviewPage.tsx so forcing a POI roll for review can never
// overwrite the real map's localStorage save. Omit both for the normal app usage (loads/persists
// the real campaign, unchanged).
export function MapProvider({
  children,
  initialState,
  persist = true,
}: {
  children: ReactNode
  initialState?: MapState
  persist?: boolean
}) {
  const [state, dispatch] = useReducer(mapReducer, undefined, () => initialState ?? initMapState())

  useEffect(() => {
    if (persist) saveMapState(state)
  }, [state, persist])

  return (
    <MapStateContext.Provider value={state}>
      <MapDispatchContext.Provider value={dispatch}>{children}</MapDispatchContext.Provider>
    </MapStateContext.Provider>
  )
}

export function useMapState(): MapState {
  const state = useContext(MapStateContext)
  if (!state) throw new Error('useMapState must be used within a MapProvider')
  return state
}

export function useMapDispatch(): Dispatch<MapAction> {
  const dispatch = useContext(MapDispatchContext)
  if (!dispatch) throw new Error('useMapDispatch must be used within a MapProvider')
  return dispatch
}
