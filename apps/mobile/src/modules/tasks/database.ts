import type { SQLiteDatabase } from 'expo-sqlite';

let databasePromise: Promise<SQLiteDatabase> | null = null;

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
      id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL,
      kind TEXT NOT NULL, timer_mode TEXT NOT NULL, estimate_minutes INTEGER NOT NULL,
      rest_minutes INTEGER NOT NULL, deadline_at INTEGER, target_amount REAL, target_unit TEXT,
      completed_amount REAL NOT NULL DEFAULT 0, must_do INTEGER NOT NULL DEFAULT 0,
      trust_level TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY NOT NULL, task_id TEXT NOT NULL, mode TEXT NOT NULL, timer_mode TEXT NOT NULL,
      started_at INTEGER NOT NULL, planned_end_at INTEGER, ended_at INTEGER NOT NULL, outcome TEXT NOT NULL,
      failure_reason TEXT, duration_seconds INTEGER NOT NULL, completed_amount REAL,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    );
    CREATE TABLE IF NOT EXISTS active_sessions (
      singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1), id TEXT NOT NULL,
      task_id TEXT NOT NULL, mode TEXT NOT NULL, timer_mode TEXT NOT NULL, phase TEXT NOT NULL,
      started_at INTEGER NOT NULL, planned_end_at INTEGER, rest_ends_at INTEGER,
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
  return database;
}
