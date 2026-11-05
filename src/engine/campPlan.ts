// Pure, deterministic rendering-only placement for CampMapSvg.tsx — NOT part of the generation
// engine. Like towerPlan.ts/keepPlan.ts/settlementPlan.ts, it's derived at render time from the
// generated CampSite (each feature's existing position and type) via a seeded hash, so nothing
// extra is persisted and generateCamp.ts is untouched. Reference for the look (2026-10-31, see
// docs/plan-camp-map-overhaul.md): a painted forest-clearing camp — a stone-ring fire in the
// middle, patched canvas tents, crates/barrels/wagons, a rope fence, stumps and grass, forest
// along one edge, fading to white paper on the other.
//
// Coordinates are the camp layout's own units (campLayout.ts), y grows downward.

import { seededRngFromNumber } from './caveRenderShapes'
import { seedForString } from './towerPlan'
import type { CampPeripheralFeature } from '../data/campTables'

export type CampPlanFeatureInput = { id: string; feature: CampPeripheralFeature | 'Central'; x: number; y: number }

export type CampPropKind =
  | 'campfire'
  | 'logSeat'
  | 'tent'
  | 'leaderTent'
  | 'bedroll'
  | 'crate'
  | 'barrel'
  | 'sack'
  | 'wagon'
  | 'coveredWagon'
  | 'table'
  | 'platform'
  | 'stake'
  | 'fencePost'
  | 'horse'
  | 'hay'
  | 'pit'
  | 'stool'
  | 'banner'
  | 'rug'

// One drawn object. `rotation` is in degrees; `size` is a per-kind scale factor around 1.
export type CampProp = { kind: CampPropKind; x: number; y: number; rotation: number; size: number; featureId: string }

export type CampPlan = {
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  props: CampProp[]
  // Rope lines (the pen's fence) as polylines.
  ropes: { featureId: string; points: { x: number; y: number }[] }[]
  // Forest canopy along one edge, and the direction it's in (radians).
  forestAngle: number
  canopy: { x: number; y: number; r: number }[]
  stumps: { x: number; y: number; r: number }[]
  grass: { x: number; y: number; rotation: number }[]
  // Where each feature's number marker goes.
  markers: { featureId: string; x: number; y: number }[]
}

const MARGIN = 7
// The camp layout's spacing (campLayout.ts) suits abstract circles; a drawn camp reads better
// pulled in tight around the fire, with each feature's objects drawn larger.
const PULL_IN = 0.62
const PROP_SCALE = 1.35
// After pulling in, features must stay at least this far apart (and from the fire), so a busy
// camp spreads out instead of overlapping.
const MIN_FEATURE_GAP = 8.5
const MIN_FIRE_GAP = 9

export function computeCampPlan(featuresIn: CampPlanFeatureInput[], seedSource: string): CampPlan {
  const rng = seededRngFromNumber(seedForString(seedSource))
  const centralIn = featuresIn.find((f) => f.feature === 'Central') ?? featuresIn[0]
  const cx = centralIn.x
  const cy = centralIn.y
  const others = featuresIn.filter((f) => f !== centralIn)
  let pull = PULL_IN
  for (const f of others) {
    const d = Math.hypot(f.x - cx, f.y - cy)
    if (d > 0) pull = Math.max(pull, MIN_FIRE_GAP / d)
    for (const g of others) {
      if (g === f) continue
      const dd = Math.hypot(f.x - g.x, f.y - g.y)
      if (dd > 0) pull = Math.max(pull, MIN_FEATURE_GAP / dd)
    }
  }
  const features = featuresIn.map((f) => ({ ...f, x: cx + (f.x - cx) * pull, y: cy + (f.y - cy) * pull }))
  const props: CampProp[] = []
  const ropes: CampPlan['ropes'] = []
  const markers: CampPlan['markers'] = []
  const jitter = (amount: number) => (rng() - 0.5) * amount
  const add = (featureId: string, kind: CampPropKind, x: number, y: number, rotation: number, size = 1) =>
    props.push({ kind, x, y, rotation, size, featureId })

  for (const f of features) {
    // Orientation facing the fire, so tents open and wagons line up around it.
    const facing = (Math.atan2(cy - f.y, cx - f.x) * 180) / Math.PI
    const toward = (d: number, sideways: number) => {
      const a = Math.atan2(cy - f.y, cx - f.x)
      return { x: f.x + Math.cos(a) * d - Math.sin(a) * sideways, y: f.y + Math.sin(a) * d + Math.cos(a) * sideways }
    }
    markers.push({ featureId: f.id, x: f.x, y: f.y - 3.4 })

    switch (f.feature) {
      case 'Central': {
        add(f.id, 'campfire', f.x, f.y, rng() * 360)
        const seats = 3 + Math.floor(rng() * 2)
        const start = rng() * 360
        for (let i = 0; i < seats; i++) {
          const a = ((start + (360 / seats) * i + jitter(25)) * Math.PI) / 180
          add(f.id, 'logSeat', f.x + Math.cos(a) * 2.6, f.y + Math.sin(a) * 2.6, (a * 180) / Math.PI + 90)
        }
        // The fire's label goes in the widest gap between the features around it.
        const angles = features
          .filter((g) => g.id !== f.id)
          .map((g) => Math.atan2(g.y - f.y, g.x - f.x))
          .sort((a, b) => a - b)
        let labelAngle = -Math.PI / 2
        if (angles.length > 0) {
          let widest = -1
          angles.forEach((a, i) => {
            const next = i + 1 < angles.length ? angles[i + 1] : angles[0] + Math.PI * 2
            if (next - a > widest) {
              widest = next - a
              labelAngle = a + (next - a) / 2
            }
          })
        }
        markers[markers.length - 1] = { featureId: f.id, x: f.x + Math.cos(labelAngle) * 3.3, y: f.y + Math.sin(labelAngle) * 3.3 }
        break
      }
      case 'Sleeping area': {
        const tents = 2 + Math.floor(rng() * 2)
        for (let i = 0; i < tents; i++) {
          const p = toward(-0.6 + jitter(0.8), (i - (tents - 1) / 2) * 2.6)
          add(f.id, 'tent', p.x, p.y, facing + 90 + jitter(20), 0.9 + rng() * 0.25)
        }
        const beds = 1 + Math.floor(rng() * 2)
        for (let i = 0; i < beds; i++) {
          const p = toward(1.9, (i - (beds - 1) / 2) * 1.6 + jitter(0.6))
          add(f.id, 'bedroll', p.x, p.y, facing + jitter(30))
        }
        break
      }
      case 'Supply cache': {
        if (rng() < 0.7) {
          const p = toward(-0.9, jitter(1))
          add(f.id, rng() < 0.5 ? 'coveredWagon' : 'wagon', p.x, p.y, facing + 90 + jitter(25))
        }
        const crates = 3 + Math.floor(rng() * 3)
        for (let i = 0; i < crates; i++) {
          const p = toward(1 + jitter(1.4), jitter(3.4))
          add(f.id, 'crate', p.x, p.y, jitter(40), 0.8 + rng() * 0.4)
        }
        const barrels = 2 + Math.floor(rng() * 2)
        for (let i = 0; i < barrels; i++) {
          const p = toward(1.6 + jitter(1.2), jitter(3.6))
          add(f.id, 'barrel', p.x, p.y, 0)
        }
        for (let i = 0; i < 2; i++) {
          const p = toward(0.6 + jitter(1), jitter(3))
          add(f.id, 'sack', p.x, p.y, jitter(60))
        }
        break
      }
      case 'Watch post': {
        add(f.id, 'platform', f.x, f.y, facing + jitter(15))
        // A short line of sharpened stakes on the outward side.
        for (let i = -3; i <= 3; i++) {
          const p = toward(-2.6, i * 0.75)
          add(f.id, 'stake', p.x, p.y, facing)
        }
        break
      }
      case 'Mounts/pack animals pen': {
        const radius = 2.6
        const posts = 9
        const points: { x: number; y: number }[] = []
        const start = rng() * 360
        for (let i = 0; i <= posts; i++) {
          // Leave a gap (the gate) facing the fire.
          const a = ((facing + 25 + ((360 - 50) / posts) * i) * Math.PI) / 180
          const p = { x: f.x + Math.cos(a) * radius, y: f.y + Math.sin(a) * radius }
          points.push(p)
          add(f.id, 'fencePost', p.x, p.y, start)
        }
        ropes.push({ featureId: f.id, points })
        const horses = 1 + Math.floor(rng() * 3)
        for (let i = 0; i < horses; i++) {
          add(f.id, 'horse', f.x + jitter(2), f.y + jitter(2), rng() * 360)
        }
        add(f.id, 'hay', f.x + jitter(1.5), f.y + jitter(1.5), rng() * 90)
        break
      }
      case 'Prisoner/captive pit': {
        add(f.id, 'pit', f.x, f.y, rng() * 360)
        const p = toward(2.2, jitter(1.5))
        add(f.id, 'stool', p.x, p.y, 0)
        break
      }
      case "Ritual/leader's space": {
        add(f.id, 'rug', f.x, f.y, facing + jitter(10))
        const t = toward(-0.8, 0)
        add(f.id, 'leaderTent', t.x, t.y, facing + 90 + jitter(10))
        const b = toward(1.4, 2.2)
        add(f.id, 'banner', b.x, b.y, 0)
        const tb = toward(2, -1.4)
        add(f.id, 'table', tb.x, tb.y, rng() * 360, 0.8)
        break
      }
    }
  }

  // Draw each feature's objects larger, spreading them out around the feature's own spot.
  const centerOf = new Map(features.map((f) => [f.id, f]))
  for (const prop of props) {
    const f = centerOf.get(prop.featureId)!
    prop.x = f.x + (prop.x - f.x) * PROP_SCALE
    prop.y = f.y + (prop.y - f.y) * PROP_SCALE
    prop.size *= PROP_SCALE
  }
  for (const rope of ropes) {
    const f = centerOf.get(rope.featureId)!
    rope.points = rope.points.map((p) => ({ x: f.x + (p.x - f.x) * PROP_SCALE, y: f.y + (p.y - f.y) * PROP_SCALE }))
  }
  for (const m of markers) {
    const f = centerOf.get(m.featureId)!
    m.x = f.x + (m.x - f.x) * PROP_SCALE
    m.y = f.y + (m.y - f.y) * PROP_SCALE
  }

  // Map bounds: the camp plus a margin of clearing.
  const xs = features.map((f) => f.x)
  const ys = features.map((f) => f.y)
  const bounds = {
    minX: Math.min(...xs) - MARGIN,
    minY: Math.min(...ys) - MARGIN,
    maxX: Math.max(...xs) + MARGIN,
    maxY: Math.max(...ys) + MARGIN,
  }
  // Keep the map roughly square — a camp with features on just two sides would otherwise be a
  // thin strip — by padding the short side with more clearing.
  const spanX = bounds.maxX - bounds.minX
  const spanY = bounds.maxY - bounds.minY
  const minSpan = Math.max(spanX, spanY) * 0.8
  if (spanX < minSpan) {
    bounds.minX -= (minSpan - spanX) / 2
    bounds.maxX += (minSpan - spanX) / 2
  }
  if (spanY < minSpan) {
    bounds.minY -= (minSpan - spanY) / 2
    bounds.maxY += (minSpan - spanY) / 2
  }
  const reach = Math.max(...features.map((f) => Math.hypot(f.x - cx, f.y - cy))) + 4.5

  // Forest along one side: canopy beyond the camp's reach in that direction.
  const forestAngle = rng() * Math.PI * 2
  const canopy: CampPlan['canopy'] = []
  // How far the map reaches in the forest's direction — the forest always starts inside it.
  const farthestAlong = Math.max(
    ...[
      [bounds.minX, bounds.minY],
      [bounds.maxX, bounds.minY],
      [bounds.minX, bounds.maxY],
      [bounds.maxX, bounds.maxY],
    ].map(([x, y]) => (x - cx) * Math.cos(forestAngle) + (y - cy) * Math.sin(forestAngle)),
  )
  // A dense band: many overlapping crowns, a wavy inner edge, kept clear of the camp itself.
  for (let i = 0; i < 900; i++) {
    const x = bounds.minX - 2 + rng() * (bounds.maxX - bounds.minX + 4)
    const y = bounds.minY - 2 + rng() * (bounds.maxY - bounds.minY + 4)
    const along = (x - cx) * Math.cos(forestAngle) + (y - cy) * Math.sin(forestAngle)
    const across = -(x - cx) * Math.sin(forestAngle) + (y - cy) * Math.cos(forestAngle)
    const edge = Math.min(reach * 0.9, farthestAlong - 4) + 1.6 * Math.sin(across * 0.35) + 0.8 * Math.sin(across * 0.9 + 1.3)
    if (along < edge) continue
    if (canopy.some((c) => Math.hypot(c.x - x, c.y - y) < 0.9)) continue
    const r = 1.1 + rng() * 1.1
    // Trees never grow over the camp's own things.
    if (props.some((p) => Math.hypot(p.x - x, p.y - y) < r + 1)) continue
    canopy.push({ x, y, r })
  }

  // Stumps and grass tufts in the open ground, clear of the camp's features.
  const clear = (x: number, y: number, room: number) => features.every((f) => Math.hypot(x - f.x, y - f.y) > room)
  const stumps: CampPlan['stumps'] = []
  for (let i = 0; i < 40 && stumps.length < 6; i++) {
    const a = rng() * Math.PI * 2
    const d = reach * (0.5 + rng() * 0.6)
    const x = cx + Math.cos(a) * d
    const y = cy + Math.sin(a) * d
    if (!clear(x, y, 4)) continue
    stumps.push({ x, y, r: 0.45 + rng() * 0.25 })
  }
  const grass: CampPlan['grass'] = []
  for (let i = 0; i < 160; i++) {
    const x = bounds.minX + rng() * (bounds.maxX - bounds.minX)
    const y = bounds.minY + rng() * (bounds.maxY - bounds.minY)
    if (!clear(x, y, 3.2)) continue
    grass.push({ x, y, rotation: jitter(40) })
  }

  return { bounds, props, ropes, forestAngle, canopy, stumps, grass, markers }
}
