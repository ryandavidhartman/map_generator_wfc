// The world's large-scale fields: seeded noise sampled at each hex.
//
// - continent: decides sea and land (below seaLevel is sea). masks.ts turns this into zones,
//   with a free shore band wherever sea and land meet.
// - elevation: the target height, in tile levels (0-4), that WFC is steered toward on land.
//   It rises inland from the coast, with ridges for mountain ranges.
// - moisture, temperature: pick the land biome (Swamp, Forest, Grassland, Desert/arctic).
//
// The fields are pure functions of the world params and a hex, so a hex always gets the same
// values whichever chunk is solved first, and the map stays unbounded.

import { cubeCoordsInRadius, type Cube } from '../wfc/cube'
import { mixSeed } from '../wfc/rng'
import { LEVELS_COUNT } from '../wfc/tiles'
import { fbm, simplex2D, type Noise2D } from './noise'

// Saved with the campaign. offsetX/offsetY shift where the origin hex sits in the noise, so
// the starting hex can be placed on land or at sea (see placeWorld).
export type WorldParams = { seed: number; offsetX: number; offsetY: number }

// Tuning (starting points; see `npm run sim`). Changing these changes how unsolved parts of an
// existing campaign's world come out, but never alters solved hexes.
export const WORLD_TUNING = {
  continentScale: 80, // hexes: size of the largest land/sea features
  continentOctaves: 4,
  seaLevel: -0.12, // continent value below which it's sea
  inlandRise: 0.5, // continent units above sea level per tile level of elevation
  ridgeScale: 28, // hexes: spacing of mountain ridges
  ridgeHeight: 2.0, // extra levels at a ridge's crest, at full strength
  moistureScale: 30,
  temperatureScale: 120,
}

export type FieldSample = {
  continent: number // roughly -1..1
  elevation: number // target level, 0..LEVELS_COUNT - 1 (continuous)
  moisture: number // roughly -1..1
  temperature: number // roughly -1..1
}

export type WorldFields = {
  params: WorldParams
  sample(c: Cube): FieldSample
  // Sample at a point of the noise plane directly (ignores the params' offset).
  samplePlane(x: number, y: number): FieldSample
  isSea(continent: number): boolean
}

const SQRT3_2 = Math.sqrt(3) / 2

// Hex center in the plane, one unit between neighboring centers (pointy-top axial).
export function hexPlane(c: Cube): { x: number; y: number } {
  return { x: c.q + c.r / 2, y: c.r * SQRT3_2 }
}

export function createWorldFields(params: WorldParams, tuning = WORLD_TUNING): WorldFields {
  const field = (n: number, scale: number, octaves: number): Noise2D =>
    fbm(simplex2D(mixSeed(params.seed, n)), scale, octaves)
  const continent = field(1, tuning.continentScale, tuning.continentOctaves)
  const ridges = field(2, tuning.ridgeScale, 3)
  const ridgeStrength = field(3, tuning.continentScale / 2, 2)
  const moisture = field(4, tuning.moistureScale, 3)
  const temperature = field(5, tuning.temperatureScale, 2)
  const top = LEVELS_COUNT - 1

  const samplePlane = (x: number, y: number): FieldSample => {
    const v = continent(x, y)
    const inland = Math.max(0, v - tuning.seaLevel) / tuning.inlandRise
    // Ridged noise peaks along the zero lines of the noise, giving long, thin ranges. Its
    // strength varies across the map so some regions are mountainous and others flat, and it
    // fades in over the first level inland so coasts stay low.
    const crest = (1 - Math.abs(ridges(x, y))) ** 4
    const strength = Math.max(0, ridgeStrength(x, y) + 0.3) * Math.min(1, inland)
    const elevation = Math.min(top, inland + crest * strength * tuning.ridgeHeight)
    return { continent: v, elevation, moisture: moisture(x, y), temperature: temperature(x, y) }
  }

  return {
    params,
    isSea: (v) => v < tuning.seaLevel,
    samplePlane,
    sample(c) {
      const { x, y } = hexPlane(c)
      return samplePlane(x + params.offsetX, y + params.offsetY)
    },
  }
}

// Find an offset that puts the origin hex well inside the sea (wantSea) or well inland, so the
// starting hex agrees with the chosen terrain: every hex within START_CLEARANCE of the origin
// must be on the right side of sea level (checking only the origin left starts on the coast).
// Deterministic for a seed.
export const START_CLEARANCE = 3

export function placeWorld(seed: number, wantSea: boolean, tuning = WORLD_TUNING): WorldParams {
  const fields = createWorldFields({ seed, offsetX: 0, offsetY: 0 }, tuning)
  const near = cubeCoordsInRadius({ q: 0, r: 0, s: 0 }, START_CLEARANCE).map(hexPlane)
  const good = (ox: number, oy: number) =>
    near.every((p) => fields.isSea(fields.samplePlane(ox + p.x, oy + p.y).continent) === wantSea)
  // Walk outward on a spiral of sample points until one fits.
  for (let k = 0; k < 4000; k++) {
    const angle = k * 2.399963 // golden angle
    const radius = 6 * Math.sqrt(k)
    const offsetX = Math.round(radius * Math.cos(angle))
    const offsetY = Math.round(radius * Math.sin(angle))
    if (good(offsetX, offsetY)) return { seed, offsetX, offsetY }
  }
  return { seed, offsetX: 0, offsetY: 0 }
}
