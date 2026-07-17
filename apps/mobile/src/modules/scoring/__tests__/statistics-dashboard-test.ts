import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';
import type { Task } from '@/modules/tasks/task.types';

const statisticsApi = require('../scoring.local') as {
  createStatisticsRange?: (kind: 'day' | 'week' | 'month' | 'year' | 'custom', anchor: number, custom?: { startDate: string; endDate: string }) => any;
  aggregateFocusStatistics?: (input: { records: Iterable<FocusSessionRecord>; tasks: Task[]; range: any; now?: number }) => any;
  shiftStatisticsAnchor?: (kind: 'day' | 'week' | 'month' | 'year', anchor: number, direction: -1 | 1) => number;
};

function createRange(kind: 'day' | 'week' | 'month' | 'year' | 'custom', anchor: number, custom?: { startDate: string; endDate: string }) {
  expect(typeof statisticsApi.createStatisticsRange).toBe('function');
  return statisticsApi.createStatisticsRange!(kind, anchor, custom);
}

function aggregate(input: { records: Iterable<FocusSessionRecord>; tasks: Task[]; range: any; now?: number }) {
  expect(typeof statisticsApi.aggregateFocusStatistics).toBe('function');
  return statisticsApi.aggregateFocusStatistics!(input);
}

function record(input: Partial<FocusSessionRecord> & Pick<FocusSessionRecord, 'id' | 'taskId' | 'startedAt' | 'endedAt' | 'durationSeconds'>): FocusSessionRecord {
  return {
    mode: 'focus', timerMode: 'countdown', phase: 'focus', plannedEndAt: input.endedAt, restEndsAt: null,
    outcome: 'completed', failureReason: null, completedAmount: null, ...input,
  };
}

function task(id: string, title: string, category: string): Task {
  return { id, title, category, trustLevel: 'medium' } as Task;
}

test('builds local preset boundaries across month and year edges', () => {
  const anchor = new Date(2026, 0, 1, 15, 45).getTime();

  expect(createRange('day', anchor)).toMatchObject({
    kind: 'day',
    startAt: new Date(2026, 0, 1).getTime(),
    endAt: new Date(2026, 0, 2).getTime(),
    granularity: 'hour',
  });
  expect(createRange('week', anchor)).toMatchObject({
    kind: 'week',
    startAt: new Date(2025, 11, 29).getTime(),
    endAt: new Date(2026, 0, 5).getTime(),
    granularity: 'day',
  });
  expect(createRange('month', anchor)).toMatchObject({ startAt: new Date(2026, 0, 1).getTime(), endAt: new Date(2026, 1, 1).getTime(), granularity: 'day' });
  expect(createRange('year', anchor)).toMatchObject({ startAt: new Date(2026, 0, 1).getTime(), endAt: new Date(2027, 0, 1).getTime(), granularity: 'month' });
});

test('moves preset ranges by their natural calendar unit', () => {
  expect(statisticsApi.shiftStatisticsAnchor?.('day', new Date(2026, 2, 1).getTime(), -1)).toBe(new Date(2026, 1, 28).getTime());
  expect(statisticsApi.shiftStatisticsAnchor?.('week', new Date(2026, 0, 5).getTime(), 1)).toBe(new Date(2026, 0, 12).getTime());
  expect(statisticsApi.shiftStatisticsAnchor?.('month', new Date(2026, 0, 31).getTime(), 1)).toBe(new Date(2026, 1, 28).getTime());
  expect(statisticsApi.shiftStatisticsAnchor?.('year', new Date(2024, 1, 29).getTime(), 1)).toBe(new Date(2025, 1, 28).getTime());
});

test('chooses custom trend granularity from the inclusive local-date span', () => {
  const anchor = new Date(2026, 6, 18, 12).getTime();

  expect(createRange('custom', anchor, { startDate: '2026-07-01', endDate: '2026-07-02' }).granularity).toBe('hour');
  expect(createRange('custom', anchor, { startDate: '2026-01-01', endDate: '2026-03-01' }).granularity).toBe('day');
  expect(createRange('custom', anchor, { startDate: '2025-01-01', endDate: '2026-02-04' }).granularity).toBe('month');
  expect(createRange('custom', anchor, { startDate: '2023-01-01', endDate: '2026-01-01' }).granularity).toBe('year');
});

test('aligns custom monthly trend buckets to natural month boundaries', () => {
  const range = createRange('custom', new Date(2026, 1, 20).getTime(), { startDate: '2025-01-15', endDate: '2026-02-20' });
  const result = aggregate({ records: [], tasks: [], range });

  expect(result.trend[0]).toMatchObject({ key: '2025-01', startAt: new Date(2025, 0, 15).getTime(), endAt: new Date(2025, 1, 1).getTime() });
  expect(result.trend[1]).toMatchObject({ key: '2025-02', startAt: new Date(2025, 1, 1).getTime(), endAt: new Date(2025, 2, 1).getTime() });
});

test('aligns custom yearly trend buckets to natural year boundaries', () => {
  const range = createRange('custom', new Date(2026, 7, 20).getTime(), { startDate: '2023-07-15', endDate: '2026-08-20' });
  const result = aggregate({ records: [], tasks: [], range });

  expect(result.trend[0]).toMatchObject({ key: '2023', startAt: new Date(2023, 6, 15).getTime(), endAt: new Date(2024, 0, 1).getTime() });
  expect(result.trend[1]).toMatchObject({ key: '2024', startAt: new Date(2024, 0, 1).getTime(), endAt: new Date(2025, 0, 1).getTime() });
});

test('aggregates summary, recent records, distributions and all chart series in one record traversal', () => {
  const anchor = new Date(2026, 6, 7, 21).getTime();
  const range = createRange('custom', anchor, { startDate: '2026-07-01', endDate: '2026-07-07' });
  const records = [
    record({ id: 'morning', taskId: 'reading', mode: 'lock', startedAt: new Date(2026, 6, 2, 8).getTime(), endedAt: new Date(2026, 6, 2, 9).getTime(), durationSeconds: 3600 }),
    record({ id: 'afternoon', taskId: 'writing', timerMode: 'untimed', startedAt: new Date(2026, 6, 3, 14).getTime(), endedAt: new Date(2026, 6, 3, 14, 30).getTime(), durationSeconds: 1800 }),
    record({ id: 'exited', taskId: 'reading', startedAt: new Date(2026, 6, 4, 20).getTime(), endedAt: new Date(2026, 6, 4, 20, 10).getTime(), durationSeconds: 600, outcome: 'exited', failureReason: '被打断' }),
    record({ id: 'heatmap-only', taskId: 'reading', startedAt: new Date(2026, 5, 1, 9).getTime(), endedAt: new Date(2026, 5, 1, 9, 20).getTime(), durationSeconds: 1200 }),
  ];
  let iterations = 0;
  const oneShotRecords = {
    [Symbol.iterator]() {
      iterations += 1;
      if (iterations > 1) throw new Error('records were traversed more than once');
      return records[Symbol.iterator]();
    },
  };

  const result = aggregate({ records: oneShotRecords, tasks: [task('reading', '阅读', '学习'), task('writing', '写作', '工作')], range, now: anchor });

  expect(iterations).toBe(1);
  expect(result.summary).toMatchObject({ focusSeconds: 6000, completedSessions: 2, exitedSessions: 1, activeDays: 3, averageSecondsPerActiveDay: 2000, completionRate: 67 });
  expect(result.recentRecords.map((item: any) => item.record.id)).toEqual(['exited', 'afternoon', 'morning']);
  expect(result.distributions.task).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'reading', label: '阅读', seconds: 4200, sessions: 2 }),
    expect.objectContaining({ key: 'writing', label: '写作', seconds: 1800, sessions: 1 }),
  ]));
  expect(result.distributions.category).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: '学习', seconds: 4200 }),
    expect.objectContaining({ key: '工作', seconds: 1800 }),
  ]));
  expect(result.distributions.mode).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'lock', seconds: 3600 }),
    expect.objectContaining({ key: 'free', seconds: 1800 }),
    expect.objectContaining({ key: 'standard', seconds: 600 }),
  ]));
  expect(result.trend.find((item: any) => item.key === '2026-07-02')).toMatchObject({ seconds: 3600, sessions: 1 });
  expect(result.weekTimeline.map((item: any) => item.day)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  expect(result.weekTimeline.find((item: any) => item.day === 4).hours[8]).toMatchObject({ seconds: 3600, sessions: 1 });
  expect(result.startTime.hours[8]).toMatchObject({ seconds: 3600, sessions: 1 });
  expect(result.startTime.bestHour).toBe(8);
  expect(result.yearHeatmap.find((item: any) => item.date === '2026-06-01')).toMatchObject({ seconds: 1200, sessions: 1 });
});

test('caps provably inflated countdown records and reports them as anomalies', () => {
  const anchor = new Date(2026, 6, 7, 21).getTime();
  const range = createRange('day', anchor);
  const inflated = record({
    id: 'inflated', taskId: 'reading', plannedFocusSeconds: 60,
    startedAt: new Date(2026, 6, 7, 20).getTime(), endedAt: new Date(2026, 6, 7, 20, 10).getTime(),
    durationSeconds: 600,
  });

  const result = aggregate({ records: [inflated], tasks: [task('reading', '阅读', '学习')], range, now: anchor });

  expect(result.summary.focusSeconds).toBe(60);
  expect(result.anomalies.map((item: any) => item.record.id)).toEqual(['inflated']);
});
