// Loading a campaign file (M8), shared by the Campaign menu and the start dialog: a hidden file
// input, a confirmation before replacing a campaign in progress, and an error to show.

import { useRef, useState, type ChangeEvent } from 'react'
import { campaignFromJson } from '../persistence/localStorage'
import { useMapDispatch, useMapState } from '../state/MapContext'

export function useCampaignFileLoader() {
  const state = useMapState()
  const dispatch = useMapDispatch()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // so choosing the same file again still fires
    if (!file) return
    const { state: loaded, error } = campaignFromJson(await file.text())
    if (!loaded) {
      setError(error)
      return
    }
    if (state.partyHexId && !window.confirm(`Replace the current campaign with "${file.name}"?`)) return
    setError(null)
    dispatch({ type: 'LOAD_MAP', state: loaded })
  }

  return { inputRef, onFile, error, open: () => inputRef.current?.click() }
}
