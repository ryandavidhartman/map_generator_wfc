// Seeded random numbers for WFC.
//
// The generator is Mulberry32, as in hex-map-wfc (src/SeededRandom.js), Copyright (c) 2026
// Felix Turner, MIT License: https://github.com/felixturner/hex-map-wfc/blob/main/LICENSE
// Change: hex-map-wfc keeps one global stream for the whole session. Here each solve gets
// its own Rng (the project's injectable `Rng` type), seeded from the world seed and the
// chunk, so a chunk's result doesn't depend on how many solves ran before it.

import type { Rng } from '../engine/dice'

export function mulberry32(seed: number): Rng {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Mix integers into one 32-bit seed (for per-chunk seeds from the world seed).
export function mixSeed(...parts: number[]): number {
  let h = 0x811c9dc5
  for (const p of parts) {
    h = Math.imul(h ^ (p | 0), 0x01000193)
    h ^= h >>> 13
    h = Math.imul(h, 0x5bd1e995)
    h ^= h >>> 15
  }
  return h >>> 0
}
