import { createSQLiteSyncRepository } from '../sqlite-sync.repository';

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
