import { useState } from 'react'
import { useMapDispatch } from '../state/MapContext'
import { ALL_TERRAINS, type Terrain } from '../data/tables'
import { rollStartingTerrain } from '../engine/generateHex'
import { createStartingWorld, randomWorldSeed, type StartProgress } from '../world/startWorld'
import { solveInWorker } from '../world/workerSolver'

export function StartMapDialog() {
  const dispatch = useMapDispatch()
  const [terrain, setTerrain] = useState<Terrain>('Grassland')
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
      const start = await createStartingWorld(randomWorldSeed(), terrain, solveInWorker, setProgress)
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
    </div>
  )
}
