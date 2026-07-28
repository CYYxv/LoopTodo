import type { ActiveSession } from '@/modules/focus-session/focus-session.types';

import { getTaskExecutionState } from '../task.execution';
import type { Task } from '../task.types';

const task: Task = {
  id: 'task', title: '任务', category: '收集箱', kind: 'pomodoro', timerMode: 'countdown',
  estimateMinutes: 25, restMinutes: 5, deadlineAt: null, targetAmount: null, targetUnit: null,
  completedAmount: 0, progressLabel: '25 分钟', mustDo: false, forcedTriggerTime: null,
  trustLevel: 'medium', status: 'pending', version: 1, syncStatus: 'pending', remoteActive: false,
  restrictionMode: 'whitelist', whitelistMode: 'inherit', whitelistListId: null, whitelistPackages: [],
};
const session: ActiveSession = { id: 'session', taskId: 'task', mode: 'focus', timerMode: 'countdown', phase: 'focus', startedAt: 0, plannedEndAt: 1, restEndsAt: null };

describe('task execution state', () => {
  test('distinguishes local, remote and stale active tasks', () => {
    expect(getTaskExecutionState({ ...task, status: 'active' }, session)).toBe('local_active');
    expect(getTaskExecutionState({ ...task, id: 'another-task' }, session)).toBe('local_session_blocked');
    expect(getTaskExecutionState({ ...task, status: 'active', remoteActive: true }, null)).toBe('remote_active');
    expect(getTaskExecutionState({ ...task, status: 'active' }, null)).toBe('stale_active');
  });

  test('prioritizes conflicts over availability', () => {
    expect(getTaskExecutionState({ ...task, syncStatus: 'conflict' }, null)).toBe('sync_conflict');
    expect(getTaskExecutionState({ ...task, status: 'failed' }, null)).toBe('available');
  });
});
