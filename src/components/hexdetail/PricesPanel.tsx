import { useState } from 'react'
import { WEAPONS, ARMOR, GENERAL_EQUIPMENT, FOOD_AND_LODGING, SERVICES, TAVERN_MEALS, TAVERN_DRINKS, type PriceEntry } from '../../data/equipmentTables'

// A GM-facing price reference, not a roll — see data/equipmentTables.ts. Collapsed by default
// since it's reference material, not something rolled per settlement.
export function PricesPanel() {
  const [open, setOpen] = useState(false)

  return (
    <details className="prices-panel" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Equipment &amp; Services Prices</summary>
      {open && (
        <div className="prices-panel-content">
          <PriceTable title="Weapons" entries={WEAPONS} />
          <PriceTable title="Armor" entries={ARMOR} />
          <PriceTable title="General Equipment" entries={GENERAL_EQUIPMENT} />
          <PriceTable title="Food & Lodging" entries={FOOD_AND_LODGING} />
          <PriceTable title="Services" entries={SERVICES} />
          <PriceTable title="Tavern Meals" entries={TAVERN_MEALS} />
          <div className="price-table">
            <h4>Tavern Drinks</h4>
            <table>
              <thead>
                <tr>
                  <th>Drink</th>
                  <th>By the Drink</th>
                  <th>By Pitcher/Gallon</th>
                  <th>By the Bottle</th>
                </tr>
              </thead>
              <tbody>
                {TAVERN_DRINKS.map((d) => (
                  <tr key={d.item}>
                    <td>{d.item}</td>
                    <td>{d.byDrink ?? '—'}</td>
                    <td>{d.byPitcherOrGallon ?? '—'}</td>
                    <td>{d.byBottle ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </details>
  )
}

function PriceTable({ title, entries }: { title: string; entries: PriceEntry[] }) {
  return (
    <div className="price-table">
      <h4>{title}</h4>
      <table>
        <tbody>
          {entries.map((e) => (
            <tr key={e.item}>
              <td>{e.item}</td>
              <td>{e.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
