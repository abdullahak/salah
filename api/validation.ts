import {
  defaultDeviceSettings,
  isCalculationMethodId,
  isMadhabId,
  isTimeFormat,
  isTokenEnvironment,
  type DeviceLocation,
  type DeviceSettings,
  type TokenEnvironment,
} from './types.js'

export class HttpError extends Error {
  readonly statusCode: number

  constructor(
    message: string,
    statusCode: number,
  ) {
    super(message)
    this.statusCode = statusCode
  }
}

export function parseRegistrationBody(body: unknown): {
  deviceId?: string
  location: DeviceLocation
  timezone: string
  settings: DeviceSettings
  tokenEnvironment: TokenEnvironment
} {
  const object = requireObject(body)
  const location = parseLocation(object.location)
  const timezone = parseTimezone(object.timezone)

  const parsed: {
    deviceId?: string
    location: DeviceLocation
    timezone: string
    settings: DeviceSettings
    tokenEnvironment: TokenEnvironment
  } = {
    location,
    timezone,
    settings: parseSettings(object.settings),
    tokenEnvironment: parseTokenEnvironment(object.tokenEnvironment),
  }

  const deviceId = optionalNonEmptyString(object.deviceId, 'deviceId')
  if (deviceId !== undefined) {
    parsed.deviceId = deviceId
  }

  return parsed
}

export function parseTokenBody(body: unknown): {
  pushToStartToken?: string
  updateToken?: string
  tokenEnvironment?: TokenEnvironment
} {
  const object = requireObject(body)
  const pushToStartToken = optionalNonEmptyString(object.pushToStartToken, 'pushToStartToken')
  const updateToken = optionalNonEmptyString(object.updateToken, 'updateToken')

  if (!pushToStartToken && !updateToken) {
    throw new HttpError('At least one ActivityKit token is required.', 400)
  }

  const parsed: {
    pushToStartToken?: string
    updateToken?: string
    tokenEnvironment?: TokenEnvironment
  } = {}

  if (pushToStartToken !== undefined) {
    parsed.pushToStartToken = pushToStartToken
  }
  if (updateToken !== undefined) {
    parsed.updateToken = updateToken
  }

  const tokenEnvironment = optionalTokenEnvironment(object.tokenEnvironment)
  if (tokenEnvironment !== undefined) {
    parsed.tokenEnvironment = tokenEnvironment
  }

  return parsed
}

export function parseSettingsBody(body: unknown): {
  location?: DeviceLocation
  timezone?: string
  settings?: Partial<DeviceSettings>
} {
  const object = requireObject(body)
  const update: {
    location?: DeviceLocation
    timezone?: string
    settings?: Partial<DeviceSettings>
  } = {}

  if (object.location !== undefined) {
    update.location = parseLocation(object.location)
  }

  if (object.timezone !== undefined) {
    update.timezone = parseTimezone(object.timezone)
  }

  if (object.settings !== undefined) {
    update.settings = parsePartialSettings(object.settings)
  }

  if (!update.location && !update.timezone && !update.settings) {
    throw new HttpError('At least one settings field is required.', 400)
  }

  return update
}

export function parseSnoozeBody(body: unknown): { minutes?: number } {
  if (body === undefined || body === null) {
    return {}
  }

  const object = requireObject(body)

  if (object.minutes === undefined) {
    return {}
  }

  return {
    minutes: parseSnoozeMinutes(object.minutes),
  }
}

export function parsePathParam(params: unknown, name: string): string {
  const object = requireObject(params)
  return requiredNonEmptyString(object[name], name)
}

function parseSettings(value: unknown): DeviceSettings {
  return {
    ...defaultDeviceSettings,
    ...parsePartialSettings(value ?? {}),
  }
}

function parsePartialSettings(value: unknown): Partial<DeviceSettings> {
  const object = requireObject(value)
  const settings: Partial<DeviceSettings> = {}

  if (object.calculationMethod !== undefined) {
    if (!isCalculationMethodId(object.calculationMethod)) {
      throw new HttpError('Unsupported calculation method.', 400)
    }
    settings.calculationMethod = object.calculationMethod
  }

  if (object.madhab !== undefined) {
    if (!isMadhabId(object.madhab)) {
      throw new HttpError('Unsupported madhab.', 400)
    }
    settings.madhab = object.madhab
  }

  if (object.timeFormat !== undefined) {
    if (!isTimeFormat(object.timeFormat)) {
      throw new HttpError('Unsupported time format.', 400)
    }
    settings.timeFormat = object.timeFormat
  }

  if (object.snoozeDurationMinutes !== undefined) {
    settings.snoozeDurationMinutes = parseSnoozeMinutes(object.snoozeDurationMinutes)
  }

  return settings
}

function parseLocation(value: unknown): DeviceLocation {
  const object = requireObject(value)
  const latitude = parseCoordinate(object.latitude, 'latitude', -90, 90)
  const longitude = parseCoordinate(object.longitude, 'longitude', -180, 180)

  return {
    latitude,
    longitude,
    label: requiredNonEmptyString(object.label, 'location.label'),
  }
}

function parseTokenEnvironment(value: unknown): TokenEnvironment {
  if (value === undefined) {
    return 'sandbox'
  }

  if (!isTokenEnvironment(value)) {
    throw new HttpError('Unsupported token environment.', 400)
  }

  return value
}

function optionalTokenEnvironment(value: unknown): TokenEnvironment | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!isTokenEnvironment(value)) {
    throw new HttpError('Unsupported token environment.', 400)
  }

  return value
}

function parseTimezone(value: unknown): string {
  const timezone = requiredNonEmptyString(value, 'timezone')

  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format(new Date())
  } catch {
    throw new HttpError('Unsupported timezone.', 400)
  }

  return timezone
}

function parseCoordinate(value: unknown, name: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new HttpError(`Invalid ${name}.`, 400)
  }

  return value
}

function parseSnoozeMinutes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 60) {
    throw new HttpError('Snooze minutes must be an integer from 1 to 60.', 400)
  }

  return value
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError('Expected a JSON object.', 400)
  }

  return value as Record<string, unknown>
}

function requiredNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(`Missing ${name}.`, 400)
  }

  return value
}

function optionalNonEmptyString(value: unknown, name: string): string | undefined {
  if (value === undefined) {
    return undefined
  }

  return requiredNonEmptyString(value, name)
}
