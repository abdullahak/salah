import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import {
  isPrayerName,
  type ActiveActivityRecord,
  type ActivityActionState,
  type ApnsEventRecord,
  type DeviceLocation,
  type DeviceRecord,
  type DeviceSettings,
  type PrayerActionRecord,
  type PrayerName,
  type PrayerScheduleSnapshot,
  type TokenEnvironment,
} from './types.js'

export type DeviceRegistration = {
  deviceId?: string
  location: DeviceLocation
  timezone: string
  settings: DeviceSettings
  tokenEnvironment: TokenEnvironment
}

export type TokenUpdate = {
  pushToStartToken?: string
  updateToken?: string
  tokenEnvironment?: TokenEnvironment
}

export type DeviceSettingsUpdate = {
  location?: DeviceLocation
  timezone?: string
  settings?: Partial<DeviceSettings>
}

export class SalahRepository {
  private readonly database: DatabaseSync

  constructor(database: DatabaseSync) {
    this.database = database
  }

  registerDevice(input: DeviceRegistration, now: Date = new Date()): DeviceRecord {
    const id = input.deviceId ?? randomUUID()
    const timestamp = now.toISOString()

    this.database
      .prepare(`
        INSERT INTO devices (
          id,
          created_at,
          updated_at,
          latitude,
          longitude,
          location_label,
          timezone,
          calculation_method,
          madhab,
          time_format,
          snooze_duration_minutes,
          token_environment
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          updated_at = excluded.updated_at,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          location_label = excluded.location_label,
          timezone = excluded.timezone,
          calculation_method = excluded.calculation_method,
          madhab = excluded.madhab,
          time_format = excluded.time_format,
          snooze_duration_minutes = excluded.snooze_duration_minutes,
          token_environment = excluded.token_environment
      `)
      .run(
        id,
        timestamp,
        timestamp,
        input.location.latitude,
        input.location.longitude,
        input.location.label,
        input.timezone,
        input.settings.calculationMethod,
        input.settings.madhab,
        input.settings.timeFormat,
        input.settings.snoozeDurationMinutes,
        input.tokenEnvironment,
      )

    return this.requireDevice(id)
  }

  updateDeviceTokens(deviceId: string, input: TokenUpdate, now: Date = new Date()): DeviceRecord {
    const current = this.requireDevice(deviceId)

    this.database
      .prepare(`
        UPDATE devices
        SET
          updated_at = ?,
          push_to_start_token = ?,
          update_token = ?,
          token_environment = ?
        WHERE id = ?
      `)
      .run(
        now.toISOString(),
        input.pushToStartToken ?? current.pushToStartToken ?? null,
        input.updateToken ?? current.updateToken ?? null,
        input.tokenEnvironment ?? current.tokenEnvironment,
        deviceId,
      )

    return this.requireDevice(deviceId)
  }

  updateDeviceSettings(deviceId: string, input: DeviceSettingsUpdate, now: Date = new Date()): DeviceRecord {
    const current = this.requireDevice(deviceId)
    const nextLocation = input.location ?? current.location
    const nextSettings = {
      ...current.settings,
      ...input.settings,
    }

    this.database
      .prepare(`
        UPDATE devices
        SET
          updated_at = ?,
          latitude = ?,
          longitude = ?,
          location_label = ?,
          timezone = ?,
          calculation_method = ?,
          madhab = ?,
          time_format = ?,
          snooze_duration_minutes = ?
        WHERE id = ?
      `)
      .run(
        now.toISOString(),
        nextLocation.latitude,
        nextLocation.longitude,
        nextLocation.label,
        input.timezone ?? current.timezone,
        nextSettings.calculationMethod,
        nextSettings.madhab,
        nextSettings.timeFormat,
        nextSettings.snoozeDurationMinutes,
        deviceId,
      )

    return this.requireDevice(deviceId)
  }

  saveLatestSchedule(deviceId: string, schedule: PrayerScheduleSnapshot, now: Date = new Date()): void {
    this.database
      .prepare('UPDATE devices SET updated_at = ?, latest_schedule_json = ? WHERE id = ?')
      .run(now.toISOString(), JSON.stringify(schedule), deviceId)
  }

  setActiveActivity(deviceId: string, activeActivity: ActiveActivityRecord, now: Date = new Date()): void {
    this.database
      .prepare(`
        UPDATE devices
        SET
          updated_at = ?,
          active_activity_id = ?,
          active_prayer_name = ?,
          active_start_at = ?,
          active_end_at = ?
        WHERE id = ?
      `)
      .run(
        now.toISOString(),
        activeActivity.activityId,
        activeActivity.prayerName,
        activeActivity.startTime,
        activeActivity.endTime,
        deviceId,
      )
  }

  clearActiveActivity(deviceId: string, now: Date = new Date()): void {
    this.database
      .prepare(`
        UPDATE devices
        SET
          updated_at = ?,
          active_activity_id = NULL,
          active_prayer_name = NULL,
          active_start_at = NULL,
          active_end_at = NULL
        WHERE id = ?
      `)
      .run(now.toISOString(), deviceId)
  }

  upsertPrayerAction(input: {
    activityId: string
    deviceId: string
    prayerName: PrayerName
    state: ActivityActionState
    snoozeUntil?: string
  }, now: Date = new Date()): PrayerActionRecord {
    const existing = this.getPrayerAction(input.activityId)
    const createdAt = existing?.createdAt ?? now.toISOString()

    this.database
      .prepare(`
        INSERT INTO prayer_actions (
          activity_id,
          device_id,
          prayer_name,
          state,
          snooze_until,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(activity_id) DO UPDATE SET
          state = excluded.state,
          snooze_until = excluded.snooze_until,
          updated_at = excluded.updated_at
      `)
      .run(
        input.activityId,
        input.deviceId,
        input.prayerName,
        input.state,
        input.snoozeUntil ?? null,
        createdAt,
        now.toISOString(),
      )

    return this.requirePrayerAction(input.activityId)
  }

  recordApnsEvent(input: Omit<ApnsEventRecord, 'id' | 'createdAt'>, now: Date = new Date()): ApnsEventRecord {
    const event: ApnsEventRecord = {
      ...input,
      id: randomUUID(),
      createdAt: now.toISOString(),
    }

    this.database
      .prepare(`
        INSERT INTO apns_events (
          id,
          device_id,
          activity_id,
          event_type,
          status,
          created_at,
          payload_json,
          error
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        event.id,
        event.deviceId,
        event.activityId,
        event.eventType,
        event.status,
        event.createdAt,
        event.payloadJson,
        event.error ?? null,
      )

    return event
  }

  requireDevice(deviceId: string): DeviceRecord {
    const device = this.getDevice(deviceId)

    if (!device) {
      throw new RepositoryNotFoundError(`Device ${deviceId} was not found.`)
    }

    return device
  }

  getDevice(deviceId: string): DeviceRecord | undefined {
    const row = this.database.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId)
    return row ? mapDevice(row) : undefined
  }

  listDevices(): DeviceRecord[] {
    return this.database.prepare('SELECT * FROM devices ORDER BY created_at').all().map(mapDevice)
  }

  getPrayerAction(activityId: string): PrayerActionRecord | undefined {
    const row = this.database
      .prepare('SELECT * FROM prayer_actions WHERE activity_id = ?')
      .get(activityId)

    return row ? mapPrayerAction(row) : undefined
  }

  requirePrayerAction(activityId: string): PrayerActionRecord {
    const action = this.getPrayerAction(activityId)

    if (!action) {
      throw new RepositoryNotFoundError(`Prayer activity ${activityId} was not found.`)
    }

    return action
  }

  getDeviceForActivity(activityId: string): DeviceRecord | undefined {
    const activeRow = this.database
      .prepare('SELECT * FROM devices WHERE active_activity_id = ?')
      .get(activityId)

    if (activeRow) {
      return mapDevice(activeRow)
    }

    const action = this.getPrayerAction(activityId)
    return action ? this.getDevice(action.deviceId) : undefined
  }

  listApnsEvents(activityId: string): ApnsEventRecord[] {
    return this.database
      .prepare('SELECT * FROM apns_events WHERE activity_id = ? ORDER BY created_at')
      .all(activityId)
      .map(mapApnsEvent)
  }
}

export class RepositoryNotFoundError extends Error {}

function mapDevice(row: Record<string, unknown>): DeviceRecord {
  const activeActivity = mapActiveActivity(row)
  const latestSchedule = parseSchedule(row.latest_schedule_json)
  const device: DeviceRecord = {
    id: stringValue(row.id),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    location: {
      latitude: numberValue(row.latitude),
      longitude: numberValue(row.longitude),
      label: stringValue(row.location_label),
    },
    timezone: stringValue(row.timezone),
    settings: {
      calculationMethod: stringValue(row.calculation_method) as DeviceSettings['calculationMethod'],
      madhab: stringValue(row.madhab) as DeviceSettings['madhab'],
      timeFormat: stringValue(row.time_format) as DeviceSettings['timeFormat'],
      snoozeDurationMinutes: numberValue(row.snooze_duration_minutes),
    },
    tokenEnvironment: stringValue(row.token_environment) as TokenEnvironment,
  }

  assignOptional(device, 'pushToStartToken', optionalString(row.push_to_start_token))
  assignOptional(device, 'updateToken', optionalString(row.update_token))
  assignOptional(device, 'latestSchedule', latestSchedule)
  assignOptional(device, 'activeActivity', activeActivity)

  return device
}

function mapActiveActivity(row: Record<string, unknown>): ActiveActivityRecord | undefined {
  const activityId = optionalString(row.active_activity_id)
  const prayerName = optionalString(row.active_prayer_name)
  const startTime = optionalString(row.active_start_at)
  const endTime = optionalString(row.active_end_at)

  if (!activityId || !prayerName || !startTime || !endTime || !isPrayerName(prayerName)) {
    return undefined
  }

  return {
    activityId,
    prayerName,
    startTime,
    endTime,
  }
}

function mapPrayerAction(row: Record<string, unknown>): PrayerActionRecord {
  const action: PrayerActionRecord = {
    activityId: stringValue(row.activity_id),
    deviceId: stringValue(row.device_id),
    prayerName: stringValue(row.prayer_name) as PrayerName,
    state: stringValue(row.state) as ActivityActionState,
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  }

  assignOptional(action, 'snoozeUntil', optionalString(row.snooze_until))
  return action
}

function mapApnsEvent(row: Record<string, unknown>): ApnsEventRecord {
  const event: ApnsEventRecord = {
    id: stringValue(row.id),
    deviceId: stringValue(row.device_id),
    activityId: stringValue(row.activity_id),
    eventType: stringValue(row.event_type) as ApnsEventRecord['eventType'],
    status: stringValue(row.status) as ApnsEventRecord['status'],
    createdAt: stringValue(row.created_at),
    payloadJson: stringValue(row.payload_json),
  }

  assignOptional(event, 'error', optionalString(row.error))
  return event
}

function parseSchedule(value: unknown): PrayerScheduleSnapshot | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  return JSON.parse(value) as PrayerScheduleSnapshot
}

function stringValue(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Expected SQLite string value.')
  }

  return value
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function numberValue(value: unknown): number {
  if (typeof value !== 'number') {
    throw new Error('Expected SQLite number value.')
  }

  return value
}

function assignOptional<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined) {
    target[key] = value
  }
}
