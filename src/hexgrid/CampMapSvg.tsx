// Renders a generated Camp as a painted forest-clearing battle map in the spirit of the user's
// reference (2026-10-31, see docs/plan-camp-map-overhaul.md): grass with tufts and stumps, forest
// along one edge, a white-paper fade on the opposite edge, a stone-ring campfire at the center
// and each feature drawn as a little scene (tents, crates and wagons, a watch platform, a fenced
// pen, a pit, the leader's tent). Soft colors, dark ink outlines, drop shadows. All placement
// comes from engine/campPlan.ts, derived at render time from the CampSite (nothing extra is
// persisted). Each feature's drawing is clickable and numbered; the objective gets a star.
// Still no lines between features — a camp is a zone the party moves through freely.

import type { ReactNode } from 'react'
import type { CampPlan, CampProp } from '../engine/campPlan'

export type CampMapFeatureData = { label: string; isObjective: boolean }

export type CampMapSvgProps = {
  plan: CampPlan
  features: Record<string, CampMapFeatureData>
  selectedId: string | null
  onSelect: (featureId: string) => void
}

const UNIT_PX = 22
const INK = '#3a2a1e'
const LINE = 0.08
const SHADOW = '#00000030'
const WOOD = '#9b6a3c'
const WOOD_DARK = '#6b4a2e'
const CANVAS = '#efe6d0'
const CANVAS_SHADE = '#d9cdb0'
const GRASS = '#8fb86a'
const GRASS_DARK = '#6e9a4c'
const CANOPY = '#3f6b35'
const CANOPY_EDGE = '#2a4a24'

function Shadow({ children }: { children: ReactNode }) {
  return (
    <g transform="translate(0.18 0.22)" fill={SHADOW} stroke="none">
      {children}
    </g>
  )
}

function Prop({ prop }: { prop: CampProp }) {
  const t = `translate(${prop.x} ${prop.y}) rotate(${prop.rotation}) scale(${prop.size})`
  switch (prop.kind) {
    case 'campfire':
      return (
        <g transform={t}>
          <circle r={1.15} fill="#5a4f45" />
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2
            return <circle key={i} cx={Math.cos(a) * 1.15} cy={Math.sin(a) * 1.15} r={0.3} fill="#9a958d" stroke={INK} strokeWidth={LINE} />
          })}
          {[0, 60, 120].map((deg) => (
            <rect key={deg} x={-0.75} y={-0.14} width={1.5} height={0.28} rx={0.1} fill={WOOD_DARK} transform={`rotate(${deg})`} />
          ))}
          <path d="M 0,-0.75 C 0.5,-0.2 0.55,0.4 0,0.55 C -0.55,0.4 -0.5,-0.2 0,-0.75 Z" fill="#f08a24" />
          <path d="M 0,-0.35 C 0.25,0 0.25,0.3 0,0.35 C -0.25,0.3 -0.25,0 0,-0.35 Z" fill="#ffd34d" />
        </g>
      )
    case 'logSeat':
      return (
        <g transform={t}>
          <Shadow>
            <rect x={-0.85} y={-0.28} width={1.7} height={0.56} rx={0.25} />
          </Shadow>
          <rect x={-0.85} y={-0.28} width={1.7} height={0.56} rx={0.25} fill="#8b5a32" stroke={INK} strokeWidth={LINE} />
          <ellipse cx={0.85} cy={0} rx={0.12} ry={0.27} fill="#c49a6c" stroke={INK} strokeWidth={0.05} />
        </g>
      )
    case 'tent':
    case 'leaderTent': {
      const big = prop.kind === 'leaderTent'
      const w = big ? 3.4 : 2.4
      const h = big ? 2.6 : 1.8
      return (
        <g transform={t}>
          <Shadow>
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.15} />
          </Shadow>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.15} fill={CANVAS} stroke={big ? '#9b3b2e' : INK} strokeWidth={big ? 0.16 : LINE} />
          <rect x={-w / 2} y={0} width={w} height={h / 2} fill={CANVAS_SHADE} opacity={0.75} />
          <line x1={-w / 2} y1={0} x2={w / 2} y2={0} stroke={INK} strokeWidth={LINE} />
          <rect x={-w * 0.3} y={-h * 0.38} width={w * 0.18} height={h * 0.2} fill={CANVAS_SHADE} />
          <rect x={w * 0.12} y={h * 0.12} width={w * 0.16} height={h * 0.18} fill="#cfc2a3" />
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sy) => <circle key={`${sx}${sy}`} cx={(sx * w) / 2 + sx * 0.35} cy={(sy * h) / 2 + sy * 0.3} r={0.08} fill={INK} />),
          )}
        </g>
      )
    }
    case 'bedroll':
      return (
        <g transform={t}>
          <Shadow>
            <rect x={-0.4} y={-0.8} width={0.8} height={1.6} rx={0.3} />
          </Shadow>
          <rect x={-0.4} y={-0.8} width={0.8} height={1.6} rx={0.3} fill="#8b3a3a" stroke={INK} strokeWidth={LINE} />
          <rect x={-0.3} y={-0.72} width={0.6} height={0.36} rx={0.12} fill="#f1ead8" stroke={INK} strokeWidth={0.05} />
        </g>
      )
    case 'crate':
      return (
        <g transform={t}>
          <Shadow>
            <rect x={-0.4} y={-0.4} width={0.8} height={0.8} />
          </Shadow>
          <rect x={-0.4} y={-0.4} width={0.8} height={0.8} fill="#a0703f" stroke={INK} strokeWidth={LINE} />
          <path d="M -0.4,-0.4 L 0.4,0.4 M 0.4,-0.4 L -0.4,0.4" stroke={WOOD_DARK} strokeWidth={0.06} />
        </g>
      )
    case 'barrel':
      return (
        <g transform={t}>
          <Shadow>
            <circle r={0.38} />
          </Shadow>
          <circle r={0.38} fill="#8b5a32" stroke={INK} strokeWidth={LINE} />
          <circle r={0.24} fill="none" stroke={WOOD_DARK} strokeWidth={0.06} />
        </g>
      )
    case 'sack':
      return <ellipse transform={t} rx={0.45} ry={0.32} fill="#c9b48a" stroke={INK} strokeWidth={LINE} />
    case 'wagon':
    case 'coveredWagon':
      return (
        <g transform={t}>
          <Shadow>
            <rect x={-1.6} y={-0.85} width={3.2} height={1.7} />
          </Shadow>
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sy) => (
              <rect key={`${sx}${sy}`} x={sx * 1.05 - 0.38} y={sy * 0.95 - 0.13} width={0.76} height={0.26} rx={0.08} fill="#3d2b1d" />
            )),
          )}
          <rect x={-1.5} y={-0.8} width={3} height={1.6} fill={WOOD} stroke={INK} strokeWidth={LINE} />
          {[-0.4, 0, 0.4].map((y) => (
            <line key={y} x1={-1.5} y1={y} x2={1.5} y2={y} stroke={WOOD_DARK} strokeWidth={0.05} />
          ))}
          <line x1={1.5} y1={0} x2={2.4} y2={0} stroke={WOOD_DARK} strokeWidth={0.14} />
          {prop.kind === 'coveredWagon' && (
            <g>
              <rect x={-1.35} y={-0.95} width={2.7} height={1.9} rx={0.5} fill={CANVAS} stroke={INK} strokeWidth={LINE} />
              {[-0.8, -0.27, 0.27, 0.8].map((x) => (
                <line key={x} x1={x} y1={-0.95} x2={x} y2={0.95} stroke={CANVAS_SHADE} strokeWidth={0.08} />
              ))}
            </g>
          )}
        </g>
      )
    case 'table':
      return (
        <g transform={t}>
          <Shadow>
            <circle r={0.85} />
          </Shadow>
          {[0, 120, 240].map((deg) => {
            const a = (deg * Math.PI) / 180
            return <circle key={deg} cx={Math.cos(a) * 1.25} cy={Math.sin(a) * 1.25} r={0.3} fill="#8b5a32" stroke={INK} strokeWidth={LINE} />
          })}
          <circle r={0.85} fill={WOOD} stroke={INK} strokeWidth={LINE} />
          <path d="M -0.8,-0.25 L 0.8,-0.25 M -0.8,0.25 L 0.8,0.25" stroke={WOOD_DARK} strokeWidth={0.05} />
        </g>
      )
    case 'platform':
      return (
        <g transform={t}>
          <Shadow>
            <rect x={-1.1} y={-1.1} width={2.2} height={2.2} />
          </Shadow>
          <rect x={-1.1} y={-1.1} width={2.2} height={2.2} fill={WOOD} stroke={INK} strokeWidth={LINE} />
          {[-0.55, 0, 0.55].map((y) => (
            <line key={y} x1={-1.1} y1={y} x2={1.1} y2={y} stroke={WOOD_DARK} strokeWidth={0.05} />
          ))}
          {[-1, 1].flatMap((sx) => [-1, 1].map((sy) => <rect key={`${sx}${sy}`} x={sx * 1.1 - 0.15} y={sy * 1.1 - 0.15} width={0.3} height={0.3} fill="#3d2b1d" />))}
          <rect x={1.1} y={-0.3} width={0.8} height={0.6} fill="none" stroke={WOOD_DARK} strokeWidth={0.07} />
          <circle r={0.32} fill="#5a4f45" stroke={INK} strokeWidth={0.05} />
          <circle r={0.18} fill="#f08a24" />
        </g>
      )
    case 'stake':
      return (
        <g transform={t}>
          <path d="M -0.12,0.35 L 0.12,0.35 L 0,-0.45 Z" fill="#8b5a32" stroke={INK} strokeWidth={0.05} />
        </g>
      )
    case 'fencePost':
      return <circle cx={prop.x} cy={prop.y} r={0.18} fill={WOOD_DARK} stroke={INK} strokeWidth={0.05} />
    case 'horse':
      return (
        <g transform={t}>
          <Shadow>
            <ellipse rx={0.65} ry={0.28} />
          </Shadow>
          <ellipse rx={0.65} ry={0.28} fill="#7a5232" stroke={INK} strokeWidth={LINE} />
          <ellipse cx={0.78} cy={0} rx={0.26} ry={0.15} fill="#7a5232" stroke={INK} strokeWidth={0.06} />
          <line x1={0.2} y1={0} x2={0.62} y2={0} stroke="#3d2b1d" strokeWidth={0.1} />
        </g>
      )
    case 'hay':
      return (
        <g transform={t}>
          <rect x={-0.45} y={-0.3} width={0.9} height={0.6} fill="#e0c060" stroke={INK} strokeWidth={LINE} />
          <path d="M -0.15,-0.3 L -0.15,0.3 M 0.15,-0.3 L 0.15,0.3" stroke="#b08a30" strokeWidth={0.05} />
        </g>
      )
    case 'pit':
      return (
        <g transform={t}>
          <circle r={1.55} fill="#8a6f4f" stroke={INK} strokeWidth={LINE} />
          <circle r={1.1} fill="#2a2420" />
          {[-0.6, -0.2, 0.2, 0.6].map((v) => (
            <g key={v}>
              <line x1={v} y1={-1.1} x2={v} y2={1.1} stroke={WOOD} strokeWidth={0.12} />
              <line x1={-1.1} y1={v} x2={1.1} y2={v} stroke={WOOD} strokeWidth={0.12} />
            </g>
          ))}
        </g>
      )
    case 'stool':
      return <circle transform={t} r={0.3} fill="#8b5a32" stroke={INK} strokeWidth={LINE} />
    case 'banner':
      return (
        <g transform={t}>
          <circle r={0.12} fill={WOOD_DARK} />
          <path d="M 0,0 L 0.9,-0.15 L 0.75,0.25 L 0.9,0.6 L 0,0.45 Z" fill="#a8322d" stroke={INK} strokeWidth={0.05} />
        </g>
      )
    case 'rug':
      return (
        <g transform={t}>
          <rect x={-1.6} y={-1.1} width={3.2} height={2.2} fill="#8b2f3a" stroke="#d4a34a" strokeWidth={0.14} />
          <rect x={-1.2} y={-0.7} width={2.4} height={1.4} fill="none" stroke="#d4a34a" strokeWidth={0.06} />
        </g>
      )
  }
}

export function CampMapSvg({ plan, features, selectedId, onSelect }: CampMapSvgProps) {
  const { bounds } = plan
  const w = bounds.maxX - bounds.minX
  const h = bounds.maxY - bounds.minY
  // The paper fade comes from the side opposite the forest.
  const fx = Math.cos(plan.forestAngle)
  const fy = Math.sin(plan.forestAngle)
  const featureIds = [...new Set(plan.props.map((p) => p.featureId))]
  // Fences first, then low ground things, then everything else.
  const layer = (p: CampProp) => (p.kind === 'rug' || p.kind === 'pit' ? 0 : p.kind === 'fencePost' ? 1 : 2)

  return (
    <svg
      viewBox={`${bounds.minX * UNIT_PX} ${bounds.minY * UNIT_PX} ${w * UNIT_PX} ${h * UNIT_PX}`}
      style={{ width: '100%', height: 'auto', display: 'block', background: GRASS }}
    >
      <defs>
        <radialGradient id="camp-clearing">
          <stop offset="0%" stopColor="#a6c97f" />
          <stop offset="100%" stopColor={GRASS} />
        </radialGradient>
        <linearGradient id="camp-paper" x1={0.5 - fx / 2} y1={0.5 - fy / 2} x2={0.5 + fx / 2} y2={0.5 + fy / 2}>
          <stop offset="0%" stopColor="#fbfaf6" stopOpacity={1} />
          <stop offset="30%" stopColor="#fbfaf6" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g transform={`scale(${UNIT_PX})`}>
        <rect x={bounds.minX} y={bounds.minY} width={w} height={h} fill="url(#camp-clearing)" />
        {plan.grass.map((g, i) => (
          <path
            key={i}
            d="M -0.3,0 L -0.15,-0.35 L 0,0 L 0.15,-0.4 L 0.3,0"
            fill="none"
            stroke={GRASS_DARK}
            strokeWidth={0.07}
            transform={`translate(${g.x} ${g.y}) rotate(${g.rotation})`}
          />
        ))}
        {plan.stumps.map((s, i) => (
          <g key={i}>
            <circle cx={s.x + 0.12} cy={s.y + 0.15} r={s.r} fill={SHADOW} />
            <circle cx={s.x} cy={s.y} r={s.r} fill="#c49a6c" stroke={INK} strokeWidth={LINE} />
            <circle cx={s.x} cy={s.y} r={s.r * 0.55} fill="none" stroke="#8b5a32" strokeWidth={0.05} />
          </g>
        ))}

        {featureIds.map((id) => {
          const props = plan.props.filter((p) => p.featureId === id).sort((a, b) => layer(a) - layer(b))
          const rope = plan.ropes.find((r) => r.featureId === id)
          const selected = selectedId === id
          const marker = plan.markers.find((m) => m.featureId === id)
          return (
            <g key={id} data-feature-id={id} onClick={() => onSelect(id)} style={{ cursor: 'pointer' }}>
              {marker && (
                <circle cx={marker.x} cy={marker.y + 3.4} r={4} fill={selected ? '#fff6d0' : 'transparent'} fillOpacity={selected ? 0.35 : 0} />
              )}
              {rope && (
                <polyline points={rope.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#a08060" strokeWidth={0.09} />
              )}
              {props.map((p, i) => (
                <Prop key={i} prop={p} />
              ))}
            </g>
          )
        })}

        {/* Forest edge, then the paper fade on the far side */}
        {plan.canopy.map((c, i) => (
          <circle key={`s${i}`} cx={c.x + 0.3} cy={c.y + 0.4} r={c.r} fill="#00000025" />
        ))}
        {plan.canopy.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={CANOPY} stroke={CANOPY_EDGE} strokeWidth={0.12} />
        ))}
        {plan.canopy.map((c, i) => (
          <circle key={`h${i}`} cx={c.x - c.r * 0.3} cy={c.y - c.r * 0.3} r={c.r * 0.45} fill="#4f7f42" />
        ))}
        <rect x={bounds.minX} y={bounds.minY} width={w} height={h} fill="url(#camp-paper)" style={{ pointerEvents: 'none' }} />

        {plan.markers.map((m) => {
          const data = features[m.featureId]
          if (!data) return null
          return (
            <g key={m.featureId} transform={`translate(${m.x} ${m.y})`} style={{ pointerEvents: 'none' }}>
              <circle r={0.85} fill="#fbf6e6" stroke={INK} strokeWidth={0.12} />
              {data.isObjective ? (
                <polygon
                  points={Array.from({ length: 10 }, (_, i) => {
                    const r = i % 2 === 0 ? 0.6 : 0.26
                    const a = ((-90 + i * 36) * Math.PI) / 180
                    return `${(r * Math.cos(a)).toFixed(3)},${(r * Math.sin(a)).toFixed(3)}`
                  }).join(' ')}
                  fill={INK}
                />
              ) : (
                <text textAnchor="middle" dominantBaseline="central" fontSize={0.95} fontWeight={700} fill={INK}>
                  {data.label}
                </text>
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
