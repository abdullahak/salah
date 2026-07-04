import { describe, expect, it } from 'vitest'
import { defaultLocation, searchOfflineCities } from './cities'

describe('offline city search', () => {
  it('returns bundled cities without network access', () => {
    expect(searchOfflineCities('new')).toContainEqual(
      expect.objectContaining({
        label: 'New York, United States',
        source: 'offline-city',
      }),
    )
  })

  it('includes major metro areas across regions', () => {
    expect(searchOfflineCities('melbourne')).toContainEqual(
      expect.objectContaining({
        label: 'Melbourne, Australia',
        timezone: 'Australia/Melbourne',
      }),
    )
    expect(searchOfflineCities('san francisco')).toContainEqual(
      expect.objectContaining({
        label: 'San Francisco, United States',
        timezone: 'America/Los_Angeles',
      }),
    )
  })

  it('uses Makkah as the default location', () => {
    expect(defaultLocation()).toEqual(
      expect.objectContaining({
        label: 'Makkah, Saudi Arabia',
        countryCode: 'SA',
      }),
    )
  })
})
