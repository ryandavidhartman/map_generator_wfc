// Regression pins for PLAN.md punch-list item 2 (town-map water from tile shapes, 2026-11-06):
// coast-only, no-water and Ocean-island ("coast with no direction") towns must come out
// byte-for-byte identical to the plans the code produced before the river rework. The hashes
// below were captured from the pre-item-2 code (main at 5275db4) before any edit, over 24 seeds
// × 4 sizes × 3 water cases (re-captured 2026-11-06 with numbers rounded, see planHash; the
// unrounded hashes still matched on x86 then, so the plans are the same), which covers every outline shape × street pattern combination
// (asserted below). Adapted from map_generator's settlementPlanBaseline.test.ts (its punch-list
// 1b).
//
// If a deliberate change to the settlement plan alters these towns, regenerate the table with
//   BASELINE_PRINT=1 npx vitest run src/engine/settlementPlanBaseline.test.ts --silent false --reporter=verbose
// paste the lines it prints into BASELINE, and note it in docs/HISTORY.md.
import { describe, expect, it } from 'vitest'
import { computeSettlementPlan, type SettlementWaterInput } from './settlementPlan'
import { generateSettlement } from './generateSettlement'
import type { SettlementType } from '../data/settlementTables'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function fnv(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function waterFor(label: string, seed: number): SettlementWaterInput | null {
  if (label === 'none') return null
  if (label === 'coast') return { kind: 'coast', angle: (seed * 1.3) % (Math.PI * 2) }
  return { kind: 'coast' } // Ocean-hex island: a coast on a seed-picked side
}

function planFor(type: SettlementType, seed: number, label: string) {
  const site = generateSettlement(seededRng(seed), type)
  return computeSettlementPlan({
    settlementType: site.settlementType,
    districts: site.districts,
    seedSource: `${site.settlementType}|${site.population}|${seed}`,
    water: waterFor(label, seed),
  })
}

// Numbers are rounded to 6 decimals before hashing. The plan's coordinates come out of
// Math.sin/cos/atan2 and friends, whose last bit can differ between CPU architectures (x86 vs
// arm64, e.g. an Apple Silicon Mac) and Node versions; hashing the raw floats failed 161 of these
// on an arm64 machine with no real change. A real change to a town moves values far more than 1e-6.
function planHash(type: SettlementType, seed: number, label: string): string {
  return fnv(JSON.stringify(planFor(type, seed, label), (_key, value) =>
    typeof value === 'number' ? Math.round(value * 1e6) / 1e6 : value))
}

const TYPES: SettlementType[] = ['Village', 'Town', 'City', 'Metropolis']
const LABELS = ['none', 'coast', 'island']

// The app's tsconfig has no Node types, so the environment is read through globalThis.
const PRINT = Boolean((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BASELINE_PRINT)

const BASELINE: Record<string, string> = {
  'Village|1|none': '0c7c4bd5',
  'Village|1|coast': '27f1e0c8',
  'Village|1|island': '0ca28214',
  'Village|2|none': 'c8cc786f',
  'Village|2|coast': 'deaa6bde',
  'Village|2|island': '9346b801',
  'Village|3|none': '96f84428',
  'Village|3|coast': '23e83569',
  'Village|3|island': 'ee444caa',
  'Village|4|none': '0afc2605',
  'Village|4|coast': '229003ef',
  'Village|4|island': '9ac55594',
  'Village|5|none': 'e59f1b45',
  'Village|5|coast': 'f058d055',
  'Village|5|island': 'a5941b96',
  'Village|6|none': '3bc8c623',
  'Village|6|coast': 'fda1e6f4',
  'Village|6|island': '00dd3ae7',
  'Village|7|none': '1aab56e2',
  'Village|7|coast': '69dff81d',
  'Village|7|island': '1b8e56a7',
  'Village|8|none': '4a6e738d',
  'Village|8|coast': '7ad7330e',
  'Village|8|island': 'b337dd3b',
  'Village|9|none': '8bf5c812',
  'Village|9|coast': 'f1783716',
  'Village|9|island': '0976f459',
  'Village|10|none': 'af117720',
  'Village|10|coast': '07c01ad6',
  'Village|10|island': 'feae51fd',
  'Village|11|none': '6685ac5a',
  'Village|11|coast': '48f1f1b6',
  'Village|11|island': '7d32153e',
  'Village|12|none': '74a04c37',
  'Village|12|coast': 'eb7ed982',
  'Village|12|island': 'a3bf8933',
  'Village|13|none': 'f22f6b16',
  'Village|13|coast': '5b99b65f',
  'Village|13|island': 'c9d41051',
  'Village|14|none': '9c49b65a',
  'Village|14|coast': 'ac2ffa30',
  'Village|14|island': '9d989dd4',
  'Village|15|none': '243f59b6',
  'Village|15|coast': '041fca88',
  'Village|15|island': '6e3b7544',
  'Village|16|none': 'fd85e644',
  'Village|16|coast': '3d233a59',
  'Village|16|island': '4d52a26c',
  'Village|17|none': '4e7c54fe',
  'Village|17|coast': 'faf22876',
  'Village|17|island': '6f9e0ba7',
  'Village|18|none': '4e05e96e',
  'Village|18|coast': '53b3c849',
  'Village|18|island': 'cce05fe2',
  'Village|19|none': 'b82c1f49',
  'Village|19|coast': 'cb9c62b0',
  'Village|19|island': '7717cdab',
  'Village|20|none': 'fefea6d9',
  'Village|20|coast': '17ee1ccf',
  'Village|20|island': 'e81fa090',
  'Village|21|none': '3f268d50',
  'Village|21|coast': '03165939',
  'Village|21|island': 'c874d0f4',
  'Village|22|none': '3e02a30a',
  'Village|22|coast': '26fa6cca',
  'Village|22|island': '5e831f48',
  'Village|23|none': '5eaa4acf',
  'Village|23|coast': '2410d0e8',
  'Village|23|island': 'eb497300',
  'Village|24|none': 'c35f821f',
  'Village|24|coast': '29128233',
  'Village|24|island': '44b0c7b5',
  'Town|1|none': 'd9113876',
  'Town|1|coast': '9369fafd',
  'Town|1|island': '9408b9b4',
  'Town|2|none': '0a7a7c68',
  'Town|2|coast': '73dcdec9',
  'Town|2|island': 'fa5ea51d',
  'Town|3|none': '0e40c55b',
  'Town|3|coast': '8d051f36',
  'Town|3|island': '57e5bea9',
  'Town|4|none': 'e5afd646',
  'Town|4|coast': '4fc774a3',
  'Town|4|island': '9e03374c',
  'Town|5|none': 'c8fd3263',
  'Town|5|coast': 'cd1feb67',
  'Town|5|island': '6ec21b69',
  'Town|6|none': '2a2ba097',
  'Town|6|coast': '14795eca',
  'Town|6|island': 'ebc0142e',
  'Town|7|none': '12a029f3',
  'Town|7|coast': '7e523111',
  'Town|7|island': '3f95ef6a',
  'Town|8|none': 'a244dd46',
  'Town|8|coast': '4a929154',
  'Town|8|island': '74bfb6a4',
  'Town|9|none': '3d622d37',
  'Town|9|coast': 'fa7974c4',
  'Town|9|island': 'e8653948',
  'Town|10|none': '21ef310f',
  'Town|10|coast': '3597b6e1',
  'Town|10|island': '7fb4d2c0',
  'Town|11|none': '8b5a7152',
  'Town|11|coast': '9c378053',
  'Town|11|island': '058588ef',
  'Town|12|none': '08a1daff',
  'Town|12|coast': '54137c6b',
  'Town|12|island': '4adcec41',
  'Town|13|none': '71f07fb0',
  'Town|13|coast': 'e57a87a3',
  'Town|13|island': 'a83cc44c',
  'Town|14|none': '080ec039',
  'Town|14|coast': 'e8cbaf57',
  'Town|14|island': '5ef16b0d',
  'Town|15|none': 'bed871d8',
  'Town|15|coast': '838f3533',
  'Town|15|island': '8d917869',
  'Town|16|none': 'e157d1e2',
  'Town|16|coast': '992dc6f7',
  'Town|16|island': 'd24a2079',
  'Town|17|none': '726b31a5',
  'Town|17|coast': '29803c58',
  'Town|17|island': '5bb803a6',
  'Town|18|none': '1b1a3be3',
  'Town|18|coast': 'c2d6d931',
  'Town|18|island': '2b7ad3ea',
  'Town|19|none': 'bec82aa1',
  'Town|19|coast': 'a74aae27',
  'Town|19|island': '925c6655',
  'Town|20|none': '7dc82fb6',
  'Town|20|coast': 'b537417f',
  'Town|20|island': '411e4f3c',
  'Town|21|none': '317e1a40',
  'Town|21|coast': 'e13ea891',
  'Town|21|island': '886d625e',
  'Town|22|none': 'b91781cd',
  'Town|22|coast': '76cca5d7',
  'Town|22|island': 'a64d4857',
  'Town|23|none': '8a18f41f',
  'Town|23|coast': '9213c35e',
  'Town|23|island': '91414a44',
  'Town|24|none': '332700d9',
  'Town|24|coast': '83feab85',
  'Town|24|island': '812da3c5',
  'City|1|none': 'ea7fdafe',
  'City|1|coast': 'dba28e73',
  'City|1|island': '5de4b1d9',
  'City|2|none': 'a1d5bd4d',
  'City|2|coast': '322338bd',
  'City|2|island': '96c80cde',
  'City|3|none': '9225f040',
  'City|3|coast': '79eee816',
  'City|3|island': '5cf70ac4',
  'City|4|none': '88b9c30d',
  'City|4|coast': '57ce05c1',
  'City|4|island': '34b65d62',
  'City|5|none': '9776e43b',
  'City|5|coast': 'f5a882d7',
  'City|5|island': '9df2f99f',
  'City|6|none': '7a8a18a0',
  'City|6|coast': 'e54f247a',
  'City|6|island': '6cfdfc5d',
  'City|7|none': '86c3c8c5',
  'City|7|coast': 'ae5cae6b',
  'City|7|island': 'ac578490',
  'City|8|none': '1865163e',
  'City|8|coast': '96a7b94d',
  'City|8|island': '5baee3b7',
  'City|9|none': 'b49fa147',
  'City|9|coast': '6485b32c',
  'City|9|island': '45d401d1',
  'City|10|none': 'f18e05cd',
  'City|10|coast': '378f3d37',
  'City|10|island': 'b57147e0',
  'City|11|none': '666d0bfa',
  'City|11|coast': '803fad07',
  'City|11|island': '21a6c7eb',
  'City|12|none': '88a20e0e',
  'City|12|coast': 'aae23195',
  'City|12|island': 'c1448754',
  'City|13|none': '23feee9f',
  'City|13|coast': '52ce61ae',
  'City|13|island': '3cd4db1c',
  'City|14|none': '0c7134d5',
  'City|14|coast': '661a8cc3',
  'City|14|island': 'd65d198e',
  'City|15|none': 'd8c5ba16',
  'City|15|coast': '083b11c0',
  'City|15|island': 'a6c0479c',
  'City|16|none': '1b8a3a02',
  'City|16|coast': '82a7575a',
  'City|16|island': '304f249b',
  'City|17|none': 'a4980a80',
  'City|17|coast': '2edd4b64',
  'City|17|island': '7c81c5bc',
  'City|18|none': 'b6d5832c',
  'City|18|coast': '9a0c9bfc',
  'City|18|island': 'b90c2a11',
  'City|19|none': '68db03f9',
  'City|19|coast': 'cabf4dfe',
  'City|19|island': 'c2ead14d',
  'City|20|none': 'bbad1cbf',
  'City|20|coast': 'edb0a502',
  'City|20|island': '5f098072',
  'City|21|none': '3312b985',
  'City|21|coast': 'f08885ce',
  'City|21|island': 'eb10ab99',
  'City|22|none': 'c13851ce',
  'City|22|coast': 'c30707e7',
  'City|22|island': 'e39a24ad',
  'City|23|none': '5fb07a1a',
  'City|23|coast': '746d1afa',
  'City|23|island': '29319f5f',
  'City|24|none': '88cada41',
  'City|24|coast': 'a24811df',
  'City|24|island': '9c3fb955',
  'Metropolis|1|none': '12bc4ec9',
  'Metropolis|1|coast': '9fbbb667',
  'Metropolis|1|island': 'ec2e5c1d',
  'Metropolis|2|none': '8224676c',
  'Metropolis|2|coast': 'e45ad0ed',
  'Metropolis|2|island': 'ca3ca7dd',
  'Metropolis|3|none': 'd5e91267',
  'Metropolis|3|coast': '5638ed90',
  'Metropolis|3|island': '40a7d899',
  'Metropolis|4|none': 'd879dfaf',
  'Metropolis|4|coast': '964735ef',
  'Metropolis|4|island': '72e28325',
  'Metropolis|5|none': 'd2c62781',
  'Metropolis|5|coast': '717e0919',
  'Metropolis|5|island': '8ad6d024',
  'Metropolis|6|none': '26a0271f',
  'Metropolis|6|coast': 'f3ad788c',
  'Metropolis|6|island': 'ea311825',
  'Metropolis|7|none': '5a27e42a',
  'Metropolis|7|coast': 'fa4d642a',
  'Metropolis|7|island': '39097550',
  'Metropolis|8|none': '2fe403e7',
  'Metropolis|8|coast': 'fe8a6cb7',
  'Metropolis|8|island': '730ff282',
  'Metropolis|9|none': '0d9ad4b6',
  'Metropolis|9|coast': '418522b1',
  'Metropolis|9|island': '4f7beadf',
  'Metropolis|10|none': '8dc48212',
  'Metropolis|10|coast': '2d05b34a',
  'Metropolis|10|island': 'a3d33f0c',
  'Metropolis|11|none': '7a512116',
  'Metropolis|11|coast': '548b8985',
  'Metropolis|11|island': '9f9b9c97',
  'Metropolis|12|none': '71c29113',
  'Metropolis|12|coast': '41213558',
  'Metropolis|12|island': 'ef2746ee',
  'Metropolis|13|none': '4c084b8a',
  'Metropolis|13|coast': 'a88bf410',
  'Metropolis|13|island': '306a7f56',
  'Metropolis|14|none': 'c6883ecc',
  'Metropolis|14|coast': 'f2719b43',
  'Metropolis|14|island': 'fb8184dc',
  'Metropolis|15|none': '41869101',
  'Metropolis|15|coast': '92e562b7',
  'Metropolis|15|island': '6c283ec8',
  'Metropolis|16|none': '2baf9629',
  'Metropolis|16|coast': 'dced17f6',
  'Metropolis|16|island': '96f2c5d8',
  'Metropolis|17|none': '23a3b779',
  'Metropolis|17|coast': 'cda62306',
  'Metropolis|17|island': '4efbb85a',
  'Metropolis|18|none': '97c9b2a9',
  'Metropolis|18|coast': '3026bec1',
  'Metropolis|18|island': 'eda9ec0e',
  'Metropolis|19|none': 'afe69df8',
  'Metropolis|19|coast': '6757bf02',
  'Metropolis|19|island': '2ae6c956',
  'Metropolis|20|none': '6bb5fae0',
  'Metropolis|20|coast': '3941066c',
  'Metropolis|20|island': 'ae97c42b',
  'Metropolis|21|none': '04748851',
  'Metropolis|21|coast': '1633c17f',
  'Metropolis|21|island': '15435218',
  'Metropolis|22|none': '05c2edaa',
  'Metropolis|22|coast': 'ee17b3e8',
  'Metropolis|22|island': '8496403a',
  'Metropolis|23|none': 'd6f5c5cf',
  'Metropolis|23|coast': '2844b58e',
  'Metropolis|23|island': 'c21d24ee',
  'Metropolis|24|none': 'b072935c',
  'Metropolis|24|coast': 'c2eb609f',
  'Metropolis|24|island': 'c5dcfeea',
}

describe('pre-item-2 baseline: coast-only, no-water and island towns are byte-identical', () => {
  it.runIf(PRINT)('print baseline', () => {
    const lines: string[] = []
    for (const type of TYPES) for (let seed = 1; seed <= 24; seed++) for (const label of LABELS) {
      lines.push(`  '${type}|${seed}|${label}': '${planHash(type, seed, label)}',`)
    }
    console.log(lines.join('\n'))
  }, 60000)

  it.skipIf(PRINT).each(Object.keys(BASELINE))('%s', (key) => {
    const [type, seed, label] = key.split('|')
    expect(planHash(type as SettlementType, Number(seed), label)).toBe(BASELINE[key])
  })

  it.skipIf(PRINT)('the pinned towns cover every outline shape × street pattern', () => {
    const seen = new Set<string>()
    for (const key of Object.keys(BASELINE)) {
      const [type, seed, label] = key.split('|')
      const plan = planFor(type as SettlementType, Number(seed), label)
      seen.add(`${plan.shape}/${plan.pattern}`)
    }
    expect([...seen].sort()).toEqual([
      'angular/grid', 'angular/gridCore', 'angular/oldTown', 'angular/organic',
      'elongated/grid', 'elongated/gridCore', 'elongated/oldTown', 'elongated/organic',
      'round/grid', 'round/gridCore', 'round/oldTown', 'round/organic',
    ])
  }, 60000)
})
