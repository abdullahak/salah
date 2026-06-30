import { describe, expect, it } from 'vitest'
import { defaultSettingsForCountry } from './defaults'
import { calculatePrayerTimes, calculateQiblahBearing, formatBearing } from './prayerTimes'
import type { ResolvedLocation } from './types'

const locations: ResolvedLocation[] = [
  {
    id: 'makkah-sa',
    label: 'Makkah, Saudi Arabia',
    latitude: 21.3891,
    longitude: 39.8579,
    timezone: 'Asia/Riyadh',
    countryCode: 'SA',
    source: 'offline-city',
  },
  {
    id: 'new-york-us',
    label: 'New York, United States',
    latitude: 40.7128,
    longitude: -74.006,
    timezone: 'America/New_York',
    countryCode: 'US',
    source: 'offline-city',
  },
  {
    id: 'london-gb',
    label: 'London, United Kingdom',
    latitude: 51.5072,
    longitude: -0.1276,
    timezone: 'Europe/London',
    countryCode: 'GB',
    source: 'offline-city',
  },
  {
    id: 'jakarta-id',
    label: 'Jakarta, Indonesia',
    latitude: -6.2088,
    longitude: 106.8456,
    timezone: 'Asia/Jakarta',
    countryCode: 'ID',
    source: 'offline-city',
  },
]

describe('calculatePrayerTimes', () => {
  it.each(locations)('calculates the six daily prayer entries for $label', (location) => {
    const prayers = calculatePrayerTimes(
      location,
      new Date('2026-06-30T12:00:00Z'),
      defaultSettingsForCountry(location.countryCode),
      location.timezone,
    )

    expect(prayers.map((prayer) => prayer.name)).toEqual([
      'fajr',
      'sunrise',
      'dhuhr',
      'asr',
      'maghrib',
      'isha',
    ])
    expect(prayers.every((prayer) => prayer.time instanceof Date)).toBe(true)
    expect(prayers.every((prayer) => prayer.formatted.length > 0)).toBe(true)
  })

  it('uses the requested time format', () => {
    const location = locations[1]

    if (!location) {
      throw new Error('Expected New York fixture')
    }

    const settings = defaultSettingsForCountry(location.countryCode)
    const prayers = calculatePrayerTimes(
      location,
      new Date('2026-06-30T12:00:00Z'),
      { ...settings, timeFormat: '24h' },
      location.timezone,
    )

    expect(prayers[0]?.formatted).toMatch(/\d{1,2}:\d{2}/)
    expect(prayers[0]?.formatted.toLowerCase()).not.toMatch(/am|pm/)
  })
})

describe('calculateQiblahBearing', () => {
  it('returns a stable known bearing for Makkah city', () => {
    const location = locations[0]

    if (!location) {
      throw new Error('Expected Makkah fixture')
    }

    expect(Math.round(calculateQiblahBearing(location))).toBe(319)
  })

  it('returns a stable known bearing for New York', () => {
    const location = locations[1]

    if (!location) {
      throw new Error('Expected New York fixture')
    }

    expect(Math.round(calculateQiblahBearing(location))).toBe(58)
    expect(formatBearing(calculateQiblahBearing(location))).toBe('58°')
  })
})
