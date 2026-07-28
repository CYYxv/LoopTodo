import type { SQLiteDatabase } from 'expo-sqlite';

import { getLoopTodoDatabase } from '@/modules/tasks/database';
import type { Task } from '@/modules/tasks/task.types';
import { legacyWhitelistDefaultId } from '@/modules/whitelist/whitelist.migration';
import { createUuid } from '@/shared/uuid';

import type { SyncRepository } from './sync.repository';
import type { OutboxItem, RemoteWhitelistList, SyncConflict, SyncOperation, SyncSnapshot } from './sync.types';

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
        FROM sync_outbox WHERE status = 'pending' AND next_attempt_at <= ?
        ORDER BY CASE WHEN operation = 'whitelist.delete' THEN 2
          WHEN operation LIKE 'whitelist.%' THEN 0 ELSE 1 END, created_at ASC, rowid ASC LIMIT 100`, timestamp);
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
        if (item.operation.type.startsWith('whitelist.')) await database.runAsync("UPDATE whitelist_lists SET sync_status = 'conflict' WHERE id = ?", item.entityId);
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
        const timestamp = now();
        const whitelistLists = snapshot.whitelistLists ?? [];
        const remoteDefault = whitelistLists.find((item) => item.isDefault && !item.archivedAt);
        const legacyMerge = remoteDefault ? await mergeLegacyWhitelistDefault(database, remoteDefault, timestamp) : null;
        for (const remote of whitelistLists) {
          await mergeWhitelistList(database, legacyMerge?.remote.id === remote.id ? legacyMerge.remote : remote, timestamp);
        }
        if (legacyMerge?.needsUpload) {
          await database.runAsync("UPDATE whitelist_lists SET sync_status = 'pending', updated_at = ? WHERE id = ?", timestamp, legacyMerge.remote.id);
          await enqueueSyncOperation(database, { type: 'whitelist.update', listId: legacyMerge.remote.id,
            version: legacyMerge.remote.version, name: legacyMerge.remote.name, packages: legacyMerge.remote.packages }, legacyMerge.remote.id,
          `whitelist-migrate-${legacyMerge.remote.id}-${legacyMerge.remote.version}`, timestamp);
        }
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
             outcome, failure_reason, completion_note, duration_seconds, completed_amount, restriction_mode,
             whitelist_source, whitelist_package_count, restriction_effective, effective_minutes, allowed_packages_snapshot, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`, session.id, session.taskId, session.mode,
            session.timerMode, startedAt, startedAt + plannedFocusSeconds * 1000, plannedFocusSeconds, Date.parse(session.endedAt),
            session.outcome === 'completed' ? 'completed' : 'exited', session.failureReasonText, session.completionNote ?? null,
            (session.actualMinutes ?? 0) * 60, session.restrictionMode ?? 'none', session.whitelistSource ?? 'none',
            session.whitelistPackageCount ?? 0, session.restrictionEffective ? 1 : 0,
            session.effectiveMinutes ?? session.actualMinutes ?? 0, JSON.stringify(session.allowedPackagesSnapshot ?? []), now());
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
        const timestamp = now();
        if (conflict.entity_type === 'whitelist') {
          const server = parseRemoteWhitelistList(conflict.server_snapshot);
          const operation = parseWhitelistOperation(conflict.local_snapshot);
          if (!server) return;
          if (strategy === 'cloud') {
            await database.runAsync("DELETE FROM sync_outbox WHERE entity_id = ? AND operation LIKE 'whitelist.%' AND status IN ('pending', 'conflict')", conflict.entity_id);
            if (operation?.type === 'whitelist.create' && server.id !== conflict.entity_id) {
              await replaceWhitelistReferences(database, conflict.entity_id, server.id, timestamp);
              await database.runAsync('DELETE FROM whitelist_lists WHERE id = ?', conflict.entity_id);
            }
            await mergeWhitelistList(database, server, timestamp, true);
          } else {
            const local = await database.getFirstAsync<{ name: string; packages: string; is_default: number; archived_at: number | null }>(
              'SELECT name, packages, is_default, archived_at FROM whitelist_lists WHERE id = ?', conflict.entity_id,
            );
            if (!local) return;
            const packages = parsePackages(local.packages);
            await database.runAsync("DELETE FROM sync_outbox WHERE entity_id = ? AND operation LIKE 'whitelist.%' AND status IN ('pending', 'conflict')", conflict.entity_id);
            if (server.archivedAt && operation?.type === 'whitelist.delete') {
              await mergeWhitelistList(database, server, timestamp, true);
            } else if (server.archivedAt) {
              const recreatedId = createUuid();
              const localDefault = Boolean(local.is_default) || operation?.type === 'whitelist.set-default';
              if (localDefault) {
                await database.runAsync('UPDATE whitelist_lists SET is_default = 0 WHERE id != ? AND archived_at IS NULL', conflict.entity_id);
              }
              await database.runAsync(`UPDATE whitelist_lists SET id = ?, is_default = ?, version = ?, sync_status = 'pending',
                archived_at = NULL, server_updated_at = NULL, updated_at = ? WHERE id = ?`, recreatedId, localDefault ? 1 : 0,
              localDefault ? 2 : 1, timestamp, conflict.entity_id);
              await replaceWhitelistReferences(database, conflict.entity_id, recreatedId, timestamp);
              await enqueueSyncOperation(database, { type: 'whitelist.create', list: {
                id: recreatedId, name: local.name, packages, isDefault: false, version: 1, syncStatus: 'pending', archivedAt: null,
              } }, recreatedId, `whitelist-resolve-create-${recreatedId}`, timestamp);
              if (localDefault) await enqueueSyncOperation(database, {
                type: 'whitelist.set-default', listId: recreatedId, version: 1,
              }, recreatedId, `whitelist-resolve-default-${recreatedId}`, timestamp);
            } else if (operation?.type === 'whitelist.set-default') {
              await database.runAsync('UPDATE whitelist_lists SET is_default = 0 WHERE id != ? AND archived_at IS NULL', conflict.entity_id);
              await database.runAsync(`UPDATE whitelist_lists SET is_default = 1, version = ?, sync_status = 'pending',
                archived_at = NULL, server_updated_at = ?, updated_at = ? WHERE id = ?`, server.version + 1,
              Date.parse(server.updatedAt), timestamp, conflict.entity_id);
              await enqueueSyncOperation(database, { type: 'whitelist.set-default', listId: conflict.entity_id, version: server.version },
                conflict.entity_id, `whitelist-resolve-default-${conflict.entity_id}-${server.version}-${createUuid()}`, timestamp);
            } else if (operation?.type === 'whitelist.delete') {
              await database.runAsync(`UPDATE whitelist_lists SET is_default = 0, version = ?, sync_status = 'pending',
                server_updated_at = ?, updated_at = ? WHERE id = ?`, server.version + 1, Date.parse(server.updatedAt), timestamp,
              conflict.entity_id);
              await enqueueSyncOperation(database, { ...operation, version: server.version }, conflict.entity_id,
                `whitelist-resolve-delete-${conflict.entity_id}-${server.version}-${createUuid()}`, timestamp);
            } else {
              const targetId = operation?.type === 'whitelist.create' ? server.id : conflict.entity_id;
              if (targetId !== conflict.entity_id) {
                await database.runAsync('UPDATE whitelist_lists SET id = ? WHERE id = ?', targetId, conflict.entity_id);
                await replaceWhitelistReferences(database, conflict.entity_id, targetId, timestamp);
              }
              await database.runAsync(`UPDATE whitelist_lists SET name = ?, packages = ?, is_default = ?, version = ?, sync_status = 'pending',
                archived_at = NULL, server_updated_at = ?, updated_at = ? WHERE id = ?`, local.name, JSON.stringify(packages), server.isDefault ? 1 : 0,
              server.version + 1, Date.parse(server.updatedAt), timestamp, targetId);
              await enqueueSyncOperation(database, { type: 'whitelist.update', listId: targetId, version: server.version,
                name: local.name, packages }, targetId, `whitelist-resolve-${targetId}-${server.version}-${createUuid()}`, timestamp);
            }
          }
          await database.runAsync('UPDATE sync_conflicts SET resolved_at = ? WHERE id = ?', timestamp, id);
          return;
        }
        if (strategy === 'cloud') {
          if (conflict.outbox_id) await database.runAsync("UPDATE sync_outbox SET status = 'discarded', updated_at = ? WHERE id = ?", timestamp, conflict.outbox_id);
          else await database.runAsync("UPDATE sync_outbox SET status = 'discarded', updated_at = ? WHERE entity_id = ? AND status IN ('pending', 'conflict')", timestamp, conflict.entity_id);
          if (conflict.entity_type === 'task' && conflict.server_snapshot) {
            await mergeTask(database, JSON.parse(conflict.server_snapshot), timestamp, true);
          }
        } else {
          if (conflict.outbox_id) await database.runAsync("UPDATE sync_outbox SET status = 'pending', attempts = 0, next_attempt_at = ?, updated_at = ? WHERE id = ?", timestamp, timestamp, conflict.outbox_id);
          else await database.runAsync("UPDATE sync_outbox SET status = 'pending', attempts = 0, next_attempt_at = ?, updated_at = ? WHERE entity_id = ? AND status = 'conflict'", timestamp, timestamp, conflict.entity_id);
          if (conflict.entity_type === 'task') await database.runAsync("UPDATE tasks SET sync_status = 'pending' WHERE id = ?", conflict.entity_id);
        }
        await database.runAsync('UPDATE sync_conflicts SET resolved_at = ? WHERE id = ?', timestamp, id);
      });
    },
  };
}

async function replaceWhitelistReferences(database: SQLiteDatabase, previousId: string, nextId: string, timestamp: number) {
  const tasks = await database.getAllAsync<ReferencedTaskRow>(`SELECT id, title, category_id AS categoryId, category,
    timer_mode AS timerMode, estimate_minutes AS estimateMinutes, rest_minutes AS restMinutes, deadline_at AS deadlineAt,
    target_amount AS targetAmount, target_unit AS targetUnit, must_do AS mustDo, forced_trigger_time AS forcedTriggerTime,
    status, version, sync_status AS syncStatus, restriction_mode AS restrictionMode, whitelist_mode AS whitelistMode,
    whitelist_list_id AS whitelistListId, whitelist_packages AS whitelistPackages
    FROM tasks WHERE whitelist_list_id = ?`, previousId);
  for (const task of tasks) {
    if (task.syncStatus !== 'synced') continue;
    const previousVersion = task.version;
    await database.runAsync(`UPDATE tasks SET whitelist_list_id = ?, version = ?, sync_status = 'pending', updated_at = ?
      WHERE id = ? AND version = ? AND whitelist_list_id = ?`, nextId, previousVersion + 1, timestamp, task.id, previousVersion, previousId);
    await enqueueSyncOperation(database, { type: 'task.update', taskId: task.id, version: previousVersion, patch: {
      title: task.title, categoryId: task.categoryId, category: task.category, timerMode: task.timerMode,
      estimateMinutes: task.estimateMinutes, restMinutes: task.restMinutes, deadlineAt: task.deadlineAt,
      targetAmount: task.targetAmount, targetUnit: task.targetUnit, mustDo: Boolean(task.mustDo),
      forcedTriggerTime: task.forcedTriggerTime, restrictionMode: task.restrictionMode,
      whitelistMode: task.whitelistMode, whitelistListId: nextId, whitelistPackages: parsePackages(task.whitelistPackages),
      status: task.status,
    } }, task.id, `task-whitelist-resolve-${task.id}-${previousVersion}-${createUuid()}`, timestamp);
  }
  await database.runAsync(`UPDATE tasks SET whitelist_list_id = ?, updated_at = ? WHERE whitelist_list_id = ?
    AND sync_status != 'synced'`, nextId, timestamp, previousId);
  await database.runAsync(`UPDATE sync_outbox SET payload = json_set(payload, '$.task.whitelistListId', ?), updated_at = ?
    WHERE operation = 'task.create' AND json_extract(payload, '$.task.whitelistListId') = ?`, nextId, timestamp, previousId);
  await database.runAsync(`UPDATE sync_outbox SET payload = json_set(payload, '$.patch.whitelistListId', ?), updated_at = ?
    WHERE operation = 'task.update' AND json_extract(payload, '$.patch.whitelistListId') = ?`, nextId, timestamp, previousId);
  await database.runAsync(`UPDATE sync_outbox SET payload = json_set(payload, '$.whitelistSource', ?), updated_at = ?
    WHERE operation = 'session.start' AND json_extract(payload, '$.whitelistSource') = ?`, `list:${nextId}`, timestamp, `list:${previousId}`);
  await database.runAsync(`UPDATE sync_outbox SET payload = json_set(payload, '$.record.whitelistSource', ?), updated_at = ?
    WHERE operation = 'session.finish' AND json_extract(payload, '$.record.whitelistSource') = ?`, `list:${nextId}`, timestamp, `list:${previousId}`);
  await database.runAsync('UPDATE active_sessions SET whitelist_source = ? WHERE whitelist_source = ?', `list:${nextId}`, `list:${previousId}`);
  await database.runAsync('UPDATE focus_sessions SET whitelist_source = ? WHERE whitelist_source = ?', `list:${nextId}`, `list:${previousId}`);
  await database.runAsync(`UPDATE sync_outbox SET payload = json_set(payload, '$.replacementId', ?), updated_at = ?
    WHERE operation = 'whitelist.delete' AND json_extract(payload, '$.replacementId') = ?`, nextId, timestamp, previousId);
}

async function mergeLegacyWhitelistDefault(
  database: SQLiteDatabase,
  remote: NonNullable<SyncSnapshot['whitelistLists']>[number],
  timestamp: number,
) {
  const legacy = await database.getFirstAsync<{ name: string; packages: string; archived_at: number | null }>(`SELECT name, packages, archived_at FROM whitelist_lists
    WHERE id = ? AND server_updated_at IS NULL`, legacyWhitelistDefaultId);
  if (!legacy) return { remote, needsUpload: false };
  const pendingUpdate = legacy.archived_at == null
    ? await database.getFirstAsync<{ name: string | null }>(`SELECT json_extract(payload, '$.name') AS name FROM sync_outbox
        WHERE entity_id = ? AND operation = 'whitelist.update' AND status IN ('pending', 'conflict')
        ORDER BY created_at DESC, rowid DESC LIMIT 1`, legacyWhitelistDefaultId)
    : null;
  const pendingName = pendingUpdate?.name?.trim();
  const name = pendingName && pendingName !== '默认名单' ? pendingName : remote.name;
  const packages = legacy.archived_at == null
    ? normalizePackages([...remote.packages, ...parsePackages(legacy.packages)])
    : normalizePackages(remote.packages);
  if (remote.id !== legacyWhitelistDefaultId) {
    await database.runAsync('UPDATE tasks SET whitelist_list_id = ?, updated_at = ? WHERE whitelist_list_id = ?',
      remote.id, timestamp, legacyWhitelistDefaultId);
    await database.runAsync(`UPDATE sync_outbox SET payload = json_set(payload, '$.task.whitelistListId', ?), updated_at = ?
      WHERE operation = 'task.create' AND json_extract(payload, '$.task.whitelistListId') = ?`,
    remote.id, timestamp, legacyWhitelistDefaultId);
    await database.runAsync(`UPDATE sync_outbox SET payload = json_set(payload, '$.patch.whitelistListId', ?), updated_at = ?
      WHERE operation = 'task.update' AND json_extract(payload, '$.patch.whitelistListId') = ?`,
    remote.id, timestamp, legacyWhitelistDefaultId);
    await database.runAsync(`UPDATE sync_outbox SET payload = json_set(payload, '$.whitelistSource', ?), updated_at = ?
      WHERE operation = 'session.start' AND json_extract(payload, '$.whitelistSource') = ?`,
    `list:${remote.id}`, timestamp, `list:${legacyWhitelistDefaultId}`);
    await database.runAsync(`UPDATE sync_outbox SET payload = json_set(payload, '$.record.whitelistSource', ?), updated_at = ?
      WHERE operation = 'session.finish' AND json_extract(payload, '$.record.whitelistSource') = ?`,
    `list:${remote.id}`, timestamp, `list:${legacyWhitelistDefaultId}`);
    await database.runAsync("UPDATE active_sessions SET whitelist_source = ? WHERE whitelist_source = ?",
      `list:${remote.id}`, `list:${legacyWhitelistDefaultId}`);
    await database.runAsync("UPDATE focus_sessions SET whitelist_source = ? WHERE whitelist_source = ?",
      `list:${remote.id}`, `list:${legacyWhitelistDefaultId}`);
    await database.runAsync(`UPDATE sync_outbox SET payload = json_set(payload, '$.replacementId', ?), updated_at = ?
      WHERE operation = 'whitelist.delete' AND json_extract(payload, '$.replacementId') = ?`,
    remote.id, timestamp, legacyWhitelistDefaultId);
    await database.runAsync("DELETE FROM sync_outbox WHERE entity_id = ? AND operation LIKE 'whitelist.%'", legacyWhitelistDefaultId);
    await database.runAsync('DELETE FROM whitelist_lists WHERE id = ?', legacyWhitelistDefaultId);
  }
  return { remote: { ...remote, name, packages }, needsUpload: legacy.archived_at == null &&
    (name !== remote.name || packages.length > normalizePackages(remote.packages).length) };
}

function parsePackages(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function normalizePackages(packages: string[]) {
  return [...new Set(packages.map((item) => item.trim()).filter(Boolean))];
}

async function mergeTask(database: SQLiteDatabase, remote: SyncSnapshot['tasks'][number], timestamp: number, force = false) {
  const local = await database.getFirstAsync<{ version: number; sync_status: string; whitelist_list_id: string | null }>(
    'SELECT version, sync_status, whitelist_list_id FROM tasks WHERE id = ?', remote.id,
  );
  if (!force && local?.whitelist_list_id) {
    const whitelistConflict = await database.getFirstAsync<{ id: string }>(
      "SELECT id FROM sync_conflicts WHERE entity_type = 'whitelist' AND entity_id = ? AND resolved_at IS NULL",
      local.whitelist_list_id,
    );
    if (whitelistConflict) return;
  }
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
  const restrictionMode = remote.restrictionMode ?? 'whitelist';
  const whitelistMode = remote.whitelistMode === 'custom' ? 'custom' : 'list';
  await database.runAsync(`INSERT INTO tasks
    (id, title, category_id, category, kind, timer_mode, estimate_minutes, rest_minutes, deadline_at, target_amount,
     target_unit, completed_amount, must_do, forced_trigger_time, trust_level, status, version, sync_status, remote_active,
     restriction_mode, whitelist_mode, whitelist_list_id, whitelist_packages, server_updated_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'medium', ?, ?, 'synced', ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, category_id = excluded.category_id, category = excluded.category, kind = excluded.kind, timer_mode = excluded.timer_mode,
      estimate_minutes = excluded.estimate_minutes, rest_minutes = excluded.rest_minutes,
      deadline_at = excluded.deadline_at, target_amount = excluded.target_amount,
      target_unit = excluded.target_unit, completed_amount = excluded.completed_amount,
      must_do = excluded.must_do,
      forced_trigger_time = COALESCE(excluded.forced_trigger_time, tasks.forced_trigger_time),
      status = excluded.status, version = excluded.version,
      sync_status = 'synced', remote_active = excluded.remote_active,
      restriction_mode = excluded.restriction_mode, whitelist_mode = excluded.whitelist_mode,
      whitelist_list_id = excluded.whitelist_list_id, whitelist_packages = excluded.whitelist_packages,
      server_updated_at = excluded.server_updated_at, updated_at = excluded.updated_at`,
    remote.id, remote.title, remote.categoryId, category?.name ?? '未分类', remote.taskType, remote.timerMode, remote.estimatedMinutes, remote.restMinutes,
    remote.deadlineAt ? Date.parse(remote.deadlineAt) : null, remote.targetAmount, remote.targetUnit,
    remote.completedAmount, remote.isTodayRequired ? 1 : 0, remote.forcedTriggerTime, remoteStatus, remote.version, remoteActive,
    restrictionMode, whitelistMode, restrictionMode === 'whitelist' && whitelistMode === 'list' ? remote.whitelistListId ?? null : null,
    JSON.stringify(restrictionMode === 'whitelist' && whitelistMode === 'custom' && Array.isArray(remote.whitelistPackages) ? remote.whitelistPackages : []),
    Date.parse(remote.updatedAt), timestamp, timestamp);
}

async function mergeWhitelistList(database: SQLiteDatabase, remote: NonNullable<SyncSnapshot['whitelistLists']>[number], timestamp: number, force = false) {
  const pending = force ? 0 : (await database.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM sync_outbox WHERE entity_id = ? AND operation LIKE 'whitelist.%' AND status IN ('pending', 'conflict')", remote.id))?.count ?? 0;
  if (!force && pending > 0) return;
  if (remote.isDefault && !remote.archivedAt) await database.runAsync('UPDATE whitelist_lists SET is_default = 0 WHERE id != ? AND archived_at IS NULL', remote.id);
  await database.runAsync(`INSERT INTO whitelist_lists
    (id, name, packages, is_default, version, sync_status, archived_at, server_updated_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, packages = excluded.packages, is_default = excluded.is_default,
      version = excluded.version, sync_status = 'synced', archived_at = excluded.archived_at,
      server_updated_at = excluded.server_updated_at, updated_at = excluded.updated_at`,
    remote.id, remote.name, JSON.stringify(remote.packages ?? []), remote.isDefault ? 1 : 0, remote.version,
    remote.archivedAt ? Date.parse(remote.archivedAt) : null, Date.parse(remote.updatedAt), timestamp, timestamp);
}

function parseRemoteWhitelistList(raw: string | null): RemoteWhitelistList | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const candidate = parsed && typeof parsed === 'object' && 'data' in parsed
      ? (parsed as { data?: unknown }).data
      : parsed;
    if (!candidate || typeof candidate !== 'object') return null;
    const value = candidate as Partial<RemoteWhitelistList>;
    if (typeof value.id !== 'string' || typeof value.name !== 'string' || !Array.isArray(value.packages) ||
      typeof value.isDefault !== 'boolean' || typeof value.version !== 'number' ||
      (value.archivedAt !== null && typeof value.archivedAt !== 'string') || typeof value.updatedAt !== 'string') return null;
    return value as RemoteWhitelistList;
  } catch {
    return null;
  }
}

type WhitelistOperation = Extract<SyncOperation, { type: `whitelist.${string}` }>;

type ReferencedTaskRow = {
  id: string;
  title: string;
  categoryId: string | null;
  category: string;
  timerMode: Task['timerMode'];
  estimateMinutes: number;
  restMinutes: number;
  deadlineAt: number | null;
  targetAmount: number | null;
  targetUnit: string | null;
  mustDo: number;
  forcedTriggerTime: string | null;
  status: Extract<Task['status'], 'pending' | 'completed' | 'failed'>;
  version: number;
  syncStatus: Task['syncStatus'];
  restrictionMode: Task['restrictionMode'];
  whitelistMode: Task['whitelistMode'];
  whitelistListId: string;
  whitelistPackages: string;
};

function parseWhitelistOperation(raw: string | null): WhitelistOperation | null {
  if (!raw) return null;
  try {
    const operation = JSON.parse(raw) as Partial<SyncOperation>;
    return typeof operation.type === 'string' && operation.type.startsWith('whitelist.')
      ? operation as WhitelistOperation
      : null;
  } catch {
    return null;
  }
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

function entityType(operation: SyncOperation) { return operation.type.startsWith('session.') ? 'session' : operation.type.startsWith('category.') ? 'category' : operation.type.startsWith('whitelist.') ? 'whitelist' : 'task'; }
function mapConflict(row: ConflictRow): SyncConflict {
  return { id: row.id, entityType: row.entity_type, entityId: row.entity_id, code: row.code,
    localSnapshot: row.local_snapshot, serverSnapshot: row.server_snapshot, createdAt: row.created_at };
}
