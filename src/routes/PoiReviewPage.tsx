import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MapProvider, useMapState } from '../state/MapContext'
import { EMPTY_MAP_STATE, type MapState } from '../state/mapReducer'
import { ALL_TERRAINS, type Terrain } from '../data/tables'
import { locationFeatureForD200 } from '../data/locationTables'
import { pointOfInterestForFeatureRoll } from '../engine/generateHex'
import { HexSiteContent } from '../components/hexdetail/HexSiteContent'
import { ReviewWaterProvider, type ReviewWater } from '../state/ReviewWaterContext'
import { HEX_DIRS, TILE_LIST, TILE_TYPE } from '../wfc/tiles'
import { tileWaterEdges } from '../world/terrain'

const MIN_ROLL = 1
const MAX_ROLL = 200
const REVIEW_HEX_ID = '0,0'

// Review tool, not part of the normal GM flow: force-generates the site for a specific Location
// Generator Feature roll (1-200) so every row can be eyeballed directly, without needing to reveal
// hexes and hope the 1-in-6 POI check + d200 roll happen to land on the row being reviewed.
// Runs in its own throwaway MapProvider (persist={false}) so nothing here ever touches the real
// campaign's localStorage save — see MapContext.tsx's `initialState`/`persist` props.
const DANGER_LEVELS = Array.from({ length: 20 }, (_, i) => i + 1)

// The water picker (PLAN.md punch-list item 2): "From terrain" is the old behavior (no tile, so
// Ocean and Coast pick a random side); otherwise the settlement map gets the water of a real hex
// with the chosen tile and rotation. Every tile with a sea, shoreline or river edge (not open sea),
// plus a lake on a grass-only hex and a river end that ends in a lake.
const FROM_TERRAIN = 'terrain'
const LAKE = 'LAKE'
const RIVER_END_LAKE = 'RIVER_END+LAKE'
const WATER_TILES = TILE_LIST.filter((t) => t.name !== 'WATER' && HEX_DIRS.some((d) => ['water', 'coast', 'river'].includes(t.edges[d]))).map((t) => t.name)
const WATER_OPTIONS = [
  { value: FROM_TERRAIN, label: 'From terrain (no tile)' },
  ...WATER_TILES.map((name) => ({ value: name, label: name })),
  { value: RIVER_END_LAKE, label: 'RIVER_END ending in a lake' },
  { value: LAKE, label: 'Lake (plain grass hex)' },
]
const RANDOM_ROTATION = -1

function reviewWaterFor(choice: string, rotation: number): ReviewWater | null {
  if (choice === FROM_TERRAIN) return null
  if (choice === LAKE) {
    return { label: 'lake on a grass-only hex', terrain: 'Grassland', edges: { seaEdges: [], coastEdges: [], riverEdges: [], lake: true } }
  }
  const tileName = choice === RIVER_END_LAKE ? 'RIVER_END' : choice
  const edges = tileWaterEdges(TILE_TYPE[tileName], rotation)
  const coast = edges.seaEdges.length + edges.coastEdges.length > 0
  return {
    label: `${tileName} @${rotation}${choice === RIVER_END_LAKE ? ' + lake' : ''}`,
    terrain: coast ? 'Coast' : 'Grassland',
    edges: { ...edges, lake: choice === RIVER_END_LAKE },
  }
}

export function PoiReviewPage() {
  const { n } = useParams<{ n: string }>()
  const navigate = useNavigate()
  const [terrain, setTerrain] = useState<Terrain>('Grassland')
  // No real neighbors exist for this synthetic hex to average against — this stands in for the
  // GM-facing local override the old campaign-wide partyLevel select used to provide here.
  const [dangerLevel, setDangerLevel] = useState(1)
  const [rerollNonce, setRerollNonce] = useState(0)
  const [waterChoice, setWaterChoice] = useState(FROM_TERRAIN)
  const [rotationChoice, setRotationChoice] = useState(RANDOM_ROTATION)
  // "Random" re-picks the rotation on each Reroll POI (and on a new tile).
  const rotation = useMemo(
    () => (rotationChoice === RANDOM_ROTATION ? Math.floor(Math.random() * 6) : rotationChoice),
    // rerollNonce and waterChoice aren't read: they deliberately trigger a fresh random pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rotationChoice, rerollNonce, waterChoice],
  )
  const reviewWater = useMemo(() => reviewWaterFor(waterChoice, rotation), [waterChoice, rotation])

  const roll = Number(n)
  const rollIsValid = Number.isInteger(roll) && roll >= MIN_ROLL && roll <= MAX_ROLL

  const initialState = useMemo<MapState | null>(() => {
    if (!rollIsValid) return null
    const poi = pointOfInterestForFeatureRoll(terrain, roll, Math.random)
    const hex = { id: REVIEW_HEX_ID, q: 0, r: 0, terrain, danger: 'Safe' as const, dangerLevel, poi }
    return { ...EMPTY_MAP_STATE, hexes: { [REVIEW_HEX_ID]: hex }, partyHexId: REVIEW_HEX_ID, selectedHexId: REVIEW_HEX_ID }
    // rerollNonce isn't read above — bumping it deliberately forces this memo (and thus the keyed
    // MapProvider below) to recompute with a fresh Math.random() roll for the same feature.
  }, [terrain, roll, rollIsValid, dangerLevel, rerollNonce])

  return (
    <div className="hex-detail-page poi-review-page">
      <button type="button" className="back-link" onClick={() => navigate('/')}>
        ← Back to map
      </button>

      <div className="poi-review-controls">
        <h2>POI Review</h2>
        <div className="poi-review-nav">
          <button type="button" disabled={roll <= MIN_ROLL} onClick={() => navigate(`/poi/${roll - 1}`)}>
            ← Prev
          </button>
          <span>
            Roll {rollIsValid ? roll : '?'} of {MAX_ROLL}
          </span>
          <button type="button" disabled={roll >= MAX_ROLL} onClick={() => navigate(`/poi/${roll + 1}`)}>
            Next →
          </button>
        </div>
        {rollIsValid && (
          <p>
            <strong>Feature:</strong> {locationFeatureForD200(roll).feature}
          </p>
        )}
        <label>
          Terrain (affects the terrain-keyed Cataclysm/Natural landmark rows, and a settlement's sea/river — there are no neighbors here, so Ocean and Coast pick a random side)
          <select value={terrain} onChange={(e) => setTerrain(e.target.value as Terrain)}>
            {ALL_TERRAINS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Water (a settlement's sea, lake or river, as on a real hex with this tile; "From terrain" uses the Terrain above)
          <select value={waterChoice} onChange={(e) => setWaterChoice(e.target.value)}>
            {WATER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {waterChoice !== FROM_TERRAIN && waterChoice !== LAKE && (
          <label>
            Rotation (60° steps clockwise; random re-picks on each reroll)
            <select value={rotationChoice} onChange={(e) => setRotationChoice(Number(e.target.value))}>
              <option value={RANDOM_ROTATION}>random ({rotation})</option>
              {[0, 1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Danger Level (gates wandering-encounter difficulty and dungeon-site scaling)
          <select value={dangerLevel} onChange={(e) => setDangerLevel(Number(e.target.value))}>
            {DANGER_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setRerollNonce((v) => v + 1)}>
          Reroll POI
        </button>
      </div>

      {!rollIsValid || !initialState ? (
        <p>
          Invalid roll — enter a number between {MIN_ROLL} and {MAX_ROLL} in the URL (e.g. /poi/135).
        </p>
      ) : (
        <ReviewWaterProvider value={reviewWater}>
          <MapProvider key={`${roll}-${terrain}-${dangerLevel}-${rerollNonce}`} initialState={initialState} persist={false}>
            <PoiReviewBody />
          </MapProvider>
        </ReviewWaterProvider>
      )}
    </div>
  )
}

function PoiReviewBody() {
  const state = useMapState()
  const hex = state.hexes[REVIEW_HEX_ID]
  return <HexSiteContent hex={hex} />
}
