// Coast masks for the wave effect, rendered top-down whenever the tiles change:
// - the coast gradient: the tiles drawn from above, land (anything not blue) dilated and
//   blurred, so it's 1 on land and fades out over the sea;
// - the cove mask: open-water cells hemmed in by land on opposite sides, dilated and blurred,
//   where water.ts thins and fades the waves.
//
// Ported from hex-map-wfc (src/hexmap/effects/WavesMask.js), Copyright (c) 2026 Felix Turner,
// MIT License: https://github.com/felixturner/hex-map-wfc/blob/main/LICENSE
// Changes:
// - TypeScript; the on-screen debug views are left out.
// - The masks cover the map's bounds, centered on it, at hex-map-wfc's resolution (2048 texels
//   per 180 units), instead of a fixed 180-unit square at the origin. The texture size follows
//   the bounds, up to MAX_SIZE.
// - Cove cells come from this app's saved tiles (axial hex ids) rather than hex-map-wfc's
//   global cell map.
// - The tile material is switched to its true-color mode for the mask render (fog and GM
//   dimming would otherwise turn the sea grey and hide it from the mask).

import {
  CircleGeometry,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  LinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  RenderTarget,
  Scene,
  Vector2,
  type Material,
  type Object3D as Object3DType,
  type WebGPURenderer,
} from 'three/webgpu'
import { float, select, texture, uniform, uv, vec2, vec3 } from 'three/tsl'
import { CUBE_DIRS } from '../wfc/cube'
import { TILE_TYPE } from '../wfc/tiles'
import type { SavedTiles } from '../world/hexTiles'
import { hexWorldPosition } from './layout'
import type { WaterBounds } from './water'

const TEXELS_PER_UNIT = 2048 / 180
const MAX_SIZE = 4096
const COVE_CUTOFF = 0.978
const COVE_RADIUS = 2.041
const COVE_BLUR = 3 // hex-map-wfc's 2.624, as whole passes
const MAX_COVES = 4096

// The square the masks cover: the tiles' extent plus a margin of open sea.
export function maskBounds(tiles: SavedTiles, margin = 8): WaterBounds {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const id of Object.keys(tiles)) {
    const [q, r] = id.split(',').map(Number)
    const p = hexWorldPosition(q, r)
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)
  }
  if (minX === Infinity) return { cx: 0, cz: 0, size: 180 }
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, size: Math.max(maxX - minX, maxZ - minZ) + 2 * margin }
}

// Open-water cells with land close by on opposite sides (hex-map-wfc _computeCoveCells).
export function coveCells(tiles: SavedTiles): { x: number; z: number }[] {
  const maxSteps = Math.ceil(COVE_RADIUS)
  const pairs = [
    [0, 3],
    [1, 4],
    [2, 5],
  ]
  const out: { x: number; z: number }[] = []
  for (const [id, t] of Object.entries(tiles)) {
    if (t[0] !== TILE_TYPE.WATER) continue
    const [q, r] = id.split(',').map(Number)
    const weights = new Float32Array(6)
    for (let d = 0; d < 6; d++) {
      const dir = CUBE_DIRS[d]
      for (let step = 1; step <= maxSteps; step++) {
        const n = tiles[`${q + dir.dq * step},${r + dir.dr * step}`]
        if (!n) continue // off the map counts as open water
        if (n[0] !== TILE_TYPE.WATER) {
          weights[d] = Math.max(0, 1 - (step - 1) / COVE_RADIUS)
          break
        }
      }
    }
    let covyness = 0
    for (const [a, b] of pairs) covyness += Math.min(weights[a], weights[b])
    if (covyness >= COVE_CUTOFF) {
      const p = hexWorldPosition(q, r)
      out.push({ x: p.x, z: p.z })
    }
  }
  return out
}

function makeTarget(size: number): RenderTarget {
  const rt = new RenderTarget(size, size, { samples: 1 })
  rt.texture.format = RGBAFormat
  rt.texture.minFilter = LinearFilter
  rt.texture.magFilter = LinearFilter
  return rt
}

export class WavesMask {
  private readonly renderer: WebGPURenderer
  private size = 1024
  private readonly rtA: RenderTarget
  private readonly rtB: RenderTarget
  private readonly rtCove: RenderTarget
  private readonly sceneCam = new OrthographicCamera(-90, 90, 90, -90, 0.1, 200)
  private readonly postCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private readonly quad = new Mesh(new PlaneGeometry(2, 2))
  private readonly quadScene = new Scene()
  private readonly texel = uniform(1 / 1024)
  private readonly dir = uniform(new Vector2(1, 0))
  private readonly dilateTex
  private readonly simpleDilateTex
  private readonly blurTex
  private readonly dilateMat = new MeshBasicNodeMaterial()
  private readonly simpleDilateMat = new MeshBasicNodeMaterial()
  private readonly blurMat = new MeshBasicNodeMaterial()
  private readonly blueMat = new MeshBasicNodeMaterial()
  private readonly coveMesh: InstancedMesh
  private readonly coveScene = new Scene()

  constructor(renderer: WebGPURenderer) {
    this.renderer = renderer
    this.rtA = makeTarget(this.size)
    this.rtB = makeTarget(this.size)
    this.rtCove = makeTarget(this.size)
    this.quadScene.add(this.quad)

    this.sceneCam.up.set(0, 0, -1)

    // Dilate land (non-blue texels) along `dir`.
    this.dilateTex = texture(this.rtA.texture)
    const dilateTex = this.dilateTex
    const sampleMask = (c: unknown) => {
      const s = dilateTex.sample(c as ReturnType<typeof uv>)
      const lum = s.r.mul(0.2126).add(s.g.mul(0.7152)).add(s.b.mul(0.0722))
      const isBlue = s.b.greaterThan(s.r.mul(2.0)).and(s.b.greaterThan(s.g.mul(1.15))).and(s.b.sub(s.r).greaterThan(0.15))
      return select(isBlue, float(0), select(lum.greaterThan(0.03), float(1), float(0)))
    }
    let maxVal = sampleMask(uv())
    for (let i = 1; i <= 14; i++) {
      const off = vec2(this.dir.x, this.dir.y).mul(this.texel.mul(i))
      maxVal = maxVal.max(sampleMask(uv().add(off))).max(sampleMask(uv().sub(off)))
    }
    this.dilateMat.colorNode = vec3(maxVal, maxVal, maxVal)

    // Plain dilation of the cove mask.
    this.simpleDilateTex = texture(this.rtCove.texture)
    let sMax = this.simpleDilateTex.sample(uv()).r
    for (let i = 1; i <= 14; i++) {
      const off = vec2(this.dir.x, this.dir.y).mul(this.texel.mul(i))
      sMax = sMax.max(this.simpleDilateTex.sample(uv().add(off)).r).max(this.simpleDilateTex.sample(uv().sub(off)).r)
    }
    this.simpleDilateMat.colorNode = vec3(sMax, sMax, sMax)

    // Box blur along `dir`.
    this.blurTex = texture(this.rtA.texture)
    let sum = this.blurTex.sample(uv())
    for (let i = 1; i <= 12; i++) {
      const off = vec2(this.dir.x, this.dir.y).mul(this.texel.mul(i))
      sum = sum.add(this.blurTex.sample(uv().add(off))).add(this.blurTex.sample(uv().sub(off)))
    }
    sum = sum.div(12 * 2 + 1)
    this.blurMat.colorNode = vec3(sum.r, sum.g, sum.b)

    this.blueMat.colorNode = vec3(0, 0, 1)

    const coveMat = new MeshBasicNodeMaterial()
    coveMat.colorNode = vec3(1, 1, 1)
    coveMat.depthTest = false
    coveMat.depthWrite = false
    const coveGeom = new CircleGeometry(2 / Math.sqrt(3), 6, Math.PI / 6)
    coveGeom.rotateX(-Math.PI / 2)
    this.coveMesh = new InstancedMesh(coveGeom, coveMat, MAX_COVES)
    this.coveMesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.coveMesh.frustumCulled = false
    this.coveScene.add(this.coveMesh)
  }

  get coastTexture() {
    return this.rtA.texture
  }

  get coveTexture() {
    return this.rtCove.texture
  }

  // Render both masks. `show` are the objects drawn from above (the tiles); the water plane
  // is drawn blue under them.
  render(scene: Scene, show: Object3DType[], waterPlane: Mesh | null, bounds: WaterBounds, tiles: SavedTiles): void {
    const { renderer } = this
    const size = Math.min(MAX_SIZE, Math.max(256, Math.ceil(bounds.size * TEXELS_PER_UNIT)))
    if (size !== this.size) {
      this.size = size
      for (const rt of [this.rtA, this.rtB, this.rtCove]) rt.setSize(size, size)
    }
    this.texel.value = 1 / size
    const half = bounds.size / 2
    const cam = this.sceneCam
    cam.left = -half
    cam.right = half
    cam.top = half
    cam.bottom = -half
    cam.position.set(bounds.cx, 100, bounds.cz)
    cam.lookAt(bounds.cx, 0, bounds.cz)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()

    const savedBackground = scene.background
    const savedClear = renderer.getClearColor(new Color() as Parameters<WebGPURenderer['getClearColor']>[0])
    const savedAlpha = renderer.getClearAlpha()
    scene.background = null
    let savedWaterMat: Material | Material[] | null = null
    if (waterPlane) {
      savedWaterMat = waterPlane.material
      waterPlane.material = this.blueMat
    }
    const showSet = new Set<Object3DType>(show)
    if (waterPlane) showSet.add(waterPlane)
    const savedVis = new Map<Object3DType, boolean>()
    scene.traverse((child) => {
      const c = child as Object3DType & { isMesh?: boolean; isBatchedMesh?: boolean; isInstancedMesh?: boolean; isLine?: boolean; isPoints?: boolean }
      if (!c.isMesh && !c.isBatchedMesh && !c.isInstancedMesh && !c.isLine && !c.isPoints) return
      savedVis.set(child, child.visible)
      child.visible = showSet.has(child)
    })

    renderer.setRenderTarget(this.rtA)
    renderer.setClearColor(0xffffff, 1)
    renderer.clear()
    renderer.render(scene, cam)

    scene.background = savedBackground
    for (const [obj, vis] of savedVis) obj.visible = vis
    if (waterPlane && savedWaterMat) waterPlane.material = savedWaterMat

    this.dilateTex.value = this.rtA.texture
    this.dir.value.set(1, 0)
    this.pass(this.dilateMat, this.rtB)
    this.dilateTex.value = this.rtB.texture
    this.dir.value.set(0, 1)
    this.pass(this.dilateMat, this.rtA)
    this.blur(this.rtA, 2)

    this.renderCoves(coveCells(tiles))

    renderer.setRenderTarget(null)
    renderer.setClearColor(savedClear, savedAlpha)
  }

  dispose(): void {
    for (const rt of [this.rtA, this.rtB, this.rtCove]) rt.dispose()
    this.coveMesh.dispose()
  }

  private pass(material: MeshBasicNodeMaterial, target: RenderTarget): void {
    this.quad.material = material
    this.renderer.setRenderTarget(target)
    this.renderer.render(this.quadScene, this.postCam)
  }

  private blur(src: RenderTarget, iterations: number): void {
    for (let i = 0; i < iterations; i++) {
      this.blurTex.value = src.texture
      this.dir.value.set(1, 0)
      this.pass(this.blurMat, this.rtB)
      this.blurTex.value = this.rtB.texture
      this.dir.value.set(0, 1)
      this.pass(this.blurMat, src)
    }
  }

  private renderCoves(cells: { x: number; z: number }[]): void {
    const obj = new Object3D()
    const count = Math.min(cells.length, MAX_COVES)
    for (let i = 0; i < MAX_COVES; i++) {
      if (i < count) obj.position.set(cells[i].x, 50, cells[i].z)
      else obj.position.set(0, -9999, 0)
      obj.updateMatrix()
      this.coveMesh.setMatrixAt(i, obj.matrix)
    }
    this.coveMesh.instanceMatrix.needsUpdate = true

    this.renderer.setRenderTarget(this.rtCove)
    this.renderer.setClearColor(0x000000, 1)
    this.renderer.clear()
    this.renderer.render(this.coveScene, this.sceneCam)

    this.simpleDilateTex.value = this.rtCove.texture
    this.dir.value.set(1, 0)
    this.pass(this.simpleDilateMat, this.rtB)
    this.simpleDilateTex.value = this.rtB.texture
    this.dir.value.set(0, 1)
    this.pass(this.simpleDilateMat, this.rtCove)
    this.blur(this.rtCove, COVE_BLUR)
  }
}
