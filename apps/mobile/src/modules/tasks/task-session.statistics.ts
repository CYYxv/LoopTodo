import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

export function taskSessionStatistics(records: FocusSessionRecord[], taskId: string) {
  const completed = new Map(records
    .filter((record) => record.taskId === taskId && record.outcome === 'completed')
    .map((record) => [record.id, record]));
  const completedMinutes = [...completed.values()].reduce((sum, record) => sum + Math.ceil(record.durationSeconds / 60), 0);
  return { completedSessions: completed.size, completedMinutes };
}
