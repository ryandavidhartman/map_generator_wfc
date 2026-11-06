// Town-map screenshots for checking settlement-map changes (rivers, coasts, layout). Usage:
//   npm run town-maps -- [--type Town] [--seed 7] [--rotation 0] [--tiles RIVER_B,COAST_A] [--png]
// Renders one town map per case with the real SettlementMapSvg, into
// node_modules/.tmp/town-maps/town-maps.html, laid out in a labeled grid. The cases are: no
// water, a coast with no tile (an Ocean hex's random side), and every water tile in TILE_LIST
// (or just the --tiles listed) at --rotation, with its edges sent through waterForEdges exactly
// as a real hex with that tile would. --png also screenshots the page with headless Chromium
// (see CLAUDE.md, "2D and town-map checks") into town-maps.png next to it.
//
// The town (districts, seat, population) comes from generateSettlement with a seeded rng, so the
// same --type and --seed give the same town in every case and only the water changes.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SettlementType } from '../src/data/settlementTables'
import type { Terrain } from '../src/data/tables'
import { generateSettlement } from '../src/engine/generateSettlement'
import { computeSettlementPlan, waterForEdges, type SettlementWaterInput } from '../src/engine/settlementPlan'
import { SettlementMapSvg } from '../src/hexgrid/SettlementMapSvg'
import { HEX_DIRS, rotateHexEdges, TILE_LIST, type HexDir, type TileDef } from '../src/wfc/tiles'

const argValue = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const type = (argValue('type') ?? 'Town') as SettlementType
const seed = Number(argValue('seed') ?? 7)
const rotation = Number(argValue('rotation') ?? 0)
const only = argValue('tiles')?.split(',')
const png = process.argv.includes('--png')
const outDir = resolve('node_modules/.tmp/town-maps')

function seededRng(s: number): () => number {
  let state = s >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

// A tile's sea, coast and river edges after rotation, sorted the way deriveHexGeo does
// (world/terrain.ts): 'water' edges are sea, 'coast' edges shoreline, 'river' edges river.
function edgesOf(tile: TileDef, turn: number) {
  const edges = rotateHexEdges(tile.edges, turn)
  const of = (kind: string): HexDir[] => HEX_DIRS.filter((d) => edges[d] === kind)
  return { seaEdges: of('water'), coastEdges: of('coast'), riverEdges: of('river') }
}

type Case = { label: string; water: SettlementWaterInput | null }
const cases: Case[] = []
if (!only) {
  cases.push({ label: 'no water', water: null })
  cases.push({ label: 'Ocean hex (coast, random side)', water: { kind: 'coast' } })
}
for (const tile of TILE_LIST) {
  const e = edgesOf(tile, rotation)
  if (e.seaEdges.length + e.coastEdges.length + e.riverEdges.length === 0) continue
  if (tile.name === 'WATER') continue // open sea: no town map
  if (only && !only.includes(tile.name)) continue
  // A tile with sea or shoreline edges is a Coast hex (world/terrain.ts); the rest are land.
  const terrain: Terrain = e.seaEdges.length + e.coastEdges.length > 0 ? 'Coast' : 'Grassland'
  cases.push({ label: `${tile.name} @${rotation} (${terrain})`, water: waterForEdges(terrain, e) })
}

const site = generateSettlement(seededRng(seed), type)
const districts = Object.fromEntries(site.districts.map((d) => [d.id, { label: String(d.index + 1), isSeat: d.isSeatOfGovernment }]))
const cells = cases.map(({ label, water }) => {
  const plan = computeSettlementPlan({
    settlementType: site.settlementType,
    districts: site.districts,
    seedSource: `${site.settlementType}|${site.population}|${seed}`,
    water,
  })
  const svg = renderToStaticMarkup(createElement(SettlementMapSvg, { plan, districts, selectedDistrictId: null, onSelectDistrict: () => {} }))
  return `<figure><figcaption>${label}</figcaption><div class="map">${svg}</div></figure>`
})

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Town maps</title><style>
body { margin: 8px; background: #fff; font: 13px sans-serif; display: grid; grid-template-columns: repeat(3, 400px); gap: 8px; }
figure { margin: 0; } figcaption { height: 18px; } .map { width: 400px; height: 400px; } .map svg { width: 100%; height: 100%; }
</style></head><body>${cells.join('')}</body></html>`

mkdirSync(outDir, { recursive: true })
const htmlPath = join(outDir, 'town-maps.html')
writeFileSync(htmlPath, html)
console.log(`${cases.length} town maps (${type}, seed ${seed}) -> ${htmlPath}`)

// Headless Chromium from the Playwright browser cache (there's no playwright package); the
// newest chromium_headless_shell-* wins. Set CHROME to use another binary.
function findChrome(): string | null {
  if (process.env.CHROME) return process.env.CHROME
  const cache = join(homedir(), '.cache/ms-playwright')
  if (!existsSync(cache)) return null
  const dirs = readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort()
  for (const dir of dirs.reverse()) {
    const bin = join(cache, dir, 'chrome-headless-shell-linux64/chrome-headless-shell')
    if (existsSync(bin)) return bin
  }
  return null
}

if (png) {
  const chrome = findChrome()
  if (!chrome) {
    console.error('No headless Chromium found: set CHROME, or install one (npx playwright install chromium-headless-shell).')
    process.exit(1)
  }
  const rows = Math.ceil(cases.length / 3)
  const pngPath = join(outDir, 'town-maps.png')
  execFileSync(chrome, ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--window-size=1240,${rows * 434 + 16}`, `--screenshot=${pngPath}`, `file://${htmlPath}`], { stdio: 'ignore' })
  console.log(`screenshot -> ${pngPath}`)
}
