export type CalculationMethodId =
  | 'MuslimWorldLeague'
  | 'Egyptian'
  | 'Karachi'
  | 'UmmAlQura'
  | 'Dubai'
  | 'MoonsightingCommittee'
  | 'NorthAmerica'
  | 'Kuwait'
  | 'Qatar'
  | 'Singapore'
  | 'Tehran'
  | 'Turkey'

export type MadhabId = 'shafi' | 'hanafi'

export type TimeFormat = '12h' | '24h'

export type Coordinates = {
  latitude: number
  longitude: number
}

export type ResolvedLocation = Coordinates & {
  id: string
  label: string
  timezone: string
  countryCode?: string
  source: 'offline-city' | 'manual-coordinates' | 'browser-geolocation'
}

export type PrayerSettings = {
  calculationMethod: CalculationMethodId
  madhab: MadhabId
  timeFormat: TimeFormat
}

export type PrayerName =
  | 'fajr'
  | 'sunrise'
  | 'dhuhr'
  | 'asr'
  | 'maghrib'
  | 'isha'

export type PrayerTime = {
  name: PrayerName
  label: string
  time: Date
  formatted: string
}
