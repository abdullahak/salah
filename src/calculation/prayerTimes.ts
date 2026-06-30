import {
  CalculationMethod,
  Coordinates as AdhanCoordinates,
  Madhab,
  PrayerTimes,
  Qibla,
} from 'adhan'
import type {
  Coordinates,
  PrayerName,
  PrayerSettings,
  PrayerTime,
  TimeFormat,
} from './types'

const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
}

const PRAYER_ORDER: PrayerName[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']

export function calculatePrayerTimes(
  coordinates: Coordinates,
  date: Date,
  settings: PrayerSettings,
  timezone: string,
): PrayerTime[] {
  const adhanCoordinates = new AdhanCoordinates(coordinates.latitude, coordinates.longitude)
  const parameters = CalculationMethod[settings.calculationMethod]()
  parameters.madhab = settings.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi

  const prayerTimes = new PrayerTimes(adhanCoordinates, date, parameters)

  return PRAYER_ORDER.map((name) => {
    const time = prayerTimes[name]

    return {
      name,
      label: PRAYER_LABELS[name],
      time,
      formatted: formatPrayerTime(time, timezone, settings.timeFormat),
    }
  })
}

export function calculateQiblahBearing(coordinates: Coordinates): number {
  const adhanCoordinates = new AdhanCoordinates(coordinates.latitude, coordinates.longitude)
  return normalizeBearing(Qibla(adhanCoordinates))
}

export function formatPrayerTime(date: Date, timezone: string, timeFormat: TimeFormat): string {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: timeFormat === '12h',
    timeZone: timezone,
  }).format(date)
}

export function formatBearing(bearing: number): string {
  return `${Math.round(normalizeBearing(bearing))}°`
}

function normalizeBearing(bearing: number): number {
  return ((bearing % 360) + 360) % 360
}
