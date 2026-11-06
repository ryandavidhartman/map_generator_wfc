import { useMemo, useState } from 'react'
import { useMapDispatch } from '../../state/MapContext'
import type { Hex } from '../../state/mapReducer'
import type { TowerSite } from '../../engine/generateTower'
import { computeTowerPlan } from '../../engine/towerPlan'
import { TowerMapSvg, type TowerMapRoomData } from '../../hexgrid/TowerMapSvg'
import { HexBaseInfo } from './HexBaseInfo'
import { TreasureLine } from './TreasureLine'
import { DressingRoller } from './DressingRoller'
import { TrickRoller } from './TrickRoller'
import { MonsterLine } from './MonsterLine'

function floorName(level: number): string {
  return level === 0 ? 'Ground Floor' : `Floor ${level}`
}

function roomListLabel(room: TowerSite['rooms'][number], number: number): string {
  if (room.id === 'entry-hall') return `${number}. Entry Hall (${floorName(0)})`
  if (room.id === 'guard-room') return `${number}. Guard Room (${floorName(0)})`
  const where = room.floorRoomIndex === 0 ? 'stair landing' : 'side room'
  return `${number}. ${floorName(room.levelIndex)}, ${where}`
}

export function TowerSiteView({ hex, site }: { hex: Hex; site: TowerSite }) {
  const dispatch = useMapDispatch()
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null)

  // Rooms are numbered in site order (ground floor up, stair landing first on each floor) —
  // the same numbers appear on the map and in the room list below.
  const plan = useMemo(
    () =>
      computeTowerPlan({
        levelCount: site.levelCount,
        // Saves from before multi-room floors (2026-10-31) have no floorRoomIndex; the guard
        // room was the only side room then.
        rooms: site.rooms.map((r) => ({ id: r.id, levelIndex: r.levelIndex, floorRoomIndex: r.floorRoomIndex ?? (r.isGuardRoom ? 1 : 0) })),
        seedSource: site.rooms.map((r) => `${r.id}:${r.roomTypeRoll}`).join('|'),
      }),
    [site],
  )
  const roomData: Record<string, TowerMapRoomData> = Object.fromEntries(
    site.rooms.map((room, i) => [room.id, { label: String(i + 1), isObjective: room.isObjectiveRoom }]),
  )

  return (
    <div className="site-view">
      <HexBaseInfo hex={hex} />

      <section className="site-section">
        <div className="site-section-header">
          <h3>
            {site.size} Tower — Danger: {site.danger} — Dungeon Level {site.dungeonLevel} (Effective {site.effectiveDungeonLevel})
          </h3>
          <button type="button" onClick={() => dispatch({ type: 'REROLL_SITE', hexId: hex.id })}>
            Reroll Site
          </button>
        </div>

        <p className="site-scenario">Scenario: {site.scenario}</p>

        <div className="site-layout tower-layout">
          <TowerMapSvg
            plan={plan}
            rooms={roomData}
            selectedLevel={selectedLevel}
            onSelectLevel={(level) => setSelectedLevel((current) => (current === level ? null : level))}
          />
        </div>

        <ol className="room-list">
          {site.rooms.map((room, i) => (
            <li
              key={room.id}
              data-room-id={room.id}
              className={[room.isObjectiveRoom ? 'objective-room' : '', selectedLevel === room.levelIndex ? 'selected-floor-room' : '']
                .filter(Boolean)
                .join(' ') || undefined}
            >
              <strong>
                {roomListLabel(room, i + 1)}: {room.roomType}
                {room.isObjectiveRoom && ' (Objective)'}
              </strong>
              {room.detail && <p>{room.detail}</p>}
              {room.monster && <MonsterLine monster={room.monster} />}
              {room.npc && <p>NPC: {room.npc.type}</p>}
              {room.treasure && <TreasureLine treasure={room.treasure} />}
              {room.trap && (
                <p>
                  Trap: {room.trap.name} <span className="room-tag">({room.trap.severity})</span>
                </p>
              )}
              <DressingRoller />
              <TrickRoller />
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
