import type { ResolvedLocation } from '../calculation/types'

export type OfflineCity = Omit<ResolvedLocation, 'source'>

export const offlineCities: OfflineCity[] = [
  {
    id: 'makkah-sa',
    label: 'Makkah, Saudi Arabia',
    latitude: 21.3891,
    longitude: 39.8579,
    timezone: 'Asia/Riyadh',
    countryCode: 'SA',
  },
  {
    id: 'madinah-sa',
    label: 'Madinah, Saudi Arabia',
    latitude: 24.5247,
    longitude: 39.5692,
    timezone: 'Asia/Riyadh',
    countryCode: 'SA',
  },
  {
    id: 'new-york-us',
    label: 'New York, United States',
    latitude: 40.7128,
    longitude: -74.006,
    timezone: 'America/New_York',
    countryCode: 'US',
  },
  {
    id: 'london-gb',
    label: 'London, United Kingdom',
    latitude: 51.5072,
    longitude: -0.1276,
    timezone: 'Europe/London',
    countryCode: 'GB',
  },
  {
    id: 'jakarta-id',
    label: 'Jakarta, Indonesia',
    latitude: -6.2088,
    longitude: 106.8456,
    timezone: 'Asia/Jakarta',
    countryCode: 'ID',
  },
  {
    id: 'istanbul-tr',
    label: 'Istanbul, Turkiye',
    latitude: 41.0082,
    longitude: 28.9784,
    timezone: 'Europe/Istanbul',
    countryCode: 'TR',
  },
  {
    id: 'karachi-pk',
    label: 'Karachi, Pakistan',
    latitude: 24.8607,
    longitude: 67.0011,
    timezone: 'Asia/Karachi',
    countryCode: 'PK',
  },
  {
    id: 'kuala-lumpur-my',
    label: 'Kuala Lumpur, Malaysia',
    latitude: 3.139,
    longitude: 101.6869,
    timezone: 'Asia/Kuala_Lumpur',
    countryCode: 'MY',
  },
]

export function searchOfflineCities(query: string, limit = 6): ResolvedLocation[] {
  const normalizedQuery = query.trim().toLowerCase()
  const matches = normalizedQuery
    ? offlineCities.filter((city) => city.label.toLowerCase().includes(normalizedQuery))
    : offlineCities

  return matches.slice(0, limit).map((city) => ({
    ...city,
    source: 'offline-city',
  }))
}

export function defaultLocation(): ResolvedLocation {
  const [city] = offlineCities

  if (!city) {
    throw new Error('Salah requires at least one bundled offline city.')
  }

  return {
    ...city,
    source: 'offline-city',
  }
}
