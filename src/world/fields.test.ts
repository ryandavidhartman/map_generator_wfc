import { describe, expect, it } from 'vitest'
import { CUBE_DIRS, cubeCoordsInRadius } from '../wfc/cube'
import { LEVELS_COUNT } from '../wfc/tiles'
import { createWorldFields, hexPlane, placeWorld, START_CLEARANCE, WORLD_TUNING } from './fields'
import { fbm, simplex2D } from './noise'

describe('noise', () => {
  it('is deterministic per seed, varies between seeds, and stays in range', () => {
    const a = simplex2D(1)
    const b = simplex2D(1)
    const c = simplex2D(2)
    let differs = false
    for (let i = 0; i < 500; i++) {
      const x = i * 0.37
      const y = i * -0.21
      expect(a(x, y)).toBe(b(x, y))
      expect(Math.abs(a(x, y))).toBeLessThanOrEqual(1)
      if (a(x, y) !== c(x, y)) differs = true
    }
    expect(differs).toBe(true)
  })

  it('is smooth: nearby points have nearby values at large scales', () => {
    const f = fbm(simplex2D(5), 80, 4)
    for (let i = 0; i < 200; i++) {
      expect(Math.abs(f(i, i * 0.5) - f(i + 1, i * 0.5))).toBeLessThan(0.15)
    }
  })
})

describe('world fields', () => {
  const fields = createWorldFields({ seed: 9, offsetX: 0, offsetY: 0 })

  it('lays hexes out one unit apart', () => {
    const o = hexPlane({ q: 0, r: 0, s: 0 })
    for (const d of CUBE_DIRS) {
      const p = hexPlane({ q: d.dq, r: d.dr, s: d.ds })
      expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeCloseTo(1)
    }
  })

  it('keeps elevation within the tile levels, and at 0 in the sea', () => {
    for (const c of cubeCoordsInRadius({ q: 0, r: 0, s: 0 }, 40)) {
      const f = fields.sample(c)
      expect(f.elevation).toBeGreaterThanOrEqual(0)
      expect(f.elevation).toBeLessThanOrEqual(LEVELS_COUNT - 1)
      if (fields.isSea(f.continent)) expect(f.elevation).toBe(0)
    }
  })

  it('shifts the noise by the offset', () => {
    const shifted = createWorldFields({ seed: 9, offsetX: 10, offsetY: 0 })
    expect(shifted.sample({ q: 0, r: 0, s: 0 })).toEqual(fields.samplePlane(10, 0))
  })
})

describe('placeWorld', () => {
  it('puts the origin and the hexes around it inland or at sea, as asked', () => {
    const near = cubeCoordsInRadius({ q: 0, r: 0, s: 0 }, START_CLEARANCE)
    for (const seed of [1, 2, 3, 4, 5, 42]) {
      const land = createWorldFields(placeWorld(seed, false))
      for (const c of near) expect(land.sample(c).continent).toBeGreaterThan(WORLD_TUNING.seaLevel)
      const sea = createWorldFields(placeWorld(seed, true))
      for (const c of near) expect(sea.sample(c).continent).toBeLessThan(WORLD_TUNING.seaLevel)
    }
  })

  it('is deterministic', () => {
    expect(placeWorld(7, false)).toEqual(placeWorld(7, false))
  })
})
