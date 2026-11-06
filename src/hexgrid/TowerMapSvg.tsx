// Renders a generated Tower site the way the reference does (2026-10-31, see CLAUDE.md's punch
// list): a schematic side view of the tower on the left, and one top-down floor plan per
// floor on the right, each plan lined up with its floor in the side view. Black line art on
// white — thick black walls, a light grid inside rooms, a solid black curved stair. All
// geometry comes from engine/towerPlan.ts, derived at render time from the TowerSite's own
// rooms (nothing extra is persisted). Clicking a floor in either view selects it.

import {
  ANNEX_HEIGHT,
  ENTRANCE_LENGTH,
  floorPlanBounds,
  polarPoint,
  type TowerFloorPlan,
  type TowerPlan,
  type TowerRoomShape,
} from '../engine/towerPlan'
import type { Point } from '../engine/caveRenderShapes'

export type TowerMapRoomData = { label: string; isObjective: boolean }

export type TowerMapSvgProps = {
  plan: TowerPlan
  rooms: Record<string, TowerMapRoomData>
  selectedLevel: number | null
  onSelectLevel: (level: number) => void
}

const INK = '#111111'
const PAPER = '#ffffff'
const GRID = '#d4d4d4'
const SELECTED = '#ececec'
const WALL = 0.35
const UNIT_PX = 14
// Side view: how much narrower than the floor plan each floor's shaft is drawn.
const ELEVATION_SCALE = 0.42
const ELEVATION_WIDTH = 16
const ROOF_HEIGHT = 5
const GROUND_HEIGHT = 1.5
const SLOT_TITLE = 1.6

function pathPoint(p: Point): string {
  return `${p.x.toFixed(3)},${p.y.toFixed(3)}`
}

function wedgePath(radius: number, start: number, end: number): string {
  const largeArc = end - start > 180 ? 1 : 0
  return `M 0,0 L ${pathPoint(polarPoint(radius, start))} A ${radius} ${radius} 0 ${largeArc} 1 ${pathPoint(polarPoint(radius, end))} Z`
}

function annulusPath(inner: number, outer: number, start: number, end: number): string {
  return [
    `M ${pathPoint(polarPoint(outer, start))}`,
    `A ${outer} ${outer} 0 0 1 ${pathPoint(polarPoint(outer, end))}`,
    `L ${pathPoint(polarPoint(inner, end))}`,
    `A ${inner} ${inner} 0 0 0 ${pathPoint(polarPoint(inner, start))}`,
    'Z',
  ].join(' ')
}

function starPoints(outer: number, inner: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    pts.push(pathPoint(polarPoint(r, -90 + i * 36)))
  }
  return pts.join(' ')
}

function floorTitle(level: number, levelCount: number): string {
  if (level === 0) return levelCount === 1 ? 'Ground floor (top)' : 'Ground floor'
  return level === levelCount - 1 ? `Floor ${level} (top)` : `Floor ${level}`
}

function RoomShape({ room, radius }: { room: TowerRoomShape; radius: number }) {
  if (room.kind === 'annex') {
    const r = room.rect
    return <rect x={r.x} y={r.y} width={r.width} height={r.height} fill="url(#tower-grid)" stroke={INK} strokeWidth={WALL} />
  }
  if (room.endAngle - room.startAngle >= 360) return <circle r={radius} fill="url(#tower-grid)" />
  return <path d={wedgePath(radius, room.startAngle, room.endAngle)} fill="url(#tower-grid)" />
}

function FloorPlan({ floor, rooms }: { floor: TowerFloorPlan; rooms: Record<string, TowerMapRoomData> }) {
  const r = floor.radius
  return (
    <g>
      {floor.entrance && (
        <rect
          x={floor.entrance.side === 'right' ? r - 0.2 : -r - ENTRANCE_LENGTH + 0.2}
          y={-0.8}
          width={ENTRANCE_LENGTH}
          height={1.6}
          fill="url(#tower-grid)"
          stroke={INK}
          strokeWidth={WALL * 0.7}
        />
      )}
      {/* Annexes first, so the core's wall is drawn over the part they tuck under. */}
      {floor.rooms
        .filter((room) => room.kind === 'annex')
        .map((room) => (
          <g key={room.id} data-room-id={room.id}>
            <RoomShape room={room} radius={r} />
          </g>
        ))}
      {floor.rooms
        .filter((room) => room.kind === 'wedge')
        .map((room) => (
          <g key={room.id} data-room-id={room.id}>
            <RoomShape room={room} radius={r} />
          </g>
        ))}
      {floor.partitionAngles.map((angle) => {
        const end = polarPoint(r, angle)
        return <line key={angle} x1={0} y1={0} x2={end.x} y2={end.y} stroke={INK} strokeWidth={WALL * 0.85} />
      })}
      <circle r={r} fill="none" stroke={INK} strokeWidth={WALL} />
      <path d={annulusPath(floor.stair.innerRadius, floor.stair.outerRadius, floor.stair.startAngle, floor.stair.endAngle)} fill={INK} />
      {Array.from({ length: Math.floor((floor.stair.endAngle - floor.stair.startAngle) / 9) }, (_, i) => {
        const angle = floor.stair.startAngle + (i + 1) * 9
        const a = polarPoint(floor.stair.innerRadius + 0.12, angle)
        const b = polarPoint(floor.stair.outerRadius - 0.12, angle)
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={PAPER} strokeWidth={0.07} />
      })}
      {[...floor.doors, ...(floor.entrance ? [{ at: { x: floor.entrance.side === 'right' ? r : -r, y: 0 }, wallAngle: 90 }] : [])].map(
        (door, i) => (
          <rect
            key={i}
            x={-0.55}
            y={-0.3}
            width={1.1}
            height={0.6}
            fill="url(#tower-grid)"
            stroke={INK}
            strokeWidth={0.08}
            transform={`translate(${door.at.x} ${door.at.y}) rotate(${door.wallAngle})`}
          />
        ),
      )}
      {floor.rooms.map((room) => {
        const data = rooms[room.id]
        if (!data) return null
        return (
          <g key={room.id} transform={`translate(${room.labelAt.x} ${room.labelAt.y})`} style={{ pointerEvents: 'none' }}>
            <circle r={0.75} fill={PAPER} stroke={INK} strokeWidth={0.12} />
            {data.isObjective ? (
              <polygon points={starPoints(0.55, 0.23)} fill={INK} />
            ) : (
              <text textAnchor="middle" dominantBaseline="central" fontSize={0.85} fontWeight={700} fill={INK}>
                {data.label}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

export function TowerMapSvg({ plan, rooms, selectedLevel, onSelectLevel }: TowerMapSvgProps) {
  const floors = plan.floors
  if (floors.length === 0) return null
  const levelCount = floors.length

  const maxRadius = Math.max(...floors.map((f) => f.radius))
  const slotHeight = maxRadius * 2 + SLOT_TITLE + 1.4
  const plansWidth = Math.max(...floors.map((f) => floorPlanBounds(f).width)) + 3
  const width = ELEVATION_WIDTH + plansWidth
  const height = ROOF_HEIGHT + levelCount * slotHeight + GROUND_HEIGHT
  const towerCenterX = ELEVATION_WIDTH / 2
  const slotTop = (level: number) => ROOF_HEIGHT + (levelCount - 1 - level) * slotHeight

  const top = floors[levelCount - 1]
  const topHalfWidth = top.radius * ELEVATION_SCALE
  const groundY = ROOF_HEIGHT + levelCount * slotHeight

  return (
    <svg
      viewBox={`0 0 ${width * UNIT_PX} ${height * UNIT_PX}`}
      style={{ width: '100%', height: 'auto', display: 'block', background: PAPER }}
    >
      <defs>
        <pattern id="tower-grid" width={1} height={1} patternUnits="userSpaceOnUse">
          <rect width={1} height={1} fill={PAPER} />
          <path d="M 1,0 L 0,0 L 0,1" fill="none" stroke={GRID} strokeWidth={0.05} />
        </pattern>
      </defs>
      <g transform={`scale(${UNIT_PX})`}>
        {/* Side view */}
        <polygon
          points={[
            `${towerCenterX - topHalfWidth - 0.5},${ROOF_HEIGHT}`,
            `${towerCenterX},${ROOF_HEIGHT * 0.3}`,
            `${towerCenterX + topHalfWidth + 0.5},${ROOF_HEIGHT}`,
          ].join(' ')}
          fill={PAPER}
          stroke={INK}
          strokeWidth={WALL * 0.8}
          strokeLinejoin="round"
        />
        <line x1={towerCenterX} y1={ROOF_HEIGHT * 0.3} x2={towerCenterX} y2={0.4} stroke={INK} strokeWidth={0.15} />
        {floors.map((floor) => {
          const half = floor.radius * ELEVATION_SCALE
          const y = slotTop(floor.levelIndex)
          const selected = selectedLevel === floor.levelIndex
          const annexes = floor.rooms.filter((room) => room.kind === 'annex')
          const annexHeight = ANNEX_HEIGHT * ELEVATION_SCALE
          return (
            <g
              key={floor.levelIndex}
              data-elevation-level={floor.levelIndex}
              onClick={() => onSelectLevel(floor.levelIndex)}
              style={{ cursor: 'pointer' }}
            >
              {annexes.map((room) => {
                if (room.kind !== 'annex') return null
                const w = (room.rect.width - 0.6) * ELEVATION_SCALE
                const x = room.side === 'right' ? towerCenterX + half : towerCenterX - half - w
                return (
                  <rect
                    key={room.id}
                    x={x}
                    y={y + slotHeight - annexHeight - 0.3}
                    width={w}
                    height={annexHeight}
                    fill={selected ? SELECTED : PAPER}
                    stroke={INK}
                    strokeWidth={WALL * 0.6}
                  />
                )
              })}
              <rect
                x={towerCenterX - half}
                y={y}
                width={half * 2}
                height={slotHeight}
                fill={selected ? SELECTED : PAPER}
                stroke={INK}
                strokeWidth={WALL * 0.8}
              />
              {[-0.45, 0.45].map((offset) => (
                <rect
                  key={offset}
                  x={towerCenterX + offset * half - 0.2}
                  y={y + slotHeight * 0.4}
                  width={0.4}
                  height={0.9}
                  rx={0.2}
                  fill={INK}
                />
              ))}
              <text x={towerCenterX} y={y + slotHeight * 0.78} textAnchor="middle" fontSize={0.9} fontWeight={700} fill={INK}>
                {floor.levelIndex === 0 ? 'G' : floor.levelIndex}
              </text>
            </g>
          )
        })}
        <path
          d={`M ${towerCenterX - 0.7},${groundY} L ${towerCenterX - 0.7},${groundY - 1.4} A 0.7 0.7 0 0 1 ${towerCenterX + 0.7},${groundY - 1.4} L ${towerCenterX + 0.7},${groundY} Z`}
          fill={INK}
        />
        <line x1={0.6} y1={groundY} x2={ELEVATION_WIDTH - 0.6} y2={groundY} stroke={INK} strokeWidth={WALL * 0.8} />

        {/* Floor plans, each lined up with its floor in the side view */}
        {floors.map((floor) => {
          const y = slotTop(floor.levelIndex)
          const bounds = floorPlanBounds(floor)
          const cx = ELEVATION_WIDTH + plansWidth / 2 - (bounds.x + bounds.width / 2)
          const cy = y + SLOT_TITLE + (slotHeight - SLOT_TITLE) / 2
          const selected = selectedLevel === floor.levelIndex
          return (
            <g
              key={floor.levelIndex}
              data-floor-level={floor.levelIndex}
              onClick={() => onSelectLevel(floor.levelIndex)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={ELEVATION_WIDTH + 0.3}
                y={y + 0.2}
                width={plansWidth - 0.6}
                height={slotHeight - 0.4}
                rx={0.4}
                fill={selected ? SELECTED : PAPER}
                stroke={selected ? INK : 'none'}
                strokeWidth={0.08}
              />
              <text x={ELEVATION_WIDTH + 0.9} y={y + 1.3} fontSize={0.95} fontWeight={700} fill={INK}>
                {floorTitle(floor.levelIndex, levelCount)}
              </text>
              <g transform={`translate(${cx} ${cy})`}>
                <FloorPlan floor={floor} rooms={rooms} />
              </g>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
