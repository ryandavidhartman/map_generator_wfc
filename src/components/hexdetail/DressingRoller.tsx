import { useState } from 'react'
import { rollDressing, type RoomDressing } from '../../engine/generateDressing'

// Sensory dressing (OSR's Air Currents/Odours/Noises/General/Furnishings tables) is rolled
// on demand, not baked into a site's generation-time rng sequence — same shape as
// EncounterRoller/generateTavern/generateShop: flavor a GM asks for when a room needs it,
// not persisted state every room carries. See docs/plan-osr-integration.md, Phase 2.
export function DressingRoller() {
  const [dressing, setDressing] = useState<RoomDressing | null>(null)

  return (
    <div className="dressing-roller">
      <button type="button" onClick={() => setDressing(rollDressing(Math.random))}>
        Roll dressing
      </button>
      {dressing && (
        <p className="dressing-result">
          The air is {dressing.airCurrent}; it smells {dressing.odour}. You hear {dressing.noise}. Amid the debris: {dressing.general}. A stray{' '}
          {dressing.furnishing} sits here.
        </p>
      )}
    </div>
  )
}
