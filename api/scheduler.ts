import {
  encodeSwiftDate,
  type ApnsDeliveryResult,
  type LiveActivityPushEvent,
  type LiveActivityPushRequest,
  type LiveActivityPusher,
  type SalahActivityContentState,
} from './apns.js'
import { calculatePrayerSchedule, currentPrayerWindow, isTerminalActionState } from './prayerSchedule.js'
import { type SalahRepository } from './repository.js'
import {
  prayerLabels,
  type ActivityActionState,
  type DeviceRecord,
  type PrayerActionRecord,
  type PrayerActivityWindow,
} from './types.js'

export class SalahScheduler {
  private readonly repository: SalahRepository
  private readonly pusher: LiveActivityPusher

  constructor(
    repository: SalahRepository,
    pusher: LiveActivityPusher,
  ) {
    this.repository = repository
    this.pusher = pusher
  }

  async tick(now: Date = new Date()): Promise<void> {
    const devices = this.repository.listDevices()

    for (const device of devices) {
      await this.tickDevice(device, now)
    }
  }

  refreshDeviceSchedule(device: DeviceRecord, now: Date = new Date()) {
    const schedule = calculatePrayerSchedule(device.location, device.timezone, device.settings, now)
    this.repository.saveLatestSchedule(device.id, schedule, now)
    return schedule
  }

  async markPrayed(activityId: string, now: Date = new Date()): Promise<PrayerActionRecord> {
    return this.endActivityWithAction(activityId, 'prayed', now)
  }

  async ignore(activityId: string, now: Date = new Date()): Promise<PrayerActionRecord> {
    return this.endActivityWithAction(activityId, 'ignored', now)
  }

  async snooze(activityId: string, requestedMinutes: number | undefined, now: Date = new Date()): Promise<PrayerActionRecord> {
    const existingAction = this.repository.getPrayerAction(activityId)
    const device = this.requireDeviceForActivity(activityId)
    const activeActivity = device.activeActivity

    if (!activeActivity || activeActivity.activityId !== activityId) {
      if (existingAction) {
        return existingAction
      }

      throw new SchedulerActionError('Activity is not active.', 409)
    }

    const endTime = new Date(activeActivity.endTime)

    if (now >= endTime) {
      throw new SchedulerActionError('Prayer window has expired.', 409)
    }

    const minutes = requestedMinutes ?? device.settings.snoozeDurationMinutes
    const snoozeUntil = new Date(Math.min(now.getTime() + minutes * 60_000, endTime.getTime()))
    const action = this.repository.upsertPrayerAction(
      {
        activityId,
        deviceId: device.id,
        prayerName: activeActivity.prayerName,
        state: 'snoozed',
        snoozeUntil: snoozeUntil.toISOString(),
      },
      now,
    )

    await this.sendActivityPush(
      device,
      activeActivityToWindow(device, activeActivity),
      'update',
      'active',
      snoozeUntil,
      now,
      { title: activeActivity.prayerName, body: 'Snoozed prayer reminder.' },
    )

    return action
  }

  private async tickDevice(device: DeviceRecord, now: Date): Promise<void> {
    const schedule = this.refreshDeviceSchedule(device, now)
    const currentWindow = currentPrayerWindow(device, schedule, now)

    if (shouldFinishActiveActivity(device, currentWindow, now)) {
      await this.finishExistingActivity(device, now)
    }

    if (!currentWindow) {
      return
    }

    const refreshedDevice = this.repository.requireDevice(device.id)
    const action = this.repository.getPrayerAction(currentWindow.activityId)

    if (action && isTerminalActionState(action.state)) {
      return
    }

    if (refreshedDevice.activeActivity?.activityId === currentWindow.activityId) {
      await this.maybeWakeSnoozedActivity(refreshedDevice, currentWindow, action, now)
      return
    }

    if (!refreshedDevice.pushToStartToken) {
      return
    }

    await this.sendActivityPush(refreshedDevice, currentWindow, 'start', 'active', undefined, now, {
      title: currentWindow.prayerLabel,
      body: `It is time for ${currentWindow.prayerLabel}.`,
    })
    this.repository.setActiveActivity(
      refreshedDevice.id,
      {
        activityId: currentWindow.activityId,
        prayerName: currentWindow.prayerName,
        startTime: currentWindow.startTime,
        endTime: currentWindow.endTime,
      },
      now,
    )
    this.repository.upsertPrayerAction(
      {
        activityId: currentWindow.activityId,
        deviceId: refreshedDevice.id,
        prayerName: currentWindow.prayerName,
        state: 'active',
      },
      now,
    )
  }

  private async finishExistingActivity(device: DeviceRecord, now: Date): Promise<void> {
    const activeActivity = device.activeActivity

    if (!activeActivity) {
      return
    }

    await this.sendActivityPush(
      device,
      activeActivityToWindow(device, activeActivity),
      'end',
      'ignored',
      undefined,
      now,
      undefined,
    )
    this.repository.upsertPrayerAction(
      {
        activityId: activeActivity.activityId,
        deviceId: device.id,
        prayerName: activeActivity.prayerName,
        state: 'ended',
      },
      now,
    )
    this.repository.clearActiveActivity(device.id, now)
  }

  private async maybeWakeSnoozedActivity(
    device: DeviceRecord,
    window: PrayerActivityWindow,
    action: PrayerActionRecord | undefined,
    now: Date,
  ): Promise<void> {
    if (action?.state !== 'snoozed' || !action.snoozeUntil || new Date(action.snoozeUntil) > now) {
      return
    }

    await this.sendActivityPush(device, window, 'update', 'active', undefined, now, {
      title: window.prayerLabel,
      body: `Reminder for ${window.prayerLabel}.`,
    })
    this.repository.upsertPrayerAction(
      {
        activityId: window.activityId,
        deviceId: device.id,
        prayerName: window.prayerName,
        state: 'active',
      },
      now,
    )
  }

  private async endActivityWithAction(
    activityId: string,
    state: Extract<ActivityActionState, 'prayed' | 'ignored'>,
    now: Date,
  ): Promise<PrayerActionRecord> {
    const existingAction = this.repository.getPrayerAction(activityId)

    if (existingAction && isTerminalActionState(existingAction.state)) {
      return existingAction
    }

    const device = this.requireDeviceForActivity(activityId)
    const activeActivity = device.activeActivity

    if (!activeActivity || activeActivity.activityId !== activityId) {
      if (existingAction) {
        return existingAction
      }

      throw new SchedulerActionError('Activity is not active.', 409)
    }

    await this.sendActivityPush(
      device,
      activeActivityToWindow(device, activeActivity),
      'end',
      state,
      undefined,
      now,
      undefined,
    )
    const action = this.repository.upsertPrayerAction(
      {
        activityId,
        deviceId: device.id,
        prayerName: activeActivity.prayerName,
        state,
      },
      now,
    )
    this.repository.clearActiveActivity(device.id, now)
    return action
  }

  private requireDeviceForActivity(activityId: string): DeviceRecord {
    const device = this.repository.getDeviceForActivity(activityId)

    if (!device) {
      throw new SchedulerActionError('Activity was not found.', 404)
    }

    return device
  }

  private async sendActivityPush(
    device: DeviceRecord,
    window: PrayerActivityWindow,
    event: LiveActivityPushEvent,
    completionState: 'active' | 'prayed' | 'ignored',
    snoozeUntil: Date | undefined,
    now: Date,
    alert: LiveActivityPushRequest['alert'],
  ): Promise<ApnsDeliveryResult> {
    const token = event === 'start' ? device.pushToStartToken : device.updateToken
    const request = createPushRequest(device, window, event, completionState, snoozeUntil, now, alert, token)
    const result = token
      ? await this.pusher.send(request)
      : { status: 'skipped', reason: 'Device does not have the required ActivityKit token.' } satisfies ApnsDeliveryResult

    const apnsEvent: Parameters<SalahRepository['recordApnsEvent']>[0] = {
      deviceId: device.id,
      activityId: window.activityId,
      eventType: event,
      status: result.status,
      payloadJson: JSON.stringify(request),
    }

    if (result.reason !== undefined) {
      apnsEvent.error = result.reason
    }

    this.repository.recordApnsEvent(apnsEvent, now)

    return result
  }
}

export class SchedulerActionError extends Error {
  readonly statusCode: number

  constructor(
    message: string,
    statusCode: number,
  ) {
    super(message)
    this.statusCode = statusCode
  }
}

export function startSchedulerLoop(scheduler: SalahScheduler, intervalMs: number): NodeJS.Timeout {
  const handle = setInterval(() => {
    scheduler.tick().catch((error: unknown) => {
      console.error('Salah scheduler tick failed.', error)
    })
  }, intervalMs)
  handle.unref()
  return handle
}

function activeActivityToWindow(device: DeviceRecord, activeActivity: NonNullable<DeviceRecord['activeActivity']>): PrayerActivityWindow {
  return {
    activityId: activeActivity.activityId,
    prayerName: activeActivity.prayerName,
    prayerLabel: prayerLabels[activeActivity.prayerName],
    startTime: activeActivity.startTime,
    endTime: activeActivity.endTime,
    locationLabel: device.location.label,
  }
}

function shouldFinishActiveActivity(
  device: DeviceRecord,
  currentWindow: PrayerActivityWindow | undefined,
  now: Date,
): boolean {
  const activeActivity = device.activeActivity

  if (!activeActivity) {
    return false
  }

  if (currentWindow) {
    return activeActivity.activityId !== currentWindow.activityId
  }

  return now >= new Date(activeActivity.endTime)
}

function createPushRequest(
  device: DeviceRecord,
  window: PrayerActivityWindow,
  event: LiveActivityPushEvent,
  completionState: 'active' | 'prayed' | 'ignored',
  snoozeUntil: Date | undefined,
  now: Date,
  alert: LiveActivityPushRequest['alert'],
  token: string | undefined,
): LiveActivityPushRequest {
  const request: LiveActivityPushRequest = {
    token: token ?? '',
    environment: device.tokenEnvironment,
    event,
    activityId: window.activityId,
    attributes: {
      activityId: window.activityId,
    },
    contentState: createContentState(window, completionState, snoozeUntil),
    priority: alert ? 10 : 5,
  }

  if (event !== 'end') {
    request.staleDate = new Date(window.endTime)
  }

  if (event === 'end') {
    request.dismissalDate = now
  }

  if (alert !== undefined) {
    request.alert = alert
  }

  return request
}

function createContentState(
  window: PrayerActivityWindow,
  completionState: 'active' | 'prayed' | 'ignored',
  snoozeUntil: Date | undefined,
): SalahActivityContentState {
  const contentState: SalahActivityContentState = {
    prayerName: window.prayerLabel,
    startTime: encodeSwiftDate(new Date(window.startTime)),
    endTime: encodeSwiftDate(new Date(window.endTime)),
    locationLabel: window.locationLabel,
    completionState,
  }

  if (snoozeUntil) {
    contentState.snoozeUntil = encodeSwiftDate(snoozeUntil)
  } else {
    contentState.snoozeUntil = null
  }

  return contentState
}
