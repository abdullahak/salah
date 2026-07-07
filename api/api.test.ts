// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import { buildApnsLiveActivityPayload, encodeSwiftDate, type LiveActivityPushRequest, type LiveActivityPusher } from './apns.js'
import { initializeDatabase } from './database.js'
import { SalahRepository } from './repository.js'
import { SalahScheduler } from './scheduler.js'
import { DatabaseSync } from 'node:sqlite'

const makkahRegistration = {
  location: {
    label: 'Makkah, Saudi Arabia',
    latitude: 21.3891,
    longitude: 39.8579,
  },
  timezone: 'Asia/Riyadh',
  settings: {
    calculationMethod: 'UmmAlQura',
    madhab: 'shafi',
    timeFormat: '12h',
    snoozeDurationMinutes: 10,
  },
  tokenEnvironment: 'sandbox',
}

describe('Salah API', () => {
  it('registers a device, stores tokens, and updates settings without returning token values', async () => {
    const { app } = createTestApp()
    const registration = await app.inject({
      method: 'POST',
      url: '/v1/devices/register',
      payload: makkahRegistration,
    })

    expect(registration.statusCode).toBe(200)
    const registered = registration.json()
    expect(registered.device.id).toEqual(expect.any(String))
    expect(registered.device.hasPushToStartToken).toBe(false)
    expect(registered.schedule.today.entries).toHaveLength(6)

    const tokenUpdate = await app.inject({
      method: 'POST',
      url: `/v1/devices/${registered.device.id}/activity-token`,
      payload: {
        pushToStartToken: 'push-token',
        updateToken: 'update-token',
        tokenEnvironment: 'production',
      },
    })

    expect(tokenUpdate.statusCode).toBe(200)
    expect(tokenUpdate.json().device.hasPushToStartToken).toBe(true)
    expect(tokenUpdate.body).not.toContain('push-token')
    expect(tokenUpdate.body).not.toContain('update-token')

    const settingsUpdate = await app.inject({
      method: 'PUT',
      url: `/v1/devices/${registered.device.id}/settings`,
      payload: {
        settings: {
          madhab: 'hanafi',
          timeFormat: '24h',
        },
      },
    })

    expect(settingsUpdate.statusCode).toBe(200)
    expect(settingsUpdate.json().device.settings.madhab).toBe('hanafi')
    expect(settingsUpdate.json().device.settings.timeFormat).toBe('24h')

    await app.close()
  })

  it('starts one activity per prayer window and does not duplicate active starts', async () => {
    const { app, repository, scheduler, pusher } = createTestApp()
    const device = registerDeviceWithTokens(repository)
    const now = new Date('2026-06-30T10:30:00Z')

    await scheduler.tick(now)
    await scheduler.tick(new Date(now.getTime() + 60_000))

    expect(pusher.requests.filter((request) => request.event === 'start')).toHaveLength(1)
    const active = repository.requireDevice(device.id).activeActivity
    expect(active?.activityId).toEqual(expect.any(String))

    const events = repository.listApnsEvents(active?.activityId ?? '')
    expect(events.map((event) => event.eventType)).toEqual(['start'])

    await app.close()
  })

  it('clamps snooze to the active prayer window and wakes the activity on the next scheduler tick', async () => {
    const { app, repository, scheduler, pusher } = createTestApp()
    const device = registerDeviceWithTokens(repository)
    const now = new Date('2026-06-30T10:30:00Z')
    await scheduler.tick(now)
    const active = repository.requireDevice(device.id).activeActivity

    if (!active) {
      throw new Error('Expected active activity.')
    }

    const snooze = await app.inject({
      method: 'POST',
      url: `/v1/prayers/${active.activityId}/snooze`,
      payload: {
        minutes: 60,
      },
    })

    expect(snooze.statusCode).toBe(200)
    expect(new Date(snooze.json().action.snoozeUntil).getTime()).toBeLessThanOrEqual(new Date(active.endTime).getTime())
    expect(pusher.requests.at(-1)?.event).toBe('update')

    await scheduler.tick(new Date(snooze.json().action.snoozeUntil))
    expect(repository.getPrayerAction(active.activityId)?.state).toBe('active')
    expect(pusher.requests.at(-1)?.alert?.body).toContain('Reminder')

    await app.close()
  })

  it('marks a prayer as prayed idempotently and ends the active activity once', async () => {
    const { app, repository, scheduler, pusher } = createTestApp()
    const device = registerDeviceWithTokens(repository)
    await scheduler.tick(new Date('2026-06-30T10:30:00Z'))
    const active = repository.requireDevice(device.id).activeActivity

    if (!active) {
      throw new Error('Expected active activity.')
    }

    const first = await app.inject({
      method: 'POST',
      url: `/v1/prayers/${active.activityId}/prayed`,
    })
    const second = await app.inject({
      method: 'POST',
      url: `/v1/prayers/${active.activityId}/prayed`,
    })

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(first.json().action.state).toBe('prayed')
    expect(second.json().action.state).toBe('prayed')
    expect(pusher.requests.filter((request) => request.event === 'end')).toHaveLength(1)
    expect(repository.requireDevice(device.id).activeActivity).toBeUndefined()

    await app.close()
  })

  it('ends the previous activity when the next prayer window starts', async () => {
    const { repository, scheduler, pusher } = createTestApp()
    const device = registerDeviceWithTokens(repository)
    await scheduler.tick(new Date('2026-06-30T10:30:00Z'))

    const firstActive = repository.requireDevice(device.id).activeActivity
    if (!firstActive) {
      throw new Error('Expected first active activity.')
    }

    await scheduler.tick(new Date(firstActive.endTime))

    expect(pusher.requests.map((request) => request.event)).toEqual(['start', 'end', 'start'])
    expect(repository.requireDevice(device.id).activeActivity?.activityId).not.toBe(firstActive.activityId)
  })

  it('rejects invalid registration input', async () => {
    const { app } = createTestApp()
    const response = await app.inject({
      method: 'POST',
      url: '/v1/devices/register',
      payload: {
        ...makkahRegistration,
        timezone: 'Not/A_Zone',
      },
    })

    expect(response.statusCode).toBe(400)
    await app.close()
  })
})

describe('APNs Live Activity payloads', () => {
  it('builds ActivityKit start payloads with Swift Codable date values', () => {
    const startTime = new Date('2026-06-30T10:00:00Z')
    const request: LiveActivityPushRequest = {
      token: 'push-token',
      environment: 'sandbox',
      event: 'start',
      activityId: 'activity-1',
      attributes: {
        activityId: 'activity-1',
      },
      contentState: {
        prayerName: 'Dhuhr',
        startTime: encodeSwiftDate(startTime),
        endTime: encodeSwiftDate(new Date('2026-06-30T13:30:00Z')),
        locationLabel: 'Makkah, Saudi Arabia',
        completionState: 'active',
        snoozeUntil: null,
      },
      staleDate: new Date('2026-06-30T13:30:00Z'),
      alert: {
        title: 'Dhuhr',
        body: 'It is time for Dhuhr.',
      },
    }
    const payload = buildApnsLiveActivityPayload(request)
    const aps = payload.aps as Record<string, unknown>
    const contentState = aps['content-state'] as Record<string, unknown>

    expect(aps.event).toBe('start')
    expect(aps['attributes-type']).toBe('SalahActivityAttributes')
    expect(aps['input-push-token']).toBe(1)
    expect(aps['stale-date']).toBe(Math.floor(new Date('2026-06-30T13:30:00Z').getTime() / 1000))
    expect(contentState.startTime).toBe(startTime.getTime() / 1000 - 978_307_200)
  })
})

class FakePusher implements LiveActivityPusher {
  readonly requests: LiveActivityPushRequest[] = []

  async send(request: LiveActivityPushRequest) {
    this.requests.push(request)
    return {
      status: 'sent' as const,
    }
  }
}

function createTestApp(now = new Date('2026-06-30T10:30:00Z')) {
  const database = new DatabaseSync(':memory:')
  initializeDatabase(database)
  const repository = new SalahRepository(database)
  const pusher = new FakePusher()
  const scheduler = new SalahScheduler(repository, pusher)
  const app = buildApp({ repository, scheduler, logger: false, now: () => now })

  return {
    app,
    repository,
    scheduler,
    pusher,
  }
}

function registerDeviceWithTokens(repository: SalahRepository) {
  const device = repository.registerDevice({
    ...makkahRegistration,
    tokenEnvironment: 'sandbox',
  })
  repository.updateDeviceTokens(device.id, {
    pushToStartToken: 'push-token',
    updateToken: 'update-token',
    tokenEnvironment: 'sandbox',
  })
  return device
}
