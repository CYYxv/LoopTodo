import type { SQLiteDatabase } from 'expo-sqlite';

import { getLoopTodoDatabase } from '@/modules/tasks/database';
import { createUuid } from '@/shared/uuid';

import type { SyncRepository } from './sync.repository';
import type { OutboxItem, SyncConflict, SyncOperation, SyncSnapshot } from './sync.types';

type OutboxRow = { id: string; operation: string; entity_id: string; payload: string; idempotency_key: string; attempts: number };
type ConflictRow = { id: string; entity_type: string; entity_id: string; outbox_id?: string | null; code: string; local_snapshot: string | null; server_snapshot: string | null; created_at: number };

export async function enqueueSyncOperation(
  database: SQLiteDatabase,
  operation: SyncOperation,
  entityId: string,
  idempotencyKey: string,
  now = Date.now()
) {
  await database.runAsync(`INSERT INTO sync_outbox
    (id, operation, entity_id, payload, idempotency_key, next_attempt_at, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`, createUuid(), operation.type, entityId,
    JSON.stringify(operation), idempotencyKey, now, now, now);
}

export function createSQLiteSyncRepository(
  getDatabase: () => Promise<SQLiteDatabase> = getLoopTodoDatabase,
  now: () => number = Date.now
): SyncRepository {
  return {
    async listReady(timestamp) {
      const database = await getDatabase();
      const rows = await database.getAllAsync<OutboxRow>(`SELECT id, operation, entity_id, payload, idempotency_key, attempts
        FROM sync_outbox WHERE status = 'pending' AND next_attempt_at <= ? ORDER BY created_at ASC, rowid ASC LIMIT 100`, timestamp);
      return rows.map((row) => ({ id: row.id, operation: JSON.parse(row.payload) as SyncOperation,
        entityId: row.entity_id, idempotencyKey: row.idempotency_key, attempts: row.attempts }));
    },
    async markDone(id) {
      const database = await getDatabase();
      await database.runAsync("UPDATE sync_outbox SET status = 'done', last_error = NULL, updated_at = ? WHERE id = ?", now(), id);
    },
    async scheduleRetry(id, attempts, nextAttemptAt, error) {
      const database = await getDatabase();
      await database.runAsync("UPDATE sync_outbox SET attempts = ?, next_attempt_at = ?, last_error = ?, updated_at = ? WHERE id = ?",
        attempts, nextAttemptAt, error, now(), id);
      await database.runAsync(`INSERT INTO sync_state(scope, last_error_at, last_error) VALUES ('task-focus', ?, ?)
        ON CONFLICT(scope) DO UPDATE SET last_error_at = excluded.last_error_at, last_error = excluded.last_error`, now(), error);
    },
    async recordConflict(item, code, serverSnapshot) {
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        await database.runAsync("UPDATE sync_outbox SET status = 'conflict', last_error = ?, updated_at = ? WHERE id = ?", code, now(), item.id);
        await database.runAsync(`INSERT INTO sync_conflicts
          (id, entity_type, entity_id, outbox_id, code, local_snapshot, server_snapshot, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, createUuid(), entityType(item.operation), item.entityId, item.id, code,
          JSON.stringify(item.operation), serverSnapshot ? JSON.stringify(serverSnapshot) : null, now());
        if (item.operation.type.startsWith('task.')) await database.runAsync("UPDATE tasks SET sync_status = 'conflict' WHERE id = ?", item.entityId);
      });
    },
    async saveEntityMap(type, localId, serverId) {
      const database = await getDatabase();
      await database.runAsync(`INSERT INTO sync_entity_map(entity_type, local_id, server_id, created_at)
        VALUES (?, ?, ?, ?) ON CONFLICT(entity_type, local_id) DO UPDATE SET server_id = excluded.server_id`, type, localId, serverId, now());
    },
    async getEntityMap(type, localId) {
      const database = await getDatabase();
      const row = await database.getFirstAsync<{ server_id: string }>('SELECT server_id FROM sync_entity_map WHERE entity_type = ? AND local_id = ?', type, localId);
      return row?.server_id ?? null;
    },
    async getCursor() {
      const database = await getDatabase();
      return (await database.getFirstAsync<{ cursor: string | null }>("SELECT cursor FROM sync_state WHERE scope = 'task-focus'"))?.cursor ?? null;
    },
    async mergeSnapshot(snapshot) {
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        for (const remote of snapshot.categories ?? []) await mergeCategory(database, remote, now());
        for (const remote of snapshot.tasks) await mergeTask(database, remote, now());
        for (const session of snapshot.sessions) {
          if (!session.endedAt) continue;
          const mapped = await database.getFirstAsync<{ local_id: string }>("SELECT local_id FROM sync_entity_map WHERE entity_type = 'session' AND server_id = ?", session.id);
          if (mapped) {
            await database.runAsync('UPDATE focus_sessions SET synced_at = ? WHERE id = ?', now(), mapped.local_id);
            continue;
          }
          const startedAt = Date.parse(session.startedAt);
          const plannedFocusSeconds = Math.max(0, Math.round(session.plannedMinutes * 60));
          await database.runAsync(`INSERT OR IGNORE INTO focus_sessions
            (id, task_id, mode, timer_mode, started_at, planned_end_at, planned_focus_seconds, ended_at,
             outcome, failure_reason, completion_note, duration_seconds, completed_amount, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`, session.id, session.taskId, session.mode,
            session.timerMode, startedAt, startedAt + plannedFocusSeconds * 1000, plannedFocusSeconds, Date.parse(session.endedAt),
            session.outcome === 'completed' ? 'completed' : 'exited', session.failureReasonText, session.completionNote ?? null,
            (session.actualMinutes ?? 0) * 60, now());
        }
        await database.runAsync(`INSERT INTO sync_state(scope, cursor, last_success_at, last_error)
          VALUES ('task-focus', ?, ?, NULL) ON CONFLICT(scope) DO UPDATE SET
          cursor = excluded.cursor, last_success_at = excluded.last_success_at, last_error = NULL`, snapshot.cursor, now());
      });
    },
    async summary() {
      const database = await getDatabase();
      const pending = (await database.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM sync_outbox WHERE status = 'pending'"))?.count ?? 0;
      const conflicts = await database.getAllAsync<ConflictRow>(`SELECT id, entity_type, entity_id, outbox_id, code, local_snapshot, server_snapshot, created_at
        FROM sync_conflicts WHERE resolved_at IS NULL ORDER BY created_at DESC`);
      const state = await database.getFirstAsync<{ last_error: string | null }>("SELECT last_error FROM sync_state WHERE scope = 'task-focus'");
      return { pending, conflicts: conflicts.map(mapConflict), lastError: state?.last_error ?? null };
    },
    async resolveConflict(id, strategy) {
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        const conflict = await database.getFirstAsync<ConflictRow>('SELECT * FROM sync_conflicts WHERE id = ? AND resolved_at IS NULL', id);
        if (!conflict) return;
        if (strategy === 'cloud') {
          if (conflict.outbox_id) await database.runAsync("UPDATE sync_outbox SET status = 'discarded', updated_at = ? WHERE id = ?", now(), conflict.outbox_id);
          else await database.runAsync("UPDATE sync_outbox SET status = 'discarded', updated_at = ? WHERE entity_id = ? AND status IN ('pending', 'conflict')", now(), conflict.entity_id);
          if (conflict.entity_type === 'task' && conflict.server_snapshot) {
            await mergeTask(database, JSON.parse(conflict.server_snapshot), now(), true);
          }
        } else {
          if (conflict.outbox_id) await database.runAsync("UPDATE sync_outbox SET status = 'pending', attempts = 0, next_attempt_at = ?, updated_at = ? WHERE id = ?", now(), now(), conflict.outbox_id);
          else await database.runAsync("UPDATE sync_outbox SET status = 'pending', attempts = 0, next_attempt_at = ?, updated_at = ? WHERE entity_id = ? AND status = 'conflict'", now(), now(), conflict.entity_id);
          if (conflict.entity_type === 'task') await database.runAsync("UPDATE tasks SET sync_status = 'pending' WHERE id = ?", conflict.entity_id);
        }
        await database.runAsync('UPDATE sync_conflicts SET resolved_at = ? WHERE id = ?', now(), id);
      });
    },
  };
}

async function mergeTask(database: SQLiteDatabase, remote: SyncSnapshot['tasks'][number], timestamp: number, force = false) {
  const local = await database.getFirstAsync<{ version: number; sync_status: string }>('SELECT version, sync_status FROM tasks WHERE id = ?', remote.id);
  const pending = (await database.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM sync_outbox WHERE entity_id = ? AND status IN ('pending', 'conflict')", remote.id))?.count ?? 0;
  if (!force && local && pending > 0) {
    if (remote.version >= local.version) {
      await database.runAsync("UPDATE tasks SET sync_status = 'conflict', remote_active = ? WHERE id = ?", remote.activeSessionId ? 1 : 0, remote.id);
      const existingConflict = await database.getFirstAsync<{ id: string }>("SELECT id FROM sync_conflicts WHERE entity_type = 'task' AND entity_id = ? AND resolved_at IS NULL", remote.id);
      if (!existingConflict) await database.runAsync(`INSERT INTO sync_conflicts
        (id, entity_type, entity_id, code, local_snapshot, server_snapshot, created_at) VALUES (?, 'task', ?, 'VERSION_CONFLICT', NULL, ?, ?)`,
        createUuid(), remote.id, JSON.stringify(remote), timestamp);
    }
    return;
  }
  const mapped = remote.activeSessionId
    ? await database.getFirstAsync<{ local_id: string }>(`SELECT map.local_id FROM sync_entity_map map
        INNER JOIN active_sessions active ON active.id = map.local_id
        WHERE map.entity_type = 'session' AND map.server_id = ?`, remote.activeSessionId)
    : null;
  const remoteActive = remote.activeSessionId && !mapped ? 1 : 0;
  const remoteStatus = remote.activeSessionId ? 'active' : remote.status === 'active' ? 'pending' : remote.status;
  const category = remote.categoryId ? await database.getFirstAsync<{ name: string }>('SELECT name FROM task_categories WHERE id = ? AND archived = 0', remote.categoryId) : null;
  await database.runAsync(`INSERT INTO tasks
    (id, title, category_id, category, kind, timer_mode, estimate_minutes, rest_minutes, deadline_at, target_amount,
     target_unit, completed_amount, must_do, forced_trigger_time, trust_level, status, version, sync_status, remote_active,
     whitelist_mode, whitelist_packages, server_updated_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'medium', ?, ?, 'synced', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, category_id = excluded.category_id, category = excluded.category, kind = excluded.kind, timer_mode = excluded.timer_mode,
      estimate_minutes = excluded.estimate_minutes, rest_minutes = excluded.rest_minutes,
      deadline_at = excluded.deadline_at, target_amount = excluded.target_amount,
      target_unit = excluded.target_unit, completed_amount = excluded.completed_amount,
      must_do = excluded.must_do,
      forced_trigger_time = COALESCE(excluded.forced_trigger_time, tasks.forced_trigger_time),
      status = excluded.status, version = excluded.version,
      sync_status = 'synced', remote_active = excluded.remote_active,
      whitelist_mode = excluded.whitelist_mode, whitelist_packages = excluded.whitelist_packages,
      server_updated_at = excluded.server_updated_at, updated_at = excluded.updated_at`,
    remote.id, remote.title, remote.categoryId, category?.name ?? '未分类', remote.taskType, remote.timerMode, remote.estimatedMinutes, remote.restMinutes,
    remote.deadlineAt ? Date.parse(remote.deadlineAt) : null, remote.targetAmount, remote.targetUnit,
    remote.completedAmount, remote.isTodayRequired ? 1 : 0, remote.forcedTriggerTime, remoteStatus, remote.version, remoteActive,
    remote.whitelistMode === 'custom' ? 'custom' : 'inherit',
    JSON.stringify(Array.isArray(remote.whitelistPackages) ? remote.whitelistPackages : []),
    Date.parse(remote.updatedAt), timestamp, timestamp);
}

async function mergeCategory(database: SQLiteDatabase, remote: NonNullable<SyncSnapshot['categories']>[number], timestamp: number) {
  const pending = (await database.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM sync_outbox WHERE entity_id = ? AND status IN ('pending', 'conflict')", remote.id))?.count ?? 0;
  if (pending > 0) return;
  await database.runAsync(`INSERT INTO task_categories
    (id, name, color, archived, version, sync_status, server_updated_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color, archived = excluded.archived,
      version = excluded.version, sync_status = 'synced', server_updated_at = excluded.server_updated_at, updated_at = excluded.updated_at`,
    remote.id, remote.name, remote.color, remote.archived ? 1 : 0, remote.version, Date.parse(remote.updatedAt), timestamp, timestamp);
  if (remote.archived) await database.runAsync("UPDATE tasks SET category_id = NULL, category = '未分类', updated_at = ? WHERE category_id = ?", timestamp, remote.id);
  else await database.runAsync('UPDATE tasks SET category = ?, updated_at = ? WHERE category_id = ?', remote.name, timestamp, remote.id);
}

function entityType(operation: SyncOperation) { return operation.type.startsWith('session.') ? 'session' : operation.type.startsWith('category.') ? 'category' : 'task'; }
function mapConflict(row: ConflictRow): SyncConflict {
  return { id: row.id, entityType: row.entity_type, entityId: row.entity_id, code: row.code,
    localSnapshot: row.local_snapshot, serverSnapshot: row.server_snapshot, createdAt: row.created_at };
}
