import { describe, expect, it } from 'vitest'
import { WEAPONS, ARMOR, GENERAL_EQUIPMENT, FOOD_AND_LODGING, SERVICES, TAVERN_MEALS, TAVERN_DRINKS } from './equipmentTables'

describe('Equipment & Services reference tables', () => {
  it.each([
    ['WEAPONS', WEAPONS],
    ['ARMOR', ARMOR],
    ['GENERAL_EQUIPMENT', GENERAL_EQUIPMENT],
    ['FOOD_AND_LODGING', FOOD_AND_LODGING],
    ['SERVICES', SERVICES],
    ['TAVERN_MEALS', TAVERN_MEALS],
  ] as const)('%s is non-empty and every entry has an item + price', (_name, table) => {
    expect(table.length).toBeGreaterThan(0)
    for (const entry of table) {
      expect(entry.item).toBeTruthy()
      expect(entry.price).toBeTruthy()
    }
  })

  it('TAVERN_DRINKS entries have an item and at least one price column', () => {
    expect(TAVERN_DRINKS.length).toBeGreaterThan(0)
    for (const entry of TAVERN_DRINKS) {
      expect(entry.item).toBeTruthy()
      expect(entry.byDrink ?? entry.byPitcherOrGallon ?? entry.byBottle).toBeTruthy()
    }
  })
})
