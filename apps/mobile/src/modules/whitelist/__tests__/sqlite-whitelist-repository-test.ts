import { createSQLiteWhitelistRepository } from '../sqlite-whitelist.repository';

test('creates a list and enqueues whitelist CRUD before returning it', async () => {
  const writes: Array<{ sql: string; args: unknown[] }> = [];
  const database = {
    async withTransactionAsync(run: () => Promise<void>) { await run(); },
    async getFirstAsync(sql: string) {
      if (sql.includes('WHERE id = ?')) return {
        id: 'list-1', name: '学习', packages: '["com.reader"]', is_default: 1,
        version: 1, sync_status: 'pending', archived_at: null,
      };
      return null;
    },
    async runAsync(sql: string, ...args: unknown[]) { writes.push({ sql, args }); return { changes: 1 }; },
  };
  const repository = createSQLiteWhitelistRepository(async () => database as never, () => 100, () => 'list-1');

  const list = await repository.create('学习', ['com.reader', '', 'com.reader']);

  expect(list).toMatchObject({ id: 'list-1', name: '学习', packages: ['com.reader'], isDefault: true, version: 1, syncStatus: 'pending' });
  const insert = writes.find((write) => write.sql.includes('INSERT INTO whitelist_lists'));
  expect(insert?.sql).toContain('CASE WHEN NOT EXISTS');
  expect(insert?.sql).toContain('WHERE archived_at IS NULL');
  const outbox = writes.find((write) => write.sql.includes('INSERT INTO sync_outbox'));
  expect(JSON.parse(String(outbox?.args[3]))).toMatchObject({ type: 'whitelist.create', list: expect.objectContaining({ id: 'list-1' }) });
});

test('does not query a count before atomically creating a non-default list', async () => {
  const reads: string[] = [];
  const database = {
    async withTransactionAsync(run: () => Promise<void>) { await run(); },
    async getFirstAsync(sql: string) {
      reads.push(sql);
      if (sql.includes('WHERE id = ?')) return {
        id: 'list-2', name: '工作', packages: '[]', is_default: 0,
        version: 1, sync_status: 'pending', archived_at: null,
      };
      return null;
    },
    async runAsync() { return { changes: 1 }; },
  };
  const repository = createSQLiteWhitelistRepository(async () => database as never, () => 100, () => 'list-2');

  await expect(repository.create('工作', [])).resolves.toMatchObject({ id: 'list-2', isDefault: false });
  expect(reads.some((sql) => sql.includes('COUNT(*)'))).toBe(false);
});

test('fails the default switch when the target version changes inside the transaction', async () => {
  const database = {
    async withTransactionAsync(run: () => Promise<void>) { await run(); },
    async getFirstAsync() { return { id: 'study' }; },
    async runAsync(sql: string) {
      if (sql.includes('SET is_default = 1')) return { changes: 0 };
      return { changes: 1 };
    },
  };
  const repository = createSQLiteWhitelistRepository(async () => database as never);

  await expect(repository.setDefault('study', 2)).rejects.toThrow('名单已被其他设备更新');
});

test('requires a replacement when archiving a referenced list', async () => {
  const database = {
    async getFirstAsync(sql: string) {
      if (sql.includes('COUNT(*)') && sql.includes('whitelist_lists')) return { count: 2 };
      if (sql.includes('FROM whitelist_lists') && sql.includes('id = ?')) return { id: 'list-1', is_default: 0 };
      if (sql.includes('COUNT(*)')) return { count: 2 };
      return null;
    },
  };
  const repository = createSQLiteWhitelistRepository(async () => database as never);

  await expect(repository.archive('list-1', 2, null)).rejects.toThrow('请选择替代名单');
});

test('does not archive the last remaining whitelist', async () => {
  const database = {
    async getFirstAsync(sql: string) {
      if (sql.includes('COUNT(*)') && sql.includes('whitelist_lists')) return { count: 1 };
      if (sql.includes('FROM whitelist_lists') && sql.includes('id = ?')) return { id: 'only', is_default: 1 };
      if (sql.includes('COUNT(*)')) return { count: 0 };
      return null;
    },
  };
  const repository = createSQLiteWhitelistRepository(async () => database as never);

  await expect(repository.archive('only', 1, null)).rejects.toThrow('至少保留一份白名单');
});

test('requires choosing a new default before archiving the default whitelist', async () => {
  const database = {
    async getFirstAsync(sql: string) {
      if (sql.includes('COUNT(*)') && sql.includes('whitelist_lists')) return { count: 2 };
      if (sql.includes('FROM whitelist_lists') && sql.includes('id = ?')) return { id: 'default', is_default: 1 };
      if (sql.includes('COUNT(*)')) return { count: 0 };
      return null;
    },
  };
  const repository = createSQLiteWhitelistRepository(async () => database as never);

  await expect(repository.archive('default', 1, null)).rejects.toThrow('请先设置新的默认白名单');
});

test('counts active tasks that reference a whitelist', async () => {
  const database = {
    async getFirstAsync(sql: string, id: string) {
      expect(sql).toContain("status != 'archived'");
      expect(id).toBe('study');
      return { count: 3 };
    },
  };
  const repository = createSQLiteWhitelistRepository(async () => database as never);

  await expect(repository.countReferences('study')).resolves.toBe(3);
});

test('reassigns referenced tasks with a version bump and pending sync inside the archive transaction', async () => {
  const writes: Array<{ sql: string; args: unknown[]; inTransaction: boolean }> = [];
  let inTransaction = false;
  const database = {
    async getFirstAsync(sql: string) {
      if (sql.includes('COUNT(*)') && sql.includes('whitelist_lists')) return { count: 2 };
      if (sql.includes('SELECT id, is_default')) return { id: 'study', is_default: 0 };
      if (sql.includes('is_default = 1')) return { id: 'default' };
      if (sql.includes('COUNT(*)')) return { count: 2 };
      return null;
    },
    async withTransactionAsync(run: () => Promise<void>) {
      inTransaction = true;
      await run();
      inTransaction = false;
    },
    async runAsync(sql: string, ...args: unknown[]) {
      writes.push({ sql, args, inTransaction });
      return { changes: 1 };
    },
  };
  const repository = createSQLiteWhitelistRepository(async () => database as never, () => 100, () => 'outbox-id');

  await repository.archive('study', 3, 'default');

  const taskWrite = writes.find((write) => write.sql.includes('UPDATE tasks SET'));
  expect(taskWrite?.sql).toContain('version = version + 1');
  expect(taskWrite?.sql).toContain("sync_status = 'pending'");
  expect(taskWrite?.inTransaction).toBe(true);
  const deleteOutbox = writes.find((write) => write.sql.includes('INSERT INTO sync_outbox'));
  expect(JSON.parse(String(deleteOutbox?.args[3]))).toEqual({
    type: 'whitelist.delete', listId: 'study', version: 3, replacementId: 'default',
  });
  expect(deleteOutbox?.inTransaction).toBe(true);
});
