// Grows the solved world around the party (world/growth.ts): whenever the party moves or a
// chunk lands, solve the nearest unsolved chunk within GROW_RADIUS in the worker, then
// dispatch ADD_CHUNK. One solve at a time, so each starts from the latest tiles.

import { useEffect, useRef, useState } from 'react'
import { chunkKey } from '../wfc/chunks'
import { chunksToGrow, lockedKeys } from '../world/growth'
import { tilesToStore } from '../world/hexTiles'
import type { ChunkSolver } from '../world/startWorld'
import { solveInWorker } from '../world/workerSolver'
import { useMapDispatch, useMapState } from './MapContext'

export function useChunkGrowth(solver: ChunkSolver = solveInWorker): { growing: boolean } {
  const state = useMapState()
  const dispatch = useMapDispatch()
  const [growing, setGrowing] = useState(false)
  const [retry, setRetry] = useState(0)
  const busy = useRef(false)
  const failed = useRef(new Set<string>()) // chunks that couldn't be solved this session
  const latestWorld = useRef(state.world)
  latestWorld.current = state.world

  useEffect(() => {
    const { world, partyHexId } = state
    if (busy.current || !world || !partyHexId) return
    const next = chunksToGrow(state.chunks, partyHexId).find((c) => !failed.current.has(chunkKey(c)))
    if (!next) return
    busy.current = true
    setGrowing(true)
    const key = chunkKey(next)
    solver(tilesToStore(state.tiles), next, world, lockedKeys(Object.keys(state.hexes)))
      .then((res) => {
        if (latestWorld.current !== world) return // a new map was started meanwhile
        if (res.ok) {
          dispatch({ type: 'ADD_CHUNK', chunk: key, updates: res.updates })
        } else {
          failed.current.add(key)
          console.error(`Couldn't solve chunk ${key}: ${res.error ?? 'no solution'}`)
        }
      })
      .catch((e: unknown) => {
        failed.current.add(key)
        console.error(`Couldn't solve chunk ${key}`, e)
      })
      .finally(() => {
        busy.current = false
        setGrowing(false)
        setRetry((n) => n + 1) // look again: the party may have moved on meanwhile
      })
  }, [state, solver, dispatch, retry])

  return { growing }
}
