// Screen-wide effects for the 3D map: ambient occlusion (GTAO, denoised), depth of field,
// the animated water layer (masked to water areas), the marker overlay, vignette and film
// grain.
//
// Ported from hex-map-wfc (src/PostFX.js), Copyright (c) 2026 Felix Turner, MIT License:
// https://github.com/felixturner/hex-map-wfc/blob/main/LICENSE
// Changes:
// - TypeScript; the debug views and fade-to-black are left out. Settings are hex-map-wfc's
//   GUI defaults (src/GUI.js `fx`): AO strength 2.7, radius 1, denoise 5, vignette, depth of
//   field with bokeh scale 3, grain 0.1 (static). All four effects are on (user, M4b).
// - The overlay (markers) is blended over the scene by its alpha instead of added, so the
//   white pawn doesn't wash out over bright ground.
// - The water-mask pass switches the tile material into its mask mode with a uniform rather
//   than swapping materials (tileMaterial.ts `renderMode`).
// - Render targets follow the canvas size, not the window's.

import { Color, RGBAFormat, RenderPipeline, RenderTarget, type Camera, type Object3D, type Scene, type WebGPURenderer } from 'three/webgpu'
import { blendOverlay, clamp, float, mix, mrt, normalView, output, pass, texture, uniform, vec3, viewportUV } from 'three/tsl'
import { ao } from 'three/addons/tsl/display/GTAONode.js'
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js'
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js'

export type PostFXLayers = {
  overlay: Object3D[] // drawn on top, without AO or blur (markers)
  water: Object3D[] // the water plane, added over water areas
  waterMask: Object3D[] // what the water mask is drawn from (tiles, decorations)
  setMaskMode: (on: boolean) => void // switch the tile material into its water-mask mode
}

export class PostFX {
  readonly dofFocus = uniform(100)
  readonly dofFocalLength = uniform(50)
  private readonly renderer: WebGPURenderer
  private readonly scene: Scene
  private readonly pipeline: RenderPipeline
  private readonly overlayTarget = new RenderTarget(1, 1, { samples: 1 })
  private readonly waterTarget = new RenderTarget(1, 1, { samples: 1 })
  private readonly waterMaskTarget = new RenderTarget(1, 1, { samples: 1 })
  private layers: PostFXLayers

  constructor(renderer: WebGPURenderer, scene: Scene, camera: Camera, layers: PostFXLayers) {
    this.renderer = renderer
    this.scene = scene
    this.layers = layers
    for (const rt of [this.overlayTarget, this.waterTarget, this.waterMaskTarget]) rt.texture.format = RGBAFormat
    this.pipeline = new RenderPipeline(renderer)

    const scenePass = pass(scene, camera)
    scenePass.setMRT(mrt({ output, normal: normalView }))
    const color = scenePass.getTextureNode('output')
    const normal = scenePass.getTextureNode('normal')
    const depth = scenePass.getTextureNode('depth')
    const viewZ = scenePass.getViewZNode()

    // Depth of field, on the scene color before AO. (The casts: the typings of these addon nodes
    // lack the usual node operators they have at runtime.)
    const afterDof = dof(color, viewZ, this.dofFocus, this.dofFocalLength, float(3)) as unknown as typeof color

    // Ambient occlusion from depth and normals, at half resolution, denoised and softened.
    const aoPass = ao(depth, normal, camera)
    aoPass.resolutionScale = 0.5
    aoPass.distanceExponent.value = 1
    aoPass.distanceFallOff.value = 0.1
    aoPass.radius.value = 1.0
    aoPass.scale.value = 2.7
    aoPass.thickness.value = 1
    const denoised = denoise(aoPass.getTextureNode(), depth, normal, camera)
    denoised.radius = uniform(5)
    const aoValue = (denoised as unknown as typeof color).r
    const withAO = afterDof.mul(aoValue.pow(0.5))

    // Water: added where the (quarter-resolution) water mask says there's visible water. The
    // mask carries brightness too: 1 for normal water, less for GM-dimmed water, 0 for fog.
    const mask = texture(this.waterMaskTarget.texture).r
    const waterMask = mask.greaterThan(0.1).toFloat().mul(mask)
    const water = texture(this.waterTarget.texture)
    const withWater = withAO.add(water.rgb.mul(water.a.mul(waterMask)))

    // Markers on top.
    const overlay = texture(this.overlayTarget.texture)
    const withOverlay = mix(withWater.rgb, overlay.rgb, overlay.a)

    // Vignette toward black at the edges.
    const vignette = float(1).sub(clamp(viewportUV.sub(0.5).length().mul(1.4), 0.0, 1.0).pow(1.5))
    const withVignette = mix(vec3(0, 0, 0), withOverlay, vignette)

    // Static per-pixel grain, overlay-blended.
    const n = (a: number, b: number) => viewportUV.x.mul(a).add(viewportUV.y.mul(b)).sin().mul(43758.5453).fract()
    const grain = vec3(n(12.9898, 78.233), n(93.9898, 67.345), n(43.332, 93.532))
    this.pipeline.outputNode = mix(withVignette, blendOverlay(withVignette, grain), float(0.1))
  }

  setLayers(layers: Partial<PostFXLayers>): void {
    this.layers = { ...this.layers, ...layers }
  }

  setSize(width: number, height: number): void {
    this.overlayTarget.setSize(width, height)
    this.waterTarget.setSize(width, height)
    this.waterMaskTarget.setSize(Math.ceil(width / 4), Math.ceil(height / 4))
  }

  render(camera: Camera): void {
    const { renderer, scene, layers } = this
    const savedClear = renderer.getClearColor(new Color() as Parameters<WebGPURenderer['getClearColor']>[0])
    const savedAlpha = renderer.getClearAlpha()
    const savedBackground = scene.background
    const savedEnvironment = scene.environment
    scene.background = null
    scene.environment = null

    const only = (objects: Object3D[], target: RenderTarget, clear: number, clearAlpha: number) => {
      const keep = new Set(objects)
      const saved = new Map<Object3D, boolean>()
      scene.traverse((child) => {
        const c = child as Object3D & { isMesh?: boolean; isBatchedMesh?: boolean; isInstancedMesh?: boolean; isLine?: boolean; isPoints?: boolean }
        if (!c.isMesh && !c.isBatchedMesh && !c.isInstancedMesh && !c.isLine && !c.isPoints) return
        // Children of a kept group stay visible too.
        let o: Object3D | null = child
        let kept = false
        while (o) {
          if (keep.has(o)) kept = true
          o = o.parent
        }
        if (!kept) {
          saved.set(child, child.visible)
          child.visible = false
        }
      })
      renderer.setRenderTarget(target)
      renderer.setClearColor(clear, clearAlpha)
      renderer.clear()
      if (objects.length) renderer.render(scene, camera)
      for (const [child, vis] of saved) child.visible = vis
    }

    layers.setMaskMode(true)
    only(layers.waterMask, this.waterMaskTarget, 0x000000, 1)
    layers.setMaskMode(false)
    scene.environment = savedEnvironment
    only(layers.overlay, this.overlayTarget, 0x000000, 0)
    scene.environment = null
    only(layers.water, this.waterTarget, 0x000000, 0)

    scene.background = savedBackground
    scene.environment = savedEnvironment
    renderer.setRenderTarget(null)
    renderer.setClearColor(savedClear, savedAlpha)

    // The main pass, without the overlay and water objects.
    const hidden = [...layers.water, ...layers.overlay]
    const saved = hidden.map((o) => o.visible)
    for (const o of hidden) o.visible = false
    this.pipeline.render()
    hidden.forEach((o, i) => (o.visible = saved[i]))
  }

  dispose(): void {
    for (const rt of [this.overlayTarget, this.waterTarget, this.waterMaskTarget]) rt.dispose()
    this.pipeline.dispose()
  }
}
