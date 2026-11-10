// World-generation simulation for tuning (milestone M2). Usage:
//   npm run sim -- [--seeds N] [--rings R]
// Grows N worlds (default 10) of R chunk rings (default 2: 19 chunks, ~4,100 hexes) and
// reports the terrain mix and the punch-list 1a targets, as mean [min-max] over the seeds.

import { ALL_TERRAINS } from '../src/data/tables'
import { growWorld, measureWorld, TERRAIN_TARGETS, WORLD_TARGETS, type WorldStats } from '../src/world/stats'

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? Number(process.argv[i + 1]) : fallback
}
const seeds = arg('seeds', 10)
const rings = arg('rings', 2)

const runs: { stats: WorldStats; ms: number; failed: number; dropped: number; solves: number }[] = []
for (let seed = 1; seed <= seeds; seed++) {
  const w = growWorld(seed, rings)
  runs.push({
    stats: measureWorld(w.store, w.fields),
    ms: w.ms,
    failed: w.solves.filter((s) => !s.ok).length,
    dropped: w.solves.reduce((n, s) => n + s.dropped.length, 0),
    solves: w.solves.length,
  })
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`
const summary = (xs: number[], fmt = pct) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return `${fmt(mean).padStart(6)} [${fmt(Math.min(...xs))}-${fmt(Math.max(...xs))}]`
}
const col = (f: (s: WorldStats) => number) => runs.map((r) => f(r.stats))

console.log(`${seeds} worlds x ${runs[0].solves} chunks, ${runs[0].stats.hexes} hexes each`)
console.log(`solves: ${runs.reduce((n, r) => n + r.failed, 0)} failed, ${runs.reduce((n, r) => n + r.dropped, 0)} dropped cells, ` +
  `${Math.round(runs.reduce((n, r) => n + r.ms, 0) / runs.reduce((n, r) => n + r.solves, 0))} ms per chunk`)
console.log(`\nterrain (share of land)      actual mean [min-max]   target`)
for (const t of ALL_TERRAINS) {
  if (t === 'Ocean') continue
  console.log(`  ${t.padEnd(16)} ${summary(col((s) => s.terrainShareOfLand[t])).padStart(26)}   ${pct(TERRAIN_TARGETS[t])}`)
}
console.log(`\nwater share of map           ${summary(col((s) => s.waterShare))}`)
console.log(`biggest landmass / land      ${summary(col((s) => s.biggestLandmassShare))}   >= ${pct(WORLD_TARGETS.biggestLandmassShare)}`)
console.log(`rivers / land                ${summary(col((s) => s.riverShareOfLand))}   ~${pct(WORLD_TARGETS.riverShareOfLand)}`)
console.log(`lakes / land                 ${summary(col((s) => s.lakeShareOfLand))}   ~${pct(WORLD_TARGETS.lakeShareOfLand)}`)
console.log(`river loops per world        ${summary(col((s) => s.riverLoops), (x) => x.toFixed(2))}   0`)
console.log(`roads / land                 ${summary(col((s) => s.roadShareOfLand))}   ~10.0%`)
console.log(`settlement anchors / land    ${summary(col((s) => s.anchorShareOfLand))}`)
console.log(`one-hex ponds / inland bodies ${summary(col((s) => s.oneHexPondShare))}   <= ${pct(WORLD_TARGETS.oneHexPondShare)}`)
console.log(`water bodies per world       ${summary(col((s) => s.oceanBodies.length), (x) => x.toFixed(1))}`)
console.log(`largest water body           ${summary(col((s) => s.oceanBodies[0] ?? 0), (x) => x.toFixed(0))}`)
console.log(`bodies >= 100 hexes / bodies ${summary(col((s) => s.oceanBodies.filter((n) => n >= 100).length / Math.max(1, s.oceanBodies.length)))}`)
