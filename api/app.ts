import Fastify, { type FastifyInstance } from 'fastify'
import { RepositoryNotFoundError, type SalahRepository } from './repository.js'
import { SchedulerActionError, type SalahScheduler } from './scheduler.js'
import {
  HttpError,
  parsePathParam,
  parseRegistrationBody,
  parseSettingsBody,
  parseSnoozeBody,
  parseTokenBody,
} from './validation.js'

export type BuildAppOptions = {
  repository: SalahRepository
  scheduler: SalahScheduler
  logger?: boolean
  now?: () => Date
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? true,
  })

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError || error instanceof SchedulerActionError) {
      reply.status(error.statusCode).send({ error: error.message })
      return
    }

    if (error instanceof RepositoryNotFoundError) {
      reply.status(404).send({ error: error.message })
      return
    }

    app.log.error(error)
    reply.status(500).send({ error: 'Internal server error.' })
  })

  app.get('/healthz', async () => ({ ok: true }))

  app.post('/v1/devices/register', async (request) => {
    const now = currentTime(options)
    const input = parseRegistrationBody(request.body)
    const device = options.repository.registerDevice(input, now)
    const schedule = options.scheduler.refreshDeviceSchedule(device, now)

    return {
      device: publicDevice(device),
      schedule,
    }
  })

  app.post('/v1/devices/:id/activity-token', async (request) => {
    const now = currentTime(options)
    const deviceId = parsePathParam(request.params, 'id')
    const input = parseTokenBody(request.body)
    const device = options.repository.updateDeviceTokens(deviceId, input, now)

    return {
      device: publicDevice(device),
    }
  })

  app.put('/v1/devices/:id/settings', async (request) => {
    const now = currentTime(options)
    const deviceId = parsePathParam(request.params, 'id')
    const input = parseSettingsBody(request.body)
    const device = options.repository.updateDeviceSettings(deviceId, input, now)
    const schedule = options.scheduler.refreshDeviceSchedule(device, now)

    return {
      device: publicDevice(device),
      schedule,
    }
  })

  app.post('/v1/prayers/:activityId/prayed', async (request) => {
    const activityId = parsePathParam(request.params, 'activityId')
    const action = await options.scheduler.markPrayed(activityId, currentTime(options))
    return { action }
  })

  app.post('/v1/prayers/:activityId/snooze', async (request) => {
    const activityId = parsePathParam(request.params, 'activityId')
    const input = parseSnoozeBody(request.body)
    const action = await options.scheduler.snooze(activityId, input.minutes, currentTime(options))
    return { action }
  })

  app.post('/v1/prayers/:activityId/ignore', async (request) => {
    const activityId = parsePathParam(request.params, 'activityId')
    const action = await options.scheduler.ignore(activityId, currentTime(options))
    return { action }
  })

  return app
}

function currentTime(options: BuildAppOptions): Date {
  return options.now?.() ?? new Date()
}

function publicDevice(device: ReturnType<SalahRepository['requireDevice']>) {
  return {
    id: device.id,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
    location: device.location,
    timezone: device.timezone,
    settings: device.settings,
    tokenEnvironment: device.tokenEnvironment,
    hasPushToStartToken: Boolean(device.pushToStartToken),
    hasUpdateToken: Boolean(device.updateToken),
    activeActivity: device.activeActivity,
  }
}
