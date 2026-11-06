import { useState } from 'react'
import type { CivicAmenity, CivicAmenityStaff } from '../../engine/generateCivicAmenities'
import type { SettlementNpc } from '../../data/npcTables'

function describeNpc(npc: SettlementNpc): string {
  const noble = npc.nobleClass && npc.nobleClass !== 'Normal Human' ? ` (${npc.nobleClass} ${npc.nobleLevel})` : ''
  return `${npc.race} ${npc.profession}${noble} — ${npc.activityTier.tier}`
}

function describeStaff(staff: CivicAmenityStaff): string {
  switch (staff.kind) {
    case 'npc':
      return describeNpc(staff.npc)
    case 'vendors':
      return staff.npcs.map(describeNpc).join('; ')
    case 'leveledNpc':
      return `Level ${staff.level} ${staff.npcClass}`
    case 'noble':
      return staff.nobleLevel ? `${staff.nobleClass} (Level ${staff.nobleLevel})` : staff.nobleClass
    case 'flavor':
      return staff.text
  }
}

// Settlement-level civic amenities (Appendix E, round 2 Phase 6) — additive to, and separate
// from, the per-district points of interest shown in each district's own expanded view.
// Collapsed by default, same UI pattern as PricesPanel (a GM opens it when it's wanted).
export function CivicAmenitiesPanel({ amenities }: { amenities: CivicAmenity[] }) {
  const [open, setOpen] = useState(false)

  return (
    <details className="prices-panel" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Civic Amenities ({amenities.length})</summary>
      {open && (
        <ul className="civic-amenity-list">
          {amenities.map((amenity) => (
            <li key={amenity.id}>
              <strong>{amenity.type}</strong>
              <br />
              <span className="npc-flavor">{describeStaff(amenity.staff)}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
