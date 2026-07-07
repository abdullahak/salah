import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export function openDatabase(databasePath: string): DatabaseSync {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true })
  }

  const database = new DatabaseSync(databasePath)
  initializeDatabase(database)
  return database
}

export function initializeDatabase(database: DatabaseSync): void {
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      location_label TEXT NOT NULL,
      timezone TEXT NOT NULL,
      calculation_method TEXT NOT NULL,
      madhab TEXT NOT NULL,
      time_format TEXT NOT NULL,
      snooze_duration_minutes INTEGER NOT NULL,
      push_to_start_token TEXT,
      update_token TEXT,
      token_environment TEXT NOT NULL DEFAULT 'sandbox',
      latest_schedule_json TEXT,
      active_activity_id TEXT,
      active_prayer_name TEXT,
      active_start_at TEXT,
      active_end_at TEXT
    );

    CREATE TABLE IF NOT EXISTS prayer_actions (
      activity_id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      prayer_name TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('active', 'prayed', 'snoozed', 'ignored', 'ended')),
      snooze_until TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prayer_actions_device_id ON prayer_actions(device_id);
    CREATE INDEX IF NOT EXISTS idx_devices_active_activity_id ON devices(active_activity_id);

    CREATE TABLE IF NOT EXISTS apns_events (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      activity_id TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('start', 'update', 'end')),
      status TEXT NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
      created_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      error TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_apns_events_activity_id ON apns_events(activity_id);
  `)
}
