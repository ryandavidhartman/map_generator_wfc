// Town-map rivers (PLAN.md punch-list item 2): a seeded sweep over more seeds, every size, every
// river tile shape, each at a seed-chosen rotation (so all six orientations turn up). Split from
// settlementRiver.test.ts so it runs in parallel with it. Adapted from map_generator's
// settlementRiverSweep.test.ts (its punch-list 1b).
import { describe, it } from 'vitest'
import { computeSettlementPlan } from './settlementPlan'
import { SCENARIOS, TYPES, checkRiverTown, inputFor, riverWater, rotated } from './settlementRiverChecks'

describe('seeded sweep: many seeds, every size, every river tile shape and rotation', () => {
  it('never throws, has no NaN, keeps every district and a reachable seat', () => {
    for (const type of TYPES) {
      for (let seed = 4; seed <= 9; seed++) {
        for (const [label, edges] of Object.entries(SCENARIOS)) {
          const turned = rotated(edges, seed % 6)
          const plan = computeSettlementPlan({ ...inputFor(seed, type), water: riverWater(turned) })
          checkRiverTown(plan, `${label}@${seed % 6} ${type} ${seed}`)
        }
      }
    }
  }, 600000)
})
