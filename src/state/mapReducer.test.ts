import { describe, expect, it } from 'vitest'
import { EMPTY_MAP_STATE, isRevealableNow, mapReducer, type MapState } from './mapReducer'

function fixedRng(value: number) {
  return () => value
}

describe('mapReducer', () => {
  it('START_MAP creates a single revealed hex at the origin, occupied by the party', () => {
    const state = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.99), // high roll: danger Deadly, poi check fails (d6=6)
    })
    expect(state.partyHexId).toBe('0,0')
    expect(state.selectedHexId).toBe('0,0')
    expect(state.hexes['0,0']).toMatchObject({ id: '0,0', q: 0, r: 0, terrain: 'Grassland' })
  })

  it('MOVE_PARTY_TO reveals an adjacent hex and moves the party there', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.99),
    })
    state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: fixedRng(0.99) })
    expect(state.partyHexId).toBe('1,0')
    expect(state.hexes['1,0']).toBeDefined()
    expect(Object.keys(state.hexes)).toHaveLength(2)
  })

  it('MOVE_PARTY_TO refuses a non-adjacent hex', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.99),
    })
    const before = state
    state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '2,0', rng: fixedRng(0.99) })
    expect(state).toBe(before)
  })

  it('MOVE_PARTY_TO can reach a hex arbitrarily far away by walking there one adjacent step at a time', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.99),
    })
    // Walk 50 hexes straight out along the q axis — there is no map-size bound anymore.
    const steps = 50
    for (let q = 1; q <= steps; q++) {
      state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: `${q},0`, rng: fixedRng(0.99) })
    }
    expect(state.partyHexId).toBe(`${steps},0`)
    expect(state.hexes[`${steps},0`]).toBeDefined()
    expect(Object.keys(state.hexes)).toHaveLength(steps + 1)
  })

  it('REROLL_HEX keeps terrain but changes danger/poi', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.99),
    })
    state = mapReducer(state, { type: 'REROLL_HEX', hexId: '0,0', rng: fixedRng(0) })
    expect(state.hexes['0,0'].terrain).toBe('Grassland')
    expect(state.hexes['0,0'].danger).toBe('Safe')
  })

  it('EDIT_HEX overrides fields manually', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.99),
    })
    state = mapReducer(state, { type: 'EDIT_HEX', hexId: '0,0', patch: { terrain: 'Mountain' } })
    expect(state.hexes['0,0'].terrain).toBe('Mountain')
  })

  it('NEW_MAP resets to the empty state', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.99),
    })
    state = mapReducer(state, { type: 'NEW_MAP' })
    expect(state).toEqual(EMPTY_MAP_STATE)
  })

  it('GENERATE_SITE generates a site for a POI hex with none yet', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.15), // poi check passes, rolls a fresh "Dungeon" feature (roll 31, non-settlement)
    })
    expect(state.hexes['0,0'].poi?.location).toBe('Dungeon')
    expect(state.hexes['0,0'].site).toBeUndefined()

    state = mapReducer(state, { type: 'GENERATE_SITE', hexId: '0,0', rng: fixedRng(0) })
    expect(state.hexes['0,0'].site?.kind).toBe('dungeon')
  })

  it('GENERATE_SITE is a no-op when the hex has no POI', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.99), // poi check fails
    })
    const before = state
    state = mapReducer(state, { type: 'GENERATE_SITE', hexId: '0,0', rng: fixedRng(0) })
    expect(state).toBe(before)
  })

  it('GENERATE_SITE is idempotent once a site already exists', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.15),
    })
    state = mapReducer(state, { type: 'GENERATE_SITE', hexId: '0,0', rng: fixedRng(0) })
    const afterFirstGenerate = state
    state = mapReducer(state, { type: 'GENERATE_SITE', hexId: '0,0', rng: fixedRng(0.5) })
    expect(state).toBe(afterFirstGenerate)
  })

  it('REROLL_SITE unconditionally regenerates the site', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.15),
    })
    state = mapReducer(state, { type: 'GENERATE_SITE', hexId: '0,0', rng: fixedRng(0) })
    const firstSite = state.hexes['0,0'].site
    state = mapReducer(state, { type: 'REROLL_SITE', hexId: '0,0', rng: fixedRng(0.3) })
    expect(state.hexes['0,0'].site).not.toBe(firstSite)
  })

  it('REROLL_HEX clears a stale site (poi is always re-rolled by REROLL_HEX)', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.15),
    })
    state = mapReducer(state, { type: 'GENERATE_SITE', hexId: '0,0', rng: fixedRng(0) })
    expect(state.hexes['0,0'].site).toBeDefined()

    state = mapReducer(state, { type: 'REROLL_HEX', hexId: '0,0', rng: fixedRng(0.99) })
    expect(state.hexes['0,0'].site).toBeUndefined()
  })

  it('EDIT_HEX clears a stale site only when the patch touches poi', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.15),
    })
    state = mapReducer(state, { type: 'GENERATE_SITE', hexId: '0,0', rng: fixedRng(0) })
    expect(state.hexes['0,0'].site).toBeDefined()

    // Patch that doesn't touch poi — site survives.
    state = mapReducer(state, { type: 'EDIT_HEX', hexId: '0,0', patch: { terrain: 'Mountain' } })
    expect(state.hexes['0,0'].site).toBeDefined()

    // Patch that touches poi (even to the same value) — site is cleared as stale.
    state = mapReducer(state, {
      type: 'EDIT_HEX',
      hexId: '0,0',
      patch: { poi: state.hexes['0,0'].poi },
    })
    expect(state.hexes['0,0'].site).toBeUndefined()
  })

  it('isRevealableNow is true only for unrevealed, adjacent hexes', () => {
    const state = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.99),
    })
    expect(isRevealableNow(state, '1,0')).toBe(true) // adjacent
    expect(isRevealableNow(state, '2,0')).toBe(false) // not adjacent
    expect(isRevealableNow(state, '0,0')).toBe(false) // already revealed
  })

  describe('Hex Danger Level (numeric)', () => {
    it('START_MAP always gives the origin hex Danger Level 1', () => {
      // fixedRng(0.99) rolls a Deadly qualitative danger, but the starting hex has no neighbors
      // to average against — it's fixed at 1 regardless.
      const state = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: fixedRng(0.99) })
      expect(state.hexes['0,0'].danger).toBe('Deadly')
      expect(state.hexes['0,0'].dangerLevel).toBe(1)
    })

    it('MOVE_PARTY_TO derives dangerLevel from its one revealed neighbor plus its own delta', () => {
      let state: MapState = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: fixedRng(0.99) })
      expect(state.hexes['0,0'].dangerLevel).toBe(1)

      // rollDie(6, 0.99) = 6 -> Deadly (delta +3). Base = round(avg([1])) = 1 -> max(1, 1 + 3) = 4.
      state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: fixedRng(0.99) })
      expect(state.hexes['1,0'].danger).toBe('Deadly')
      expect(state.hexes['1,0'].dangerLevel).toBe(4)
    })

    it('floors at 1 even when the delta would push it non-positive', () => {
      let state: MapState = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: fixedRng(0.99) })
      // rollDie(6, 0) = 1 -> Safe (delta -1). Base = round(avg([1])) = 1 -> max(1, 1 - 1) = 1.
      state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: fixedRng(0) })
      expect(state.hexes['1,0'].danger).toBe('Safe')
      expect(state.hexes['1,0'].dangerLevel).toBe(1)
    })

    it('averages multiple revealed neighbors, rounded, before applying its own delta', () => {
      // (0,0) -> dangerLevel 1. (1,0), reached from (0,0) with a Deadly roll -> dangerLevel 4.
      // (1,-1) is adjacent to both (0,0) and (1,0) — reveal it last (moving on from (1,0), which
      // is itself adjacent to (1,-1)) so both are already-revealed neighbors to average.
      let state: MapState = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: fixedRng(0.99) })
      state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: fixedRng(0.99) })
      expect(state.hexes['1,0'].dangerLevel).toBe(4)

      // rollDie(6, 0) = 1 -> Safe (delta -1). Base = round(avg([1, 4])) = round(2.5) = 3 ->
      // max(1, 3 - 1) = 2.
      state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,-1', rng: fixedRng(0) })
      expect(state.hexes['1,-1'].danger).toBe('Safe')
      expect(state.hexes['1,-1'].dangerLevel).toBe(2)
    })

    it('REROLL_HEX recomputes dangerLevel from the same neighbors using the fresh danger roll', () => {
      let state: MapState = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: fixedRng(0.99) })
      state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: fixedRng(0.99) })
      expect(state.hexes['1,0'].dangerLevel).toBe(4)

      // Neighbors of (1,0) unchanged (still just the origin at dangerLevel 1). Reroll with a
      // Safe result (delta -1): base = round(avg([1])) = 1 -> max(1, 1 - 1) = 1.
      state = mapReducer(state, { type: 'REROLL_HEX', hexId: '1,0', rng: fixedRng(0) })
      expect(state.hexes['1,0'].danger).toBe('Safe')
      expect(state.hexes['1,0'].dangerLevel).toBe(1)
    })

    it('EDIT_HEX can override dangerLevel directly, without recomputing it', () => {
      const state = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: fixedRng(0.99) })
      const edited = mapReducer(state, { type: 'EDIT_HEX', hexId: '0,0', patch: { dangerLevel: 12 } })
      expect(edited.hexes['0,0'].dangerLevel).toBe(12)
    })
  })

})

describe('mapReducer — revisits, selection and unknown actions', () => {
  function twoHexMap(): MapState {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: fixedRng(0.99) })
    state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: fixedRng(0.99) })
    return state
  }

  it('MOVE_PARTY_TO into an already-revealed hex just relocates the party, rolling nothing', () => {
    const before = twoHexMap()
    const rng = () => {
      throw new Error('a revisit must not roll')
    }
    const after = mapReducer(before, { type: 'MOVE_PARTY_TO', hexId: '0,0', rng })
    expect(after.partyHexId).toBe('0,0')
    expect(after.selectedHexId).toBe('0,0')
    expect(after.hexes).toBe(before.hexes)
  })

  it('MOVE_PARTY_TO does nothing before a map is started', () => {
    expect(mapReducer(EMPTY_MAP_STATE, { type: 'MOVE_PARTY_TO', hexId: '1,0' })).toBe(EMPTY_MAP_STATE)
  })

  it('SELECT_HEX selects a revealed hex without moving the party', () => {
    const before = twoHexMap()
    const after = mapReducer(before, { type: 'SELECT_HEX', hexId: '0,0' })
    expect(after.selectedHexId).toBe('0,0')
    expect(after.partyHexId).toBe('1,0')
    expect(after.hexes).toBe(before.hexes)
  })

  it('SELECT_HEX ignores an unrevealed hex', () => {
    const before = twoHexMap()
    expect(mapReducer(before, { type: 'SELECT_HEX', hexId: '5,5' })).toBe(before)
  })

  it('returns the same state for an unknown action', () => {
    const before = twoHexMap()
    // Simulates an action from an older/newer build reaching the reducer.
    expect(mapReducer(before, { type: 'NOT_A_REAL_ACTION' } as unknown as Parameters<typeof mapReducer>[1])).toBe(before)
  })
})
