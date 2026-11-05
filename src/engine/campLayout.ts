// Pure geometry for Camp's scatter/zone layout — the third distinct layout shape in this
// project (after dungeons' BSP tiling / Keep's hub-and-spoke rects, and Tower's linear vertical
// chain): a central feature with peripheral features scattered around it at irregular distances,
// with no connections at all — confirmed 2026-07-04, "a camp isn't traversed room-to-room; it's
// a zone the party moves through freely." Renders via the new CampMapSvg.tsx, not a reuse of
// DungeonMapSvg — those rooms are rects with graph edges; Camp features are circles with no edges.

export type CampPoint = { x: number; y: number; radius: number }

const CENTRAL_RADIUS = 5
const PERIPHERAL_RADIUS = 3
const PERIPHERAL_DISTANCE_BASE = 14
// Deterministic irregularity, not rng-driven: alternating +/- jitter by index parity, same
// "organic-looking but fully reproducible" approach keepLayout.ts uses for its fan angles —
// avoids consuming extra rng() calls that would need to be accounted for in scripted tests.
const PERIPHERAL_DISTANCE_JITTER = 4

export type CampLayout = {
  central: CampPoint
  peripheral: CampPoint[]
}

export function computeCampLayout(peripheralCount: number): CampLayout {
  const centralRaw: CampPoint = { x: 0, y: 0, radius: CENTRAL_RADIUS }

  const peripheralRaw: CampPoint[] = []
  for (let i = 0; i < peripheralCount; i++) {
    const angleDeg = (360 / peripheralCount) * i
    const angleRad = (angleDeg * Math.PI) / 180
    const distance = PERIPHERAL_DISTANCE_BASE + (i % 2 === 0 ? PERIPHERAL_DISTANCE_JITTER : -PERIPHERAL_DISTANCE_JITTER)
    peripheralRaw.push({
      x: distance * Math.cos(angleRad),
      y: distance * Math.sin(angleRad),
      radius: PERIPHERAL_RADIUS,
    })
  }

  // Shift into non-negative coordinate space (same renderer convention as dungeonLayout.ts/
  // keepLayout.ts), accounting for each point's own radius so circles never clip negative.
  const all = [centralRaw, ...peripheralRaw]
  const minX = Math.min(...all.map((p) => p.x - p.radius))
  const minY = Math.min(...all.map((p) => p.y - p.radius))
  const shiftX = -minX + 1
  const shiftY = -minY + 1
  const shift = (p: CampPoint): CampPoint => ({ ...p, x: p.x + shiftX, y: p.y + shiftY })

  return {
    central: shift(centralRaw),
    peripheral: peripheralRaw.map(shift),
  }
}
