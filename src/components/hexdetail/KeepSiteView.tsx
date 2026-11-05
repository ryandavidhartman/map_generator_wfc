import { useMemo, useState } from 'react'
import { useMapDispatch } from '../../state/MapContext'
import type { Hex } from '../../state/mapReducer'
import type { KeepSite, KeepRoom } from '../../engine/generateKeep'
import { computeKeepPlan } from '../../engine/keepPlan'
import { KeepMapSvg, floorName, type KeepMapRoomData } from '../../hexgrid/KeepMapSvg'
import { HexBaseInfo } from './HexBaseInfo'
import { TreasureLine } from './TreasureLine'
import { DressingRoller } from './DressingRoller'
import { TrickRoller } from './TrickRoller'
import { MonsterLine } from './MonsterLine'

// Saves from before multi-floor keeps (2026-10-31) have no `floor`; everything was ground level.
function floorOf(room: KeepRoom): number {
  return room.floor ?? 0
}

export function KeepSiteView({ hex, site }: { hex: Hex; site: KeepSite }) {
  const dispatch = useMapDispatch()
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)

  const plan = useMemo(
    () =>
      computeKeepPlan({
        rooms: site.rooms.map((r) => ({ id: r.id, floor: floorOf(r), isCourtyard: r.isCourtyard })),
        seedSource: site.rooms.map((r) => `${r.id}:${r.roomTypeRoll}`).join('|'),
      }),
    [site],
  )
  // Rooms are numbered in site order (courtyard, ground floor, upper floors, cellar) — the same
  // numbers appear on the map and in the room list below.
  const roomData: Record<string, KeepMapRoomData> = Object.fromEntries(
    site.rooms.map((room, i) => [room.id, { label: String(i + 1), isObjective: room.isObjectiveRoom }]),
  )
  const courtyardId = site.rooms.find((r) => r.isCourtyard)?.id ?? 'courtyard'

  return (
    <div className="site-view">
      <HexBaseInfo hex={hex} />

      <section className="site-section">
        <div className="site-section-header">
          <h3>
            {site.size} Keep — Danger: {site.danger} — Dungeon Level {site.dungeonLevel} (Effective {site.effectiveDungeonLevel})
          </h3>
          <button type="button" onClick={() => dispatch({ type: 'REROLL_SITE', hexId: hex.id })}>
            Reroll Site
          </button>
        </div>

        <p className="site-scenario">Scenario: {site.scenario}</p>
        <p className="site-scenario">
          Ruled by a level {site.approach.ownerLevel} {site.approach.ownerClass}, backed by {site.approach.patrol}. Reaction to the
          party: {site.approach.reaction}.
        </p>

        <div className="site-layout paper-layout">
          <KeepMapSvg
            plan={plan}
            rooms={roomData}
            courtyardId={courtyardId}
            selectedFloor={selectedFloor}
            onSelectFloor={(floor) => setSelectedFloor((current) => (current === floor ? null : floor))}
          />
        </div>

        <ol className="room-list">
          {site.rooms.map((room, i) => (
            <li
              key={room.id}
              data-room-id={room.id}
              className={[room.isObjectiveRoom ? 'objective-room' : '', selectedFloor === floorOf(room) ? 'selected-floor-room' : '']
                .filter(Boolean)
                .join(' ') || undefined}
            >
              <strong>
                {i + 1}. {room.name} ({floorName(floorOf(room))}): {room.roomType}
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
