// Render smoke tests for the UI layer: every site view and its map renderer, the overland map, and
// the routes, rendered to static HTML (react-dom/server — no browser or DOM library needed). They
// catch render-time crashes, React warnings (e.g. duplicate keys), NaN/undefined leaking into SVG
// attributes, and map elements missing for generated rooms/districts/features. Effects don't run
// in a static render, so anything a view generates in useEffect isn't exercised here — sites are
// pre-generated instead. Visual quality still needs a real browser (see CLAUDE.md).
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { HexSiteContent } from './hexdetail/HexSiteContent'
import { HexGridSvg } from '../render2d/HexGridSvg'
import { MapProvider } from '../state/MapContext'
import { EMPTY_MAP_STATE, mapReducer, type Hex, type MapState } from '../state/mapReducer'
import { ALL_TERRAINS, type Terrain } from '../data/tables'
import { pointOfInterestForFeatureRoll } from '../engine/generateHex'
import { generateSiteForHex } from '../engine/generateSite'
import { computeVisibleCoords } from '../hexgrid/hexMath'
import { FEATURE_COLORS, TERRAIN_COLORS } from '../hexgrid/colors'
import { TILE_TYPE } from '../wfc/tiles'
import { FIXTURE_TILES, FIXTURE_WORLD, startMapAction } from '../state/testWorld'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const HEX_ID = '0,0'

// One hex with its site pre-generated, plus an Ocean neighbor on odd seeds so settlements also
// get drawn with a coast (waterForHex reads revealed neighbors from the map state).
function stateForFeature(roll: number, terrain: Terrain, seed: number, dangerLevel: number): { state: MapState; hex: Hex } {
  const rng = seededRng(seed)
  const poi = pointOfInterestForFeatureRoll(terrain, roll, rng)
  const site = poi.siteKind === 'none' ? undefined : generateSiteForHex(poi, rng, dangerLevel)
  const hex: Hex = { id: HEX_ID, q: 0, r: 0, terrain, danger: 'Risky', dangerLevel, poi, site }
  const hexes: MapState['hexes'] = { [HEX_ID]: hex }
  if (seed % 2 === 1) hexes['1,0'] = { id: '1,0', q: 1, r: 0, terrain: 'Ocean', danger: 'Safe', dangerLevel }
  return { state: { ...EMPTY_MAP_STATE, world: FIXTURE_WORLD, tiles: FIXTURE_TILES, hexes, partyHexId: HEX_ID, selectedHexId: HEX_ID }, hex }
}

function renderSite(state: MapState, hex: Hex): string {
  return renderToString(
    <MemoryRouter>
      <MapProvider initialState={state} persist={false}>
        <HexSiteContent hex={hex} />
      </MapProvider>
    </MemoryRouter>,
  )
}

function expectCleanMarkup(html: string) {
  expect(html).not.toMatch(/NaN/)
  expect(html).not.toMatch(/="undefined"|="null"/)
  expect(html).not.toMatch(/Generating site/)
}

const count = (html: string, needle: string) => html.split(needle).length - 1

let consoleError: MockInstance
let consoleWarn: MockInstance

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

// react-router's MemoryRouter uses useLayoutEffect, which React always warns about in a static
// render. It's an artifact of rendering on the server, not an app problem, so it's the one message
// ignored.
const isStaticRenderArtifact = (args: unknown[]) => String(args[0]).includes('useLayoutEffect does nothing on the server')

afterEach(() => {
  // Any other React warning (duplicate keys, invalid DOM nesting, bad props) fails the test.
  expect(consoleError.mock.calls.filter((args) => !isStaticRenderArtifact(args))).toEqual([])
  expect(consoleWarn.mock.calls).toEqual([])
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('site views render every Feature-table row', () => {
  // Two seeds per row, with terrain and danger level varied across rows.
  const cases = Array.from({ length: 200 }, (_, i) => i + 1).flatMap((roll) =>
    [1, 2].map((s) => ({ roll, seed: roll * 101 + s, terrain: ALL_TERRAINS[(roll + s) % ALL_TERRAINS.length], dangerLevel: 1 + ((roll * s) % 10) })),
  )

  it.each(cases)('row $roll (seed $seed, $terrain, DL $dangerLevel)', ({ roll, seed, terrain, dangerLevel }) => {
    const { state, hex } = stateForFeature(roll, terrain, seed, dangerLevel)
    const html = renderSite(state, hex)
    expectCleanMarkup(html)

    const site = hex.site
    if (!site) {
      expect(hex.poi?.siteKind).toBe('none')
      return
    }
    switch (site.kind) {
      case 'dungeon':
      case 'tower':
      case 'keep':
        expect(html).toContain('<svg')
        for (const room of site.rooms) expect(count(html, `data-room-id="${room.id}"`)).toBeGreaterThanOrEqual(1)
        break
      case 'settlement':
        expect(html).toContain('<svg')
        for (const d of site.districts) expect(count(html, `data-district-id="${d.id}"`)).toBeGreaterThanOrEqual(2)
        break
      case 'camp':
        expect(html).toContain('<svg')
        for (const id of ['central', ...site.peripheralFeatures.map((f) => f.id)]) {
          expect(count(html, `data-feature-id="${id}"`)).toBeGreaterThanOrEqual(2)
        }
        break
      case 'shrine':
      case 'rift':
        // No map for these kinds — just make sure the view rendered real content.
        expect(html.length).toBeGreaterThan(200)
        break
    }
  })

  it('a hex with no point of interest renders the wilderness view', () => {
    const hex: Hex = { id: HEX_ID, q: 0, r: 0, terrain: 'Forest/jungle', danger: 'Safe', dangerLevel: 1 }
    const html = renderSite({ ...EMPTY_MAP_STATE, hexes: { [HEX_ID]: hex }, partyHexId: HEX_ID, selectedHexId: HEX_ID }, hex)
    expectCleanMarkup(html)
    expect(html).not.toContain('<svg')
  })
})

describe('overland map', () => {
  function walkedMap(steps: number): MapState {
    const rng = seededRng(42)
    let state = mapReducer(EMPTY_MAP_STATE, { ...startMapAction(), rng })
    for (let q = 1; q <= steps; q++) state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: `${q},0`, rng })
    state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: `${steps},1`, rng })
    return state
  }

  function renderMap(state: MapState, gmView = false): string {
    return renderToString(
      <MemoryRouter>
        <MapProvider initialState={state} persist={false}>
          <HexGridSvg gmView={gmView} />
        </MapProvider>
      </MemoryRouter>,
    )
  }

  it('draws one tile per revealed hex plus its unrevealed frontier', () => {
    const state = walkedMap(12)
    const html = renderMap(state)
    expectCleanMarkup(html)
    const revealed = Object.values(state.hexes).map(({ q, r }) => ({ q, r }))
    expect(count(html, 'data-hex-id=')).toBe(computeVisibleCoords(revealed).length)
    for (const id of Object.keys(state.hexes)) expect(html).toContain(`data-hex-id="${id}"`)
    // The walk went through the fixture's water hex (2,0), which revealed as Ocean.
    expect(html).toContain('<title>Ocean')
  })

  it('GM view also draws every solved hex, with its terrain in the tooltip', () => {
    // A smaller solved area than the fixture's, to keep the render quick.
    const base = walkedMap(3)
    const tiles = Object.fromEntries(Object.entries(base.tiles).filter(([id]) => id.split(',').every((n) => Math.abs(Number(n)) <= 6)))
    const state = { ...base, tiles }
    const html = renderMap(state, true)
    expectCleanMarkup(html)
    const ids = new Set([...Object.keys(tiles), ...computeVisibleCoords(Object.values(state.hexes)).map(({ q, r }) => `${q},${r}`)])
    expect(count(html, 'data-hex-id=')).toBe(ids.size)
    expect(html).toContain('<title>Unrevealed: ')
  })

  it('draws an icon for each point of interest by its kind', () => {
    const base = walkedMap(2)
    const hexes = { ...base.hexes }
    const kinds = ['settlement', 'tower', 'keep', 'dungeon', 'shrine', 'camp', 'rift'] as const
    kinds.forEach((kind, i) => {
      const id = `${i},-1`
      hexes[id] = { id, q: i, r: -1, terrain: 'Grassland', danger: 'Safe', dangerLevel: 1, poi: { location: kind, development: '', siteKind: kind } }
    })
    const html = renderMap({ ...base, hexes })
    expectCleanMarkup(html)
    for (const kind of kinds) expect(html).toContain(`data-poi-icon="${kind}"`)
  })

  it('draws rivers, roads and the water side of a coast from the tile', () => {
    const base = walkedMap(1)
    // (0,-1) (north of the start, unrevealed): a river bend; (1,-1): a road; (-1,0): a coast.
    const tiles: MapState['tiles'] = { ...base.tiles, '0,-1': [TILE_TYPE.RIVER_B, 0, 0], '1,-1': [TILE_TYPE.ROAD_A, 0, 0], '-1,0': [TILE_TYPE.COAST_A, 0, 0] }
    const html = renderMap({ ...base, tiles }, true)
    expectCleanMarkup(html)
    expect(html).toContain(`stroke="${FEATURE_COLORS.river}"`)
    expect(html).toContain(`stroke="${FEATURE_COLORS.road}"`)
    expect(html).toContain(`fill="${TERRAIN_COLORS.Ocean}"`)
  })
})

describe('routes', () => {
  function memoryStorage(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial))
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
  }

  function renderRoute(path: string): string {
    return renderToString(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    )
  }

  it('/ with no save shows the start screen', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    const html = renderRoute('/')
    expect(html).toContain('start-screen')
    expect(html).not.toContain('data-hex-id')
  })

  it('/ with a save loads it and draws the overland map', () => {
    const { state } = stateForFeature(31, 'Grassland', 7, 2)
    vi.stubGlobal('localStorage', memoryStorage({ 'wfc-hex-crawl:map': JSON.stringify(state) }))
    const html = renderRoute('/')
    expectCleanMarkup(html)
    expect(html).toContain(`data-hex-id="${HEX_ID}"`)
  })

  it('/ opens the 3D view when that was the last view used (loaded lazily, so a static render shows its placeholder)', () => {
    const { state } = stateForFeature(31, 'Grassland', 7, 2)
    vi.stubGlobal('localStorage', memoryStorage({ 'wfc-hex-crawl:map': JSON.stringify(state), 'wfc-hex-crawl:view3d': '1' }))
    const html = renderRoute('/')
    expectCleanMarkup(html)
    expect(html).toContain('Loading the 3D map')
    expect(html).toContain('3D<!-- --> map')
    expect(html).not.toContain('data-hex-id')
  })

  it('/hex/:id renders a saved hex\'s site, and a missing hex says so', () => {
    const { state, hex } = stateForFeature(150, 'Grassland', 3, 2) // 150 = Village
    expect(hex.site?.kind).toBe('settlement')
    vi.stubGlobal('localStorage', memoryStorage({ 'wfc-hex-crawl:map': JSON.stringify(state) }))
    const html = renderRoute(`/hex/${HEX_ID}`)
    expectCleanMarkup(html)
    expect(html).toContain('data-district-id=')
    expect(renderRoute('/hex/9,9')).toContain('Hex not found')
  })

  it('/poi/:n renders the review controls, and rejects an out-of-range roll', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    // The site itself is generated in an effect, which a static render doesn't run.
    expect(renderRoute('/poi/25')).toContain('Roll <!-- -->25<!-- --> of <!-- -->200')
    expect(renderRoute('/poi/0')).toContain('Invalid roll')
    expect(renderRoute('/poi/abc')).toContain('Invalid roll')
  })
})
