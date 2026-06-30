import { describe, expect, it } from 'vitest'
import { defaultLocation, searchOfflineCities } from './cities'

describe('offline city search', () => {
  it('returns bundled cities without network access', () => {
    expect(searchOfflineCities('new')).toEqual([
      expect.objectContaining({
        label: 'New York, United States',
        source: 'offline-city',
      }),
    ])
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
