// The animated water layer: caustic sparkles drifting over open water and wave bands running
// out from the coast. Drawn as emission only, to its own render target, and added on top of
// the water areas by postFX.ts.
//
// Ported from hex-map-wfc (src/hexmap/effects/Water.js), Copyright (c) 2026 Felix Turner,
// MIT License: https://github.com/felixturner/hex-map-wfc/blob/main/LICENSE
// Changes:
// - TypeScript. The tuning is hex-map-wfc's GUI defaults (src/GUI.js `water` and `waves`),
//   fixed; the debug cove overlay is left out.
// - The coast textures cover the map's bounds (wavesMask.ts `bounds`) instead of a fixed
//   180-unit square at the origin, and the plane is sized to them, since this map grows.

import { Color, LinearFilter, Mesh, MeshPhysicalNodeMaterial, PlaneGeometry, RepeatWrapping, TextureLoader, Vector2, type Texture } from 'three/webgpu'
import { clamp, cos, float, mix, mx_noise_float, positionWorld, sin, texture, time, uniform, vec2, vec3 } from 'three/tsl'

export const WATER_Y = 0.88

export type WaterBounds = { cx: number; cz: number; size: number }

export class Water {
  readonly mesh: Mesh
  private readonly center = uniform(new Vector2(0, 0))
  private readonly size = uniform(180)

  constructor(assetBase: string, coastTexture: Texture, coveTexture: Texture) {
    const causticTex = new TextureLoader().load(`${assetBase}textures/caustic.jpg`)
    causticTex.wrapS = causticTex.wrapT = RepeatWrapping
    causticTex.minFilter = LinearFilter
    causticTex.magFilter = LinearFilter

    // Sparkles (GUI defaults: opacity 0.1, speed 1.5, freq 1.5, angle 0, brightness 0.53,
    // contrast 17.5).
    const waterOpacity = float(0.1)
    const waterSpeed = float(1.5)
    const waterFreq = float(1.5)
    const waterAngle = float(0)
    const waterBrightness = float(0.53)
    const waterContrast = float(17.5)
    // Waves (speed 2, count 4, opacity 0.35, break 0.135, width 1 - 0.27, offset 0.3,
    // gradient 0.31 of #4770a1, cove strength 2.274, cove fade and thin on).
    const waveSpeed = float(2)
    const waveCount = float(4)
    const waveOpacity = float(0.35)
    const waveNoiseBreak = float(0.135)
    const waveWidth = float(1 - 0.27)
    const waveOffset = float(0.3)
    const waveGradientOpacity = float(0.31)
    const waveGradientColor = vec3(new Color('#4770a1').r, new Color('#4770a1').g, new Color('#4770a1').b)
    const coveStrength = float(2.274)
    const coveFade = float(1)
    const coveThin = float(1)

    const driftX = cos(waterAngle).mul(waterSpeed).mul(0.015)
    const driftZ = sin(waterAngle).mul(waterSpeed).mul(0.015)
    const waterUV = vec2(
      positionWorld.x.mul(waterFreq).mul(0.1).add(time.mul(driftX)),
      positionWorld.z.mul(waterFreq).mul(0.1).add(time.mul(driftZ)),
    )
    const causticVal = texture(causticTex).sample(waterUV).r
    const sparkle = clamp(causticVal.sub(waterBrightness).mul(waterContrast), 0.0, 1.0)
    const totalAlpha = sparkle.mul(waterOpacity)

    // Coast distance from the blurred coast mask (1 at the coastline, falling off seaward).
    const coastUV = vec2(
      positionWorld.x.sub(this.center.x).div(this.size).add(0.5),
      positionWorld.z.sub(this.center.y).div(this.size).add(0.5),
    )
    const gradSample = texture(coastTexture).sample(coastUV).r
    const outwardDist = clamp(float(1).sub(gradSample), 0, 1)

    const waveStart = waveOffset
    const waveEnd = waveOffset.add(0.6)
    const localDist = clamp(outwardDist.sub(waveStart).div(float(0.6)), 0, 1)
    const inRange = clamp(outwardDist.sub(waveStart).mul(20.0), 0, 1).mul(clamp(waveEnd.sub(outwardDist).mul(20.0), 0, 1))

    const coveSample = clamp(texture(coveTexture).sample(coastUV).r.mul(coveStrength), 0, 1)

    const wavePhase = sin(localDist.mul(waveCount).mul(Math.PI * 2).sub(time.mul(waveSpeed))).mul(0.5).add(0.5)
    const baseThreshold = mix(waveWidth, float(0.99), localDist)
    const waveThreshold = mix(baseThreshold, float(1.0), coveSample.mul(coveThin))
    const waveBand = clamp(wavePhase.sub(waveThreshold).mul(40.0), 0, 1)

    // Animated breaks along the wave lines, at two scales.
    const breakHi = mx_noise_float(vec3(positionWorld.x.mul(3.0), positionWorld.z.mul(3.0), time.mul(0.15)))
    const breakLo = mx_noise_float(vec3(positionWorld.x.mul(0.6), positionWorld.z.mul(0.6), time.mul(0.08)))
    const noiseVal = breakHi.mul(0.6).add(breakLo.mul(0.4)).mul(0.5).add(0.5)
    const breakMask = clamp(noiseVal.sub(waveNoiseBreak.mul(3.0)).mul(20.0), 0, 1)
    const broken = waveBand.mul(breakMask)

    const fadeIn = clamp(localDist.mul(8.0), 0, 1)
    const fadeOut = clamp(float(1).sub(localDist).mul(5.0), 0, 1)
    const nearCoast = clamp(gradSample.mul(3.0), 0, 1)
    const coveFadeMask = mix(float(1), float(1).sub(coveSample), coveFade)
    const waveAlpha = broken.mul(fadeIn).mul(fadeOut).mul(inRange).mul(nearCoast).mul(waveOpacity).mul(coveFadeMask)

    // Sparkles near the coast (rivers) and in deep water, held back in the wave zone.
    const uMask = clamp(outwardDist.sub(0.5).abs().sub(0.3).mul(10.0), 0, 1)
    const sparkleMask = mix(float(1), uMask, float(1).sub(coveSample))
    const sparkles = vec3(sparkle, sparkle, sparkle).mul(totalAlpha).mul(sparkleMask).mul(breakMask)

    const material = new MeshPhysicalNodeMaterial({ transparent: true, depthWrite: false, depthTest: true })
    material.colorNode = vec3(0, 0, 0)
    material.emissiveNode = sparkles.add(vec3(waveAlpha, waveAlpha, waveAlpha)).add(waveGradientColor.mul(gradSample).mul(waveGradientOpacity))
    material.opacityNode = float(1)

    const geometry = new PlaneGeometry(1, 1)
    geometry.rotateX(-Math.PI / 2)
    this.mesh = new Mesh(geometry, material)
    this.mesh.position.y = WATER_Y
  }

  // Cover the map, matching the coast textures' area.
  setBounds(b: WaterBounds): void {
    this.center.value.set(b.cx, b.cz)
    this.size.value = b.size
    this.mesh.position.set(b.cx, WATER_Y, b.cz)
    this.mesh.scale.set(b.size, 1, b.size)
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as MeshPhysicalNodeMaterial).dispose()
  }
}
