import { createHash } from 'node:crypto'
import {
  CalculationMethod,
  Coordinates as AdhanCoordinates,
  Madhab,
  PrayerTimes,
} from 'adhan'
import {
  prayerLabels,
  prayerNames,
  type DailyPrayerSchedule,
  type DeviceLocation,
  type DeviceRecord,
  type DeviceSettings,
  type PrayerActivityWindow,
  type PrayerScheduleSnapshot,
  type PrayerTimeEntry,
} from './types.js'

export function calculatePrayerSchedule(
  location: DeviceLocation,
  timezone: string,
  settings: DeviceSettings,
  now: Date = new Date(),
): PrayerScheduleSnapshot {
  return {
    generatedAt: now.toISOString(),
    timezone,
    today: calculateDailySchedule(location, timezone, settings, now),
    tomorrow: calculateDailySchedule(location, timezone, settings, addDays(now, 1)),
  }
}

export function currentPrayerWindow(
  device: Pick<DeviceRecord, 'id' | 'location'>,
  schedule: PrayerScheduleSnapshot,
  now: Date = new Date(),
): PrayerActivityWindow | undefined {
  const entries = schedule.today.entries

  for (const [index, entry] of entries.entries()) {
    const nextEntry = entries[index + 1] ?? schedule.tomorrow.entries[0]

    if (!nextEntry) {
      continue
    }

    const startTime = new Date(entry.time)
    const endTime = new Date(nextEntry.time)

    if (startTime <= now && now < endTime) {
      return {
        activityId: activityIdForWindow(device.id, entry.name, startTime),
        prayerName: entry.name,
        prayerLabel: entry.label,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        locationLabel: device.location.label,
      }
    }
  }

  return undefined
}

export function isTerminalActionState(state: string): boolean {
  return state === 'prayed' || state === 'ignored' || state === 'ended'
}

function calculateDailySchedule(
  location: DeviceLocation,
  timezone: string,
  settings: DeviceSettings,
  date: Date,
): DailyPrayerSchedule {
  const coordinates = new AdhanCoordinates(location.latitude, location.longitude)
  const parameters = CalculationMethod[settings.calculationMethod]()
  parameters.madhab = settings.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi

  const prayerTimes = new PrayerTimes(coordinates, date, parameters)
  const entries: PrayerTimeEntry[] = prayerNames.map((name) => {
    const time = prayerTimes[name]

    return {
      name,
      label: prayerLabels[name],
      time: time.toISOString(),
      formatted: formatPrayerTime(time, timezone, settings.timeFormat),
    }
  })

  return {
    date: dateKey(date, timezone),
    entries,
  }
}

function activityIdForWindow(deviceId: string, prayerName: string, startTime: Date): string {
  const digest = createHash('sha256')
    .update(`${deviceId}:${prayerName}:${startTime.toISOString()}`)
    .digest('hex')
    .slice(0, 32)

  return `act_${digest}`
}

function formatPrayerTime(date: Date, timezone: string, timeFormat: DeviceSettings['timeFormat']): string {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: timeFormat === '12h',
    timeZone: timezone,
  }).format(date)
}

function dateKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  }).format(date)
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)
  return nextDate
}
