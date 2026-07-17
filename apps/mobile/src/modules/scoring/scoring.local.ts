import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

export function localStatistics(records: FocusSessionRecord[], now = Date.now()) {
  const today = dayKey(now); const completed = records.filter((record) => record.outcome === 'completed');
  const todayRecords = completed.filter((record) => dayKey(record.endedAt) === today);
  const failed = records.filter((record) => record.outcome === 'exited');
  const todayFailed = failed.filter((record) => dayKey(record.endedAt) === today);
  const activeDays = new Set(completed.map((record) => dayKey(record.endedAt))); let cursor = startOfDay(now); let streakDays = 0;
  while (activeDays.has(dayKey(cursor))) { streakDays += 1; cursor -= 86_400_000; }
  const dailyMinutes = Array.from({ length: 7 }, (_, index) => {
    const timestamp = startOfDay(now) - (6 - index) * 86_400_000;
    const minutes = Math.floor(completed.filter((record) => dayKey(record.endedAt) === dayKey(timestamp)).reduce((sum, record) => sum + record.durationSeconds, 0) / 60);
    return { date: dayKey(timestamp), label: '日一二三四五六'[new Date(timestamp).getDay()], minutes };
  });
  const maxMinutes = Math.max(1, ...dailyMinutes.map((item) => item.minutes));
  const totalMinutes = Math.floor(completed.reduce((sum, record) => sum + record.durationSeconds, 0) / 60);
  const timeOfDay = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const record of completed) {
    const hour = new Date(record.endedAt).getHours();
    if (hour >= 5 && hour < 12) timeOfDay.morning += 1;
    else if (hour >= 12 && hour < 18) timeOfDay.afternoon += 1;
    else if (hour >= 18 && hour < 24) timeOfDay.evening += 1;
    else timeOfDay.night += 1;
  }
  return { todayMinutes: Math.floor(todayRecords.reduce((sum, record) => sum + record.durationSeconds, 0) / 60),
    todayCompleted: todayRecords.length, totalMinutes,
    todayFailed: todayFailed.length, totalCompleted: completed.length, totalFailed: failed.length, streakDays,
    averageMinutesPerActiveDay: activeDays.size ? Math.round(totalMinutes / activeDays.size) : 0, timeOfDay,
    dailyTrend: dailyMinutes.map((item) => ({ ...item, ratio: item.minutes / maxMinutes })) };
}
function startOfDay(value: number) { const date = new Date(value); return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(); }
function dayKey(value: number) { const date = new Date(value); return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; }
