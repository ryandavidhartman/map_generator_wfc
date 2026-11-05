// Rolls the 5 universal atmosphere tables (Air Currents/Odours/Noises/General/Furnishings —
// see dungeonDressingTables.ts for which of the book's 13 dressing tables these are and why)
// plus the concrete Random Trap table for Trap rooms. Both are additive sensory/mechanical
// detail layered on top of the core rules' existing room content, not a replacement for it — see
// docs/plan-osr-integration.md, Phase 2.

import { rollDie, type Rng } from './dice'
import { airCurrentForD100, odourForD100, noiseForD100, generalDressingForD100, furnishingForD100 } from '../data/dungeonDressingTables'
import { randomTrapForD100, trapSeverityForDungeonLevel, type TrapSeverity } from '../data/trapTables'
import { trickObjectForD100, trickAttributeForD100 } from '../data/trickTables'

export type RoomDressing = {
  airCurrent: string
  odour: string
  noise: string
  general: string
  furnishing: string
}

export function rollDressing(rng: Rng): RoomDressing {
  return {
    airCurrent: airCurrentForD100(rollDie(100, rng)),
    odour: odourForD100(rollDie(100, rng)),
    noise: noiseForD100(rollDie(100, rng)),
    general: generalDressingForD100(rollDie(100, rng)),
    furnishing: furnishingForD100(rollDie(100, rng)),
  }
}

export type RolledTrap = {
  name: string
  severity: TrapSeverity
}

export function rollTrap(rng: Rng, dungeonLevel: number): RolledTrap {
  return {
    name: randomTrapForD100(rollDie(100, rng)),
    severity: trapSeverityForDungeonLevel(dungeonLevel),
  }
}

// Round 2, Phase 2 — Tricks (see data/trickTables.ts). Same on-demand, not-baked-into-generation
// shape as rollDressing above.
export type RolledTrick = {
  object: string
  attribute: string
}

export function rollTrick(rng: Rng): RolledTrick {
  return {
    object: trickObjectForD100(rollDie(100, rng)),
    attribute: trickAttributeForD100(rollDie(100, rng)),
  }
}
