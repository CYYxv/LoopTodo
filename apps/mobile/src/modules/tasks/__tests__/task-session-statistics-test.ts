import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

import { taskSessionStatistics } from '../task-session.statistics';

const record = (id: string, taskId: string, outcome: FocusSessionRecord['outcome'], durationSeconds: number): FocusSessionRecord => ({
  id, taskId, mode: 'focus', timerMode: 'countdown', phase: 'focus', startedAt: 0, plannedEndAt: 60_000,
  restEndsAt: null, endedAt: 60_000, outcome, failureReason: null, durationSeconds, completedAmount: null,
});

test('counts unique completed sessions for one task', () => {
  const records = [
    record('completed', 'task-1', 'completed', 125),
    record('completed', 'task-1', 'completed', 125),
    record('exited', 'task-1', 'exited', 600),
    record('other', 'task-2', 'completed', 600),
  ];

  expect(taskSessionStatistics(records, 'task-1')).toEqual({ completedSessions: 1, completedMinutes: 3 });
});
