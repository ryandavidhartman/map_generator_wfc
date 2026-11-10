import { useState } from 'react'
import { useMapDispatch, useMapState } from '../../state/MapContext'
import type { PlannedHex } from '../../state/mapReducer'
import { ALL_TERRAINS, type DangerLevel, type Terrain } from '../../data/tables'
import { geoAt } from '../../world/hexTiles'
import { CUSTOM_POI_HINT, FEATURE_OPTIONS, featureOptionFor, featureSummary } from './featureOptions'

const DANGER_LEVELS: DangerLevel[] = ['Safe', 'Unsafe', 'Risky', 'Deadly']
const ROLL = 'roll'

type PoiMode = 'roll' | 'none' | 'feature' | 'custom'

function poiSummary(plan: PlannedHex | undefined): string {
  if (plan?.poiFeature) return `${featureSummary(plan.poiFeature)}, its details rolled at reveal`
  if (plan?.poi === undefined) return 'rolled at reveal'
  if (plan.poi === null) return 'none'
  return `${plan.poi.location} (custom)`
}

// The hex page for a solved hex the party hasn't revealed (PLAN.md punch-list item 3), opened by
// double-clicking it in GM view. The GM can plan its terrain, danger, Danger Level and point of
// interest; whatever is planned is used when the party reveals it, and the rest rolls then.
// A planned hex is locked: later map growth and GM edits nearby never reshape it.
export function PlannedHexView({ hexId }: { hexId: string }) {
  const state = useMapState()
  const dispatch = useMapDispatch()
  const [editing, setEditing] = useState(false)
  const plan = state.planned[hexId]
  const tileTerrain = state.world ? (geoAt(state.world, state.tiles, hexId)?.terrain ?? null) : null

  if (editing) return <PlanHexForm hexId={hexId} plan={plan} tileTerrain={tileTerrain} onDone={() => setEditing(false)} />

  return (
    <div className="hex-base-info planned-hex">
      <h2>Hex {hexId} (not revealed)</h2>
      <p className="edit-hint">
        GM only. The party hasn't been here yet. Anything you plan is used when they reveal this hex;
        anything left to roll is rolled then. A planned hex never changes shape when the map grows
        or when you edit hexes near it.
      </p>
      <p>
        <strong>Terrain:</strong> {plan?.terrain ?? tileTerrain ?? 'unknown'}
        {plan?.terrain && plan.terrain !== tileTerrain && tileTerrain && ` (the map's own: ${tileTerrain})`}
        {!plan?.terrain && ' (from the map)'}
      </p>
      {plan?.tileMismatch && (
        <p className="tile-mismatch-note">
          Tile mismatch: the map couldn't be reshaped to {plan.terrain} here, so {plan.terrain} is a label over the
          map's own terrain.
        </p>
      )}
      <p>
        <strong>Danger:</strong> {plan?.danger ?? 'rolled at reveal'}
      </p>
      <p>
        <strong>Danger Level:</strong> {plan?.dangerLevel ?? 'from the revealed neighbors, at reveal'}
      </p>
      <p>
        <strong>Point of interest:</strong> {poiSummary(plan)}
      </p>
      {!plan?.poiFeature && plan?.poi?.development && <p>{plan.poi.development}</p>}

      <div className="hex-details-actions">
        <button type="button" onClick={() => setEditing(true)}>
          {plan ? 'Edit plan' : 'Plan this hex'}
        </button>
        {plan && (
          <button type="button" onClick={() => dispatch({ type: 'CLEAR_PLAN', hexId })}>
            Clear plan
          </button>
        )}
      </div>
    </div>
  )
}

function PlanHexForm({
  hexId,
  plan,
  tileTerrain,
  onDone,
}: {
  hexId: string
  plan: PlannedHex | undefined
  tileTerrain: Terrain | null
  onDone: () => void
}) {
  const dispatch = useMapDispatch()
  const [terrain, setTerrain] = useState<string>(plan?.terrain ?? ROLL)
  const [danger, setDanger] = useState<string>(plan?.danger ?? ROLL)
  const [dangerLevel, setDangerLevel] = useState<string>(plan?.dangerLevel !== undefined ? String(plan.dangerLevel) : '')
  const [poiMode, setPoiMode] = useState<PoiMode>(
    plan?.poiFeature ? 'feature' : plan?.poi === undefined ? 'roll' : plan.poi === null ? 'none' : 'custom',
  )
  const [feature, setFeature] = useState<number>(
    plan?.poiFeature ? featureOptionFor(plan.poiFeature) : FEATURE_OPTIONS[0].roll,
  )
  const [location, setLocation] = useState(plan?.poi?.location ?? '')
  const [development, setDevelopment] = useState(plan?.poi?.development ?? '')

  function handleSave() {
    const next: PlannedHex = {}
    if (terrain !== ROLL) next.terrain = terrain as Terrain
    if (danger !== ROLL) next.danger = danger as DangerLevel
    if (dangerLevel.trim() !== '') next.dangerLevel = Math.max(1, Number(dangerLevel) || 1)
    if (poiMode === 'none') next.poi = null
    if (poiMode === 'feature') next.poiFeature = feature
    if (poiMode === 'custom') next.poi = { location, development }
    dispatch({ type: 'PLAN_HEX', hexId, plan: next })
    onDone()
  }

  return (
    <div className="hex-edit-form">
      <h2>Plan hex {hexId}</h2>

      <p className="edit-hint">
        Changing the terrain reshapes the map here, as editing a revealed hex does: Ocean, Coast, Hills
        and Mountain change this hex's tile and re-solve unplanned, unrevealed hexes nearby. Between
        Grassland, Forest/jungle, Swamp and Desert/arctic, only the label changes.
      </p>
      <label>
        Terrain
        <select value={terrain} onChange={(e) => setTerrain(e.target.value)}>
          <option value={ROLL}>From the map ({tileTerrain ?? 'unknown'})</option>
          {ALL_TERRAINS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label>
        Danger
        <select value={danger} onChange={(e) => setDanger(e.target.value)}>
          <option value={ROLL}>Roll at reveal</option>
          {DANGER_LEVELS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <label>
        Danger Level (leave empty to work it out from the revealed neighbors at reveal)
        <input type="number" min={1} value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)} />
      </label>

      <label>
        Point of interest
        <select value={poiMode} onChange={(e) => setPoiMode(e.target.value as PoiMode)}>
          <option value="roll">Roll at reveal (the usual 1-in-6 chance)</option>
          <option value="none">None</option>
          <option value="feature">Pick from the Feature table</option>
          <option value="custom">Custom (write your own)</option>
        </select>
      </label>

      {poiMode === 'feature' && (
        <label>
          Feature (its details, such as a settlement's name or a dungeon's type, are rolled at reveal
          from this row, exactly as if the d200 had landed on it)
          <select value={feature} onChange={(e) => setFeature(Number(e.target.value))}>
            {FEATURE_OPTIONS.map((o) => (
              <option key={o.roll} value={o.roll}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {poiMode === 'custom' && (
        <>
          <p className="edit-hint">{CUSTOM_POI_HINT}</p>
          <label>
            Name (what the party finds, e.g. "Drowned keep" or "Witch's hut")
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          <label>
            Notes (optional, e.g. "Flooded to the second floor")
            <input value={development} onChange={(e) => setDevelopment(e.target.value)} />
          </label>
        </>
      )}

      <div className="hex-edit-actions">
        <button type="button" className="primary" onClick={handleSave}>
          Save plan
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  )
}
