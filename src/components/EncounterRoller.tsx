import { useState } from 'react'
import { rollEncounter, rollEncounterPurpose, checkWildernessEncounterFrequency, rollWildernessMonster, rollOsrUrbanEncounter, type WildernessMonsterResult } from '../engine/rollEncounter'
import type { EncounterTableKey, OsrUrbanEncounterTableKey } from '../data/encounterTables'
import type { Terrain } from '../data/tables'
import { describeRolledTreasure } from '../data/treasureTypeTables'

const OSR_URBAN_KEYS: OsrUrbanEncounterTableKey[] = ['OSR Urban (Daytime)', 'OSR Urban (Nighttime)']
function isOsrUrbanKey(key: EncounterTableKey): key is OsrUrbanEncounterTableKey {
  return (OSR_URBAN_KEYS as string[]).includes(key)
}

// A sentinel source id for "roll on OSR's Terrain Category Summary instead of the book table" —
// distinct from any real EncounterTableKey. Mutually exclusive with the book table sources: one
// roll, one encounter, the GM picks which system generates it. (Real bug, user-reported
// 2026-08-23: this used to roll BOTH sources on every click and show them stacked, so an
// ankheg/bulette terrain-table result and an unrelated OSR-rolled Ghoul appeared together as if
// happening at once — nonsensical. Fixed by making it a single selectable source.)
const OSR_WILDERNESS_SOURCE = 'OSR Wandering Monster' as const
type Source = EncounterTableKey | typeof OSR_WILDERNESS_SOURCE

// A Danger Level dropdown right on the roller itself, rather than tracking a campaign-wide
// number — lets a GM preview/roll at a different level without editing the hex. Seeded from the
// current hex's own dangerLevel (house-rule numeric Danger Level, see state/mapReducer.ts) so it
// starts in sync, then a fully independent local override.
const DANGER_LEVELS = Array.from({ length: 20 }, (_, i) => i + 1)

type RollResult =
  | 'none'
  | { kind: 'table'; encounter: string; purpose: string }
  | { kind: 'osr-wilderness'; monster: WildernessMonsterResult; purpose: string }

function describeWildernessMonster(result: WildernessMonsterResult): string {
  if (result.kind === 'traveler') {
    return `Traveler: ${result.npc.race} ${result.npc.profession}`
  }
  return `${result.monster.name} (${result.monster.category})`
}

function wildernessTreasureLine(result: WildernessMonsterResult): string | undefined {
  if (result.kind === 'traveler' || !result.monster.treasureTypeRaw) return undefined
  return describeRolledTreasure(result.monster.treasureTypeRaw, result.monster.treasure)
}

type EncounterRollerProps = {
  tableKeys: EncounterTableKey[]
  // When provided, a frequency check (OSR's Encounter Frequency table — see
  // engine/rollEncounter.ts) gates whether an encounter happens at all before rolling, so the
  // roller can produce "no encounter" instead of always hitting. Wilderness only: the book gives
  // urban/settlement checks no die-based gate, just DM-judged cadence ("every 3 turns, or as
  // desired") — so district use (SettlementView) omits this prop and keeps the old
  // always-rolls behavior. Also unlocks the OSR Wandering Monster source as a selectable option.
  wildernessTerrain?: Terrain
  // The hex this roller is attached to (its own numeric Danger Level) — seeds the local override
  // dropdown below. Callers pass `hex.dangerLevel ?? 1`.
  hexDangerLevel: number
}

export function EncounterRoller({ tableKeys, wildernessTerrain, hexDangerLevel }: EncounterRollerProps) {
  const sources: Source[] = wildernessTerrain ? [...tableKeys, OSR_WILDERNESS_SOURCE] : tableKeys
  const [selectedSource, setSelectedSource] = useState<Source>(sources[0])
  const [dangerLevel, setDangerLevel] = useState(hexDangerLevel)
  const [result, setResult] = useState<RollResult | null>(null)

  function roll() {
    if (wildernessTerrain && !checkWildernessEncounterFrequency(wildernessTerrain)) {
      setResult('none')
      return
    }
    if (selectedSource === OSR_WILDERNESS_SOURCE) {
      setResult({ kind: 'osr-wilderness', monster: rollWildernessMonster(wildernessTerrain!, dangerLevel), purpose: rollEncounterPurpose() })
    } else if (isOsrUrbanKey(selectedSource)) {
      setResult({ kind: 'table', encounter: rollOsrUrbanEncounter(selectedSource, dangerLevel), purpose: rollEncounterPurpose() })
    } else {
      setResult({ kind: 'table', encounter: rollEncounter(selectedSource), purpose: rollEncounterPurpose() })
    }
  }

  return (
    <div className="encounter-roller">
      {sources.length > 1 && (
        <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value as Source)}>
          {sources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      )}
      <label className="party-level-control">
        Danger Level
        <select value={dangerLevel} onChange={(e) => setDangerLevel(Number(e.target.value))}>
          {DANGER_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={roll}>
        {wildernessTerrain ? 'Check for wandering encounter' : 'Roll random encounter'}
      </button>
      {result === 'none' && <p className="encounter-result">No encounter.</p>}
      {result && result !== 'none' && result.kind === 'table' && (
        <p className="encounter-result">
          {result.encounter}
          <br />
          <span className="encounter-purpose">Purpose: {result.purpose}</span>
        </p>
      )}
      {result && result !== 'none' && result.kind === 'osr-wilderness' && (
        <p className="encounter-result">
          {describeWildernessMonster(result.monster)}
          <br />
          <span className="encounter-purpose">Purpose: {result.purpose}</span>
          {wildernessTreasureLine(result.monster) && (
            <>
              <br />
              <span className="encounter-purpose">{wildernessTreasureLine(result.monster)}</span>
            </>
          )}
        </p>
      )}
    </div>
  )
}
