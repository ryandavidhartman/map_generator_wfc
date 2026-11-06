// The tile material: hex-map-wfc's palette-texture blend, plus this project's biome tints, fog
// silhouettes and GM-view dimming.
//
// Ported from hex-map-wfc (src/hexmap/HexMap.js, initMaterial and _initTextureBlend),
// Copyright (c) 2026 Felix Turner, MIT License:
// https://github.com/felixturner/hex-map-wfc/blob/main/LICENSE
// Changes:
// - TypeScript; the debug color modes, the runtime texture swap and the water-mask material
//   (used by the M4b wave effect) are left out.
// - The low-to-high palette blend starts at level 2 instead of 0 (see below).
// - New: the instance color's B channel picks a look (render3d/layout.ts instanceColor):
//   - biome tints recolor only the grass swatch of the palette (UV column 0, row 2), so roads,
//     rivers, sand and water keep their colors;
//   - fog draws a flat, unlit two-tone grey silhouette (sea darker than land; rivers aren't
//     shown);
//   - dim darkens the tile (unrevealed hexes in GM view).
// - Decorations share the material (instance G = 1), as in hex-map-wfc.
// - A render-mode uniform replaces hex-map-wfc's separate water-mask material (RENDER_MODE).
//
// The tiles' UVs index an 8x4 palette atlas (moody.png at low levels, winter.png at high ones,
// blended by level and by height within a slope), loaded with flipY off as the GLB expects.

import { MeshPhysicalNodeMaterial, SRGBColorSpace, TextureLoader, type Texture } from 'three/webgpu'
import {
  clamp,
  diffuseColor,
  dot,
  float,
  floor,
  materialColor,
  materialOpacity,
  mix,
  positionGeometry,
  select,
  texture,
  uniform,
  uv,
  varying,
  varyingProperty,
  vec3,
  vec4,
} from 'three/tsl'
import { LEVELS_COUNT } from '../wfc/tiles'
import { LOOK_CODES, TINT, TINT_COUNT } from './layout'

// Biome tint colors (linear RGB) for the grass swatch, and how far each pulls toward its color.
const TINTS: Record<number, { color: [number, number, number]; amount: number }> = {
  [TINT.swamp]: { color: [0.11, 0.16, 0.08], amount: 0.75 },
  [TINT.desert]: { color: [0.62, 0.45, 0.2], amount: 0.85 },
  [TINT.arctic]: { color: [0.8, 0.84, 0.9], amount: 0.9 },
  [TINT.forest]: { color: [0.04, 0.16, 0.05], amount: 0.75 },
}
// Emissive, linear: 0.12 shows as a mid grey.
const FOG_LAND = 0.12
const FOG_WATER = 0.035
const FOG_FRONTIER_BOOST = 1.7
const DIM = 0.4

function loadTexture(loader: TextureLoader, path: string, srgb = true): Promise<Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (tex) => {
        tex.flipY = false // the GLB's UVs expect non-flipped textures
        if (srgb) tex.colorSpace = SRGBColorSpace // (the water mask is data, kept linear)
        tex.needsUpdate = true
        resolve(tex)
      },
      undefined,
      reject,
    )
  })
}

// How the material draws. Uniform, so switching modes between passes needs no recompile.
export const RENDER_MODE = {
  normal: 0,
  // True colors, ignoring fog and GM dimming: for the top-down coast mask (wavesMask.ts),
  // which finds the sea by its blue.
  trueColor: 1,
  // Where water shows: the palette's water mask (water-mask.png), 0 under fog, dimmed in GM
  // view; for the water layer's mask (postFX.ts).
  waterMask: 2,
} as const

export type TileMaterial = {
  material: MeshPhysicalNodeMaterial
  setRenderMode: (mode: (typeof RENDER_MODE)[keyof typeof RENDER_MODE]) => void
}

export async function createTileMaterial(assetBase: string): Promise<TileMaterial> {
  const loader = new TextureLoader()
  const [texLo, texHi, texMask] = await Promise.all([
    loadTexture(loader, `${assetBase}textures/moody.png`),
    loadTexture(loader, `${assetBase}textures/winter.png`),
    loadTexture(loader, `${assetBase}textures/water-mask.png`, false),
  ])
  const renderMode = uniform(RENDER_MODE.normal)

  const mat = new MeshPhysicalNodeMaterial()
  mat.roughness = 1
  mat.metalness = 0

  // Skip the automatic multiply by the batch color: it carries data here, not a tint.
  mat.setupDiffuseColor = function () {
    const colorNode = this.colorNode ? vec4(this.colorNode) : materialColor
    diffuseColor.assign(colorNode)
    // (Cast: the typings don't accept materialOpacity, a float node, in mul.)
    const opacityNode = (this.opacityNode ? float(this.opacityNode) : materialOpacity) as ReturnType<typeof float>
    diffuseColor.a.assign(diffuseColor.a.mul(opacityNode))
  }

  const texCoord = uv()
  const batchColor = varyingProperty('vec3', 'vBatchColor')

  // Level blend (hex-map-wfc): instance level, plus the height within the mesh. A tile's
  // surface is at geometry y = 1 and each 0.5 above it is one more level; decorations (G = 1)
  // start at y = 0.
  const rawGeomPos = varying(positionGeometry, 'vRawGeomPos')
  const isDecoration = batchColor.g.greaterThan(0.5)
  const slopeContrib = select(isDecoration, rawGeomPos.y, rawGeomPos.y.sub(1.0)).mul(2.0 / (LEVELS_COUNT - 1))
  // Change from hex-map-wfc: the blend starts at level 2 (0 there, 0.5 at level 3, 1 at 4).
  // This world is steered higher than hex-map-wfc's (most land is at levels 1-3), and blending
  // from level 0 washed ordinary land out toward the snowy palette.
  const blend = clamp(batchColor.r.add(slopeContrib).mul(2).sub(1), 0, 1)
  const base = mix(texture(texLo, texCoord), texture(texHi, texCoord), blend).rgb

  // The look, from B.
  const code = floor(batchColor.b.mul(LOOK_CODES))
  const tint = code.mod(TINT_COUNT)
  const dim = floor(code.div(TINT_COUNT)).mod(2).equal(1)
  const seaTile = code.greaterThanEqual(2 * TINT_COUNT)

  // Grass swatch: column 0 (u < 1/8), row 2 (1/2 <= v < 3/4).
  const isGrass = texCoord.x.lessThan(0.125).and(texCoord.y.greaterThanEqual(0.5)).and(texCoord.y.lessThan(0.75))
  // Water swatch: column 1, row 1.
  const isWater = texCoord.x.greaterThanEqual(0.125).and(texCoord.x.lessThan(0.25)).and(texCoord.y.greaterThanEqual(0.25)).and(texCoord.y.lessThan(0.5))

  // Keep the swatch's light-to-dark gradient: scale the tint color by the texel's brightness.
  const luma = dot(base, vec3(0.2126, 0.7152, 0.0722))
  let tinted = base
  for (const [k, t] of Object.entries(TINTS)) {
    const target = vec3(...t.color).mul(luma.mul(1.6).add(0.4))
    tinted = select(tint.equal(Number(k)).and(isGrass), mix(base, target, t.amount), tinted)
  }
  const lit = select(dim, tinted.mul(DIM), tinted)

  const isFog = tint.equal(TINT.fog).or(tint.equal(TINT.fogFrontier))
  const fogGrey = select(isWater.and(seaTile), float(FOG_WATER), float(FOG_LAND)).mul(select(tint.equal(TINT.fogFrontier), float(FOG_FRONTIER_BOOST), float(1)))

  const isTrue = renderMode.equal(RENDER_MODE.trueColor)
  const isMask = renderMode.equal(RENDER_MODE.waterMask)
  const fogNow = isFog.and(isTrue.not())
  const maskValue = select(isFog, float(0), texture(texMask, texCoord).r.mul(select(dim, float(DIM), float(1))))

  mat.colorNode = select(isMask.or(fogNow), vec3(0, 0, 0), select(isTrue, tinted, lit))
  // Fog is unlit: all of its color comes from emission. So is the water mask.
  mat.emissiveNode = select(isMask, vec3(maskValue, maskValue, maskValue), select(fogNow, vec3(fogGrey, fogGrey, fogGrey), vec3(0, 0, 0)))
  mat.needsUpdate = true
  return { material: mat, setRenderMode: (mode) => (renderMode.value = mode) }
}
