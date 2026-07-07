import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { connect, type ClientHttp2Session } from 'node:http2'
import type { TokenEnvironment } from './types.js'

const SWIFT_REFERENCE_DATE_UNIX_SECONDS = 978_307_200

export type SalahActivityContentState = {
  prayerName: string
  startTime: number
  endTime: number
  locationLabel: string
  completionState: 'active' | 'prayed' | 'ignored'
  snoozeUntil?: number | null
}

export type LiveActivityPushEvent = 'start' | 'update' | 'end'

export type LiveActivityPushRequest = {
  token: string
  environment: TokenEnvironment
  event: LiveActivityPushEvent
  activityId: string
  attributes: {
    activityId: string
  }
  contentState: SalahActivityContentState
  alert?: {
    title: string
    body: string
  }
  staleDate?: Date
  dismissalDate?: Date
  priority?: 5 | 10
}

export type ApnsDeliveryResult = {
  status: 'sent' | 'skipped' | 'failed'
  statusCode?: number
  apnsId?: string
  reason?: string
}

export type ApnsConfig = {
  keyId: string
  teamId: string
  bundleId: string
  authKey: string
}

export interface LiveActivityPusher {
  send(request: LiveActivityPushRequest): Promise<ApnsDeliveryResult>
}

export class NoopLiveActivityPusher implements LiveActivityPusher {
  async send(): Promise<ApnsDeliveryResult> {
    return {
      status: 'skipped',
      reason: 'APNs credentials are not configured.',
    }
  }
}

export class ApnsLiveActivityPusher implements LiveActivityPusher {
  private readonly config: ApnsConfig

  constructor(config: ApnsConfig) {
    this.config = config
  }

  async send(request: LiveActivityPushRequest): Promise<ApnsDeliveryResult> {
    const payload = buildApnsLiveActivityPayload(request)
    const host = request.environment === 'production'
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com'
    const session = connect(host)

    try {
      return await sendHttp2Request(session, request, this.config, payload)
    } finally {
      session.close()
    }
  }
}

export function createLiveActivityPusherFromEnv(env: NodeJS.ProcessEnv): LiveActivityPusher {
  const keyId = env.SALAH_APNS_KEY_ID
  const teamId = env.SALAH_APNS_TEAM_ID
  const bundleId = env.SALAH_APNS_BUNDLE_ID ?? 'com.abdlh.salah'
  const authKey = env.SALAH_APNS_AUTH_KEY ?? readOptionalAuthKey(env.SALAH_APNS_AUTH_KEY_PATH)

  if (!keyId || !teamId || !authKey) {
    return new NoopLiveActivityPusher()
  }

  return new ApnsLiveActivityPusher({
    keyId,
    teamId,
    bundleId,
    authKey,
  })
}

export function buildApnsLiveActivityPayload(request: LiveActivityPushRequest): Record<string, unknown> {
  const aps: Record<string, unknown> = {
    timestamp: Math.floor(Date.now() / 1000),
    event: request.event,
    'content-state': request.contentState,
  }

  if (request.event === 'start') {
    aps['attributes-type'] = 'SalahActivityAttributes'
    aps.attributes = request.attributes
    aps['input-push-token'] = 1
    aps.alert = {
      title: request.alert?.title ?? request.contentState.prayerName,
      body: request.alert?.body ?? 'Prayer window started.',
      sound: 'default',
    }
  }

  if (request.alert && request.event !== 'start') {
    aps.alert = {
      title: request.alert.title,
      body: request.alert.body,
      sound: 'default',
    }
  }

  if (request.staleDate) {
    aps['stale-date'] = unixSeconds(request.staleDate)
  }

  if (request.dismissalDate) {
    aps['dismissal-date'] = unixSeconds(request.dismissalDate)
  }

  return { aps }
}

export function encodeSwiftDate(date: Date): number {
  return date.getTime() / 1000 - SWIFT_REFERENCE_DATE_UNIX_SECONDS
}

function sendHttp2Request(
  session: ClientHttp2Session,
  request: LiveActivityPushRequest,
  config: ApnsConfig,
  payload: Record<string, unknown>,
): Promise<ApnsDeliveryResult> {
  return new Promise((resolve) => {
    const stream = session.request({
      ':method': 'POST',
      ':path': `/3/device/${request.token}`,
      authorization: `bearer ${createApnsJwt(config)}`,
      'apns-topic': `${config.bundleId}.push-type.liveactivity`,
      'apns-push-type': 'liveactivity',
      'apns-priority': String(request.priority ?? 10),
    })
    const chunks: Buffer[] = []

    stream.setEncoding('utf8')
    stream.on('data', (chunk: string) => {
      chunks.push(Buffer.from(chunk))
    })
    stream.on('response', (headers) => {
      const statusCode = typeof headers[':status'] === 'number' ? headers[':status'] : undefined
      const apnsId = typeof headers['apns-id'] === 'string' ? headers['apns-id'] : undefined

      stream.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString('utf8')
        const reason = parseApnsReason(responseBody)

        const result: ApnsDeliveryResult = {
          status: statusCode && statusCode >= 200 && statusCode < 300 ? 'sent' : 'failed',
        }

        if (statusCode !== undefined) {
          result.statusCode = statusCode
        }
        if (apnsId !== undefined) {
          result.apnsId = apnsId
        }
        if (reason !== undefined) {
          result.reason = reason
        }

        resolve(result)
      })
    })
    stream.on('error', (error) => {
      resolve({
        status: 'failed',
        reason: error.message,
      })
    })
    stream.end(JSON.stringify(payload))
  })
}

function createApnsJwt(config: ApnsConfig, issuedAt: number = Math.floor(Date.now() / 1000)): string {
  const header = base64UrlJson({ alg: 'ES256', kid: config.keyId })
  const claims = base64UrlJson({ iss: config.teamId, iat: issuedAt })
  const signingInput = `${header}.${claims}`
  const derSignature = createSign('sha256').update(signingInput).sign(config.authKey)
  return `${signingInput}.${base64Url(derToJoseSignature(derSignature))}`
}

function derToJoseSignature(signature: Buffer): Buffer {
  let offset = 0

  if (signature[offset] !== 0x30) {
    throw new Error('Expected DER sequence.')
  }
  offset += 1
  const sequenceLength = signature[offset]
  offset += 1

  if (sequenceLength === undefined || sequenceLength + 2 !== signature.length) {
    throw new Error('Unexpected DER sequence length.')
  }

  const r = readDerInteger(signature, offset)
  offset = r.nextOffset
  const s = readDerInteger(signature, offset)

  return Buffer.concat([leftPad(stripLeadingZeroes(r.value), 32), leftPad(stripLeadingZeroes(s.value), 32)])
}

function readDerInteger(signature: Buffer, offset: number): { value: Buffer; nextOffset: number } {
  if (signature[offset] !== 0x02) {
    throw new Error('Expected DER integer.')
  }

  const length = signature[offset + 1]
  if (length === undefined) {
    throw new Error('Missing DER integer length.')
  }

  const start = offset + 2
  const end = start + length
  return {
    value: signature.subarray(start, end),
    nextOffset: end,
  }
}

function stripLeadingZeroes(value: Buffer): Buffer {
  let offset = 0
  while (offset < value.length - 1 && value[offset] === 0) {
    offset += 1
  }
  return value.subarray(offset)
}

function leftPad(value: Buffer, length: number): Buffer {
  if (value.length > length) {
    return value.subarray(value.length - length)
  }

  if (value.length === length) {
    return value
  }

  return Buffer.concat([Buffer.alloc(length - value.length), value])
}

function base64UrlJson(value: unknown): string {
  return base64Url(Buffer.from(JSON.stringify(value)))
}

function base64Url(value: Buffer): string {
  return value.toString('base64url')
}

function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

function parseApnsReason(responseBody: string): string | undefined {
  if (!responseBody) {
    return undefined
  }

  try {
    const parsed = JSON.parse(responseBody) as { reason?: unknown }
    return typeof parsed.reason === 'string' ? parsed.reason : responseBody
  } catch {
    return responseBody
  }
}

function readOptionalAuthKey(path: string | undefined): string | undefined {
  return path ? readFileSync(path, 'utf8') : undefined
}
