// Browser side of the PNG export: render MapExportSvg off screen, draw it on a canvas, and
// download the PNG. Drawn at twice the on-screen size, for printing; very large maps are scaled
// down to keep the image under MAX_SIDE pixels a side (browsers refuse bigger canvases).

import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { MapState } from '../state/mapReducer'
import { exportBounds, MapExportSvg } from './MapExportSvg'

const MAX_SIDE = 8000
const PRINT_SCALE = 2

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function svgMarkup(state: MapState, gmView: boolean): string {
  const host = document.createElement('div')
  const root = createRoot(host)
  flushSync(() => root.render(<MapExportSvg state={state} gmView={gmView} />))
  const markup = host.innerHTML
  root.unmount()
  return markup
}

export async function exportMapPng(state: MapState, gmView: boolean): Promise<void> {
  const b = exportBounds(state, gmView)
  const scale = Math.min(PRINT_SCALE, MAX_SIDE / Math.max(b.width, b.height))
  const width = Math.round(b.width * scale)
  const height = Math.round(b.height * scale)
  const url = URL.createObjectURL(new Blob([svgMarkup(state, gmView)], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("Couldn't draw the map image"))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png'))
    downloadBlob(png, `hex-crawl-${state.world?.seed ?? 'map'}-${gmView ? 'gm' : 'player'}.png`)
  } finally {
    URL.revokeObjectURL(url)
  }
}
