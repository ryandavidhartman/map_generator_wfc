// Renders a generated settlement as a color city map in the spirit of the user's reference (a
// painted map, "Onadbyr" by Elderbrain — see docs/plan-settlement-map-overhaul.md): farmland
// and trees outside, a stone wall with round towers and gates, cream streets between blocks of
// tightly packed red/brown roofs, gardens, a central plaza (or castle), temples. All geometry
// comes from engine/settlementPlan.ts, derived at render time from the Settlement's districts
// (nothing extra is persisted). Districts are clickable and numbered; the seat gets a star.

import type { Block, Pt, SettlementPlan } from '../engine/settlementPlan'

export type SettlementMapDistrictData = { label: string; isSeat: boolean }

export type SettlementMapSvgProps = {
  plan: SettlementPlan
  districts: Record<string, SettlementMapDistrictData>
  selectedDistrictId: string | null
  onSelectDistrict: (districtId: string) => void
}

const UNIT_PX = 8
const COUNTRYSIDE = '#8fa968'
const DIRT_ROAD = '#cdb88d'
const STREET = '#e4d6b2'
const BLOCK_GROUND = '#c9b48b'
const ROOF_EDGE = '#3b2a20'
const GARDEN = '#6f9a4f'
const TREE = '#4d7a35'
const TREE_EDGE = '#2f4f22'
const PLAZA = '#eadfc2'
const WALL = '#8a857c'
const WALL_EDGE = '#45413b'
const INK = '#1d1a16'
const WATER = '#86b9cf'
const WATER_EDGE = '#4f7f96'
const SAND = '#e3d3a4'
const BRIDGE = '#bcae8c'
const PIER = '#7a5a3a'

function pts(poly: Pt[]): string {
  return poly.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}

function centroidOf(poly: Pt[]): Pt {
  return { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length }
}

function starPoints(c: Pt, outer: number, inner: number): string {
  const out: string[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = ((-90 + i * 36) * Math.PI) / 180
    out.push(`${(c.x + r * Math.cos(a)).toFixed(2)},${(c.y + r * Math.sin(a)).toFixed(2)}`)
  }
  return out.join(' ')
}

function Tree({ at, r }: { at: Pt; r: number }) {
  return (
    <g>
      <circle cx={at.x + 0.15} cy={at.y + 0.2} r={r} fill="#00000030" />
      <circle cx={at.x} cy={at.y} r={r} fill={TREE} stroke={TREE_EDGE} strokeWidth={0.1} />
    </g>
  )
}

function BlockArt({ block, walled }: { block: Block; walled: boolean }) {
  const shape = block.shape
  if (!shape) return null
  const c = centroidOf(shape)
  switch (block.kind) {
    case 'plaza':
      return (
        <g>
          <polygon points={pts(shape)} fill={PLAZA} stroke="#b9a983" strokeWidth={0.12} />
          <circle cx={c.x} cy={c.y} r={1.1} fill="#9cc7d9" stroke="#5b7f8f" strokeWidth={0.18} />
          <circle cx={c.x} cy={c.y} r={0.35} fill="#5b7f8f" />
        </g>
      )
    case 'field':
      return <polygon points={pts(shape)} fill={block.lots[0]?.color ?? GARDEN} stroke="#6f8a4c" strokeWidth={0.12} />
    case 'garden':
      return (
        <g>
          <polygon points={pts(shape)} fill={GARDEN} stroke="#4f7339" strokeWidth={0.12} />
          {block.trees.map((t, i) => (
            <Tree key={i} at={t.at} r={t.r} />
          ))}
        </g>
      )
    case 'castle':
      return (
        <g>
          <polygon points={pts(shape)} fill={GARDEN} stroke="#4f7339" strokeWidth={0.12} />
          <rect x={c.x - 2.6} y={c.y - 2.6} width={5.2} height={5.2} fill="#7a7c85" stroke={WALL_EDGE} strokeWidth={0.3} />
          <rect x={c.x - 1.5} y={c.y - 1.5} width={3} height={3} fill="#5e5a66" stroke={WALL_EDGE} strokeWidth={0.2} />
          {[
            [-2.6, -2.6],
            [2.6, -2.6],
            [-2.6, 2.6],
            [2.6, 2.6],
          ].map(([dx, dy]) => (
            <circle key={`${dx},${dy}`} cx={c.x + dx} cy={c.y + dy} r={0.8} fill={WALL} stroke={WALL_EDGE} strokeWidth={0.2} />
          ))}
        </g>
      )
    case 'temple':
      return (
        <g>
          <polygon points={pts(shape)} fill={PLAZA} stroke="#b9a983" strokeWidth={0.12} />
          <circle cx={c.x} cy={c.y} r={2.2} fill="#c9a865" stroke={ROOF_EDGE} strokeWidth={0.2} />
          <circle cx={c.x} cy={c.y} r={1.2} fill="#ddc489" stroke={ROOF_EDGE} strokeWidth={0.12} />
          {[0, 60, 120, 180, 240, 300].map((deg) => {
            const a = (deg * Math.PI) / 180
            return (
              <line
                key={deg}
                x1={c.x + Math.cos(a) * 1.2}
                y1={c.y + Math.sin(a) * 1.2}
                x2={c.x + Math.cos(a) * 2.2}
                y2={c.y + Math.sin(a) * 2.2}
                stroke={ROOF_EDGE}
                strokeWidth={0.1}
              />
            )
          })}
        </g>
      )
    default:
      return (
        <g>
          {/* Village houses sit straight on the grass; town blocks have packed-earth yards. */}
          {walled && <polygon points={pts(shape)} fill={BLOCK_GROUND} />}
          {block.lots.map((lot, i) => {
            if (lot.kind === 'building') {
              return <polygon key={i} points={pts(lot.poly)} fill={lot.color} stroke={ROOF_EDGE} strokeWidth={0.1} />
            }
            if (lot.kind === 'tree') {
              const lc = centroidOf(lot.poly)
              return <Tree key={i} at={lc} r={0.7} />
            }
            return null
          })}
        </g>
      )
  }
}

export function SettlementMapSvg({ plan, districts, selectedDistrictId, onSelectDistrict }: SettlementMapSvgProps) {
  const { bounds } = plan
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const districtIds = [...new Set(plan.blocks.map((b) => b.districtId))]

  return (
    <svg
      viewBox={`${bounds.minX * UNIT_PX} ${bounds.minY * UNIT_PX} ${width * UNIT_PX} ${height * UNIT_PX}`}
      style={{ width: '100%', height: 'auto', display: 'block', background: COUNTRYSIDE }}
    >
      <g transform={`scale(${UNIT_PX})`}>
        {/* Countryside: fields, then the roads out of the gates, then tree clumps */}
        {plan.fields.map((f, i) => (
          <polygon key={i} points={pts(f.poly)} fill={f.color} stroke="#6f8a4c" strokeWidth={0.12} />
        ))}
        {plan.outerRoads.map((road, i) => (
          <path
            key={i}
            d={`M ${road[0].x},${road[0].y} Q ${road[1].x},${road[1].y} ${road[2].x},${road[2].y}`}
            fill="none"
            stroke={DIRT_ROAD}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        ))}
        {plan.suburbs.map((house, i) => (
          <polygon key={`s${i}`} points={pts(house.poly)} fill={house.color} stroke={ROOF_EDGE} strokeWidth={0.1} />
        ))}
        {plan.outsideTrees.map((t, i) => (
          <Tree key={i} at={t.at} r={t.r} />
        ))}

        {/* Town ground: in walled towns the streets are whatever shows between blocks; a
            village has no town ground at all — its plots sit straight on the countryside, with
            dirt roads drawn on top */}
        {plan.walled && <polygon points={pts(plan.outline)} fill={STREET} />}

        {/* Water: drawn over the town ground (the blocks already leave room for it) */}
        {plan.water?.kind === 'coast' && (
          <g style={{ pointerEvents: 'none' }}>
            <polyline points={pts(plan.water.shore)} fill="none" stroke={SAND} strokeWidth={1.6} strokeLinejoin="round" />
            <polygon points={pts(plan.water.sea)} fill={WATER} stroke={WATER_EDGE} strokeWidth={0.25} strokeLinejoin="round" />
          </g>
        )}
        {plan.water?.kind === 'river' && (
          <polygon points={pts(plan.water.river)} fill={WATER} stroke={WATER_EDGE} strokeWidth={0.25} strokeLinejoin="round" style={{ pointerEvents: 'none' }} />
        )}
        {!plan.walled &&
          plan.mainRoads.map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={DIRT_ROAD} strokeWidth={2.2} strokeLinecap="round" />
          ))}
        {plan.blocks.map((block, i) => (
          <BlockArt key={i} block={block} walled={plan.walled} />
        ))}

        {/* District borders, faint (towns only — in a village they'd cross open fields) */}
        {plan.walled &&
          plan.districtBorders.map(([a, b], i) => (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#5a3e2b" strokeWidth={0.18} strokeDasharray="0.6 0.5" opacity={0.55} />
        ))}

        {/* Click regions per district, plus the selected district's highlight */}
        {districtIds.map((id) => (
          <g key={id} data-district-id={id} onClick={() => onSelectDistrict(id)} style={{ cursor: 'pointer' }}>
            {plan.blocks
              .filter((b) => b.districtId === id)
              .map((b, i) => (
                <polygon
                  key={i}
                  points={pts(b.cell)}
                  fill={selectedDistrictId === id ? '#fff6d0' : 'transparent'}
                  fillOpacity={selectedDistrictId === id ? 0.35 : 0}
                />
              ))}
          </g>
        ))}

        {/* Old inner wall (old-town pattern), broken where the main roads pass */}
        {plan.innerWall.length > 0 && (
          <g style={{ pointerEvents: 'none' }}>
            {plan.innerWall.map(([a, b], i) => (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={WALL_EDGE} strokeWidth={0.95} strokeLinecap="round" />
            ))}
            {plan.innerWall.map(([a, b], i) => (
              <line key={`f${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={WALL} strokeWidth={0.6} strokeLinecap="round" />
            ))}
            {plan.innerTowers.map((t, i) => (
              <circle key={i} cx={t.x} cy={t.y} r={0.8} fill={WALL} stroke={WALL_EDGE} strokeWidth={0.18} />
            ))}
          </g>
        )}

        {/* Bridges and piers */}
        {plan.water?.kind === 'river' &&
          plan.water.bridges.map(([a, b], i) => (
            <g key={i} style={{ pointerEvents: 'none' }}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={WALL_EDGE} strokeWidth={2.2} />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={BRIDGE} strokeWidth={1.7} />
            </g>
          ))}
        {plan.water?.kind === 'coast' &&
          plan.water.piers.map(([a, b], i) => (
            <g key={i} style={{ pointerEvents: 'none' }}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={PIER} strokeWidth={0.8} />
              <ellipse
                cx={b.x + (b.x - a.x) * 0.25}
                cy={b.y + (b.y - a.y) * 0.25}
                rx={0.9}
                ry={0.4}
                fill="#6b4a2e"
                transform={`rotate(${(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI} ${b.x + (b.x - a.x) * 0.25} ${b.y + (b.y - a.y) * 0.25})`}
              />
            </g>
          ))}

        {/* Wall, towers and gates */}
        {plan.walled && (
          <g style={{ pointerEvents: 'none' }}>
            {plan.wallSegments.map(([a, b], i) => (
              <line key={`e${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={WALL_EDGE} strokeWidth={1.3} strokeLinecap="round" />
            ))}
            {plan.wallSegments.map(([a, b], i) => (
              <line key={`f${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={WALL} strokeWidth={0.9} strokeLinecap="round" />
            ))}
            {plan.towers.map((t, i) => (
              <circle key={i} cx={t.x} cy={t.y} r={1.05} fill={WALL} stroke={WALL_EDGE} strokeWidth={0.22} />
            ))}
            {/* Corner bastions of an angular wall: arrow-head points jutting outward */}
            {plan.bastions.map((b, i) => {
              const angle = (Math.atan2(b.y, b.x) * 180) / Math.PI
              return (
                <polygon
                  key={i}
                  points="-1.4,-1.4 1.1,-1.4 2.6,0 1.1,1.4 -1.4,1.4"
                  transform={`translate(${b.x} ${b.y}) rotate(${angle})`}
                  fill={WALL}
                  stroke={WALL_EDGE}
                  strokeWidth={0.22}
                />
              )
            })}
            {plan.gates.map((g, i) => {
              const tangent = { x: -Math.sin(g.angle), y: Math.cos(g.angle) }
              return (
                <g key={i}>
                  <circle cx={g.at.x} cy={g.at.y} r={1.25} fill={STREET} />
                  {[-1, 1].map((side) => (
                    <rect
                      key={side}
                      x={g.at.x + tangent.x * side * 1.5 - 0.75}
                      y={g.at.y + tangent.y * side * 1.5 - 0.75}
                      width={1.5}
                      height={1.5}
                      fill={WALL}
                      stroke={WALL_EDGE}
                      strokeWidth={0.22}
                    />
                  ))}
                </g>
              )
            })}
          </g>
        )}

        {/* District markers */}
        {plan.districtLabels.map(({ districtId, at }) => {
          const data = districts[districtId]
          if (!data) return null
          return (
            <g key={districtId} style={{ pointerEvents: 'none' }}>
              <circle cx={at.x} cy={at.y} r={1.5} fill="#fbf6e6" stroke={INK} strokeWidth={0.22} />
              {data.isSeat ? (
                <polygon points={starPoints(at, 1.05, 0.45)} fill={INK} />
              ) : (
                <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fontSize={1.6} fontWeight={700} fill={INK}>
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
