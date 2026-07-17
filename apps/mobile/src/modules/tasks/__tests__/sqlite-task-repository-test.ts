import { createSQLiteTaskRepository } from '../sqlite-task.repository';
import type { ActiveSession } from '@/modules/focus-session/focus-session.types';
import type { Task } from '../task.types';

const task: Task = {
  id: 'task-1', title: '修改任务', category: '未分类', kind: 'pomodoro', timerMode: 'countdown',
  estimateMinutes: 25, restMinutes: 5, deadlineAt: null, targetAmount: null, targetUnit: null,
  completedAmount: 0, progressLabel: '倒计时 25 分钟', mustDo: false, forcedTriggerTime: null,
  trustLevel: 'medium', status: 'pending', version: 2, syncStatus: 'pending', remoteActive: false,
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
    startedAt: 1_000, plannedEndAt: 61_000, restEndsAt: null, pausedAt: 11_000, accumulatedPausedMs: 5_000,
  };

  await repository.updateActiveSession(session);

  expect(writes[0].sql).toContain('paused_at = ?');
  expect(writes[0].args).toEqual([11_000, 5_000, 61_000, null, 'session-1']);
});
