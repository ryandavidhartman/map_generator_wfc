import { describe, expect, it } from 'vitest'
import { generateSiteForHex } from './generateSite'
import type { PointOfInterest } from './generateHex'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('generateSiteForHex', () => {
  it('returns undefined for a siteKind of "none" (Cataclysm/Natural landmark rows)', () => {
    const poi: PointOfInterest = { location: 'Cataclysm', development: '', cataclysm: 'Volcano', siteKind: 'none' }
    expect(generateSiteForHex(poi, seededRng(1))).toBeUndefined()
  })

  it.each([
    ['settlement', 'Village'],
    ['dungeon', 'Cave'],
    ['tower', undefined],
    ['shrine', undefined],
    ['rift', undefined],
    ['keep', undefined],
    ['camp', undefined],
  ] as const)('dispatches siteKind %s to a matching GeneratedSite', (siteKind, forcedType) => {
    const poi: PointOfInterest = { location: 'test', development: '', siteKind, forcedType }
    const site = generateSiteForHex(poi, seededRng(1))
    expect(site?.kind).toBe(siteKind)
  })

  it('passes forcedType through to the dungeon generator as the Site Type', () => {
    const poi: PointOfInterest = { location: 'Deep tunnels', development: '', siteKind: 'dungeon', forcedType: 'Deep tunnels' }
    const site = generateSiteForHex(poi, seededRng(1))
    expect(site?.kind).toBe('dungeon')
    if (site?.kind === 'dungeon') expect(site.siteType).toBe('Deep tunnels')
  })

  it('passes forcedType through to the settlement generator as the Settlement Type', () => {
    const poi: PointOfInterest = { location: 'Metropolis', development: '', siteKind: 'settlement', forcedType: 'Metropolis' }
    const site = generateSiteForHex(poi, seededRng(1))
    expect(site?.kind).toBe('settlement')
    if (site?.kind === 'settlement') expect(site.settlementType).toBe('Metropolis')
  })

  // Legacy fallback: POIs with no siteKind (e.g. created via the manual hex-edit form) route via
  // the old location-text heuristic that predates the Location Generator.
  describe('legacy fallback (no siteKind set)', () => {
    it('dispatches to a settlement for a settlement-type POI location', () => {
      const poi: PointOfInterest = { location: 'Village', development: 'Abandoned and in ruins' }
      const site = generateSiteForHex(poi, seededRng(1))
      expect(site?.kind).toBe('settlement')
    })

    it('dispatches to a dungeon site for a non-settlement POI location', () => {
      const poi: PointOfInterest = { location: 'Barrow mounds', development: 'Around/over a sleeping dragon' }
      const site = generateSiteForHex(poi, seededRng(1))
      expect(site?.kind).toBe('dungeon')
    })
  })
})
