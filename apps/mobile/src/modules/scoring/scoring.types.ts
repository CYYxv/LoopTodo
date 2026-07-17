import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

export type DailyScore = {
  date: string;
  focusMinutes: number;
  completedSessions: number;
  failedSessions: number;
  streakDays: number;
  durationScore: number;
  streakScore: number;
  trustScore: number;
  penaltyScore: number;
  totalScore: number;
};

export type ScoreHistory = { items: DailyScore[]; total: number };

export type StatisticsRangeKind = 'day' | 'week' | 'month' | 'year' | 'custom';
export type StatisticsGranularity = 'hour' | 'day' | 'month' | 'year';

export type StatisticsRange = {
  kind: StatisticsRangeKind;
  startAt: number;
  endAt: number;
  startDate: string;
  endDate: string;
  label: string;
  granularity: StatisticsGranularity;
};

export type StatisticsBucket = {
  key: string;
  label: string;
  startAt: number;
  endAt: number;
  seconds: number;
  sessions: number;
};

export type StatisticsDistributionItem = {
  key: string;
  label: string;
  color: string;
  seconds: number;
  sessions: number;
};

export type StatisticsHourBucket = {
  hour: number;
  seconds: number;
  sessions: number;
};

export type StatisticsWeekTimelineDay = {
  day: number;
  label: string;
  seconds: number;
  sessions: number;
  hours: StatisticsHourBucket[];
};

export type StatisticsHeatmapDay = {
  date: string;
  weekday: number;
  week: number;
  seconds: number;
  sessions: number;
};

export type StatisticsRecentRecord = {
  record: FocusSessionRecord;
  taskTitle: string;
  category: string;
};

export type FocusStatisticsDashboard = {
  range: StatisticsRange;
  summary: {
    focusSeconds: number;
    completedSessions: number;
    exitedSessions: number;
    activeDays: number;
    averageSecondsPerActiveDay: number;
    completionRate: number;
    longestSessionSeconds: number;
    currentStreakDays: number;
  };
  recentRecords: StatisticsRecentRecord[];
  anomalies: StatisticsRecentRecord[];
  distributions: {
    task: StatisticsDistributionItem[];
    category: StatisticsDistributionItem[];
    mode: StatisticsDistributionItem[];
  };
  trend: StatisticsBucket[];
  weekTimeline: StatisticsWeekTimelineDay[];
  startTime: {
    hours: StatisticsHourBucket[];
    bestHour: number | null;
  };
  year: number;
  yearHeatmap: StatisticsHeatmapDay[];
};

export type UsageAppStatistic = {
  packageName: string;
  label?: string;
  durationSeconds: number;
};

export type UsageStatisticsData =
  | { status: 'loading' }
  | { status: 'authorized'; totalSeconds: number; apps: UsageAppStatistic[]; interruptionCount: number; interruptionApps: Array<{ packageName: string; label?: string; count: number }> }
  | { status: 'denied' | 'unavailable'; reason?: string };
