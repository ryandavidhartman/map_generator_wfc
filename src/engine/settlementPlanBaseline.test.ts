// Regression pins for PLAN.md punch-list item 2 (town-map water from tile shapes, 2026-11-06):
// coast-only, no-water and Ocean-island ("coast with no direction") towns must come out
// byte-for-byte identical to the plans the code produced before the river rework. The hashes
// below were captured from the pre-item-2 code (main at 5275db4) before any edit, over 24 seeds
// × 4 sizes × 3 water cases, which covers every outline shape × street pattern combination
// (asserted below). Adapted from map_generator's settlementPlanBaseline.test.ts (its punch-list
// 1b).
//
// If a deliberate change to the settlement plan alters these towns, regenerate the table with
//   BASELINE_PRINT=1 npx vitest run src/engine/settlementPlanBaseline.test.ts --silent=false
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

const TYPES: SettlementType[] = ['Village', 'Town', 'City', 'Metropolis']
const LABELS = ['none', 'coast', 'island']

// The app's tsconfig has no Node types, so the environment is read through globalThis.
const PRINT = Boolean((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BASELINE_PRINT)

const BASELINE: Record<string, string> = {
  'Village|1|none': '3b87c74f',
  'Village|1|coast': '7fc5be04',
  'Village|1|island': 'bc59c8b8',
  'Village|2|none': '81b17868',
  'Village|2|coast': '50a8db9c',
  'Village|2|island': '4f554c44',
  'Village|3|none': '037c3cef',
  'Village|3|coast': '0e345f0d',
  'Village|3|island': 'e3595739',
  'Village|4|none': '2c642918',
  'Village|4|coast': '21972c1d',
  'Village|4|island': 'e9c95552',
  'Village|5|none': '410ea1eb',
  'Village|5|coast': '5553efbf',
  'Village|5|island': '4de7ec45',
  'Village|6|none': '072345e6',
  'Village|6|coast': '0e10afc7',
  'Village|6|island': 'ee285ecc',
  'Village|7|none': '98fa80ca',
  'Village|7|coast': '492cdf83',
  'Village|7|island': '77673c7a',
  'Village|8|none': 'b99bd28d',
  'Village|8|coast': '2ac489c8',
  'Village|8|island': 'ec4bfc16',
  'Village|9|none': '73e6b0d6',
  'Village|9|coast': 'ec6d3ec7',
  'Village|9|island': 'fc718013',
  'Village|10|none': '9e0932fb',
  'Village|10|coast': 'df8d4f77',
  'Village|10|island': '48ed4f29',
  'Village|11|none': 'b89c272a',
  'Village|11|coast': '87a35d90',
  'Village|11|island': '4af15fed',
  'Village|12|none': 'fdd6e1e4',
  'Village|12|coast': '9b7068e6',
  'Village|12|island': 'bfffbd2d',
  'Village|13|none': 'ebfde71d',
  'Village|13|coast': '8d04623b',
  'Village|13|island': '820773b5',
  'Village|14|none': 'f3dd539e',
  'Village|14|coast': '639709b1',
  'Village|14|island': '5290c3b6',
  'Village|15|none': 'cda67ce1',
  'Village|15|coast': '02298869',
  'Village|15|island': 'c8c8fa29',
  'Village|16|none': '8c521ee8',
  'Village|16|coast': 'c2ea726f',
  'Village|16|island': '030af23e',
  'Village|17|none': '545b2c50',
  'Village|17|coast': '87a00550',
  'Village|17|island': '23228af5',
  'Village|18|none': '22595bbc',
  'Village|18|coast': '2de6b83f',
  'Village|18|island': '500d6569',
  'Village|19|none': '3fab8e17',
  'Village|19|coast': '875b947d',
  'Village|19|island': '844430d2',
  'Village|20|none': '5a9ddee1',
  'Village|20|coast': '481b78d6',
  'Village|20|island': 'fed6154b',
  'Village|21|none': 'ff5a93e9',
  'Village|21|coast': '03cb18a2',
  'Village|21|island': '5daa16e5',
  'Village|22|none': '4f427d45',
  'Village|22|coast': '330b0d24',
  'Village|22|island': '74be41a1',
  'Village|23|none': '32bbcb84',
  'Village|23|coast': 'fd0f00de',
  'Village|23|island': '76a8c436',
  'Village|24|none': '90a39b02',
  'Village|24|coast': 'aa47f9a4',
  'Village|24|island': 'c29637c0',
  'Town|1|none': '68642999',
  'Town|1|coast': 'f18d9bdd',
  'Town|1|island': '881670ae',
  'Town|2|none': 'a10a335e',
  'Town|2|coast': 'e096103a',
  'Town|2|island': '92b19b1f',
  'Town|3|none': 'f4a0b727',
  'Town|3|coast': '01f6e50d',
  'Town|3|island': '0f02a80b',
  'Town|4|none': '39b3fcb8',
  'Town|4|coast': '8e4f70fc',
  'Town|4|island': 'fb968aca',
  'Town|5|none': 'a51a5570',
  'Town|5|coast': '6104d245',
  'Town|5|island': '9327708f',
  'Town|6|none': 'd80fc3a7',
  'Town|6|coast': 'de3a083f',
  'Town|6|island': 'c64d819b',
  'Town|7|none': '03c2c3a7',
  'Town|7|coast': '1a2ac6d0',
  'Town|7|island': 'bab58d02',
  'Town|8|none': '8b2e9a96',
  'Town|8|coast': '19ba1126',
  'Town|8|island': '3ae34e65',
  'Town|9|none': '36a19afd',
  'Town|9|coast': 'd14ee1c6',
  'Town|9|island': '0365ee1c',
  'Town|10|none': '3ea8ff5e',
  'Town|10|coast': '55c582a4',
  'Town|10|island': '8dc1adda',
  'Town|11|none': '6109fe61',
  'Town|11|coast': 'ea80cf79',
  'Town|11|island': 'd8d63aa4',
  'Town|12|none': '717fbee3',
  'Town|12|coast': '8fea2a28',
  'Town|12|island': 'b8eb3a6f',
  'Town|13|none': 'bdabd13f',
  'Town|13|coast': '029034b9',
  'Town|13|island': '82ae2ec6',
  'Town|14|none': 'a06d6a7b',
  'Town|14|coast': 'e4788dd5',
  'Town|14|island': '3661be06',
  'Town|15|none': '9aa8a444',
  'Town|15|coast': '426e5def',
  'Town|15|island': '119841b7',
  'Town|16|none': '963d1506',
  'Town|16|coast': 'ad9c1138',
  'Town|16|island': 'a4b55534',
  'Town|17|none': '2b54f59d',
  'Town|17|coast': '8b80eeac',
  'Town|17|island': '704e04f7',
  'Town|18|none': '91718624',
  'Town|18|coast': '7e86b2fc',
  'Town|18|island': '516a3628',
  'Town|19|none': '79308529',
  'Town|19|coast': 'fdf1d5f8',
  'Town|19|island': '22266708',
  'Town|20|none': '8652a1c7',
  'Town|20|coast': 'cf589fa3',
  'Town|20|island': '2ef19878',
  'Town|21|none': '066fb146',
  'Town|21|coast': '17eb2d87',
  'Town|21|island': 'e8bc999c',
  'Town|22|none': '0eb7153d',
  'Town|22|coast': '29ef6ae0',
  'Town|22|island': '9158fbf8',
  'Town|23|none': 'c66f3326',
  'Town|23|coast': 'd821e009',
  'Town|23|island': 'b62f7e18',
  'Town|24|none': '7c35f169',
  'Town|24|coast': '51e57ea4',
  'Town|24|island': 'c0cd0252',
  'City|1|none': 'a79541d5',
  'City|1|coast': '9bbadebe',
  'City|1|island': '20c57091',
  'City|2|none': '0aff5327',
  'City|2|coast': '5034179d',
  'City|2|island': '29203c20',
  'City|3|none': 'c8ec6461',
  'City|3|coast': '02d0055e',
  'City|3|island': 'cc8bf989',
  'City|4|none': 'c30033bd',
  'City|4|coast': '1bbd22af',
  'City|4|island': 'd72e1621',
  'City|5|none': '80f48bc3',
  'City|5|coast': '59c1c083',
  'City|5|island': '591fa6d7',
  'City|6|none': '94c17dfa',
  'City|6|coast': '1405782e',
  'City|6|island': 'd2b2b8cf',
  'City|7|none': 'b949b7d7',
  'City|7|coast': 'af2f0514',
  'City|7|island': 'f7fc6ff2',
  'City|8|none': 'a1fe24bb',
  'City|8|coast': '4cb0d958',
  'City|8|island': '14dfd8d4',
  'City|9|none': '59690424',
  'City|9|coast': '07e28dc7',
  'City|9|island': '34b418bc',
  'City|10|none': '82eb4b65',
  'City|10|coast': '1c9b7ce9',
  'City|10|island': 'a34f2525',
  'City|11|none': 'e7e3b1be',
  'City|11|coast': '40121401',
  'City|11|island': '1d983611',
  'City|12|none': '3175d5f4',
  'City|12|coast': '8a03172a',
  'City|12|island': '7474b096',
  'City|13|none': '4e452cae',
  'City|13|coast': 'cd754019',
  'City|13|island': '7f16eeb9',
  'City|14|none': 'd373ad43',
  'City|14|coast': '19c77c3a',
  'City|14|island': '3a0fb05d',
  'City|15|none': 'b95b1f3f',
  'City|15|coast': '08205b27',
  'City|15|island': 'ca4137c4',
  'City|16|none': '346a3afc',
  'City|16|coast': 'f917fc7f',
  'City|16|island': '563022e0',
  'City|17|none': 'e9e3078d',
  'City|17|coast': '6996a500',
  'City|17|island': 'c19f2cca',
  'City|18|none': '7711c78f',
  'City|18|coast': '6135edd4',
  'City|18|island': 'd72e408d',
  'City|19|none': '7a54a1e0',
  'City|19|coast': '5142a623',
  'City|19|island': '36256e4b',
  'City|20|none': '9b201c64',
  'City|20|coast': '2255fe41',
  'City|20|island': '988b18cb',
  'City|21|none': '8e0c5f33',
  'City|21|coast': 'f17bae85',
  'City|21|island': 'f53e2b68',
  'City|22|none': '603e747a',
  'City|22|coast': '2f19c5ff',
  'City|22|island': 'ab63fabf',
  'City|23|none': '0fecef0e',
  'City|23|coast': '87e72339',
  'City|23|island': '54383287',
  'City|24|none': '2ed8da79',
  'City|24|coast': '59a83016',
  'City|24|island': 'a9b49f5c',
  'Metropolis|1|none': 'ec9d55d9',
  'Metropolis|1|coast': 'a6a0ee92',
  'Metropolis|1|island': '0021e04e',
  'Metropolis|2|none': 'cdcdf2c8',
  'Metropolis|2|coast': 'c365047d',
  'Metropolis|2|island': '78e3b69a',
  'Metropolis|3|none': 'ff3a0bc1',
  'Metropolis|3|coast': 'd6f755c4',
  'Metropolis|3|island': '3255b6df',
  'Metropolis|4|none': 'd54a4ddf',
  'Metropolis|4|coast': 'd9527423',
  'Metropolis|4|island': 'a5ed232f',
  'Metropolis|5|none': '92c7069d',
  'Metropolis|5|coast': 'b79e5d20',
  'Metropolis|5|island': '42e114d7',
  'Metropolis|6|none': '91907c5d',
  'Metropolis|6|coast': '7d2addbc',
  'Metropolis|6|island': 'd629caf1',
  'Metropolis|7|none': 'cfa47888',
  'Metropolis|7|coast': '0eb0e2c0',
  'Metropolis|7|island': '38407afb',
  'Metropolis|8|none': 'd5c8d56b',
  'Metropolis|8|coast': '8abb8cd3',
  'Metropolis|8|island': '3603ca6c',
  'Metropolis|9|none': '229b1316',
  'Metropolis|9|coast': 'ff3899d9',
  'Metropolis|9|island': 'b21351c6',
  'Metropolis|10|none': '0f0aa7dc',
  'Metropolis|10|coast': 'b8b3ed57',
  'Metropolis|10|island': '71b2acad',
  'Metropolis|11|none': '6869c26a',
  'Metropolis|11|coast': '5c9265b5',
  'Metropolis|11|island': '392c59b6',
  'Metropolis|12|none': '429a21d6',
  'Metropolis|12|coast': '1ff8eefa',
  'Metropolis|12|island': '5ecc8ee4',
  'Metropolis|13|none': '2e42a7d6',
  'Metropolis|13|coast': 'e141bc42',
  'Metropolis|13|island': 'a05c0880',
  'Metropolis|14|none': '5b00e015',
  'Metropolis|14|coast': '462dd84f',
  'Metropolis|14|island': '630bee15',
  'Metropolis|15|none': 'f27dbd2d',
  'Metropolis|15|coast': '3c54b42a',
  'Metropolis|15|island': '5e9f794d',
  'Metropolis|16|none': 'd6f5a479',
  'Metropolis|16|coast': '3a4f83e8',
  'Metropolis|16|island': 'b5f11888',
  'Metropolis|17|none': '1c232ec0',
  'Metropolis|17|coast': 'd8746882',
  'Metropolis|17|island': '564eecab',
  'Metropolis|18|none': '0231743f',
  'Metropolis|18|coast': '1c00b027',
  'Metropolis|18|island': '9f90add1',
  'Metropolis|19|none': 'e65ec9a1',
  'Metropolis|19|coast': 'c8ef731a',
  'Metropolis|19|island': '90712f9c',
  'Metropolis|20|none': '7bfcdf2b',
  'Metropolis|20|coast': '09c3337d',
  'Metropolis|20|island': '8e2c9c53',
  'Metropolis|21|none': 'f70b8d6a',
  'Metropolis|21|coast': 'be89a455',
  'Metropolis|21|island': '033a59f2',
  'Metropolis|22|none': 'b3b1f8dc',
  'Metropolis|22|coast': 'c549284b',
  'Metropolis|22|island': '4e5dd92d',
  'Metropolis|23|none': '2d7160cd',
  'Metropolis|23|coast': 'e83712d7',
  'Metropolis|23|island': '930a63d5',
  'Metropolis|24|none': 'caff6cdb',
  'Metropolis|24|coast': 'ac1accf8',
  'Metropolis|24|island': 'e393c898',
}

describe('pre-item-2 baseline: coast-only, no-water and island towns are byte-identical', () => {
  it.runIf(PRINT)('print baseline', () => {
    const lines: string[] = []
    for (const type of TYPES) for (let seed = 1; seed <= 24; seed++) for (const label of LABELS) {
      lines.push(`  '${type}|${seed}|${label}': '${fnv(JSON.stringify(planFor(type, seed, label)))}',`)
    }
    console.log(lines.join('\n'))
  }, 60000)

  it.skipIf(PRINT).each(Object.keys(BASELINE))('%s', (key) => {
    const [type, seed, label] = key.split('|')
    expect(fnv(JSON.stringify(planFor(type as SettlementType, Number(seed), label)))).toBe(BASELINE[key])
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
