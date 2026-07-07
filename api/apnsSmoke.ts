import { createPrivateKey } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  createLiveActivityPusherFromEnv,
  encodeSwiftDate,
  type ApnsDeliveryResult,
  type LiveActivityPushRequest,
} from './apns.js'
import { isTokenEnvironment, type TokenEnvironment } from './types.js'

type ApnsReadiness = {
  ok: boolean
  configured: boolean
  missing: string[]
  authKeyReadable: boolean
  attemptedPush: boolean
  delivery?: ApnsDeliveryResult
}

const readiness = await checkApns(process.env)
console.log(JSON.stringify(readiness, null, 2))
process.exit(readiness.ok ? 0 : 1)

async function checkApns(env: NodeJS.ProcessEnv): Promise<ApnsReadiness> {
  const missing = missingApnsConfig(env)
  const authKey = readAuthKey(env)
  const authKeyReadable = authKey !== undefined && canReadPrivateKey(authKey)
  const configured = missing.length === 0 && authKeyReadable

  if (!configured) {
    return {
      ok: false,
      configured: false,
      missing,
      authKeyReadable,
      attemptedPush: false,
    }
  }

  const testToken = env.SALAH_APNS_TEST_TOKEN
  if (!testToken) {
    return {
      ok: true,
      configured: true,
      missing: [],
      authKeyReadable,
      attemptedPush: false,
    }
  }

  const delivery = await createLiveActivityPusherFromEnv(env).send(buildSmokePush(testToken, parseTestEnvironment(env)))

  return {
    ok: delivery.status === 'sent',
    configured: true,
    missing: [],
    authKeyReadable,
    attemptedPush: true,
    delivery,
  }
}

function missingApnsConfig(env: NodeJS.ProcessEnv): string[] {
  const missing: string[] = []

  if (!env.SALAH_APNS_KEY_ID) {
    missing.push('SALAH_APNS_KEY_ID')
  }
  if (!env.SALAH_APNS_TEAM_ID) {
    missing.push('SALAH_APNS_TEAM_ID')
  }
  if (!env.SALAH_APNS_AUTH_KEY && !env.SALAH_APNS_AUTH_KEY_PATH) {
    missing.push('SALAH_APNS_AUTH_KEY or SALAH_APNS_AUTH_KEY_PATH')
  }

  return missing
}

function readAuthKey(env: NodeJS.ProcessEnv): string | undefined {
  if (env.SALAH_APNS_AUTH_KEY) {
    return env.SALAH_APNS_AUTH_KEY
  }

  if (!env.SALAH_APNS_AUTH_KEY_PATH) {
    return undefined
  }

  try {
    return readFileSync(env.SALAH_APNS_AUTH_KEY_PATH, 'utf8')
  } catch {
    return undefined
  }
}

function canReadPrivateKey(authKey: string): boolean {
  try {
    createPrivateKey(authKey)
    return true
  } catch {
    return false
  }
}

function parseTestEnvironment(env: NodeJS.ProcessEnv): TokenEnvironment {
  if (env.SALAH_APNS_TEST_ENVIRONMENT === undefined) {
    return 'sandbox'
  }

  if (!isTokenEnvironment(env.SALAH_APNS_TEST_ENVIRONMENT)) {
    throw new Error('SALAH_APNS_TEST_ENVIRONMENT must be "sandbox" or "production".')
  }

  return env.SALAH_APNS_TEST_ENVIRONMENT
}

function buildSmokePush(token: string, environment: TokenEnvironment): LiveActivityPushRequest {
  const start = new Date()
  const end = new Date(start.getTime() + 10 * 60_000)
  const activityId = `apns-smoke-${start.getTime()}`

  return {
    token,
    environment,
    event: 'start',
    activityId,
    attributes: {
      activityId,
    },
    contentState: {
      prayerName: 'Dhuhr',
      startTime: encodeSwiftDate(start),
      endTime: encodeSwiftDate(end),
      locationLabel: 'APNs smoke test',
      completionState: 'active',
      snoozeUntil: null,
    },
    staleDate: end,
    alert: {
      title: 'Salah APNs smoke test',
      body: 'Testing Live Activity delivery.',
    },
  }
}
