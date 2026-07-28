import { createSQLiteSyncRepository } from '../../sync/sqlite-sync.repository';
import { legacyWhitelistDefaultId, legacyWhitelistStorageKey, migrateLegacyWhitelist } from '../whitelist.migration';

test('creates an empty local default on a fresh install before the server snapshot', async () => {
  const database = createMigrationDatabase();
  const secureStore = {
    getItemAsync: jest.fn(async () => null),
    deleteItemAsync: jest.fn(async () => undefined),
  };

  await migrateLegacyWhitelist(database as never, secureStore);

  expect(database.lists).toEqual([expect.objectContaining({
    id: legacyWhitelistDefaultId,
    name: '默认名单',
    packages: [],
    isDefault: true,
  })]);
  expect(database.outbox).toEqual([]);
  expect(database.migrated).toBe(true);
  expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
});

test('migrates the legacy package array into one default list exactly once', async () => {
  const database = createMigrationDatabase();
  const secureStore = {
    getItemAsync: jest.fn(async () => JSON.stringify(['com.reader', '', 'com.reader', 'com.music'])),
    deleteItemAsync: jest.fn(async () => undefined),
  };

  await migrateLegacyWhitelist(database as never, secureStore);
  await migrateLegacyWhitelist(database as never, secureStore);

  expect(secureStore.getItemAsync).toHaveBeenCalledWith(legacyWhitelistStorageKey);
  expect(database.lists).toEqual([expect.objectContaining({
    id: legacyWhitelistDefaultId, name: '默认名单', packages: ['com.reader', 'com.music'],
    isDefault: true, version: 1, syncStatus: 'pending',
  })]);
  expect(database.outbox).toEqual([]);
  expect(secureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
});

test('merges legacy packages into the server default and maps local task references', async () => {
  const database = createMigrationDatabase([{ id: 'task-1', whitelistListId: null }], [{
    operation: 'task.create', entityId: 'task-1', payload: {
      type: 'task.create', task: { id: 'task-1', whitelistListId: legacyWhitelistDefaultId },
    },
  }, {
    operation: 'task.update', entityId: 'task-2', payload: {
      type: 'task.update', taskId: 'task-2', patch: { whitelistListId: legacyWhitelistDefaultId },
    },
  }, {
    operation: 'session.start', entityId: 'task-1', payload: {
      type: 'session.start', localSessionId: 'session-1', whitelistSource: `list:${legacyWhitelistDefaultId}`,
    },
  }, {
    operation: 'session.finish', entityId: 'task-1', payload: {
      type: 'session.finish', localSessionId: 'session-1', record: { whitelistSource: `list:${legacyWhitelistDefaultId}` },
    },
  }, {
    operation: 'whitelist.update', entityId: legacyWhitelistDefaultId, payload: {
      type: 'whitelist.update', listId: legacyWhitelistDefaultId, version: 1, name: '默认名单', packages: ['com.reader'],
    },
  }, {
    operation: 'whitelist.set-default', entityId: legacyWhitelistDefaultId, payload: {
      type: 'whitelist.set-default', listId: legacyWhitelistDefaultId, version: 1,
    },
  }, {
    operation: 'whitelist.delete', entityId: legacyWhitelistDefaultId, payload: {
      type: 'whitelist.delete', listId: legacyWhitelistDefaultId, version: 1, replacementId: null,
    },
  }]);
  const secureStore = {
    getItemAsync: jest.fn(async () => JSON.stringify(['com.reader', 'com.shared'])),
    deleteItemAsync: jest.fn(async () => undefined),
  };

  await migrateLegacyWhitelist(database as never, secureStore);
  const repository = createSQLiteSyncRepository(async () => database as never, () => 200);
  await repository.mergeSnapshot({
    cursor: 'cursor-1',
    whitelistLists: [{ id: 'cloud-default', name: '云端默认', packages: ['com.cloud', 'com.shared'], isDefault: true,
      version: 4, archivedAt: null, updatedAt: '2026-07-26T00:00:00.000Z' }],
    tasks: [],
    sessions: [],
  });

  expect(database.lists).toEqual([expect.objectContaining({
    id: 'cloud-default', name: '云端默认', packages: ['com.cloud', 'com.shared', 'com.reader'], isDefault: true,
  })]);
  expect(database.tasks).toEqual([{ id: 'task-1', whitelistListId: 'cloud-default' }]);
  expect(database.outbox).toEqual([
    expect.objectContaining({ operation: 'task.create', payload: expect.objectContaining({
      task: expect.objectContaining({ whitelistListId: 'cloud-default' }),
    }) }),
    expect.objectContaining({ operation: 'task.update', payload: expect.objectContaining({
      patch: expect.objectContaining({ whitelistListId: 'cloud-default' }),
    }) }),
    expect.objectContaining({ operation: 'session.start', payload: expect.objectContaining({
      whitelistSource: 'list:cloud-default',
    }) }),
    expect.objectContaining({ operation: 'session.finish', payload: expect.objectContaining({
      record: expect.objectContaining({ whitelistSource: 'list:cloud-default' }),
    }) }),
    expect.objectContaining({
      operation: 'whitelist.update', entityId: 'cloud-default', payload: expect.objectContaining({
        listId: 'cloud-default', version: 4, packages: ['com.cloud', 'com.shared', 'com.reader'],
      }),
    }),
  ]);
});

test('maps legacy tasks without letting an empty local placeholder overwrite the server default', async () => {
  const database = createMigrationDatabase([{ id: 'task-1', whitelistListId: null }]);
  const secureStore = {
    getItemAsync: jest.fn(async () => null),
    deleteItemAsync: jest.fn(async () => undefined),
  };

  await migrateLegacyWhitelist(database as never, secureStore);
  const repository = createSQLiteSyncRepository(async () => database as never, () => 200);
  await repository.mergeSnapshot({
    cursor: 'cursor-1',
    whitelistLists: [{ id: 'cloud-default', name: '云端默认', packages: ['com.cloud'], isDefault: true,
      version: 4, archivedAt: null, updatedAt: '2026-07-26T00:00:00.000Z' }],
    tasks: [],
    sessions: [],
  });

  expect(database.lists).toEqual([expect.objectContaining({ id: 'cloud-default', packages: ['com.cloud'], isDefault: true })]);
  expect(database.tasks).toEqual([{ id: 'task-1', whitelistListId: 'cloud-default' }]);
  expect(database.outbox).toEqual([]);
});

test('cleans an archived legacy placeholder without restoring its deleted packages', async () => {
  const database = createMigrationDatabase();
  const secureStore = {
    getItemAsync: jest.fn(async () => JSON.stringify(['com.legacy'])),
    deleteItemAsync: jest.fn(async () => undefined),
  };
  await migrateLegacyWhitelist(database as never, secureStore);
  database.lists[0].archivedAt = 150;
  database.lists[0].isDefault = false;
  database.outbox.push({
    operation: 'whitelist.delete', entityId: legacyWhitelistDefaultId,
    payload: { type: 'whitelist.delete', listId: legacyWhitelistDefaultId, version: 1, replacementId: 'cloud-default' },
  });

  const repository = createSQLiteSyncRepository(async () => database as never, () => 200);
  await repository.mergeSnapshot({
    cursor: 'cursor-1',
    whitelistLists: [{ id: 'cloud-default', name: '云端默认', packages: ['com.cloud'], isDefault: true,
      version: 4, archivedAt: null, updatedAt: '2026-07-26T00:00:00.000Z' }],
    tasks: [], sessions: [],
  });

  expect(database.lists).toEqual([expect.objectContaining({ id: 'cloud-default', packages: ['com.cloud'] })]);
  expect(database.outbox).toEqual([]);
});

test('maps a pending list deletion replacement away from the legacy placeholder', async () => {
  const database = createMigrationDatabase([{ id: 'legacy-task', whitelistListId: null }], [{
    operation: 'whitelist.delete', entityId: 'offline-list', payload: {
      type: 'whitelist.delete', listId: 'offline-list', version: 1, replacementId: legacyWhitelistDefaultId,
    },
  }]);
  const secureStore = {
    getItemAsync: jest.fn(async () => null),
    deleteItemAsync: jest.fn(async () => undefined),
  };
  await migrateLegacyWhitelist(database as never, secureStore);

  const repository = createSQLiteSyncRepository(async () => database as never, () => 200);
  await repository.mergeSnapshot({
    cursor: 'cursor-1',
    whitelistLists: [{ id: 'cloud-default', name: '云端默认', packages: [], isDefault: true,
      version: 4, archivedAt: null, updatedAt: '2026-07-26T00:00:00.000Z' }],
    tasks: [], sessions: [],
  });

  expect(database.outbox).toEqual([expect.objectContaining({
    operation: 'whitelist.delete', entityId: 'offline-list',
    payload: expect.objectContaining({ replacementId: 'cloud-default' }),
  })]);
});

test('preserves an offline rename while merging the active legacy placeholder', async () => {
  const database = createMigrationDatabase([], [{
    operation: 'whitelist.update', entityId: legacyWhitelistDefaultId, payload: {
      type: 'whitelist.update', listId: legacyWhitelistDefaultId, version: 1, name: '专注名单', packages: ['com.reader'],
    },
  }]);
  const secureStore = {
    getItemAsync: jest.fn(async () => JSON.stringify(['com.reader'])),
    deleteItemAsync: jest.fn(async () => undefined),
  };
  await migrateLegacyWhitelist(database as never, secureStore);
  database.lists[0].name = '专注名单';

  const repository = createSQLiteSyncRepository(async () => database as never, () => 200);
  await repository.mergeSnapshot({
    cursor: 'cursor-1',
    whitelistLists: [{ id: 'cloud-default', name: '云端默认', packages: ['com.cloud'], isDefault: true,
      version: 4, archivedAt: null, updatedAt: '2026-07-26T00:00:00.000Z' }],
    tasks: [], sessions: [],
  });

  expect(database.lists).toEqual([expect.objectContaining({ id: 'cloud-default', name: '专注名单' })]);
  expect(database.outbox).toEqual([expect.objectContaining({
    operation: 'whitelist.update', entityId: 'cloud-default',
    payload: expect.objectContaining({ name: '专注名单' }),
  })]);
});

type TestOutboxItem = { operation: string; entityId: unknown; payload: Record<string, unknown> };

function createMigrationDatabase(
  initialTasks: Array<{ id: string; whitelistListId: string | null }> = [],
  initialOutbox: TestOutboxItem[] = [],
) {
  const state = {
    migrated: false,
    tasks: initialTasks.map((task) => ({ ...task })),
    lists: [] as Array<Record<string, unknown>>,
    outbox: initialOutbox.map((item) => ({ ...item, payload: structuredClone(item.payload) })),
    async withTransactionAsync(run: () => Promise<void>) { await run(); },
    async getFirstAsync<T>(sql: string, ...args: unknown[]) {
      if (sql.includes('schema_migrations')) return (state.migrated ? { version: 8 } : null) as T;
      if (sql.includes('COUNT(*)') && sql.includes('FROM tasks')) return { count: state.tasks.length } as T;
      if (sql.includes('FROM whitelist_lists') && args[0] === legacyWhitelistDefaultId) {
        const list = state.lists.find((item) => item.id === legacyWhitelistDefaultId);
        if (!list || (sql.includes('archived_at IS NULL') && list.archivedAt != null)) return null as T;
        return ({ name: list.name, packages: JSON.stringify(list.packages), archived_at: list.archivedAt ?? null } as T);
      }
      if (sql.includes("operation = 'whitelist.update'") && args[0] === legacyWhitelistDefaultId) {
        const update = [...state.outbox].reverse().find((item) => item.entityId === legacyWhitelistDefaultId && item.operation === 'whitelist.update');
        return (update ? { name: update.payload.name } : null) as T;
      }
      if (sql.includes('COUNT(*)') && sql.includes('sync_outbox')) return { count: 0 } as T;
      return null as T;
    },
    async runAsync(sql: string, ...args: unknown[]) {
      if (sql.includes('INSERT OR IGNORE INTO whitelist_lists')) state.lists.push({
        id: args[0], name: args[1], packages: JSON.parse(String(args[2])), isDefault: Boolean(args[3]), version: args[4], syncStatus: 'pending',
      });
      if (sql.includes('UPDATE tasks SET whitelist_list_id = ?')) {
        state.tasks.forEach((task) => { if (task.whitelistListId === args[2] || task.whitelistListId === null) task.whitelistListId = String(args[0]); });
      }
      if (sql.includes('UPDATE whitelist_lists SET is_default = 0')) {
        state.lists.forEach((list) => { if (list.id !== args[0]) list.isDefault = false; });
      }
      if (sql.includes('INSERT INTO whitelist_lists')) {
        const next = { id: args[0], name: args[1], packages: JSON.parse(String(args[2])), isDefault: Boolean(args[3]),
          version: args[4], syncStatus: 'synced' };
        const index = state.lists.findIndex((list) => list.id === next.id);
        if (index >= 0) state.lists[index] = next;
        else state.lists.push(next);
      }
      if (sql.includes('DELETE FROM whitelist_lists')) state.lists = state.lists.filter((list) => list.id !== args[0]);
      if (sql.includes("json_set(payload, '$.task.whitelistListId'")) {
        state.outbox.forEach((item) => {
          const task = item.payload.task as Record<string, unknown> | undefined;
          if (!task) return;
          if (item.operation === 'task.create' && task.whitelistListId === args[2]) task.whitelistListId = args[0];
        });
      }
      if (sql.includes("json_set(payload, '$.patch.whitelistListId'")) {
        state.outbox.forEach((item) => {
          const patch = item.payload.patch as Record<string, unknown> | undefined;
          if (!patch) return;
          if (item.operation === 'task.update' && patch.whitelistListId === args[2]) patch.whitelistListId = args[0];
        });
      }
      if (sql.includes("json_set(payload, '$.whitelistSource'")) {
        state.outbox.forEach((item) => {
          if (item.operation === 'session.start' && item.payload.whitelistSource === args[2]) item.payload.whitelistSource = args[0];
        });
      }
      if (sql.includes("json_set(payload, '$.record.whitelistSource'")) {
        state.outbox.forEach((item) => {
          const record = item.payload.record as Record<string, unknown> | undefined;
          if (item.operation === 'session.finish' && record && record.whitelistSource === args[2]) record.whitelistSource = args[0];
        });
      }
      if (sql.includes("json_set(payload, '$.replacementId'")) {
        state.outbox.forEach((item) => {
          if (item.operation === 'whitelist.delete' && item.payload.replacementId === args[2]) item.payload.replacementId = args[0];
        });
      }
      if (sql.includes("DELETE FROM sync_outbox WHERE entity_id")) {
        state.outbox = state.outbox.filter((item) => item.entityId !== args[0] || !item.operation.startsWith('whitelist.'));
      }
      if (sql.includes("UPDATE whitelist_lists SET sync_status = 'pending'")) {
        const list = state.lists.find((item) => item.id === args[1] || item.id === args[0]);
        if (list) list.syncStatus = 'pending';
      }
      if (sql.includes('INSERT INTO sync_outbox')) state.outbox.push({
        operation: String(args[1]), entityId: args[2], payload: JSON.parse(String(args[3])) as Record<string, unknown>,
      });
      if (sql.includes('INSERT OR IGNORE INTO schema_migrations')) state.migrated = true;
      return { changes: 1 };
    },
  };
  return state;
}
