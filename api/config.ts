export type ApiConfig = {
  host: string
  port: number
  databasePath: string
  schedulerIntervalMs: number
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    host: env.SALAH_API_HOST ?? '127.0.0.1',
    port: parseInteger(env.SALAH_API_PORT, 3001),
    databasePath: env.SALAH_API_DATABASE_PATH ?? '/var/lib/salah-api/salah-api.sqlite',
    schedulerIntervalMs: parseInteger(env.SALAH_API_SCHEDULER_INTERVAL_MS, 60_000),
  }
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
