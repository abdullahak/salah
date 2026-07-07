export const calculationMethodIds = [
  'MuslimWorldLeague',
  'Egyptian',
  'Karachi',
  'UmmAlQura',
  'Dubai',
  'MoonsightingCommittee',
  'NorthAmerica',
  'Kuwait',
  'Qatar',
  'Singapore',
  'Tehran',
  'Turkey',
] as const

export type CalculationMethodId = (typeof calculationMethodIds)[number]

export const madhabIds = ['shafi', 'hanafi'] as const

export type MadhabId = (typeof madhabIds)[number]

export const timeFormats = ['12h', '24h'] as const

export type TimeFormat = (typeof timeFormats)[number]

export const prayerNames = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const

export type PrayerName = (typeof prayerNames)[number]

export const prayerLabels: Record<PrayerName, string> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
}

export const tokenEnvironments = ['sandbox', 'production'] as const

export type TokenEnvironment = (typeof tokenEnvironments)[number]

export const actionStates = ['active', 'prayed', 'snoozed', 'ignored', 'ended'] as const

export type ActivityActionState = (typeof actionStates)[number]

export type Coordinates = {
  latitude: number
  longitude: number
}

export type DeviceLocation = Coordinates & {
  label: string
}

export type DeviceSettings = {
  calculationMethod: CalculationMethodId
  madhab: MadhabId
  timeFormat: TimeFormat
  snoozeDurationMinutes: number
}

export const defaultDeviceSettings: DeviceSettings = {
  calculationMethod: 'MuslimWorldLeague',
  madhab: 'shafi',
  timeFormat: '12h',
  snoozeDurationMinutes: 10,
}

export type PrayerTimeEntry = {
  name: PrayerName
  label: string
  time: string
  formatted: string
}

export type DailyPrayerSchedule = {
  date: string
  entries: PrayerTimeEntry[]
}

export type PrayerScheduleSnapshot = {
  generatedAt: string
  timezone: string
  today: DailyPrayerSchedule
  tomorrow: DailyPrayerSchedule
}

export type PrayerActivityWindow = {
  activityId: string
  prayerName: PrayerName
  prayerLabel: string
  startTime: string
  endTime: string
  locationLabel: string
}

export type ActiveActivityRecord = {
  activityId: string
  prayerName: PrayerName
  startTime: string
  endTime: string
}

export type DeviceRecord = {
  id: string
  createdAt: string
  updatedAt: string
  location: DeviceLocation
  timezone: string
  settings: DeviceSettings
  tokenEnvironment: TokenEnvironment
  pushToStartToken?: string
  updateToken?: string
  latestSchedule?: PrayerScheduleSnapshot
  activeActivity?: ActiveActivityRecord
}

export type PrayerActionRecord = {
  activityId: string
  deviceId: string
  prayerName: PrayerName
  state: ActivityActionState
  snoozeUntil?: string
  createdAt: string
  updatedAt: string
}

export type ApnsEventRecord = {
  id: string
  deviceId: string
  activityId: string
  eventType: 'start' | 'update' | 'end'
  status: 'sent' | 'skipped' | 'failed'
  createdAt: string
  payloadJson: string
  error?: string
}

export function isCalculationMethodId(value: unknown): value is CalculationMethodId {
  return typeof value === 'string' && calculationMethodIds.includes(value as CalculationMethodId)
}

export function isMadhabId(value: unknown): value is MadhabId {
  return typeof value === 'string' && madhabIds.includes(value as MadhabId)
}

export function isTimeFormat(value: unknown): value is TimeFormat {
  return typeof value === 'string' && timeFormats.includes(value as TimeFormat)
}

export function isTokenEnvironment(value: unknown): value is TokenEnvironment {
  return typeof value === 'string' && tokenEnvironments.includes(value as TokenEnvironment)
}

export function isPrayerName(value: unknown): value is PrayerName {
  return typeof value === 'string' && prayerNames.includes(value as PrayerName)
}
