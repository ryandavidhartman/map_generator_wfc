// Seeded 2D simplex noise and fractal (fBm) sums of it, for the world's large-scale fields.
//
// Simplex noise after Stefan Gustavson's public-domain reference implementation
// ("Simplex noise demystified", 2005), with the permutation table shuffled from a seed.

import { mulberry32 } from '../wfc/rng'

export type Noise2D = (x: number, y: number) => number // roughly -1..1

const GRAD: readonly [number, number][] = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
]
const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6

export function simplex2D(seed: number): Noise2D {
  const rng = mulberry32(seed)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  const perm = new Uint8Array(512)
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]

  const corner = (gi: number, x: number, y: number) => {
    const t = 0.5 - x * x - y * y
    if (t < 0) return 0
    const g = GRAD[gi & 7]
    return t * t * t * t * (g[0] * x + g[1] * y)
  }

  return (xin, yin) => {
    const s = (xin + yin) * F2
    const i = Math.floor(xin + s)
    const j = Math.floor(yin + s)
    const t = (i + j) * G2
    const x0 = xin - (i - t)
    const y0 = yin - (j - t)
    const i1 = x0 > y0 ? 1 : 0
    const j1 = x0 > y0 ? 0 : 1
    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2
    const ii = i & 255
    const jj = j & 255
    const n =
      corner(perm[ii + perm[jj]], x0, y0) +
      corner(perm[ii + i1 + perm[jj + j1]], x1, y1) +
      corner(perm[ii + 1 + perm[jj + 1]], x2, y2)
    return 70 * n
  }
}

// Fractal sum of `octaves` layers, each at double the frequency and `gain` times the
// amplitude of the last, normalized back to roughly -1..1. `scale` is the size of the
// largest features, in the same units as x and y.
export function fbm(noise: Noise2D, scale: number, octaves: number, gain = 0.5): Noise2D {
  let norm = 0
  for (let o = 0, a = 1; o < octaves; o++, a *= gain) norm += a
  return (x, y) => {
    let sum = 0
    let amp = 1
    let freq = 1 / scale
    for (let o = 0; o < octaves; o++) {
      // Offset each octave so the layers don't all line up at the origin.
      sum += amp * noise(x * freq + o * 31.7, y * freq - o * 17.3)
      amp *= gain
      freq *= 2
    }
    return sum / norm
  }
}
