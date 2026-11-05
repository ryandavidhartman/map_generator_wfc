// The 3D overland map: an imperative Three.js scene that ThreeMapView.tsx owns. React hands it
// what to draw (setTiles, setView) and gets clicks back by hex id.
//
// Renderer, camera, controls and lighting are ported from hex-map-wfc (src/App.js initCamera,
// src/Lighting.js), and the tile instancing from src/hexmap/HexGrid.js and HexTiles.js,
// Copyright (c) 2026 Felix Turner, MIT License:
// https://github.com/felixturner/hex-map-wfc/blob/main/LICENSE
// Decorations are placed as in hex-map-wfc's Decorations.js (geometry prep, one BatchedMesh,
// the shared material), and the frame loop follows its App.animate (depth-of-field focus from
// the camera distance).
// Changes:
// - TypeScript, one class; one BatchedMesh for the tiles and one for the decorations, for the
//   whole map, instead of a pair per 217-hex grid. What goes where is planned by scenery.ts.
// - No orthographic camera, GUI, stats, debug helpers, sounds or build animations.
// - Draws continuously only while something animates (the water); with the OS "reduce motion"
//   setting it draws only when something changes.
// - The renderer doesn't require WebGPU: WebGPURenderer falls back to WebGL2 by itself.
// - The light's shadow frustum follows the camera target as in hex-map-wfc, perspective only.
// - New: markers (party, points of interest, selection, danger rings) and click picking by hex.

import {
  BatchedMesh,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  EquirectangularReflectionMapping,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  PCFShadowMap,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGPURenderer,
  type Material,
} from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { DANGER_COLORS } from '../hexgrid/colors'
import { TILE_LIST } from '../wfc/tiles'
import type { SavedTiles } from '../world/hexTiles'
import { hexWorldPosition, instanceColor, isSeaTile, rotationAngle, TINT, tileBaseY, type TileDraw } from './layout'
import { PostFX } from './postFX'
import { ALL_DECORATION_MESHES, KEEP_Y_MESHES, MOUNTAIN_MESHES, planPoiModels, planScenery, poiHasModel, poiSlots } from './scenery'
import { createTileMaterial, RENDER_MODE, type TileMaterial } from './tileMaterial'
import { Water } from './water'
import { maskBounds, WavesMask } from './wavesMask'

const BACKGROUND = 0x98a4bb
const ENV_INTENSITY = 0.95
const DIR_LIGHT_INTENSITY = 2.15
const DIR_LIGHT_OFFSET = new Vector3(35, 50, 45)
const SHADOW_MAP_SIZE = 2048
const CAMERA_FOV = 20
const CAMERA_OFFSET = new Vector3(0, 55, 32) // from the target: about 11 hexes tall at the start
const DOUBLE_CLICK_DELAY_MS = 250
const CLICK_SLOP_PX = 5
const MASK_DELAY_FRAMES = 3
const DROP_HEIGHT = 4
const DROP_MS = 450
const DROP_STAGGER_MS = 45 // per hex from the middle of the new area

export type MarkerView = {
  partyHexId: string | null
  selectedHexId: string | null
  poiHexIds: string[]
  danger: { hexId: string; danger: keyof typeof DANGER_COLORS }[]
}

export type MapSceneCallbacks = {
  onClick: (hexId: string) => void
  onDoubleClick: (hexId: string) => void
}

type TileAssets = {
  geoms: Map<number, BufferGeometry>
  bottom: BufferGeometry | null
  decorations: Map<string, BufferGeometry>
  tileMaterial: TileMaterial
}

// Loaded once per page and shared by every MapScene (switching 2D/3D back and forth).
let assetsPromise: Promise<TileAssets> | null = null

function loadTileAssets(assetBase: string): Promise<TileAssets> {
  assetsPromise ??= (async () => {
    const [gltf, tileMaterial] = await Promise.all([
      new GLTFLoader().loadAsync(`${assetBase}models/hex-terrain.glb`),
      createTileMaterial(assetBase),
    ])
    const byName = new Map<string, BufferGeometry>()
    gltf.scene.traverse((child) => {
      const mesh = child as Mesh
      if (mesh.isMesh && mesh.geometry) byName.set(child.name, mesh.geometry)
    })
    // The GLB's origin is centered in XZ with the surface at y = 0; tiles sit with their base at
    // y = 0 and their surface at y = 1 (hex-map-wfc's HexTileGeometry.findAndProcessGeometry).
    const prepared = (name: string): BufferGeometry | null => {
      const g = byName.get(name)
      if (!g) return null
      const out = g.clone()
      out.translate(0, 1, 0)
      out.computeBoundingBox()
      out.computeBoundingSphere()
      return out
    }
    const geoms = new Map<number, BufferGeometry>()
    TILE_LIST.forEach((def, type) => {
      const g = prepared(def.mesh)
      if (g) geoms.set(type, g)
      else console.warn(`3D map: no mesh "${def.mesh}" for tile ${def.name}`)
    })
    // The fill under raised tiles: its top moved to y = 0 so it can be stretched down from a
    // tile's base.
    let bottom = prepared('hex_grass_bottom')
    if (bottom) {
      bottom.translate(0, -bottom.boundingBox!.max.y, 0)
      bottom.computeBoundingBox()
      bottom.computeBoundingSphere()
    }
    // Decorations sit with their lowest point at y = 0; mountains are sunk half a unit so they
    // look shorter (hex-map-wfc Decorations.initGeometries).
    const decorations = new Map<string, BufferGeometry>()
    for (const name of ALL_DECORATION_MESHES) {
      const g = byName.get(name)
      if (!g) {
        console.warn(`3D map: no decoration mesh "${name}"`)
        continue
      }
      const out = g.clone()
      out.computeBoundingBox()
      // Buildings keep their modeled origin height (hex-map-wfc keepYMeshes).
      if (!KEEP_Y_MESHES.has(name)) out.translate(0, -out.boundingBox!.min.y - (MOUNTAIN_MESHES.includes(name) ? 0.5 : 0), 0)
      out.computeBoundingBox()
      out.computeBoundingSphere()
      decorations.set(name, out)
    }
    return { geoms, bottom, decorations, tileMaterial }
  })()
  assetsPromise.catch(() => (assetsPromise = null))
  return assetsPromise
}

export class MapScene {
  private readonly canvas: HTMLCanvasElement
  private readonly callbacks: MapSceneCallbacks
  private readonly assetBase: string
  private renderer: WebGPURenderer | null = null
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(CAMERA_FOV, 1, 1, 1000)
  private controls: OrbitControls | null = null
  private light: DirectionalLight | null = null
  private assets: TileAssets | null = null
  private tileMesh: BatchedMesh | null = null
  private decoMesh: BatchedMesh | null = null
  private decoInstances = new Map<string, { id: number; level: number }[]>() // hex id -> decorations
  private water: Water | null = null
  private wavesMask: WavesMask | null = null
  private postFX: PostFX | null = null
  private tilesForMask: SavedTiles = {}
  private readonly animate = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  private tileInstances = new Map<string, number>() // hex id -> tile instance
  private fillInstances = new Map<string, number>() // hex id -> fill instance
  private instanceHex = new Map<number, string>() // instance -> hex id
  private draws = new Map<string, TileDraw>()
  private readonly markers = new Group()
  private resizeObserver: ResizeObserver | null = null
  private disposed = false
  private worldSeed = 0
  private poiSignature = ''
  private readonly poiGroup = new Group() // procedural camp and rift models
  private drops = new Map<string, number>() // hex id -> when its drop starts (ms)
  private bases = new Map<string, { x: number; y: number; z: number; rotY: number }>() // resting tile placement
  private maskFrames = 0 // frames until the coast masks are redrawn (0: not pending)
  private dirty = true // draw on the next frame (nothing is drawn while nothing changes)
  private pendingClick: number | null = null
  private downAt: { x: number; y: number } | null = null
  private readonly dummy = new Object3D()
  private readonly color = new Color()

  constructor(canvas: HTMLCanvasElement, callbacks: MapSceneCallbacks, assetBase = import.meta.env.BASE_URL + 'assets/') {
    this.canvas = canvas
    this.callbacks = callbacks
    this.assetBase = assetBase
  }

  // Which backend the renderer ended up on (WebGPU, or the WebGL2 fallback).
  get backend(): string {
    const b = (this.renderer as unknown as { backend?: { isWebGPUBackend?: boolean } })?.backend
    return b?.isWebGPUBackend ? 'WebGPU' : 'WebGL2'
  }

  async init(): Promise<void> {
    const renderer = new WebGPURenderer({ canvas: this.canvas, antialias: true })
    await renderer.init()
    if (this.disposed) {
      renderer.dispose()
      return
    }
    this.renderer = renderer
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFShadowMap

    this.scene.background = new Color(BACKGROUND)
    this.scene.environmentIntensity = ENV_INTENSITY
    this.scene.add(this.markers, this.poiGroup)

    const light = new DirectionalLight(0xffffff, DIR_LIGHT_INTENSITY)
    light.castShadow = true
    light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
    light.shadow.bias = -0.0005
    this.scene.add(light, light.target)
    this.light = light

    const controls = new OrbitControls(this.camera, this.canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.1
    controls.mouseButtons = { LEFT: 2, MIDDLE: 1, RIGHT: 0 } // pan, dolly, rotate
    controls.touches = { ONE: 0, TWO: 2 } // rotate, dolly-pan
    controls.minDistance = 25
    controls.maxDistance = 410
    controls.maxPolarAngle = 1.424
    controls.screenSpacePanning = false
    this.controls = controls

    const [env, assets] = await Promise.all([
      new HDRLoader().loadAsync(`${this.assetBase}hdr/venice_sunset_1k.hdr`),
      loadTileAssets(this.assetBase),
    ])
    if (this.disposed) return
    env.mapping = EquirectangularReflectionMapping
    this.scene.environment = env
    this.assets = assets

    this.wavesMask = new WavesMask(renderer)
    this.water = new Water(this.assetBase, this.wavesMask.coastTexture, this.wavesMask.coveTexture)
    this.scene.add(this.water.mesh)
    this.postFX = new PostFX(renderer, this.scene, this.camera, {
      overlay: [this.markers],
      water: [this.water.mesh],
      waterMask: [],
      setMaskMode: (on) => assets.tileMaterial.setRenderMode(on ? RENDER_MODE.waterMask : RENDER_MODE.normal),
    })

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas)
    this.resize()
    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    this.canvas.addEventListener('pointerup', this.handlePointerUp)
    this.canvas.addEventListener('dblclick', this.handleDoubleClick)
    this.canvas.addEventListener('contextmenu', this.preventDefault)
    renderer.setAnimationLoop(() => this.frame())
  }

  // Look at a hex from the default angle.
  focus(hexId: string): void {
    if (!this.controls) return
    const d = this.draws.get(hexId)
    const [q, r] = hexId.split(',').map(Number)
    const p = hexWorldPosition(q, r)
    const target = new Vector3(p.x, d ? tileBaseY(d.level) + 1 : 1, p.z)
    this.controls.target.copy(target)
    this.camera.position.copy(target).add(CAMERA_OFFSET)
    this.controls.update()
    this.dirty = true
  }

  // Rebuild the tile instances (the solved map changed).
  setTiles(draws: TileDraw[], tiles: SavedTiles, worldSeed: number): void {
    this.tilesForMask = tiles
    this.worldSeed = worldSeed
    if (!this.assets) return
    const { geoms, bottom, tileMaterial } = this.assets
    const material = tileMaterial.material
    if (this.tileMesh) {
      this.scene.remove(this.tileMesh)
      this.tileMesh.dispose()
    }
    this.tileInstances.clear()
    this.fillInstances.clear()
    this.instanceHex.clear()
    // Tiles new since the last build (a grown chunk) drop into place, rippling out from the
    // middle of the new area. Not on the first build, nor with "reduce motion".
    const isNew = this.draws.size > 0 ? draws.filter((d) => !this.draws.has(d.id)) : []
    this.draws = new Map(draws.map((d) => [d.id, d]))
    this.drops.clear()
    if (this.animate && isNew.length) {
      const cq = isNew.reduce((a, d) => a + d.q, 0) / isNew.length
      const cr = isNew.reduce((a, d) => a + d.r, 0) / isNew.length
      const now = performance.now()
      for (const d of isNew) {
        const dist = Math.max(Math.abs(d.q - cq), Math.abs(d.r - cr), Math.abs(d.q + d.r - cq - cr))
        this.drops.set(d.id, now + dist * DROP_STAGGER_MS)
      }
    }

    let vertices = 0
    let indices = 0
    for (const g of [...geoms.values(), ...(bottom ? [bottom] : [])]) {
      vertices += g.attributes.position.count
      indices += g.index ? g.index.count : 0
    }
    const mesh = new BatchedMesh(draws.length * 2 + 16, vertices, indices, material)
    mesh.sortObjects = false
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    const geomIds = new Map<number, number>()
    for (const [type, g] of geoms) geomIds.set(type, mesh.addGeometry(g))
    const bottomId = bottom ? mesh.addGeometry(bottom) : null

    // A hidden first instance with a color set (hex-map-wfc: fixes a WebGPU color sync issue).
    const first = mesh.addInstance(geomIds.values().next().value!)
    mesh.setColorAt(first, this.color.setRGB(1, 1, 1))
    this.dummy.position.set(0, -1000, 0)
    this.dummy.rotation.set(0, 0, 0)
    this.dummy.scale.setScalar(0)
    this.dummy.updateMatrix()
    mesh.setMatrixAt(first, this.dummy.matrix)

    for (const d of draws) {
      const geomId = geomIds.get(d.type)
      if (geomId === undefined) continue
      const p = hexWorldPosition(d.q, d.r)
      const y = tileBaseY(d.level)
      const id = mesh.addInstance(geomId)
      this.dummy.position.set(p.x, y, p.z)
      this.dummy.rotation.set(0, rotationAngle(d.rotation), 0)
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      mesh.setMatrixAt(id, this.dummy.matrix)
      this.tileInstances.set(d.id, id)
      this.bases.set(d.id, { x: p.x, y, z: p.z, rotY: rotationAngle(d.rotation) })
      this.instanceHex.set(id, d.id)
      if (d.level >= 1 && bottomId !== null) {
        const fill = mesh.addInstance(bottomId)
        this.dummy.position.set(p.x, y, p.z)
        this.dummy.rotation.set(0, 0, 0)
        this.dummy.scale.set(1, y, 1)
        this.dummy.updateMatrix()
        mesh.setMatrixAt(fill, this.dummy.matrix)
        this.fillInstances.set(d.id, fill)
        this.instanceHex.set(fill, d.id)
      }
    }
    this.tileMesh = mesh
    this.scene.add(mesh)
    this.buildDecorations(draws)
    this.buildPoiModels(draws)
    this.applyLooks()
    // The coast masks are drawn a few frames later: drawing the tiles before the scene has
    // rendered once (while their shaders are still being prepared) leaves the masks empty.
    this.maskFrames = MASK_DELAY_FRAMES
    this.dirty = true
  }

  // Update how each tile looks (revealed, fog, GM view) and the markers.
  setView(draws: TileDraw[], markers: MarkerView): void {
    for (const d of draws) this.draws.set(d.id, d)
    // A newly revealed point of interest brings its models.
    if (poiSignature(draws) !== this.poiSignature) {
      this.buildDecorations(draws)
      this.buildPoiModels(draws)
      this.refreshMaskLayers()
    }
    this.applyLooks()
    this.buildMarkers(markers)
    this.dirty = true
  }

  // The hex under a point of the canvas, if any.
  pick(clientX: number, clientY: number): string | null {
    if (!this.tileMesh) return null
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    const raycaster = new Raycaster()
    raycaster.setFromCamera(ndc, this.camera)
    const hits = raycaster.intersectObject(this.tileMesh, false)
    for (const h of hits) {
      const id = this.instanceHex.get((h as unknown as { batchId: number }).batchId)
      if (id) return id
    }
    return null
  }

  dispose(): void {
    this.disposed = true
    if (this.pendingClick !== null) window.clearTimeout(this.pendingClick)
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick)
    this.canvas.removeEventListener('contextmenu', this.preventDefault)
    this.resizeObserver?.disconnect()
    this.controls?.dispose()
    this.renderer?.setAnimationLoop(null)
    this.tileMesh?.dispose()
    this.decoMesh?.dispose()
    this.water?.dispose()
    this.wavesMask?.dispose()
    this.postFX?.dispose()
    this.clearMarkers()
    this.renderer?.dispose()
  }

  private applyLooks(): void {
    const mesh = this.tileMesh
    if (!mesh) return
    for (const [id, d] of this.draws) {
      const [r, g, b] = instanceColor(d.level, d.look, isSeaTile(d.type))
      this.color.setRGB(r, g, b)
      const tile = this.tileInstances.get(id)
      if (tile !== undefined) mesh.setColorAt(tile, this.color)
      const fill = this.fillInstances.get(id)
      if (fill !== undefined) mesh.setColorAt(fill, this.color)
      // Decorations: hidden on fog silhouettes, otherwise shaded like their tile (G = 1 marks
      // them as decorations for the shader).
      const decos = this.decoInstances.get(id)
      if (decos && this.decoMesh) {
        const fog = d.look.tint === TINT.fog || d.look.tint === TINT.fogFrontier
        for (const deco of decos) {
          this.decoMesh.setVisibleAt(deco.id, !fog && !this.drops.has(id))
          const [dr, , db] = instanceColor(deco.level, d.look, false)
          this.decoMesh.setColorAt(deco.id, this.color.setRGB(dr, 1, db))
        }
      }
    }
  }

  // Camps and rifts: no model in the tile pack, so they're built here from simple shapes.
  private buildPoiModels(draws: TileDraw[]): void {
    for (const child of [...this.poiGroup.children]) {
      this.poiGroup.remove(child)
      child.traverse((o) => {
        const m = o as Mesh
        m.geometry?.dispose()
        ;(m.material as Material | undefined)?.dispose()
      })
    }
    for (const d of draws) {
      if (!poiHasModel(d) || (d.poi!.kind !== 'camp' && d.poi!.kind !== 'rift')) continue
      const slot = poiSlots(d)[0]
      const p = hexWorldPosition(d.q, d.r)
      const model = d.poi!.kind === 'camp' ? campModel() : riftModel()
      model.position.set(p.x + slot.x, tileBaseY(d.level) + 1 + (TILE_LIST[d.type].levelIncrement ?? 0) * 0.25, p.z + slot.z)
      model.rotation.y = ((d.q * 7 + d.r * 13) % 6) * (Math.PI / 3)
      this.poiGroup.add(model)
    }
  }

  private buildDecorations(draws: TileDraw[]): void {
    if (!this.assets) return
    if (this.decoMesh) {
      this.scene.remove(this.decoMesh)
      this.decoMesh.dispose()
      this.decoMesh = null
    }
    this.decoInstances.clear()
    const plans = draws.flatMap((d) => [...planScenery(d, this.worldSeed), ...planPoiModels(d, this.worldSeed)])
    this.poiSignature = poiSignature(draws)
    if (plans.length === 0) return
    const geoms = this.assets.decorations
    let vertices = 0
    let indices = 0
    for (const g of geoms.values()) {
      vertices += g.attributes.position.count
      indices += g.index ? g.index.count : 0
    }
    const mesh = new BatchedMesh(plans.length + 16, vertices, indices, this.assets.tileMaterial.material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    const ids = new Map<string, number>()
    for (const [name, g] of geoms) ids.set(name, mesh.addGeometry(g))
    const first = mesh.addInstance(ids.values().next().value!)
    mesh.setColorAt(first, this.color.setRGB(1, 1, 1))
    this.dummy.position.set(0, -1000, 0)
    this.dummy.rotation.set(0, 0, 0)
    this.dummy.scale.setScalar(0)
    this.dummy.updateMatrix()
    mesh.setMatrixAt(first, this.dummy.matrix)
    for (const p of plans) {
      const geomId = ids.get(p.mesh)
      if (geomId === undefined) continue
      const id = mesh.addInstance(geomId)
      this.dummy.position.set(p.x, p.y, p.z)
      this.dummy.rotation.set(0, p.rotY, 0)
      this.dummy.scale.setScalar(p.scale)
      this.dummy.updateMatrix()
      mesh.setMatrixAt(id, this.dummy.matrix)
      const list = this.decoInstances.get(p.hexId) ?? []
      list.push({ id, level: p.level })
      this.decoInstances.set(p.hexId, list)
    }
    this.decoMesh = mesh
    this.scene.add(mesh)
  }

  // Move dropping tiles (and the fills under them) down to rest; show their decorations when
  // they land.
  private stepDrops(): void {
    const mesh = this.tileMesh
    if (!mesh) return
    const now = performance.now()
    let landed = false
    for (const [id, startAt] of this.drops) {
      const t = Math.min(1, Math.max(0, (now - startAt) / DROP_MS))
      const ease = 1 - (1 - t) ** 3
      const lift = (1 - ease) * DROP_HEIGHT
      const b = this.bases.get(id)
      const tile = this.tileInstances.get(id)
      if (b && tile !== undefined) {
        this.dummy.position.set(b.x, b.y + lift, b.z)
        this.dummy.rotation.set(0, b.rotY, 0)
        this.dummy.scale.setScalar(t > 0 ? 1 : 0) // hidden until its turn
        this.dummy.updateMatrix()
        mesh.setMatrixAt(tile, this.dummy.matrix)
        const fill = this.fillInstances.get(id)
        if (fill !== undefined) {
          this.dummy.rotation.set(0, 0, 0)
          this.dummy.scale.set(1, b.y, 1).multiplyScalar(t > 0 ? 1 : 0)
          this.dummy.updateMatrix()
          mesh.setMatrixAt(fill, this.dummy.matrix)
        }
      }
      if (t >= 1) {
        this.drops.delete(id)
        landed = true
      }
    }
    if (landed) this.applyLooks()
  }

  // Size the water to the map and redraw the coast masks (after the tiles change).
  private updateWater(): void {
    const { water, wavesMask, tileMesh, assets, postFX } = this
    if (!water || !wavesMask || !tileMesh || !assets || !postFX) return
    const bounds = maskBounds(this.tilesForMask)
    water.setBounds(bounds)
    assets.tileMaterial.setRenderMode(RENDER_MODE.trueColor)
    wavesMask.render(this.scene, [tileMesh], water.mesh, bounds, this.tilesForMask)
    assets.tileMaterial.setRenderMode(RENDER_MODE.normal)
    this.refreshMaskLayers()
  }

  // The water mask is drawn from the current tile and decoration meshes (rebuilt on growth and
  // on a newly revealed point of interest).
  private refreshMaskLayers(): void {
    if (!this.tileMesh || !this.postFX) return
    this.postFX.setLayers({ waterMask: [this.tileMesh, ...(this.decoMesh ? [this.decoMesh] : [])] })
  }

  private surfaceAt(hexId: string): Vector3 {
    const [q, r] = hexId.split(',').map(Number)
    const p = hexWorldPosition(q, r)
    const d = this.draws.get(hexId)
    const rise = d ? (TILE_LIST[d.type].levelIncrement ?? 0) * 0.25 : 0
    return new Vector3(p.x, (d ? tileBaseY(d.level) : 0) + 1 + rise, p.z)
  }

  private clearMarkers(): void {
    for (const child of [...this.markers.children]) {
      this.markers.remove(child)
      const m = child as Mesh
      m.geometry?.dispose()
      ;(m.material as Material | undefined)?.dispose()
    }
  }

  private buildMarkers(view: MarkerView): void {
    this.clearMarkers()

    // Danger rings on revealed hexes, and the selection ring.
    const ring = (hexId: string, inset: number, lift: number) => {
      const c = this.surfaceAt(hexId)
      const radius = (2 / Math.sqrt(3)) * inset // corner distance of a 2-unit-wide hex
      const pts: number[] = []
      for (let i = 0; i < 6; i++) {
        const a0 = ((-90 + 60 * i) * Math.PI) / 180
        const a1 = ((-90 + 60 * (i + 1)) * Math.PI) / 180
        pts.push(c.x + radius * Math.cos(a0), c.y + lift, c.z + radius * Math.sin(a0))
        pts.push(c.x + radius * Math.cos(a1), c.y + lift, c.z + radius * Math.sin(a1))
      }
      return pts
    }
    const positions: number[] = []
    const colors: number[] = []
    for (const { hexId, danger } of view.danger) {
      const pts = ring(hexId, 0.9, 0.05)
      positions.push(...pts)
      this.color.set(DANGER_COLORS[danger])
      for (let i = 0; i < pts.length / 3; i++) colors.push(this.color.r, this.color.g, this.color.b)
    }
    if (positions.length) {
      const g = new BufferGeometry()
      g.setAttribute('position', new Float32BufferAttribute(positions, 3))
      g.setAttribute('color', new Float32BufferAttribute(colors, 3))
      this.markers.add(new LineSegments(g, new LineBasicMaterial({ vertexColors: true })))
    }
    if (view.selectedHexId) {
      const g = new BufferGeometry()
      g.setAttribute('position', new Float32BufferAttribute(ring(view.selectedHexId, 0.97, 0.08), 3))
      this.markers.add(new LineSegments(g, new LineBasicMaterial({ color: 0xffffff })))
    }

    for (const hexId of view.poiHexIds) {
      const d = this.draws.get(hexId)
      if (d && poiHasModel(d)) continue // drawn as a model instead (scenery.ts, buildPoiModels)
      const gem = new Mesh(new OctahedronGeometry(0.35), new MeshStandardMaterial({ color: 0xffd54a, emissive: 0x6b5200 }))
      // Above the pawn when the party stands on it.
      gem.position.copy(this.surfaceAt(hexId)).add(new Vector3(0, hexId === view.partyHexId ? 1.75 : 1.2, 0))
      gem.castShadow = true
      this.markers.add(gem)
    }

    if (view.partyHexId) {
      const at = this.surfaceAt(view.partyHexId)
      const pawn = new Group()
      const white = () => new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
      const base = new Mesh(new CylinderGeometry(0.32, 0.4, 0.15, 24), white())
      base.position.y = 0.075
      const body = new Mesh(new ConeGeometry(0.28, 0.8, 24), white())
      body.position.y = 0.55
      const head = new Mesh(new SphereGeometry(0.2, 24, 16), white())
      head.position.y = 1.0
      for (const m of [base, body, head]) {
        m.castShadow = true
        pawn.add(m)
      }
      pawn.position.copy(at)
      this.markers.add(pawn)
    }
  }

  private resize(): void {
    const renderer = this.renderer
    const parent = this.canvas.parentElement
    if (!renderer || !parent) return
    const w = Math.max(1, parent.clientWidth)
    const h = Math.max(1, parent.clientHeight)
    renderer.setSize(w, h, false)
    const dpr = renderer.getPixelRatio()
    this.postFX?.setSize(Math.round(w * dpr), Math.round(h * dpr))
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.dirty = true
  }

  // Draws only when something changed: the camera moved (including damping after a drag),
  // or the tiles, looks, markers or size did.
  private frame(): void {
    if (!this.renderer || !this.controls) return
    const moved = this.controls.update()
    if (this.maskFrames > 0 && --this.maskFrames === 0) {
      this.updateWater()
      this.dirty = true
    }
    if (this.maskFrames > 0) this.dirty = true // keep frames coming until the masks are drawn
    if (this.drops.size) {
      this.stepDrops()
      this.dirty = true
    }
    if (!moved && !this.dirty && !this.animate) return
    this.dirty = false
    this.updateShadowCamera()
    if (this.postFX) {
      // Depth of field focuses on the camera target; the blur shrinks as you zoom in
      // (hex-map-wfc App.animate).
      const dist = this.camera.position.distanceTo(this.controls.target)
      this.postFX.dofFocus.value = dist
      const t = Math.min(Math.max((dist - 25) / (410 - 25), 0), 1)
      this.postFX.dofFocalLength.value = 20 + t * 80
      this.postFX.render(this.camera)
    } else {
      this.renderer.render(this.scene, this.camera)
    }
  }

  // The sun follows the view, and its shadow frustum is fitted to what the camera sees
  // (hex-map-wfc Lighting.updateShadowCamera, perspective case).
  private updateShadowCamera(): void {
    const light = this.light
    const controls = this.controls
    if (!light || !controls) return
    const target = controls.target
    light.position.set(target.x + DIR_LIGHT_OFFSET.x, DIR_LIGHT_OFFSET.y, target.z + DIR_LIGHT_OFFSET.z)
    light.target.position.copy(target)
    light.target.updateMatrixWorld()
    light.updateMatrixWorld()
    const shadowCam = light.shadow.camera
    shadowCam.updateMatrixWorld()
    const distance = this.camera.position.distanceTo(target)
    const vHalf = Math.tan((this.camera.fov * Math.PI) / 360) * distance
    const halfSize = Math.max(8, Math.min(Math.max(vHalf, vHalf * this.camera.aspect) * 1.2, 120))
    const height = 10
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const dx of [-halfSize, halfSize])
      for (const dz of [-halfSize, halfSize])
        for (const y of [0, height]) {
          const c = new Vector3(target.x + dx, y, target.z + dz).applyMatrix4(shadowCam.matrixWorldInverse)
          minX = Math.min(minX, c.x)
          maxX = Math.max(maxX, c.x)
          minY = Math.min(minY, c.y)
          maxY = Math.max(maxY, c.y)
          minZ = Math.min(minZ, c.z)
          maxZ = Math.max(maxZ, c.z)
        }
    const pad = Math.max(2, halfSize * 0.1)
    shadowCam.left = minX - pad
    shadowCam.right = maxX + pad
    shadowCam.top = maxY + pad
    shadowCam.bottom = minY - pad
    shadowCam.near = -maxZ - pad
    shadowCam.far = -minZ + pad
    shadowCam.updateProjectionMatrix()
  }

  private readonly preventDefault = (e: Event) => e.preventDefault()

  private readonly handlePointerDown = (e: PointerEvent) => {
    this.downAt = e.button === 0 ? { x: e.clientX, y: e.clientY } : null
  }

  // A left click that didn't drag (dragging pans). Delayed so a double click can cancel it.
  private readonly handlePointerUp = (e: PointerEvent) => {
    const down = this.downAt
    this.downAt = null
    if (!down || e.button !== 0 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP_PX) return
    const id = this.pick(e.clientX, e.clientY)
    if (!id) return
    if (this.pendingClick !== null) {
      window.clearTimeout(this.pendingClick)
      this.pendingClick = null
      return
    }
    this.pendingClick = window.setTimeout(() => {
      this.pendingClick = null
      this.callbacks.onClick(id)
    }, DOUBLE_CLICK_DELAY_MS)
  }

  private readonly handleDoubleClick = (e: MouseEvent) => {
    if (this.pendingClick !== null) {
      window.clearTimeout(this.pendingClick)
      this.pendingClick = null
    }
    const id = this.pick(e.clientX, e.clientY)
    if (id) this.callbacks.onDoubleClick(id)
  }
}

// Which hexes have which points of interest: when this changes, the POI models are rebuilt.
function poiSignature(draws: TileDraw[]): string {
  return draws
    .filter((d) => d.poi)
    .map((d) => `${d.id}:${d.poi!.kind}:${d.poi!.settlementType ?? ''}`)
    .join('|')
}

// A camp: two canvas tents and a campfire.
function campModel(): Group {
  const g = new Group()
  const canvas = new MeshStandardMaterial({ color: 0xd9c9a3, roughness: 0.9 })
  for (const [x, z, s] of [
    [-0.28, -0.12, 1],
    [0.22, -0.26, 0.85],
  ] as const) {
    const tent = new Mesh(new ConeGeometry(0.26 * s, 0.38 * s, 4), canvas)
    tent.position.set(x, 0.19 * s, z)
    tent.rotation.y = Math.PI / 4 + x
    tent.castShadow = true
    g.add(tent)
  }
  const wood = new MeshStandardMaterial({ color: 0x5b3a1e, roughness: 1 })
  for (let i = 0; i < 3; i++) {
    const log = new Mesh(new CylinderGeometry(0.025, 0.025, 0.22, 6), wood)
    log.rotation.set(Math.PI / 2, (i * Math.PI) / 3, 0)
    log.position.set(0.05, 0.03, 0.2)
    g.add(log)
  }
  const fire = new Mesh(new ConeGeometry(0.07, 0.18, 6), new MeshStandardMaterial({ color: 0xff8a1f, emissive: 0xff5a00, emissiveIntensity: 2 }))
  fire.position.set(0.05, 0.11, 0.2)
  g.add(fire)
  return g
}

// A rift: a dark scar in the ground with glowing violet shards breaking out of it.
function riftModel(): Group {
  const g = new Group()
  const scar = new Mesh(new CylinderGeometry(0.42, 0.42, 0.02, 7), new MeshStandardMaterial({ color: 0x140a1f, roughness: 1 }))
  scar.position.y = 0.01
  scar.scale.set(1, 1, 0.55)
  g.add(scar)
  const crystal = new MeshStandardMaterial({ color: 0x9d5cff, emissive: 0x6a1fd1, emissiveIntensity: 1.6, roughness: 0.3 })
  const shards: [number, number, number, number, number][] = [
    [0, 0, 0.55, 0, 0],
    [0.16, 0.05, 0.38, 0.35, 0.2],
    [-0.15, -0.04, 0.42, -0.3, -0.15],
    [0.05, -0.1, 0.28, 0.15, -0.4],
  ]
  for (const [x, z, h, tiltX, tiltZ] of shards) {
    const shard = new Mesh(new OctahedronGeometry(0.09), crystal)
    shard.scale.set(1, h / 0.09 / 2, 1)
    shard.position.set(x, h / 2, z)
    shard.rotation.set(tiltX, 0, tiltZ)
    shard.castShadow = true
    g.add(shard)
  }
  return g
}
