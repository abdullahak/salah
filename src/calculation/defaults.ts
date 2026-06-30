import type { CalculationMethodId, MadhabId, PrayerSettings, TimeFormat } from './types'

const COUNTRY_METHODS: Record<string, CalculationMethodId> = {
  AE: 'Dubai',
  BH: 'Kuwait',
  EG: 'Egyptian',
  ID: 'Singapore',
  IN: 'Karachi',
  JO: 'MuslimWorldLeague',
  KW: 'Kuwait',
  MY: 'Singapore',
  PK: 'Karachi',
  QA: 'Qatar',
  SA: 'UmmAlQura',
  SG: 'Singapore',
  TR: 'Turkey',
  US: 'NorthAmerica',
}

const HANAFI_COUNTRIES = new Set(['AF', 'BD', 'IN', 'PK', 'TR'])

export const defaultPrayerSettings: PrayerSettings = {
  calculationMethod: 'MuslimWorldLeague',
  madhab: 'shafi',
  timeFormat: '12h',
}

export function defaultMethodForCountry(countryCode?: string): CalculationMethodId {
  if (!countryCode) {
    return defaultPrayerSettings.calculationMethod
  }

  return COUNTRY_METHODS[countryCode.toUpperCase()] ?? defaultPrayerSettings.calculationMethod
}

export function defaultMadhabForCountry(countryCode?: string): MadhabId {
  if (!countryCode) {
    return defaultPrayerSettings.madhab
  }

  return HANAFI_COUNTRIES.has(countryCode.toUpperCase()) ? 'hanafi' : 'shafi'
}

export function defaultSettingsForCountry(countryCode?: string): PrayerSettings {
  return {
    calculationMethod: defaultMethodForCountry(countryCode),
    madhab: defaultMadhabForCountry(countryCode),
    timeFormat: defaultPrayerSettings.timeFormat,
  }
}

export function isTimeFormat(value: string): value is TimeFormat {
  return value === '12h' || value === '24h'
}
