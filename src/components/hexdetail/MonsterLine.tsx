import { describeDungeonMonster, type GeneratedDungeonMonster } from '../../engine/generateDungeonEncounter'

// Shared monster + Treasure Type display, used by every dungeon-shaped site view
// (DungeonSiteView/TowerSiteView/KeepSiteView) that renders a room's rolled monster.
export function MonsterLine({ monster }: { monster: GeneratedDungeonMonster }) {
  const described = describeDungeonMonster(monster)
  return (
    <p>
      Monster: {described.name} <span className="room-tag">({described.subtitle})</span>
      {described.treasure && (
        <>
          <br />
          <span className="room-tag">{described.treasure}</span>
        </>
      )}
    </p>
  )
}
