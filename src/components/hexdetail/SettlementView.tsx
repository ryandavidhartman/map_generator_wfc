import { useMemo, useState } from 'react'
import { useMapDispatch, useMapState } from '../../state/MapContext'
import type { Hex } from '../../state/mapReducer'
import type { Settlement, District } from '../../engine/generateSettlement'
import { SettlementMapSvg, type SettlementMapDistrictData } from '../../hexgrid/SettlementMapSvg'
import { computeSettlementPlan, waterForMapHex, type OutlineShape, type PlanWater, type StreetPattern } from '../../engine/settlementPlan'
import { DISTRICT_TYPE_TO_ENCOUNTER_KEY } from '../../data/encounterTables'
import { generateTavern, type Tavern } from '../../engine/generateTavern'
import { generateShop, type Shop } from '../../engine/generateShop'
import type { ShopTier } from '../../data/settlementTables'
import type { DistrictType } from '../../data/settlementTables'
import { HexBaseInfo } from './HexBaseInfo'
import { EncounterRoller } from '../EncounterRoller'
import { PricesPanel } from './PricesPanel'
import { CivicAmenitiesPanel } from './CivicAmenitiesPanel'

const SHAPE_LABEL: Record<OutlineShape, string> = {
  round: 'round',
  angular: 'angular fortified walls',
  elongated: 'stretched along its main road',
}
const PATTERN_LABEL: Record<StreetPattern, string> = {
  organic: 'organic streets',
  grid: 'planned street grid',
  gridCore: 'planned grid core with organic outskirts',
  oldTown: 'old town inside an inner wall',
}

// Compass name for a map direction (radians, y down: -90° is north).
function compass(angle: number): string {
  const names = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']
  const index = Math.round(((angle * 180) / Math.PI + 360) / 45) % 8
  return names[index]
}

function waterLabel(water: PlanWater): string {
  return water.kind === 'coast' ? `coast, sea to the ${compass(water.angle)}` : `river flowing ${compass(water.angle)}`
}

function defaultShopTierForDistrict(type: DistrictType): ShopTier {
  if (type === 'Slums' || type === 'Low District') return 'Poor'
  if (type === 'High District' || type === 'Castle District') return 'Wealthy'
  return 'Standard'
}

export function SettlementView({ hex, site }: { hex: Hex; site: Settlement }) {
  const dispatch = useMapDispatch()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggle(id: string) {
    setExpandedId((current) => (current === id ? null : id))
  }

  // The water follows the hex (user rule): its own terrain plus its revealed neighbors, each
  // with its direction from this hex on the overland map.
  const mapState = useMapState()
  const water = useMemo(() => waterForMapHex(hex, mapState.hexes), [hex, mapState.hexes])
  const plan = useMemo(
    () =>
      computeSettlementPlan({
        water,
        settlementType: site.settlementType,
        districts: site.districts,
        seedSource: `${site.settlementType}|${site.population}|${site.districts.map((d) => `${d.id}:${d.districtTypeRoll}`).join('|')}`,
      }),
    [site, water],
  )
  const districtData: Record<string, SettlementMapDistrictData> = Object.fromEntries(
    site.districts.map((d) => [d.id, { label: String(d.index + 1), isSeat: d.isSeatOfGovernment }]),
  )

  return (
    <div className="site-view">
      <HexBaseInfo hex={hex} />

      <section className="site-section">
        <div className="site-section-header">
          <h3>
            {site.settlementType}
            {hex.poi?.settlementName ? `: ${hex.poi.settlementName}` : ''}
          </h3>
          <button type="button" onClick={() => dispatch({ type: 'REROLL_SITE', hexId: hex.id })}>
            Reroll Site
          </button>
        </div>

        <p className="settlement-summary">
          Population: {site.population.toLocaleString()} — Government: {site.government.authority}
        </p>
        <p className="settlement-summary-notes">{site.government.notes}</p>

        <p className="settlement-summary-notes">
          Layout: {SHAPE_LABEL[plan.shape]}, {PATTERN_LABEL[plan.pattern]}
          {plan.water && `; ${waterLabel(plan.water)}`}
        </p>

        <div className="site-layout paper-layout">
          <SettlementMapSvg plan={plan} districts={districtData} selectedDistrictId={expandedId} onSelectDistrict={toggle} />
        </div>

        <ul className="district-list">
          {site.districts.map((district) => (
            <DistrictListItem
              key={district.id}
              district={district}
              expanded={expandedId === district.id}
              onToggle={() => toggle(district.id)}
              hexDangerLevel={hex.dangerLevel ?? 1}
            />
          ))}
        </ul>

        <CivicAmenitiesPanel amenities={site.amenities} />
        <PricesPanel />
      </section>
    </div>
  )
}

function DistrictListItem({
  district,
  expanded,
  onToggle,
  hexDangerLevel,
}: {
  district: District
  expanded: boolean
  onToggle: () => void
  hexDangerLevel: number
}) {
  const [tavern, setTavern] = useState<Tavern | null>(null)
  const [shop, setShop] = useState<Shop | null>(null)

  return (
    <li data-district-id={district.id} className={district.isSeatOfGovernment ? 'seat-of-government' : undefined}>
      <button type="button" className="district-toggle" onClick={onToggle}>
        District {district.index + 1}: {district.districtType}
        {district.isSeatOfGovernment && ' (Seat of Government)'}
      </button>
      {expanded && (
        <div className="district-detail">
          <p>
            <strong>Alignment:</strong> {district.alignment}
          </p>
          <ul>
            {district.pointsOfInterest.map((poi, i) => (
              <li key={i}>
                {poi.text}
                <br />
                <span className="npc-flavor">
                  {poi.npc.race} {poi.npc.profession}
                  {poi.npc.nobleClass && poi.npc.nobleClass !== 'Normal Human' && ` (${poi.npc.nobleClass} ${poi.npc.nobleLevel})`}
                  {' — '}
                  {poi.npc.activityTier.tier} ({poi.npc.activityTier.hitDice} hp, {poi.npc.activityTier.combatAbility})
                </span>
              </li>
            ))}
          </ul>

          <EncounterRoller
            tableKeys={[DISTRICT_TYPE_TO_ENCOUNTER_KEY[district.districtType], 'OSR Urban (Daytime)', 'OSR Urban (Nighttime)']}
            hexDangerLevel={hexDangerLevel}
          />

          <div className="district-actions">
            <button type="button" onClick={() => setTavern(generateTavern())}>
              Generate Tavern
            </button>
            <button type="button" onClick={() => setShop(generateShop(defaultShopTierForDistrict(district.districtType)))}>
              Generate Shop
            </button>
          </div>

          {tavern && (
            <div className="generated-tavern">
              <strong>{tavern.name}</strong> ({tavern.sizeTier}) — {tavern.knownFor}
              <p>Food: {tavern.food}</p>
              <p>Drink: {tavern.drink}</p>
            </div>
          )}

          {shop && (
            <div className="generated-shop">
              <strong>{shop.name}</strong> — {shop.shopType}
              <p>{shop.knownFor}</p>
              <p>Notable customer: {shop.interestingCustomer}</p>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
