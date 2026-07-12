import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

export function localStatistics(records: FocusSessionRecord[], now = Date.now()) {
  const today = dayKey(now); const completed = records.filter((record) => record.outcome === 'completed');
  const todayRecords = completed.filter((record) => dayKey(record.endedAt) === today);
  const activeDays = new Set(completed.map((record) => dayKey(record.endedAt))); let cursor = startOfDay(now); let streakDays = 0;
  while (activeDays.has(dayKey(cursor))) { streakDays += 1; cursor -= 86_400_000; }
  return { todayMinutes: Math.floor(todayRecords.reduce((sum, record) => sum + record.durationSeconds, 0) / 60),
    todayCompleted: todayRecords.length, totalMinutes: Math.floor(completed.reduce((sum, record) => sum + record.durationSeconds, 0) / 60),
    totalCompleted: completed.length, streakDays };
}
function startOfDay(value: number) { const date = new Date(value); return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(); }
function dayKey(value: number) { const date = new Date(value); return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; }
