import type { SQLiteDatabase } from 'expo-sqlite';

let databasePromise: Promise<SQLiteDatabase> | null = null;

export const legacyDurationRepairSql = `
  UPDATE focus_sessions
  SET planned_focus_seconds = CAST(MAX(0, COALESCE(MIN(
    (SELECT json_extract(payload, '$.plannedMinutes') * 60
     FROM sync_outbox
     WHERE operation = 'session.start'
       AND json_extract(payload, '$.localSessionId') = focus_sessions.id
     ORDER BY created_at ASC LIMIT 1),
    (planned_end_at - started_at) / 1000
  ), (planned_end_at - started_at) / 1000)) AS INTEGER)
  WHERE planned_focus_seconds IS NULL AND timer_mode = 'countdown' AND planned_end_at IS NOT NULL;
  UPDATE focus_sessions
  SET duration_seconds = planned_focus_seconds
  WHERE timer_mode = 'countdown' AND planned_focus_seconds IS NOT NULL
    AND duration_seconds > planned_focus_seconds;
  UPDATE active_sessions
  SET planned_focus_seconds = CAST(MAX(0, COALESCE(MIN(
    (SELECT json_extract(payload, '$.plannedMinutes') * 60
     FROM sync_outbox
     WHERE operation = 'session.start'
       AND json_extract(payload, '$.localSessionId') = active_sessions.id
     ORDER BY created_at ASC LIMIT 1),
    (planned_end_at - started_at - COALESCE(accumulated_paused_ms, 0)) / 1000
  ), (planned_end_at - started_at - COALESCE(accumulated_paused_ms, 0)) / 1000)) AS INTEGER)
  WHERE planned_focus_seconds IS NULL AND timer_mode = 'countdown' AND planned_end_at IS NOT NULL;
  INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (7, unixepoch() * 1000);
`;

export function getLoopTodoDatabase() {
  if (!databasePromise) {
    databasePromise = openAndMigrate().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

async function openAndMigrate() {
  const { openDatabaseAsync } = await import('expo-sqlite');
  const database = await openDatabaseAsync('looptodo.db');
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, category_id TEXT, category TEXT NOT NULL,
      kind TEXT NOT NULL, timer_mode TEXT NOT NULL, estimate_minutes INTEGER NOT NULL,
      rest_minutes INTEGER NOT NULL, deadline_at INTEGER, target_amount REAL, target_unit TEXT,
      completed_amount REAL NOT NULL DEFAULT 0, must_do INTEGER NOT NULL DEFAULT 0,
      trust_level TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
      sync_status TEXT NOT NULL DEFAULT 'pending', remote_active INTEGER NOT NULL DEFAULT 0,
      server_updated_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_categories (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, color TEXT, archived INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1, sync_status TEXT NOT NULL DEFAULT 'pending',
      server_updated_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY NOT NULL, task_id TEXT NOT NULL, mode TEXT NOT NULL, timer_mode TEXT NOT NULL,
      started_at INTEGER NOT NULL, planned_end_at INTEGER, planned_focus_seconds INTEGER,
      ended_at INTEGER NOT NULL, outcome TEXT NOT NULL,
      failure_reason TEXT, completion_note TEXT, duration_seconds INTEGER NOT NULL, completed_amount REAL, synced_at INTEGER,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    );
    CREATE TABLE IF NOT EXISTS active_sessions (
      singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1), id TEXT NOT NULL,
      task_id TEXT NOT NULL, mode TEXT NOT NULL, timer_mode TEXT NOT NULL, phase TEXT NOT NULL,
      started_at INTEGER NOT NULL, planned_end_at INTEGER, planned_focus_seconds INTEGER, rest_ends_at INTEGER,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    );
    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, target_minutes INTEGER NOT NULL,
      force_enabled INTEGER NOT NULL DEFAULT 0, trigger_time TEXT, status TEXT NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS habit_progress_entries (
      id TEXT PRIMARY KEY NOT NULL, habit_id TEXT NOT NULL, minutes INTEGER NOT NULL,
      progress_date TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL,
      FOREIGN KEY(habit_id) REFERENCES habits(id)
    );
    CREATE TABLE IF NOT EXISTS task_progress_entries (
      id TEXT PRIMARY KEY NOT NULL, task_id TEXT NOT NULL, amount REAL NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    );
    CREATE INDEX IF NOT EXISTS habit_progress_habit_date_idx ON habit_progress_entries(habit_id, progress_date);
    INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (1, unixepoch() * 1000);
    INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (2, unixepoch() * 1000);
  `);
  await ensureColumn(database, 'tasks', 'version', 'INTEGER NOT NULL DEFAULT 1');
  await ensureColumn(database, 'tasks', 'sync_status', "TEXT NOT NULL DEFAULT 'pending'");
  await ensureColumn(database, 'tasks', 'remote_active', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(database, 'tasks', 'server_updated_at', 'INTEGER');
  await ensureColumn(database, 'tasks', 'forced_trigger_time', 'TEXT');
  await ensureColumn(database, 'tasks', 'category_id', 'TEXT');
  await ensureColumn(database, 'tasks', 'whitelist_mode', "TEXT NOT NULL DEFAULT 'inherit'");
  await ensureColumn(database, 'tasks', 'whitelist_packages', "TEXT NOT NULL DEFAULT '[]'");
  await ensureColumn(database, 'focus_sessions', 'synced_at', 'INTEGER');
  await ensureColumn(database, 'focus_sessions', 'completion_note', 'TEXT');
  await ensureColumn(database, 'focus_sessions', 'planned_focus_seconds', 'INTEGER');
  await ensureColumn(database, 'active_sessions', 'paused_at', 'INTEGER');
  await ensureColumn(database, 'active_sessions', 'accumulated_paused_ms', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(database, 'active_sessions', 'planned_focus_seconds', 'INTEGER');
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY NOT NULL, operation TEXT NOT NULL, entity_id TEXT NOT NULL,
      payload TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', last_error TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sync_outbox_ready_idx ON sync_outbox(status, next_attempt_at, created_at);
    CREATE TABLE IF NOT EXISTS sync_entity_map (
      entity_type TEXT NOT NULL, local_id TEXT NOT NULL, server_id TEXT NOT NULL,
      created_at INTEGER NOT NULL, PRIMARY KEY(entity_type, local_id)
    );
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id TEXT PRIMARY KEY NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      outbox_id TEXT,
      code TEXT NOT NULL, local_snapshot TEXT, server_snapshot TEXT, created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS sync_state (
      scope TEXT PRIMARY KEY NOT NULL, cursor TEXT, last_success_at INTEGER, last_error_at INTEGER,
      last_error TEXT
    );
    INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (3, unixepoch() * 1000);
    CREATE TABLE IF NOT EXISTS notification_schedules (
      id TEXT PRIMARY KEY NOT NULL, event_type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
      data TEXT NOT NULL, scheduled_at INTEGER NOT NULL, platform_notification_id TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS notification_schedules_status_time_idx
      ON notification_schedules(status, scheduled_at);
    CREATE TABLE IF NOT EXISTS notification_preferences (
      singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1), task_reminders_enabled INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO notification_preferences(singleton_id, task_reminders_enabled, updated_at)
      VALUES (1, 1, unixepoch() * 1000);
    INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (4, unixepoch() * 1000);
    CREATE TABLE IF NOT EXISTS resource_passes (
      id TEXT PRIMARY KEY NOT NULL, task_id TEXT NOT NULL, type TEXT NOT NULL, value TEXT NOT NULL,
      display_name TEXT NOT NULL, value_hash TEXT NOT NULL, created_at INTEGER NOT NULL,
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS resource_passes_task_idx ON resource_passes(task_id, created_at);
    INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (5, unixepoch() * 1000);
  `);
  await database.execAsync(legacyDurationRepairSql);
  await ensureColumn(database, 'sync_conflicts', 'outbox_id', 'TEXT');
  return database;
}

async function ensureColumn(database: SQLiteDatabase, table: string, column: string, definition: string) {
  const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
