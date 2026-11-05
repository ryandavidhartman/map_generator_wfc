import { useState } from 'react'
import { useMapDispatch, useMapState } from '../../state/MapContext'
import { isAdjacentToParty, type Hex } from '../../state/mapReducer'
import { TERRAIN_ORDER, type DangerLevel, type Terrain } from '../../data/tables'
import { TERRAIN_TO_ENCOUNTER_KEYS } from '../../data/encounterTables'
import { EncounterRoller } from '../EncounterRoller'

const DANGER_LEVELS: DangerLevel[] = ['Safe', 'Unsafe', 'Risky', 'Deadly']

// Shared by every hex full-view variant (wilderness/dungeon/settlement): id/terrain/danger/poi
// display, move/reroll/edit actions (ported from the now-retired HexDetailsPanel sidebar), and
// the standalone random-encounter roller.
export function HexBaseInfo({ hex }: { hex: Hex }) {
  const state = useMapState()
  const dispatch = useMapDispatch()
  const [editing, setEditing] = useState(false)

  const isParty = state.partyHexId === hex.id
  const canMoveHere = !isParty && isAdjacentToParty(state, hex.id)

  if (editing) {
    return <HexEditForm hex={hex} onDone={() => setEditing(false)} />
  }

  return (
    <div className="hex-base-info">
      <h2>
        Hex {hex.id} {isParty && <span title="Party is here">🧭</span>}
      </h2>
      <p>
        <strong>Terrain:</strong> {hex.terrain}
      </p>
      <p>
        <strong>Danger:</strong> {hex.danger}
      </p>
      <p>
        <strong>Danger Level:</strong> {hex.dangerLevel ?? 1}
      </p>
      {hex.poi ? (
        <div>
          <p>
            <strong>Point of interest:</strong> {hex.poi.location}
          </p>
          {hex.poi.development && <p>{hex.poi.development}</p>}
          {hex.poi.cataclysm && (
            <p>
              <strong>Cataclysm:</strong> {hex.poi.cataclysm}
            </p>
          )}
          {hex.poi.naturalLandmark && (
            <p>
              <strong>Landmark:</strong> {hex.poi.naturalLandmark}
            </p>
          )}
          {hex.poi.settlementName && (
            <p>
              <strong>Settlement name:</strong> {hex.poi.settlementName}
            </p>
          )}
        </div>
      ) : (
        <p>No point of interest.</p>
      )}

      <div className="hex-details-actions">
        {canMoveHere && (
          <button type="button" onClick={() => dispatch({ type: 'MOVE_PARTY_TO', hexId: hex.id })}>
            Move party here
          </button>
        )}
        <button type="button" onClick={() => dispatch({ type: 'REROLL_HEX', hexId: hex.id })}>
          Reroll danger/POI
        </button>
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>

      <EncounterRoller
        tableKeys={TERRAIN_TO_ENCOUNTER_KEYS[hex.terrain]}
        wildernessTerrain={hex.terrain}
        hexDangerLevel={hex.dangerLevel ?? 1}
      />
    </div>
  )
}

function HexEditForm({ hex, onDone }: { hex: Hex; onDone: () => void }) {
  const dispatch = useMapDispatch()
  const [terrain, setTerrain] = useState<Terrain>(hex.terrain)
  const [danger, setDanger] = useState<DangerLevel>(hex.danger)
  const [dangerLevel, setDangerLevel] = useState(hex.dangerLevel ?? 1)
  const [hasPoi, setHasPoi] = useState(Boolean(hex.poi))
  const [location, setLocation] = useState(hex.poi?.location ?? '')
  const [development, setDevelopment] = useState(hex.poi?.development ?? '')

  function handleSave() {
    dispatch({
      type: 'EDIT_HEX',
      hexId: hex.id,
      patch: {
        terrain,
        danger,
        dangerLevel,
        poi: hasPoi ? { location, development } : undefined,
      },
    })
    onDone()
  }

  return (
    <div className="hex-edit-form">
      <h2>Edit hex {hex.id}</h2>

      <label>
        Terrain
        <select value={terrain} onChange={(e) => setTerrain(e.target.value as Terrain)}>
          {TERRAIN_ORDER.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label>
        Danger
        <select value={danger} onChange={(e) => setDanger(e.target.value as DangerLevel)}>
          {DANGER_LEVELS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <label>
        Danger Level
        <input
          type="number"
          min={1}
          value={dangerLevel}
          onChange={(e) => setDangerLevel(Math.max(1, Number(e.target.value) || 1))}
        />
      </label>

      <label>
        <input type="checkbox" checked={hasPoi} onChange={(e) => setHasPoi(e.target.checked)} />
        Has point of interest
      </label>

      {hasPoi && (
        <>
          <label>
            Location
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          <label>
            Development
            <input value={development} onChange={(e) => setDevelopment(e.target.value)} />
          </label>
        </>
      )}

      <div className="hex-edit-actions">
        <button type="button" className="primary" onClick={handleSave}>
          Save
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  )
}
