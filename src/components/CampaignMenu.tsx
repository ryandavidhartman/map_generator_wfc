// The Campaign menu (M8): what's saved and how big, saving to and loading from a file, PNG
// exports of the 2D map, and starting a new map.

import { useState } from 'react'
import { campaignFileName, campaignToJson, STORAGE_BUDGET_CHARS } from '../persistence/localStorage'
import { useMapDispatch, useMapState, useSaveInfo } from '../state/MapContext'
import { useCampaignFileLoader } from './useCampaignFile'

const WARN_SHARE = 0.7

export function CampaignMenu() {
  const state = useMapState()
  const dispatch = useMapDispatch()
  const save = useSaveInfo()
  const loader = useCampaignFileLoader()
  const [busy, setBusy] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const share = save ? save.chars / STORAGE_BUDGET_CHARS : 0
  const notSaved = save !== null && !save.ok
  const warn = notSaved || share >= WARN_SHARE

  async function saveToFile() {
    const { downloadBlob } = await import('../render2d/exportPng')
    downloadBlob(new Blob([campaignToJson(state)], { type: 'application/json' }), campaignFileName(state))
  }

  async function exportPng(gmView: boolean) {
    setBusy(gmView ? 'gm' : 'player')
    setExportError(null)
    try {
      const { exportMapPng } = await import('../render2d/exportPng')
      await exportMapPng(state, gmView)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  function newMap() {
    if (state.partyHexId && !window.confirm('Start a new map? This clears the current one (save it to a file first to keep it).')) return
    dispatch({ type: 'NEW_MAP' })
  }

  return (
    <details className="campaign-menu">
      <summary className={warn ? 'warn' : undefined}>Campaign{warn ? ' ⚠' : ''}</summary>
      <div className="campaign-menu-panel">
        {state.world && <p className="campaign-info">World seed {state.world.seed}</p>}
        {save && (
          <div className="campaign-info">
            <div className={`save-meter${warn ? ' warn' : ''}`} title="Share of this browser's storage the save uses">
              <span style={{ width: `${Math.min(100, share * 100)}%` }} />
            </div>
            {notSaved ? (
              <p className="save-warning">Not saved: this browser's storage is full or unavailable. Save to a file to keep this campaign.</p>
            ) : (
              <p>
                Saved in this browser: {(save.chars / 1_000_000).toFixed(2)} MB of about {STORAGE_BUDGET_CHARS / 1_000_000} MB ({Math.round(share * 100)}%)
                {share >= WARN_SHARE && ' — getting full; save to a file as a backup.'}
              </p>
            )}
          </div>
        )}
        <button type="button" onClick={saveToFile}>
          Save to file
        </button>
        <button type="button" onClick={loader.open}>
          Load from file…
        </button>
        <input ref={loader.inputRef} type="file" accept=".json,application/json" hidden onChange={loader.onFile} />
        {loader.error && <p className="save-warning">{loader.error}</p>}
        <button type="button" disabled={busy !== null} onClick={() => exportPng(false)} title="Only what the party has seen: a handout">
          {busy === 'player' ? 'Exporting…' : 'Export player map (PNG)'}
        </button>
        <button type="button" disabled={busy !== null} onClick={() => exportPng(true)} title="The whole solved world, unrevealed areas dimmed">
          {busy === 'gm' ? 'Exporting…' : 'Export GM map (PNG)'}
        </button>
        {exportError && <p className="save-warning">{exportError}</p>}
        <button type="button" onClick={newMap}>
          New map
        </button>
      </div>
    </details>
  )
}
