import { useState } from 'react'
import { rollTrick, type RolledTrick } from '../../engine/generateDressing'

// A trick (OSR's Trick Object + Trick Attribute tables) is rolled on demand, same shape as
// DressingRoller — a GM's occasional twist on a room, not persisted generation-time state.
// See docs/plan-osr-integration.md, round 2, Phase 2.
export function TrickRoller() {
  const [trick, setTrick] = useState<RolledTrick | null>(null)

  return (
    <div className="trick-roller">
      <button type="button" onClick={() => setTrick(rollTrick(Math.random))}>
        Roll a trick
      </button>
      {trick && (
        <p className="trick-result">
          {trick.object}, {trick.attribute}
        </p>
      )}
    </div>
  )
}
