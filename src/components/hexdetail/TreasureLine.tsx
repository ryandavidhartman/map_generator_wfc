import { describeTreasureAmount, type RolledTreasure } from '../../engine/generateTreasure'

// Shared by DungeonSiteView/TowerSiteView/KeepSiteView — a Treasure room's rolled amount(s),
// container, and (if present) guard/hiding-location flavor. See generateTreasure.ts.
export function TreasureLine({ treasure }: { treasure: RolledTreasure }) {
  return (
    <p>
      Treasure: {treasure.amounts.map(describeTreasureAmount).join(' + ')} ({treasure.container})
      {treasure.guard && (
        <>
          {' — '}
          {treasure.guard}, {treasure.hiddenIn}
        </>
      )}
    </p>
  )
}
