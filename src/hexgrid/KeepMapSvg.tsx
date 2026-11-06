// Renders a generated Keep the way the reference does (2026-10-31, see CLAUDE.md's punch list):
// the ground floor as a walled compound (thick curtain wall, square towers, a gatehouse with a
// path out, an open courtyard in front of the keep building), then the same building's upper
// floors and cellar as separate plans in a row below. Black line art on white with a light grid
// inside rooms, matching TowerMapSvg.tsx. All geometry comes from engine/keepPlan.ts, derived at
// render time from the KeepSite's rooms (nothing extra is persisted). Clicking a floor's panel
// selects it.

import type { Point } from '../engine/caveRenderShapes'
import type { KeepDoor, KeepFloorPlan, KeepPlan } from '../engine/keepPlan'

export type KeepMapRoomData = { label: string; isObjective: boolean }

export type KeepMapSvgProps = {
  plan: KeepPlan
  rooms: Record<string, KeepMapRoomData>
  courtyardId: string
  selectedFloor: number | null
  onSelectFloor: (floor: number) => void
}

const INK = '#111111'
const PAPER = '#ffffff'
const GRID = '#d4d4d4'
const YARD = '#f2f2f2'
const SELECTED = '#ececec'
const UNIT_PX = 14
const PAD = 1.5
const TITLE = 2
const PATH_LENGTH = 4
const PANEL_GAP = 1.5
// Room around a lone building plan for the stair turret, which sticks out past its corner.
const TURRET_MARGIN = 2.8

export function floorName(floor: number): string {
  if (floor < 0) return 'Cellar'
  if (floor === 0) return 'Ground floor'
  return `Floor ${floor}`
}

function starPoints(outer: number, inner: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = ((-90 + i * 36) * Math.PI) / 180
    pts.push(`${(r * Math.cos(a)).toFixed(3)},${(r * Math.sin(a)).toFixed(3)}`)
  }
  return pts.join(' ')
}

function octagonPoints(c: Point, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 8; i++) {
    const a = ((22.5 + i * 45) * Math.PI) / 180
    pts.push(`${(c.x + r * Math.cos(a)).toFixed(3)},${(c.y + r * Math.sin(a)).toFixed(3)}`)
  }
  return pts.join(' ')
}

function Door({ door }: { door: KeepDoor }) {
  const along = 1.2
  const across = 0.6
  const w = door.axis === 'x' ? along : across
  const h = door.axis === 'x' ? across : along
  return <rect x={door.at.x - w / 2} y={door.at.y - h / 2} width={w} height={h} fill="url(#keep-grid)" stroke={INK} strokeWidth={0.08} />
}

function RoomMarker({ at, data }: { at: Point; data: KeepMapRoomData | undefined }) {
  if (!data) return null
  return (
    <g transform={`translate(${at.x} ${at.y})`} style={{ pointerEvents: 'none' }}>
      <circle r={0.8} fill={PAPER} stroke={INK} strokeWidth={0.12} />
      {data.isObjective ? (
        <polygon points={starPoints(0.58, 0.24)} fill={INK} />
      ) : (
        <text textAnchor="middle" dominantBaseline="central" fontSize={0.85} fontWeight={700} fill={INK}>
          {data.label}
        </text>
      )}
    </g>
  )
}

// One floor of the keep building, drawn in building coordinates.
function BuildingFloor({
  floor,
  plan,
  rooms,
  entrance,
}: {
  floor: KeepFloorPlan
  plan: KeepPlan
  rooms: Record<string, KeepMapRoomData>
  entrance?: KeepDoor
}) {
  const { width, height } = plan.building
  const turret = plan.stairTurret
  return (
    <g>
      {floor.rooms.map((room) => (
        <rect
          key={room.id}
          data-room-id={room.id}
          x={room.rect.x}
          y={room.rect.y}
          width={room.rect.width}
          height={room.rect.height}
          fill="url(#keep-grid)"
          stroke={INK}
          strokeWidth={0.3}
        />
      ))}
      <rect x={0} y={0} width={width} height={height} fill="none" stroke={INK} strokeWidth={0.6} />
      {floor.doors.map((door, i) => (
        <Door key={i} door={door} />
      ))}
      {entrance && <Door door={entrance} />}
      <polygon points={octagonPoints(turret.center, turret.radius)} fill="url(#keep-grid)" stroke={INK} strokeWidth={0.45} />
      <rect x={turret.center.x - 0.8} y={turret.center.y - 0.8} width={1.6} height={1.6} fill={INK} />
      {[-0.4, 0, 0.4].map((dy) => (
        <line
          key={dy}
          x1={turret.center.x - 0.65}
          x2={turret.center.x + 0.65}
          y1={turret.center.y + dy}
          y2={turret.center.y + dy}
          stroke={PAPER}
          strokeWidth={0.08}
        />
      ))}
      {floor.rooms.map((room) => (
        <RoomMarker key={room.id} at={room.labelAt} data={rooms[room.id]} />
      ))}
    </g>
  )
}

export function KeepMapSvg({ plan, rooms, courtyardId, selectedFloor, onSelectFloor }: KeepMapSvgProps) {
  const { compound, building } = plan
  const ground = plan.floors.find((f) => f.floor === 0)
  // Upper floors left to right, then the cellar.
  const others = plan.floors
    .filter((f) => f.floor !== 0)
    .sort((a, b) => (a.floor < 0 ? 1 : b.floor < 0 ? -1 : a.floor - b.floor))

  // Corner towers stick out past the wall by half their size — leave room so they don't cover
  // the panel title or poke out of the panel.
  const towerOverhang = Math.max(0, ...compound.towers.map((tower) => -tower.rect.y))
  const groundPanelWidth = compound.wall.width + (PAD + towerOverhang) * 2
  const groundPanelHeight = TITLE + towerOverhang + compound.wall.height + PATH_LENGTH + PAD
  const otherPanelWidth = building.width + TURRET_MARGIN * 2
  const otherPanelHeight = TITLE + TURRET_MARGIN + building.height + PAD
  const othersWidth = others.length * otherPanelWidth + Math.max(0, others.length - 1) * PANEL_GAP
  const width = Math.max(groundPanelWidth, othersWidth) + PAD
  const othersTop = groundPanelHeight + PANEL_GAP
  const height = othersTop + (others.length > 0 ? otherPanelHeight : 0) + PAD

  const groundLeft = (width - groundPanelWidth) / 2
  const wallX = groundLeft + PAD + towerOverhang
  const wallY = TITLE + towerOverhang + 0.3
  const w = compound.wall
  const t = compound.wallThickness
  const gate = compound.gatehouse
  const othersLeft = (width - othersWidth) / 2

  return (
    <svg viewBox={`0 0 ${width * UNIT_PX} ${height * UNIT_PX}`} style={{ width: '100%', height: 'auto', display: 'block', background: PAPER }}>
      <defs>
        <pattern id="keep-grid" width={1} height={1} patternUnits="userSpaceOnUse">
          <rect width={1} height={1} fill={PAPER} />
          <path d="M 1,0 L 0,0 L 0,1" fill="none" stroke={GRID} strokeWidth={0.05} />
        </pattern>
      </defs>
      <g transform={`scale(${UNIT_PX})`}>
        {/* Ground floor: the walled compound */}
        <g data-keep-floor={0} onClick={() => onSelectFloor(0)} style={{ cursor: 'pointer' }}>
          <rect
            x={groundLeft + 0.3}
            y={0.2}
            width={groundPanelWidth - 0.6}
            height={groundPanelHeight - 0.4}
            rx={0.4}
            fill={selectedFloor === 0 ? SELECTED : PAPER}
            stroke={selectedFloor === 0 ? INK : 'none'}
            strokeWidth={0.08}
          />
          <text x={groundLeft + 0.9} y={1.4} fontSize={0.95} fontWeight={700} fill={INK}>
            {floorName(0)}
          </text>
          <g transform={`translate(${wallX} ${wallY})`}>
            {/* Path leading out of the gate */}
            {[-1.1, 1.1].map((dx) => (
              <path
                key={dx}
                d={`M ${w.width / 2 + dx},${w.height} Q ${w.width / 2 + dx + 1.5},${w.height + PATH_LENGTH / 2} ${w.width / 2 + dx},${w.height + PATH_LENGTH}`}
                fill="none"
                stroke={INK}
                strokeWidth={0.12}
              />
            ))}
            {/* Curtain wall: solid band, open yard inside */}
            <rect x={0} y={0} width={w.width} height={w.height} fill={INK} />
            <rect x={t} y={t} width={w.width - t * 2} height={w.height - t * 2} fill={YARD} data-room-id={courtyardId} />
            {compound.towers.map((tower, i) => (
              <rect
                key={i}
                x={tower.rect.x}
                y={tower.rect.y}
                width={tower.rect.width}
                height={tower.rect.height}
                fill="url(#keep-grid)"
                stroke={INK}
                strokeWidth={0.4}
              />
            ))}
            <rect x={gate.x} y={gate.y} width={gate.width} height={gate.height} fill="url(#keep-grid)" stroke={INK} strokeWidth={0.4} />
            <rect x={gate.x + gate.width / 2 - 0.9} y={gate.y - 0.1} width={1.8} height={gate.height + 0.2} fill={YARD} />
            <g transform={`translate(${compound.buildingOffset.x} ${compound.buildingOffset.y})`}>
              {ground && <BuildingFloor floor={ground} plan={plan} rooms={rooms} entrance={compound.buildingEntrance} />}
            </g>
            <RoomMarker at={compound.courtyardLabel} data={rooms[courtyardId]} />
          </g>
        </g>

        {/* Upper floors and cellar: the building alone */}
        {others.map((floor, i) => {
          const left = othersLeft + i * (otherPanelWidth + PANEL_GAP)
          const selected = selectedFloor === floor.floor
          return (
            <g key={floor.floor} data-keep-floor={floor.floor} onClick={() => onSelectFloor(floor.floor)} style={{ cursor: 'pointer' }}>
              <rect
                x={left}
                y={othersTop}
                width={otherPanelWidth}
                height={otherPanelHeight}
                rx={0.4}
                fill={selected ? SELECTED : PAPER}
                stroke={selected ? INK : '#bbbbbb'}
                strokeWidth={0.08}
              />
              <text x={left + 0.6} y={othersTop + 1.4} fontSize={0.95} fontWeight={700} fill={INK}>
                {floorName(floor.floor)}
              </text>
              <g transform={`translate(${left + TURRET_MARGIN} ${othersTop + TITLE + TURRET_MARGIN})`}>
                <BuildingFloor floor={floor} plan={plan} rooms={rooms} />
              </g>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
