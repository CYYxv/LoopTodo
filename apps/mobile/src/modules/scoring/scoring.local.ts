import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';
import type { Task } from '@/modules/tasks/task.types';

import type {
  FocusStatisticsDashboard,
  StatisticsBucket,
  StatisticsDistributionItem,
  StatisticsGranularity,
  StatisticsHeatmapDay,
  StatisticsHourBucket,
  StatisticsRange,
  StatisticsRangeKind,
  StatisticsRecentRecord,
  StatisticsWeekTimelineDay,
} from './scoring.types';

const DISTRIBUTION_COLORS = ['#2563EB', '#7C3AED', '#0D9488', '#EA580C', '#DB2777', '#65A30D', '#0891B2', '#9333EA'];
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

type CustomRangeInput = { startDate: string; endDate: string };
type AggregateInput = { records: Iterable<FocusSessionRecord>; tasks: Task[]; range: StatisticsRange; now?: number };

export function createStatisticsRange(kind: StatisticsRangeKind, anchor = Date.now(), custom?: CustomRangeInput): StatisticsRange {
  const anchorDate = new Date(anchor);
  let start: Date;
  let end: Date;
  let granularity: StatisticsGranularity;

  if (kind === 'custom') {
    if (!custom) throw new Error('请选择自定义日期范围');
    start = parseLocalDate(custom.startDate);
    const inclusiveEnd = parseLocalDate(custom.endDate);
    if (start.getTime() > inclusiveEnd.getTime()) throw new Error('开始日期不能晚于结束日期');
    end = addLocalDays(inclusiveEnd, 1);
    granularity = customGranularity(start, end);
  } else if (kind === 'day') {
    start = startOfDay(anchorDate);
    end = addLocalDays(start, 1);
    granularity = 'hour';
  } else if (kind === 'week') {
    start = startOfWeek(anchorDate);
    end = addLocalDays(start, 7);
    granularity = 'day';
  } else if (kind === 'month') {
    start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    end = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 1);
    granularity = 'day';
  } else {
    start = new Date(anchorDate.getFullYear(), 0, 1);
    end = new Date(anchorDate.getFullYear() + 1, 0, 1);
    granularity = 'month';
  }

  const inclusiveEnd = addLocalDays(end, -1);
  return {
    kind,
    startAt: start.getTime(),
    endAt: end.getTime(),
    startDate: localDateKey(start),
    endDate: localDateKey(inclusiveEnd),
    label: rangeLabel(kind, start, inclusiveEnd),
    granularity,
  };
}

export function formatStatisticsDateInput(value: number | Date) {
  return localDateKey(value instanceof Date ? value : new Date(value));
}

export function shiftStatisticsAnchor(kind: Exclude<StatisticsRangeKind, 'custom'>, anchor: number, direction: -1 | 1) {
  const date = new Date(anchor);
  if (kind === 'day') return addLocalDays(date, direction).getTime();
  if (kind === 'week') return addLocalDays(date, direction * 7).getTime();
  if (kind === 'month') return shiftCalendarMonth(date, direction).getTime();
  return shiftCalendarYear(date, direction).getTime();
}

export function aggregateFocusStatistics({ records, tasks, range, now = Date.now() }: AggregateInput): FocusStatisticsDashboard {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const trend = createTrendBuckets(range);
  const trendByKey = new Map(trend.map((bucket) => [bucket.key, bucket]));
  const weekTimeline = createWeekTimeline();
  const weekTimelineByDay = new Map(weekTimeline.map((day) => [day.day, day]));
  const startHours = createHourBuckets();
  const heatmapContext = createYearHeatmap(range);
  const activeDays = new Set<string>();
  const recentRecords: StatisticsRecentRecord[] = [];
  const anomalies: StatisticsRecentRecord[] = [];
  const taskDistribution = new Map<string, StatisticsDistributionItem>();
  const categoryDistribution = new Map<string, StatisticsDistributionItem>();
  const modeDistribution = new Map<string, StatisticsDistributionItem>();
  let focusSeconds = 0;
  let completedSessions = 0;
  let exitedSessions = 0;
  let longestSessionSeconds = 0;

  for (const record of records) {
    const normalizedDuration = normalizeRecordDuration(record);
    const durationSeconds = normalizedDuration.seconds;
    const endedDate = new Date(record.endedAt);
    const heatmapDay = heatmapContext.byDate.get(localDateKey(endedDate));
    if (heatmapDay && record.endedAt >= heatmapContext.startAt && record.endedAt < heatmapContext.endAt) {
      heatmapDay.seconds += durationSeconds;
      heatmapDay.sessions += 1;
    }

    if (record.endedAt < range.startAt || record.endedAt >= range.endAt) continue;

    const task = taskById.get(record.taskId);
    const category = task?.category?.trim() || '未分类';
    if (normalizedDuration.anomalous) insertRecent(anomalies, { record, taskTitle: task?.title || '已删除任务', category });
    focusSeconds += durationSeconds;
    longestSessionSeconds = Math.max(longestSessionSeconds, durationSeconds);
    if (record.outcome === 'completed') completedSessions += 1;
    else exitedSessions += 1;
    activeDays.add(localDateKey(endedDate));

    const trendBucket = trendByKey.get(statisticsBucketKey(endedDate, range.granularity));
    if (trendBucket) {
      trendBucket.seconds += durationSeconds;
      trendBucket.sessions += 1;
    }

    const startedDate = new Date(record.startedAt);
    const hour = startedDate.getHours();
    const weekday = startedDate.getDay();
    const timelineDay = weekTimelineByDay.get(weekday)!;
    addToHourBucket(startHours[hour], durationSeconds);
    addToHourBucket(timelineDay.hours[hour], durationSeconds);
    timelineDay.seconds += durationSeconds;
    timelineDay.sessions += 1;

    addDistribution(taskDistribution, record.taskId, task?.title || '已删除任务', durationSeconds);
    addDistribution(categoryDistribution, category, category, durationSeconds);
    const mode = statisticsMode(record);
    addDistribution(modeDistribution, mode.key, mode.label, durationSeconds);
    insertRecent(recentRecords, { record, taskTitle: task?.title || '已删除任务', category });
  }

  const totalSessions = completedSessions + exitedSessions;
  const bestHourBucket = startHours.reduce<StatisticsHourBucket | null>((best, current) => current.seconds > (best?.seconds ?? 0) ? current : best, null);
  return {
    range,
    summary: {
      focusSeconds,
      completedSessions,
      exitedSessions,
      activeDays: activeDays.size,
      averageSecondsPerActiveDay: activeDays.size ? Math.round(focusSeconds / activeDays.size) : 0,
      completionRate: totalSessions ? Math.round(completedSessions / totalSessions * 100) : 0,
      longestSessionSeconds,
      currentStreakDays: consecutiveDays(activeDays, range, now),
    },
    recentRecords,
    anomalies,
    distributions: {
      task: finalizeDistribution(taskDistribution),
      category: finalizeDistribution(categoryDistribution),
      mode: finalizeDistribution(modeDistribution),
    },
    trend,
    weekTimeline,
    startTime: { hours: startHours, bestHour: bestHourBucket?.seconds ? bestHourBucket.hour : null },
    year: heatmapContext.year,
    yearHeatmap: heatmapContext.days,
  };
}

export function localStatistics(records: FocusSessionRecord[], now = Date.now()) {
  const today = localDateKey(new Date(now));
  const activeDays = new Set<string>();
  const dailySeconds = new Map<string, number>();
  const timeOfDay = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  let todaySeconds = 0;
  let todayCompleted = 0;
  let todayFailed = 0;
  let totalSeconds = 0;
  let totalCompleted = 0;
  let totalFailed = 0;

  for (const record of records) {
    const date = new Date(record.endedAt);
    const dateKey = localDateKey(date);
    if (record.outcome === 'exited') {
      totalFailed += 1;
      if (dateKey === today) todayFailed += 1;
      continue;
    }
    totalCompleted += 1;
    const durationSeconds = normalizeRecordDuration(record).seconds;
    totalSeconds += durationSeconds;
    activeDays.add(dateKey);
    dailySeconds.set(dateKey, (dailySeconds.get(dateKey) ?? 0) + durationSeconds);
    if (dateKey === today) {
      todayCompleted += 1;
      todaySeconds += durationSeconds;
    }
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) timeOfDay.morning += 1;
    else if (hour >= 12 && hour < 18) timeOfDay.afternoon += 1;
    else if (hour >= 18) timeOfDay.evening += 1;
    else timeOfDay.night += 1;
  }

  const dailyTrend = Array.from({ length: 7 }, (_, index) => {
    const date = addLocalDays(startOfDay(new Date(now)), index - 6);
    const minutes = Math.floor((dailySeconds.get(localDateKey(date)) ?? 0) / 60);
    return { date: localDateKey(date), label: WEEKDAY_LABELS[date.getDay()], minutes, ratio: 0 };
  });
  const maxMinutes = Math.max(1, ...dailyTrend.map((item) => item.minutes));
  for (const item of dailyTrend) item.ratio = item.minutes / maxMinutes;
  const totalMinutes = Math.floor(totalSeconds / 60);

  return {
    todayMinutes: Math.floor(todaySeconds / 60),
    todayCompleted,
    todayFailed,
    totalMinutes,
    totalCompleted,
    totalFailed,
    streakDays: consecutiveDaysFrom(activeDays, now),
    averageMinutesPerActiveDay: activeDays.size ? Math.round(totalMinutes / activeDays.size) : 0,
    timeOfDay,
    dailyTrend,
  };
}

function customGranularity(start: Date, endExclusive: Date): StatisticsGranularity {
  if (endExclusive.getTime() <= addLocalDays(start, 2).getTime()) return 'hour';
  if (endExclusive.getTime() <= addLocalDays(start, 90).getTime()) return 'day';
  if (endExclusive.getTime() <= addLocalYears(start, 2).getTime()) return 'month';
  return 'year';
}

function createTrendBuckets(range: StatisticsRange) {
  const buckets: StatisticsBucket[] = [];
  let cursor = new Date(range.startAt);
  while (cursor.getTime() < range.endAt) {
    const next = addGranularity(cursor, range.granularity);
    buckets.push({
      key: statisticsBucketKey(cursor, range.granularity),
      label: bucketLabel(cursor, range.granularity),
      startAt: cursor.getTime(),
      endAt: Math.min(next.getTime(), range.endAt),
      seconds: 0,
      sessions: 0,
    });
    cursor = next;
  }
  return buckets;
}

function createWeekTimeline(): StatisticsWeekTimelineDay[] {
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, label: `周${WEEKDAY_LABELS[day]}`, seconds: 0, sessions: 0, hours: createHourBuckets() }));
}

function createHourBuckets(): StatisticsHourBucket[] {
  return Array.from({ length: 24 }, (_, hour) => ({ hour, seconds: 0, sessions: 0 }));
}

function createYearHeatmap(range: StatisticsRange) {
  const lastIncludedDate = addLocalDays(new Date(range.endAt), -1);
  const year = lastIncludedDate.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const days: StatisticsHeatmapDay[] = [];
  const byDate = new Map<string, StatisticsHeatmapDay>();
  let cursor = start;
  let week = 0;
  while (cursor.getTime() < end.getTime()) {
    if (days.length && cursor.getDay() === 1) week += 1;
    const item = { date: localDateKey(cursor), weekday: (cursor.getDay() + 6) % 7, week, seconds: 0, sessions: 0 };
    days.push(item);
    byDate.set(item.date, item);
    cursor = addLocalDays(cursor, 1);
  }
  return { year, startAt: start.getTime(), endAt: end.getTime(), days, byDate };
}

function addDistribution(target: Map<string, StatisticsDistributionItem>, key: string, label: string, seconds: number) {
  const current = target.get(key);
  if (current) {
    current.seconds += seconds;
    current.sessions += 1;
    return;
  }
  target.set(key, { key, label, color: DISTRIBUTION_COLORS[target.size % DISTRIBUTION_COLORS.length], seconds, sessions: 1 });
}

function finalizeDistribution(items: Map<string, StatisticsDistributionItem>) {
  return Array.from(items.values()).sort((left, right) => right.seconds - left.seconds || right.sessions - left.sessions || left.label.localeCompare(right.label, 'zh-CN'));
}

function insertRecent(target: StatisticsRecentRecord[], item: StatisticsRecentRecord) {
  const index = target.findIndex((current) => current.record.endedAt < item.record.endedAt);
  if (index === -1) target.push(item);
  else target.splice(index, 0, item);
  if (target.length > 12) target.pop();
}

function addToHourBucket(bucket: StatisticsHourBucket, seconds: number) {
  bucket.seconds += seconds;
  bucket.sessions += 1;
}

function normalizeRecordDuration(record: FocusSessionRecord) {
  if (!Number.isFinite(record.durationSeconds) || record.durationSeconds < 0 || record.endedAt < record.startedAt) {
    return { seconds: 0, anomalous: true };
  }
  const seconds = Math.floor(record.durationSeconds);
  if (
    record.outcome === 'completed' &&
    record.timerMode === 'countdown' &&
    record.plannedFocusSeconds != null &&
    seconds > record.plannedFocusSeconds
  ) return { seconds: Math.max(0, Math.floor(record.plannedFocusSeconds)), anomalous: true };
  return { seconds, anomalous: false };
}

function statisticsMode(record: FocusSessionRecord) {
  if (record.mode === 'lock') return { key: 'lock', label: '锁机' };
  if (record.timerMode === 'untimed') return { key: 'free', label: '自由' };
  return { key: 'standard', label: '标准' };
}

function consecutiveDays(activeDays: Set<string>, range: StatisticsRange, now: number) {
  let cursor = startOfDay(new Date(Math.min(now, range.endAt)));
  if (cursor.getTime() >= range.endAt) cursor = addLocalDays(cursor, -1);
  let streak = 0;
  while (cursor.getTime() >= range.startAt && activeDays.has(localDateKey(cursor))) {
    streak += 1;
    cursor = addLocalDays(cursor, -1);
  }
  return streak;
}

function consecutiveDaysFrom(activeDays: Set<string>, now: number) {
  let cursor = startOfDay(new Date(now));
  let streak = 0;
  while (activeDays.has(localDateKey(cursor))) {
    streak += 1;
    cursor = addLocalDays(cursor, -1);
  }
  return streak;
}

function rangeLabel(kind: StatisticsRangeKind, start: Date, end: Date) {
  if (kind === 'day') return formatMonthDay(start);
  if (kind === 'week' || kind === 'custom') return `${formatMonthDay(start)} - ${formatMonthDay(end)}`;
  if (kind === 'month') return `${start.getFullYear()} 年 ${start.getMonth() + 1} 月`;
  return `${start.getFullYear()} 年`;
}

function bucketLabel(date: Date, granularity: StatisticsGranularity) {
  if (granularity === 'hour') return `${pad(date.getHours())}:00`;
  if (granularity === 'day') return formatMonthDay(date);
  if (granularity === 'month') return `${date.getMonth() + 1}月`;
  return `${date.getFullYear()}`;
}

function statisticsBucketKey(date: Date, granularity: StatisticsGranularity) {
  if (granularity === 'hour') return `${localDateKey(date)}-${pad(date.getHours())}`;
  if (granularity === 'day') return localDateKey(date);
  if (granularity === 'month') return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  return `${date.getFullYear()}`;
}

function addGranularity(date: Date, granularity: StatisticsGranularity) {
  if (granularity === 'month') return new Date(date.getFullYear(), date.getMonth() + 1, 1);
  if (granularity === 'year') return new Date(date.getFullYear() + 1, 0, 1);
  const next = new Date(date);
  if (granularity === 'hour') next.setHours(next.getHours() + 1);
  else next.setDate(next.getDate() + 1);
  return next;
}

function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('日期格式应为 YYYY-MM-DD');
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (localDateKey(date) !== value) throw new Error('日期无效');
  return date;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function startOfWeek(value: Date) {
  const date = startOfDay(value);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return date;
}

function addLocalDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function addLocalYears(value: Date, years: number) {
  const date = new Date(value);
  date.setFullYear(date.getFullYear() + years);
  return date;
}

function shiftCalendarMonth(value: Date, months: number) {
  const target = new Date(value.getFullYear(), value.getMonth() + months, 1, value.getHours(), value.getMinutes(), value.getSeconds(), value.getMilliseconds());
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(value.getDate(), lastDay));
  return target;
}

function shiftCalendarYear(value: Date, years: number) {
  const targetYear = value.getFullYear() + years;
  const lastDay = new Date(targetYear, value.getMonth() + 1, 0).getDate();
  return new Date(targetYear, value.getMonth(), Math.min(value.getDate(), lastDay), value.getHours(), value.getMinutes(), value.getSeconds(), value.getMilliseconds());
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}
