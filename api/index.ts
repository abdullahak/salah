import { buildApp } from './app.js'
import { createLiveActivityPusherFromEnv } from './apns.js'
import { loadConfig } from './config.js'
import { openDatabase } from './database.js'
import { SalahRepository } from './repository.js'
import { SalahScheduler, startSchedulerLoop } from './scheduler.js'

const config = loadConfig()
const database = openDatabase(config.databasePath)
const repository = new SalahRepository(database)
const pusher = createLiveActivityPusherFromEnv(process.env)
const scheduler = new SalahScheduler(repository, pusher)
const app = buildApp({ repository, scheduler })
const schedulerLoop = startSchedulerLoop(scheduler, config.schedulerIntervalMs)

await app.listen({ host: config.host, port: config.port })

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    clearInterval(schedulerLoop)
    await app.close()
    database.close()
    process.exit(0)
  })
}
