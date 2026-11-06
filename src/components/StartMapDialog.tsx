import { useState } from 'react'
import { useMapDispatch } from '../state/MapContext'
import { ALL_TERRAINS, type Terrain } from '../data/tables'
import { rollStartingTerrain } from '../engine/generateHex'
import { createStartingWorld, seedFromText, type StartProgress } from '../world/startWorld'
import { hasOutdatedSave } from '../persistence/localStorage'
import { useCampaignFileLoader } from './useCampaignFile'
import { solveInWorker } from '../world/workerSolver'

export function StartMapDialog() {
  const dispatch = useMapDispatch()
  const [terrain, setTerrain] = useState<Terrain>('Grassland')
  const [seedText, setSeedText] = useState('')
  const [outdated] = useState(hasOutdatedSave)
  const loader = useCampaignFileLoader()
  const [progress, setProgress] = useState<StartProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const working = progress !== null

  function handleRoll() {
    setTerrain(rollStartingTerrain())
  }

  async function handleStart() {
    setError(null)
    setProgress({ attempt: 0, chunksSolved: 0, chunksTotal: 7 })
    try {
      const start = await createStartingWorld(seedFromText(seedText), terrain, solveInWorker, setProgress)
      if (!start.terrainMatched) console.warn(`No ${terrain} start found; starting on the origin hex instead.`)
      dispatch({ type: 'START_MAP', world: start.world, chunks: start.chunks, tiles: start.tiles, startHexId: start.startHexId })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setProgress(null)
    }
  }

  return (
    <div className="start-map-dialog">
      <h2>Start a new hex map</h2>
      {outdated && (
        <p className="start-notice">
          The map saved in this browser is from an older version of the app and can't be loaded.
          Starting a new map replaces it.
        </p>
      )}

      <label>
        Starting terrain
        <select value={terrain} disabled={working} onChange={(e) => setTerrain(e.target.value as Terrain)}>
          {ALL_TERRAINS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <button type="button" disabled={working} onClick={handleRoll}>
        Roll 3d6
      </button>

      <label>
        World seed (optional: a number or any word; blank for a random world)
        <input type="text" value={seedText} disabled={working} placeholder="random" onChange={(e) => setSeedText(e.target.value)} />
      </label>

      <button type="button" className="primary" disabled={working} onClick={handleStart}>
        {working ? 'Generating…' : 'Start Map'}
      </button>
      {progress && (
        <p className="start-progress">
          Solving the world: {progress.chunksSolved + 1} of {progress.chunksTotal} chunks
          {progress.attempt > 0 && ` (seed ${progress.attempt + 1}, looking for ${terrain})`}
        </p>
      )}
      {error && <p className="start-error">Couldn't generate the world: {error}</p>}

      <button type="button" disabled={working} onClick={loader.open}>
        Load a campaign from a file…
      </button>
      <input ref={loader.inputRef} type="file" accept=".json,application/json" hidden onChange={loader.onFile} />
      {loader.error && <p className="start-error">{loader.error}</p>}
    </div>
  )
}
