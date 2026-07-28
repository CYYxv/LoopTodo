import { createSQLiteSyncRepository } from '../sqlite-sync.repository';
import type { SyncOperation } from '../sync.types';

test('uploads a created list and its referencing task before archiving the list', async () => {
  let query = '';
  const rows = [
    outboxRow('list-create', 'whitelist.create', { type: 'whitelist.create', list: { id: 'list-a' } }, 1),
    outboxRow('task-create', 'task.create', { type: 'task.create', task: { id: 'task-1', whitelistListId: 'list-a' } }, 2),
    outboxRow('list-delete', 'whitelist.delete', { type: 'whitelist.delete', listId: 'list-a', version: 1, replacementId: 'default' }, 3),
  ];
  const database = {
    async getAllAsync(sql: string) {
      query = sql;
      const archiveLast = sql.includes("WHEN operation = 'whitelist.delete' THEN 2");
      return [...rows].sort((left, right) => priority(left.operation, archiveLast) - priority(right.operation, archiveLast)
        || left.created_at - right.created_at);
    },
  };
  const repository = createSQLiteSyncRepository(async () => database as never);

  const ready = await repository.listReady(10);

  expect(ready.map((item) => item.operation.type)).toEqual(['whitelist.create', 'task.create', 'whitelist.delete']);
  expect(query).toContain("WHEN operation = 'whitelist.delete' THEN 2");
});

test('merges whitelist lists before tasks from a snapshot', async () => {
  const writes: string[] = [];
  const database = {
    async withTransactionAsync(run: () => Promise<void>) { await run(); },
    async getFirstAsync(sql: string) { if (sql.includes('COUNT(*)')) return { count: 0 }; return null; },
    async runAsync(sql: string) { writes.push(sql); return { changes: 1 }; },
  };
  const repository = createSQLiteSyncRepository(async () => database as never, () => 1);

  await repository.mergeSnapshot({ cursor: 'cursor', whitelistLists: [{
    id: 'list-1', name: '学习', packages: ['com.reader'], isDefault: true, version: 2,
    archivedAt: null, updatedAt: '2026-07-26T00:00:00.000Z',
  }], tasks: [], sessions: [] });

  expect(writes.findIndex((sql) => sql.includes('whitelist_lists'))).toBeLessThan(writes.findIndex((sql) => sql.includes('sync_state')));
});

test('applies the complete server whitelist when resolving a conflict with cloud', async () => {
  const database = createWhitelistConflictDatabase();
  const repository = createSQLiteSyncRepository(async () => database as never, () => 500);

  await repository.resolveConflict('conflict-1', 'cloud');

  expect(database.list).toEqual({
    id: 'list-1', name: '云端名单', packages: ['com.cloud'], isDefault: true,
    version: 7, syncStatus: 'synced', archivedAt: null, serverUpdatedAt: Date.parse('2026-07-27T00:00:00.000Z'),
  });
  expect(database.outbox).toEqual([]);
  expect(database.conflict.resolved_at).toBe(500);
});

test('rebuilds a version-correct whitelist update when resolving a conflict with local', async () => {
  const database = createWhitelistConflictDatabase();
  const repository = createSQLiteSyncRepository(async () => database as never, () => 500);

  await repository.resolveConflict('conflict-1', 'local');

  expect(database.list).toEqual(expect.objectContaining({
    id: 'list-1', name: '本地名单', packages: ['com.local'], isDefault: true,
    version: 8, syncStatus: 'pending', archivedAt: null,
  }));
  expect(database.outbox).toEqual([expect.objectContaining({
    operation: 'whitelist.update', entityId: 'list-1', status: 'pending',
    payload: { type: 'whitelist.update', listId: 'list-1', version: 7, name: '本地名单', packages: ['com.local'] },
  })]);
  expect(database.conflict.resolved_at).toBe(500);
});

test('rebuilds set-default with the latest server version when resolving with local', async () => {
  const database = createOperationConflictDatabase({
    operation: { type: 'whitelist.set-default', listId: 'list-1', version: 2 },
  });
  const repository = createSQLiteSyncRepository(async () => database as never, () => 500);

  await repository.resolveConflict('conflict-1', 'local');

  expect(database.list).toEqual(expect.objectContaining({ isDefault: true, version: 8, syncStatus: 'pending' }));
  expect(database.outbox).toEqual([expect.objectContaining({
    operation: 'whitelist.set-default', entityId: 'list-1',
    payload: { type: 'whitelist.set-default', listId: 'list-1', version: 7 },
  })]);
});

test('rebuilds delete with its replacement and latest server version when resolving with local', async () => {
  const database = createOperationConflictDatabase({
    operation: { type: 'whitelist.delete', listId: 'list-1', version: 2, replacementId: 'default-list' },
    localOverrides: { archivedAt: 400, syncStatus: 'conflict' },
  });
  const repository = createSQLiteSyncRepository(async () => database as never, () => 500);

  await repository.resolveConflict('conflict-1', 'local');

  expect(database.list).toEqual(expect.objectContaining({ version: 8, syncStatus: 'pending', archivedAt: 400 }));
  expect(database.outbox).toEqual([expect.objectContaining({
    operation: 'whitelist.delete', entityId: 'list-1',
    payload: { type: 'whitelist.delete', listId: 'list-1', version: 7, replacementId: 'default-list' },
  })]);
});

test('maps a same-name create conflict to the remote id before keeping local content', async () => {
  const database = createOperationConflictDatabase({
    operation: { type: 'whitelist.create', list: {
      id: 'local-list', name: '学习名单', packages: ['com.local'], isDefault: false, version: 1, syncStatus: 'pending',
    } },
    serverOverrides: { id: 'remote-list', name: '学习名单', packages: ['com.cloud'], isDefault: false },
    localOverrides: { id: 'local-list', name: '学习名单' },
  });
  const repository = createSQLiteSyncRepository(async () => database as never, () => 500);

  await repository.resolveConflict('conflict-1', 'local');

  expect(database.list).toEqual(expect.objectContaining({ id: 'remote-list', name: '学习名单', packages: ['com.local'], version: 8 }));
  expect(database.outbox).toEqual([expect.objectContaining({
    operation: 'whitelist.update', entityId: 'remote-list',
    payload: { type: 'whitelist.update', listId: 'remote-list', version: 7, name: '学习名单', packages: ['com.local'] },
  })]);
});

test('applies a remote whitelist tombstone when resolving with cloud', async () => {
  const database = createWhitelistConflictDatabase({
    isDefault: false, version: 4, archivedAt: '2026-07-27T01:00:00.000Z', updatedAt: '2026-07-27T01:00:00.000Z',
  });
  const repository = createSQLiteSyncRepository(async () => database as never, () => 500);

  await repository.resolveConflict('conflict-1', 'cloud');

  expect(database.list).toEqual(expect.objectContaining({
    id: 'list-1', version: 4, syncStatus: 'synced', archivedAt: Date.parse('2026-07-27T01:00:00.000Z'),
  }));
  expect(database.outbox).toEqual([]);
  expect(database.conflict.resolved_at).toBe(500);
});

test('recreates local whitelist content under a new id when resolving a tombstone with local', async () => {
  const database = createWhitelistConflictDatabase({
    isDefault: false, version: 4, archivedAt: '2026-07-27T01:00:00.000Z', updatedAt: '2026-07-27T01:00:00.000Z',
  });
  const repository = createSQLiteSyncRepository(async () => database as never, () => 500);

  await repository.resolveConflict('conflict-1', 'local');

  expect(database.list).toEqual(expect.objectContaining({
    name: '本地名单', packages: ['com.local'], isDefault: false, version: 1, syncStatus: 'pending', archivedAt: null,
  }));
  expect(database.list.id).not.toBe('list-1');
  expect(database.outbox).toEqual([expect.objectContaining({
    operation: 'whitelist.create', entityId: database.list.id, status: 'pending',
    payload: { type: 'whitelist.create', list: expect.objectContaining({ id: database.list.id, name: '本地名单', packages: ['com.local'] }) },
  })]);
  expect(database.conflict.resolved_at).toBe(500);
});

test('preserves set-default intent when recreating a remotely deleted whitelist', async () => {
  const database = createOperationConflictDatabase({
    operation: { type: 'whitelist.set-default', listId: 'list-1', version: 2 },
    serverOverrides: { isDefault: false, version: 4, archivedAt: '2026-07-27T01:00:00.000Z' },
    localOverrides: { isDefault: false },
  });
  const repository = createSQLiteSyncRepository(async () => database as never, () => 500);

  await repository.resolveConflict('conflict-1', 'local');

  expect(database.list).toEqual(expect.objectContaining({ isDefault: true, version: 2, syncStatus: 'pending' }));
  expect(database.outbox).toEqual(expect.arrayContaining([expect.objectContaining({
    operation: 'whitelist.set-default', entityId: database.list.id,
    payload: { type: 'whitelist.set-default', listId: database.list.id, version: 1 },
  })]));
});

test('versions and enqueues affected tasks when keeping a locally recreated tombstone', async () => {
  const database = createOperationConflictDatabase({
    operation: { type: 'whitelist.update', listId: 'list-1', version: 2, name: '本地名单', packages: ['com.local'] },
    serverOverrides: { isDefault: false, version: 4, archivedAt: '2026-07-27T01:00:00.000Z' },
    tasks: [localTask()],
  });
  const repository = createSQLiteSyncRepository(async () => database as never, () => 500);

  await repository.resolveConflict('conflict-1', 'local');

  const recreatedId = database.list.id;
  expect(recreatedId).not.toBe('list-1');
  expect(database.tasks[0]).toEqual(expect.objectContaining({
    whitelistListId: recreatedId, version: 6, syncStatus: 'pending',
  }));
  expect(database.outbox).toEqual(expect.arrayContaining([expect.objectContaining({
    operation: 'task.update', entityId: 'task-1',
    payload: expect.objectContaining({
      type: 'task.update', taskId: 'task-1', version: 5,
      patch: expect.objectContaining({ whitelistListId: recreatedId, status: 'pending' }),
    }),
  })]));
});

test('keeps task references intact while their whitelist tombstone conflict is unresolved', async () => {
  const writes: string[] = [];
  const database = {
    async withTransactionAsync(run: () => Promise<void>) { await run(); },
    async getFirstAsync<T>(sql: string, ...args: unknown[]) {
      if (sql.includes('WHERE id = ? AND server_updated_at IS NULL')) return null as T;
      if (sql.includes('COUNT(*)') && sql.includes('sync_outbox')) return ({ count: args[0] === 'list-1' ? 1 : 0 } as T);
      if (sql.includes('SELECT version, sync_status') && sql.includes('FROM tasks')) {
        return ({ version: 5, sync_status: 'synced', whitelist_list_id: 'list-1' } as T);
      }
      if (sql.includes("entity_type = 'whitelist'") && sql.includes('sync_conflicts')) return ({ id: 'conflict-1' } as T);
      return null as T;
    },
    async runAsync(sql: string) { writes.push(sql); return { changes: 1 }; },
  };
  const repository = createSQLiteSyncRepository(async () => database as never, () => 500);

  await repository.mergeSnapshot({
    cursor: 'cursor', whitelistLists: [{
      id: 'list-1', name: '已删除名单', packages: [], isDefault: false, version: 4,
      archivedAt: '2026-07-27T01:00:00.000Z', updatedAt: '2026-07-27T01:00:00.000Z',
    }], sessions: [], tasks: [{
      id: 'task-1', categoryId: null, title: '本地任务', taskType: 'pomodoro', timerMode: 'countdown',
      estimatedMinutes: 25, restMinutes: 5, deadlineAt: null, targetAmount: null, targetUnit: null,
      completedAmount: 0, isTodayRequired: false, forcedTriggerTime: null, restrictionMode: 'whitelist',
      whitelistMode: 'list', whitelistListId: 'default-list', whitelistPackages: [], status: 'pending',
      activeSessionId: null, version: 6, updatedAt: '2026-07-27T01:00:00.000Z',
    }],
  });

  expect(writes.some((sql) => sql.includes('INSERT INTO tasks'))).toBe(false);
});

test('persists the forced trigger time from a remote task snapshot', async () => {
  const writes: Array<{ sql: string; args: unknown[] }> = [];
  const database = {
    async withTransactionAsync(run: () => Promise<void>) { await run(); },
    async getFirstAsync(sql: string) {
      if (sql.includes('COUNT(*)')) return { count: 0 };
      return null;
    },
    async runAsync(sql: string, ...args: unknown[]) { writes.push({ sql, args }); return { changes: 1 }; },
  };
  const repository = createSQLiteSyncRepository(async () => database as never, () => 1);

  await repository.mergeSnapshot({
    cursor: '2026-07-17T00:00:00.000Z', sessions: [], tasks: [{
      id: 'task-1', categoryId: null, title: '今日任务', taskType: 'pomodoro', timerMode: 'countdown',
      estimatedMinutes: 25, restMinutes: 5, deadlineAt: null, targetAmount: null, targetUnit: null,
      completedAmount: 0, isTodayRequired: true, forcedTriggerTime: '20:00', status: 'pending',
      activeSessionId: null, version: 2, updatedAt: '2026-07-17T00:00:00.000Z',
    }],
  });

  const taskWrite = writes.find((write) => write.sql.includes('INSERT INTO tasks'));
  expect(taskWrite?.sql).toContain('forced_trigger_time');
  expect(taskWrite?.args).toContain('20:00');
});

test('keeps a local trigger time when a legacy remote snapshot omits it', async () => {
  const writes: Array<{ sql: string; args: unknown[] }> = [];
  const database = {
    async withTransactionAsync(run: () => Promise<void>) { await run(); },
    async getFirstAsync(sql: string) {
      if (sql.includes('COUNT(*)')) return { count: 0 };
      return null;
    },
    async runAsync(sql: string, ...args: unknown[]) { writes.push({ sql, args }); return { changes: 1 }; },
  };
  const repository = createSQLiteSyncRepository(async () => database as never, () => 1);

  await repository.mergeSnapshot({
    cursor: '2026-07-17T00:00:00.000Z', sessions: [], tasks: [{
      id: 'task-1', categoryId: null, title: '今日任务', taskType: 'pomodoro', timerMode: 'countdown',
      estimatedMinutes: 25, restMinutes: 5, deadlineAt: null, targetAmount: null, targetUnit: null,
      completedAmount: 0, isTodayRequired: true, forcedTriggerTime: null, status: 'pending',
      activeSessionId: null, version: 2, updatedAt: '2026-07-17T00:00:00.000Z',
    }],
  });

  const taskWrite = writes.find((write) => write.sql.includes('INSERT INTO tasks'));
  expect(taskWrite?.sql).toContain('forced_trigger_time = COALESCE(excluded.forced_trigger_time, tasks.forced_trigger_time)');
});

test('persists the planned focus seconds from a remote session snapshot', async () => {
  const writes: Array<{ sql: string; args: unknown[] }> = [];
  const database = {
    async withTransactionAsync(run: () => Promise<void>) { await run(); },
    async getFirstAsync() { return null; },
    async runAsync(sql: string, ...args: unknown[]) { writes.push({ sql, args }); return { changes: 1 }; },
  };
  const repository = createSQLiteSyncRepository(async () => database as never, () => 1);

  await repository.mergeSnapshot({
    cursor: '2026-07-17T00:00:00.000Z', tasks: [], sessions: [{
      id: 'session-1', taskId: 'task-1', mode: 'focus', timerMode: 'countdown',
      startedAt: '2026-07-17T00:00:00.000Z', endedAt: '2026-07-17T00:25:00.000Z',
      plannedMinutes: 25, actualMinutes: 25, outcome: 'completed', failureReasonText: null,
      allowedPackagesSnapshot: ['com.reader', 'com.notes'],
      updatedAt: '2026-07-17T00:25:00.000Z',
    }],
  });

  const sessionWrite = writes.find((write) => write.sql.includes('INSERT OR IGNORE INTO focus_sessions'));
  expect(sessionWrite?.sql).toContain('planned_focus_seconds');
  expect(sessionWrite?.args).toContain(1_500);
  expect(sessionWrite?.args).toContain(JSON.stringify(['com.reader', 'com.notes']));
});

function outboxRow(id: string, operation: string, payload: Record<string, unknown>, createdAt: number) {
  return { id, operation, entity_id: id, payload: JSON.stringify(payload), idempotency_key: id, attempts: 0, created_at: createdAt };
}

function priority(operation: string, archiveLast: boolean) {
  if (archiveLast && operation === 'whitelist.delete') return 2;
  return operation.startsWith('whitelist.') ? 0 : 1;
}

function createOperationConflictDatabase({
  operation,
  serverOverrides = {},
  localOverrides = {},
  tasks = [],
}: {
  operation: Extract<SyncOperation, { type: `whitelist.${string}` }>;
  serverOverrides?: Partial<{ id: string; name: string; packages: string[]; isDefault: boolean; version: number; archivedAt: string | null; updatedAt: string }>;
  localOverrides?: Partial<{ id: string; name: string; packages: string[]; isDefault: boolean; version: number; syncStatus: string; archivedAt: number | null; serverUpdatedAt: number | null }>;
  tasks?: ReturnType<typeof localTask>[];
}) {
  const entityId = operation.type === 'whitelist.create' ? operation.list.id : operation.listId;
  const serverList = {
    id: entityId, name: '云端名单', packages: ['com.cloud'], isDefault: true, version: 7,
    archivedAt: null as string | null, updatedAt: '2026-07-27T00:00:00.000Z', ...serverOverrides,
  };
  const state = {
    list: {
      id: entityId, name: '本地名单', packages: ['com.local'], isDefault: false, version: 3,
      syncStatus: 'conflict', archivedAt: null as number | null, serverUpdatedAt: null as number | null, ...localOverrides,
    },
    tasks: tasks.map((task) => ({ ...task })),
    outbox: [{
      id: 'outbox-1', operation: operation.type, entityId, status: 'conflict', attempts: 1,
      payload: operation as unknown as Record<string, unknown>,
    }],
    conflict: {
      id: 'conflict-1', entity_type: 'whitelist', entity_id: entityId, outbox_id: 'outbox-1', code: 'VERSION_CONFLICT',
      local_snapshot: JSON.stringify(operation), server_snapshot: JSON.stringify(serverList), created_at: 100, resolved_at: null as number | null,
    },
    async withTransactionAsync(run: () => Promise<void>) { await run(); },
    async getFirstAsync<T>(sql: string, ...args: unknown[]) {
      if (sql.includes('FROM sync_conflicts')) return (state.conflict.id === args[0] && state.conflict.resolved_at == null ? state.conflict : null) as T;
      if (sql.includes('FROM whitelist_lists')) {
        if (sql.includes('archived_at IS NULL') && state.list.archivedAt != null) return null as T;
        return ({ name: state.list.name, packages: JSON.stringify(state.list.packages), is_default: state.list.isDefault ? 1 : 0,
          archived_at: state.list.archivedAt } as T);
      }
      if (sql.includes('COUNT(*)') && sql.includes('sync_outbox')) return ({ count: state.outbox.length } as T);
      return null as T;
    },
    async getAllAsync<T>(sql: string, ...args: unknown[]) {
      if (sql.includes('FROM tasks')) return state.tasks.filter((task) => task.whitelistListId === args[0]) as T[];
      return [] as T[];
    },
    async runAsync(sql: string, ...args: unknown[]) {
      if (sql.includes("DELETE FROM sync_outbox") && sql.includes("operation LIKE 'whitelist.%'")) {
        state.outbox = state.outbox.filter((item) => item.entityId !== args[0] || !item.operation.startsWith('whitelist.'));
      }
      if (sql.includes('UPDATE whitelist_lists SET is_default = 0')) state.list.isDefault = false;
      if (sql.includes('UPDATE whitelist_lists SET is_default = 1')) {
        state.list = { ...state.list, isDefault: true, version: Number(args[0]), syncStatus: 'pending' };
      }
      if (sql.includes('UPDATE whitelist_lists SET is_default = 0, version = ?')) {
        state.list = { ...state.list, isDefault: false, version: Number(args[0]), syncStatus: 'pending', serverUpdatedAt: Number(args[1]) };
      }
      if (sql.includes("UPDATE whitelist_lists SET name = ?") && sql.includes("sync_status = 'pending'")) {
        state.list = { ...state.list, name: String(args[0]), packages: JSON.parse(String(args[1])), isDefault: Boolean(args[2]),
          version: Number(args[3]), syncStatus: 'pending', archivedAt: null, serverUpdatedAt: Number(args[4]) };
      }
      if (sql.includes('UPDATE whitelist_lists SET id = ?') && sql.includes("sync_status = 'pending'")) {
        state.list = { ...state.list, id: String(args[0]), isDefault: Boolean(args[1]), version: Number(args[2]),
          syncStatus: 'pending', archivedAt: null, serverUpdatedAt: null };
      }
      if (sql.includes('UPDATE whitelist_lists SET id = ? WHERE id = ?')) state.list.id = String(args[0]);
      if (sql.includes('UPDATE tasks SET whitelist_list_id = ?')) {
        state.tasks.forEach((task) => {
          if (task.whitelistListId !== args.at(-1)) return;
          task.whitelistListId = String(args[0]);
          if (sql.includes('version = ?')) {
            task.version = Number(args[1]);
            task.syncStatus = 'pending';
          }
        });
      }
      if (sql.includes('INSERT INTO sync_outbox')) state.outbox.push({
        id: String(args[0]), operation: String(args[1]) as Extract<SyncOperation, { type: `whitelist.${string}` }>['type'],
        entityId: String(args[2]), payload: JSON.parse(String(args[3])),
        status: 'pending', attempts: 0,
      });
      if (sql.includes('UPDATE sync_conflicts SET resolved_at')) state.conflict.resolved_at = Number(args[0]);
      return { changes: 1 };
    },
  };
  return state;
}

function localTask() {
  return {
    id: 'task-1', title: '本地任务', category_id: null, category: '未分类', timer_mode: 'countdown',
    estimate_minutes: 25, rest_minutes: 5, deadline_at: null, target_amount: null, target_unit: null,
    must_do: 0, forced_trigger_time: null, status: 'pending', version: 5, syncStatus: 'synced',
    restriction_mode: 'whitelist', whitelist_mode: 'list', whitelistListId: 'list-1', whitelist_packages: '[]',
  };
}

function createWhitelistConflictDatabase(serverOverrides: Partial<{
  id: string; name: string; packages: string[]; isDefault: boolean; version: number; archivedAt: string | null; updatedAt: string;
}> = {}) {
  const serverList = {
    id: 'list-1', name: '云端名单', packages: ['com.cloud'], isDefault: true, version: 7,
    archivedAt: null as string | null, updatedAt: '2026-07-27T00:00:00.000Z', ...serverOverrides,
  };
  const state = {
    list: {
      id: 'list-1', name: '本地名单', packages: ['com.local'], isDefault: false,
      version: 3, syncStatus: 'conflict', archivedAt: null as number | null, serverUpdatedAt: null as number | null,
    },
    outbox: [{
      id: 'outbox-1', operation: 'whitelist.update', entityId: 'list-1', status: 'conflict', attempts: 1,
      payload: { type: 'whitelist.update', listId: 'list-1', version: 2, name: '本地名单', packages: ['com.local'] },
    }],
    conflict: {
      id: 'conflict-1', entity_type: 'whitelist', entity_id: 'list-1', outbox_id: 'outbox-1', code: 'VERSION_CONFLICT',
      local_snapshot: null, server_snapshot: JSON.stringify(serverList), created_at: 100, resolved_at: null as number | null,
    },
    async withTransactionAsync(run: () => Promise<void>) { await run(); },
    async getFirstAsync<T>(sql: string, ...args: unknown[]) {
      if (sql.includes('FROM sync_conflicts')) return (state.conflict.id === args[0] && state.conflict.resolved_at == null ? state.conflict : null) as T;
      if (sql.includes('FROM whitelist_lists')) return ({ name: state.list.name, packages: JSON.stringify(state.list.packages) } as T);
      if (sql.includes('COUNT(*)') && sql.includes('sync_outbox')) {
        return ({ count: state.outbox.filter((item) => item.entityId === args[0] && ['pending', 'conflict'].includes(item.status)).length } as T);
      }
      return null as T;
    },
    async getAllAsync<T>() { return [] as T[]; },
    async runAsync(sql: string, ...args: unknown[]) {
      if (sql.includes("UPDATE sync_outbox SET status = 'discarded'") && sql.includes('WHERE id = ?')) {
        state.outbox.forEach((item) => { if (item.id === args[1]) item.status = 'discarded'; });
      }
      if (sql.includes("UPDATE sync_outbox SET status = 'pending'") && sql.includes('WHERE id = ?')) {
        state.outbox.forEach((item) => { if (item.id === args[3]) item.status = 'pending'; });
      }
      if (sql.includes("DELETE FROM sync_outbox") && sql.includes("operation LIKE 'whitelist.%'")) {
        state.outbox = state.outbox.filter((item) => item.entityId !== args[0]);
      }
      if (sql.includes('UPDATE whitelist_lists SET is_default = 0')) state.list.isDefault = false;
      if (sql.includes('INSERT INTO whitelist_lists')) {
        state.list = {
          id: String(args[0]), name: String(args[1]), packages: JSON.parse(String(args[2])), isDefault: Boolean(args[3]),
          version: Number(args[4]), syncStatus: 'synced', archivedAt: args[5] == null ? null : Number(args[5]), serverUpdatedAt: Number(args[6]),
        };
      }
      if (sql.includes("UPDATE whitelist_lists SET name = ?") && sql.includes("sync_status = 'pending'")) {
        state.list = { ...state.list, name: String(args[0]), packages: JSON.parse(String(args[1])), isDefault: Boolean(args[2]),
          version: Number(args[3]), syncStatus: 'pending', archivedAt: null, serverUpdatedAt: Number(args[4]) };
      }
      if (sql.includes('UPDATE whitelist_lists SET id = ?') && sql.includes("sync_status = 'pending'")) {
        state.list = { ...state.list, id: String(args[0]), isDefault: false, version: 1, syncStatus: 'pending',
          archivedAt: null, serverUpdatedAt: null };
      }
      if (sql.includes('INSERT INTO sync_outbox')) state.outbox.push({
        id: String(args[0]), operation: String(args[1]), entityId: String(args[2]), payload: JSON.parse(String(args[3])),
        status: 'pending', attempts: 0,
      });
      if (sql.includes('UPDATE sync_conflicts SET resolved_at')) state.conflict.resolved_at = Number(args[0]);
      return { changes: 1 };
    },
  };
  return state;
}
