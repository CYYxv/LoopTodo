import { createSQLiteTaskRepository } from '../sqlite-task.repository';
import type { ActiveSession } from '@/modules/focus-session/focus-session.types';
import type { Task } from '../task.types';

const task: Task = {
  id: 'task-1', title: '修改任务', category: '未分类', kind: 'pomodoro', timerMode: 'countdown',
  estimateMinutes: 25, restMinutes: 5, deadlineAt: null, targetAmount: null, targetUnit: null,
  completedAmount: 0, progressLabel: '倒计时 25 分钟', mustDo: false, forcedTriggerTime: null,
  trustLevel: 'medium', status: 'pending', version: 2, syncStatus: 'pending', remoteActive: false,
  restrictionMode: 'whitelist', whitelistMode: 'inherit', whitelistListId: null, whitelistPackages: [],
};

test('rejects a task edit when the persisted version has advanced', async () => {
  const currentVersion = 2;
  const database = {
    async withTransactionAsync(run: () => Promise<void>) { await run(); },
    async runAsync(sql: string, ...args: unknown[]) {
      if (!sql.includes('UPDATE tasks')) return { changes: 1 };
      if (!sql.includes('AND version = ?')) return { changes: 1 };
      return { changes: args.at(-1) === currentVersion ? 1 : 0 };
    },
  };
  const repository = createSQLiteTaskRepository(async () => database as never);

  await expect(repository.update(task, 1)).rejects.toThrow('任务正在执行或已被其他设备更新');
});

test('persists the paused active session snapshot', async () => {
  const writes: Array<{ sql: string; args: unknown[] }> = [];
  const database = {
    async runAsync(sql: string, ...args: unknown[]) { writes.push({ sql, args }); return { changes: 1 }; },
  };
  const repository = createSQLiteTaskRepository(async () => database as never);
  const session: ActiveSession = {
    id: 'session-1', taskId: 'task-1', mode: 'focus', timerMode: 'countdown', phase: 'focus',
    startedAt: 1_000, plannedEndAt: 61_000, plannedFocusSeconds: 60,
    restEndsAt: null, pausedAt: 11_000, accumulatedPausedMs: 5_000,
  };

  await repository.updateActiveSession(session);

  expect(writes[0].sql).toContain('paused_at = ?');
  expect(writes[0].sql).toContain('planned_focus_seconds = ?');
  expect(writes[0].args).toEqual([11_000, 5_000, 61_000, 60, null, 'none', 'none', 0, '[]', 'session-1']);
});

test('syncs the capped planned focus duration instead of an oversized task estimate', async () => {
  const writes: Array<{ sql: string; args: unknown[] }> = [];
  const database = {
    async withTransactionAsync(run: () => Promise<void>) { await run(); },
    async runAsync(sql: string, ...args: unknown[]) { writes.push({ sql, args }); return { changes: 1 }; },
  };
  const repository = createSQLiteTaskRepository(async () => database as never);
  const session: ActiveSession = {
    id: 'session-long', taskId: task.id, mode: 'focus', timerMode: 'countdown', phase: 'focus',
    startedAt: 1_000, plannedEndAt: 10_801_000, plannedFocusSeconds: 10_800,
    restEndsAt: null, pausedAt: null, accumulatedPausedMs: 0,
  };

  await repository.startSession({ ...task, estimateMinutes: 240, status: 'active' }, session);

  const outboxWrite = writes.find((write) => write.sql.includes('INSERT INTO sync_outbox'));
  expect(JSON.parse(String(outboxWrite?.args[3]))).toMatchObject({ plannedMinutes: 180 });
});

test('persists the resolved restriction and allowed package snapshot with the active session', async () => {
  const writes: Array<{ sql: string; args: unknown[] }> = [];
  const database = {
    async withTransactionAsync(run: () => Promise<void>) { await run(); },
    async runAsync(sql: string, ...args: unknown[]) { writes.push({ sql, args }); return { changes: 1 }; },
  };
  const repository = createSQLiteTaskRepository(async () => database as never);
  const session = {
    id: 'session-restricted', taskId: task.id, mode: 'focus' as const, timerMode: 'countdown' as const, phase: 'focus' as const,
    startedAt: 1_000, plannedEndAt: 61_000, plannedFocusSeconds: 60, restEndsAt: null,
    pausedAt: null, accumulatedPausedMs: 0, restrictionMode: 'whitelist' as const,
    whitelistSource: 'list:study' as const, restrictionEffective: true, allowedPackagesSnapshot: ['com.reader'],
  };

  await repository.startSession({ ...task, status: 'active' }, session);

  const activeWrite = writes.find((write) => write.sql.includes('INSERT INTO active_sessions'));
  expect(activeWrite?.sql).toContain('restriction_mode');
  expect(activeWrite?.sql).toContain('allowed_packages_snapshot');
  expect(activeWrite?.sql).toContain('whitelist_source');
  expect(activeWrite?.sql).toContain('restriction_effective');
  expect(activeWrite?.args).toEqual(expect.arrayContaining(['whitelist', 'list:study', 1, JSON.stringify(['com.reader'])]));
});

test('persists the frozen restriction snapshot with the completed session record', async () => {
  const writes: Array<{ sql: string; args: unknown[] }> = [];
  const database = {
    async withTransactionAsync(run: () => Promise<void>) { await run(); },
    async runAsync(sql: string, ...args: unknown[]) { writes.push({ sql, args }); return { changes: 1 }; },
  };
  const repository = createSQLiteTaskRepository(async () => database as never);
  const record = {
    id: 'session-completed', taskId: task.id, mode: 'focus' as const, timerMode: 'countdown' as const, phase: 'focus' as const,
    startedAt: 1_000, plannedEndAt: 61_000, plannedFocusSeconds: 60, restEndsAt: null,
    pausedAt: null, accumulatedPausedMs: 0, endedAt: 61_000, outcome: 'completed' as const,
    failureReason: null, durationSeconds: 60, completedAmount: null,
    restrictionMode: 'whitelist' as const, whitelistSource: 'list:study' as const,
    restrictionEffective: true, whitelistPackageCount: 1, effectiveMinutes: 1,
    allowedPackagesSnapshot: ['com.reader'],
  };

  await repository.finishSession({ ...task, status: 'pending' }, record, null);

  const recordWrite = writes.find((write) => write.sql.includes('INSERT INTO focus_sessions'));
  expect(recordWrite?.sql).toContain('restriction_mode');
  expect(recordWrite?.sql).toContain('allowed_packages_snapshot');
  expect(recordWrite?.sql).toContain('whitelist_source');
  expect(recordWrite?.sql).toContain('whitelist_package_count');
  expect(recordWrite?.sql).toContain('restriction_effective');
  expect(recordWrite?.sql).toContain('effective_minutes');
  expect(recordWrite?.args).toEqual(expect.arrayContaining(['whitelist', 'list:study', 1, 1, 1, JSON.stringify(['com.reader'])]));
});
