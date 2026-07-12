import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';
import { localStatistics } from '../scoring.local';

function record(endedAt: number, durationSeconds: number): FocusSessionRecord { return { id: `${endedAt}`, taskId: 'task', mode: 'focus', timerMode: 'countdown', phase: 'focus',
  startedAt: endedAt - durationSeconds * 1000, plannedEndAt: endedAt, restEndsAt: null, endedAt, outcome: 'completed', failureReason: null, durationSeconds, completedAmount: null }; }

test('summarizes today totals and consecutive days', () => {
  const now = new Date(2026, 6, 12, 12).getTime(); const yesterday = new Date(2026, 6, 11, 12).getTime();
  expect(localStatistics([record(now, 3600), record(yesterday, 1800)], now)).toEqual({ todayMinutes: 60, todayCompleted: 1, totalMinutes: 90, totalCompleted: 2, streakDays: 2 });
});
