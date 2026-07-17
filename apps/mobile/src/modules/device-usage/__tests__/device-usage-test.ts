import { createDeviceUsage, summarizeDeviceUsage } from '../device-usage';
import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

const nativeResult = {
  apps: [
    { packageName: 'com.example.reader', label: '阅读器', foregroundDurationMs: 120_000 },
    { packageName: 'com.looptodo.app', foregroundDurationMs: 30_000 },
    { packageName: 'com.android.systemui', foregroundDurationMs: 10_000 },
    { packageName: 'com.android.launcher3', foregroundDurationMs: 5_000 },
  ],
  events: [
    { packageName: 'com.example.reader', timestamp: 1_000, eventType: 'foreground' as const },
    { packageName: 'com.looptodo.app', timestamp: 2_000, eventType: 'foreground' as const },
    { packageName: 'com.android.systemui', timestamp: 3_000, eventType: 'foreground' as const },
    { packageName: 'com.android.launcher3', timestamp: 4_000, eventType: 'foreground' as const },
    { packageName: 'com.example.reader', timestamp: 5_000, eventType: 'background' as const },
  ],
};

test('delegates usage access status and settings to the native module', async () => {
  const nativeModule = {
    getUsageAccessStatus: jest.fn(async () => 'granted' as const),
    openUsageAccessSettings: jest.fn(async () => undefined),
    queryAppUsage: jest.fn(async () => nativeResult),
  };
  const usage = createDeviceUsage(nativeModule);

  await expect(usage.getUsageAccessStatus()).resolves.toBe('granted');
  await usage.openUsageAccessSettings();

  expect(nativeModule.openUsageAccessSettings).toHaveBeenCalledTimes(1);
});

test('filters LoopTodo and Android shell packages in the JS layer', async () => {
  const nativeModule = {
    getUsageAccessStatus: jest.fn(async () => 'granted' as const),
    openUsageAccessSettings: jest.fn(async () => undefined),
    queryAppUsage: jest.fn(async () => nativeResult),
  };
  const usage = createDeviceUsage(nativeModule);

  await expect(usage.queryAppUsage(1_000, 6_000)).resolves.toEqual({
    apps: [{ packageName: 'com.example.reader', label: '阅读器', foregroundDurationMs: 120_000 }],
    events: [
      { packageName: 'com.example.reader', timestamp: 1_000, eventType: 'foreground' },
      { packageName: 'com.example.reader', timestamp: 5_000, eventType: 'background' },
    ],
  });
  expect(nativeModule.queryAppUsage).toHaveBeenCalledWith(1_000, 6_000);
});

test('rejects an invalid time range before querying Android', async () => {
  const nativeModule = {
    getUsageAccessStatus: jest.fn(async () => 'granted' as const),
    openUsageAccessSettings: jest.fn(async () => undefined),
    queryAppUsage: jest.fn(async () => nativeResult),
  };
  const usage = createDeviceUsage(nativeModule);

  await expect(usage.queryAppUsage(6_000, 1_000)).rejects.toThrow('endAt must be greater than startAt');
  expect(nativeModule.queryAppUsage).not.toHaveBeenCalled();
});

test('returns an empty result without querying Android when usage access is denied', async () => {
  const nativeModule = {
    getUsageAccessStatus: jest.fn(async () => 'denied' as const),
    openUsageAccessSettings: jest.fn(async () => undefined),
    queryAppUsage: jest.fn(async () => nativeResult),
  };
  const usage = createDeviceUsage(nativeModule);

  await expect(usage.queryAppUsage(1_000, 6_000)).resolves.toEqual({ apps: [], events: [] });
  expect(nativeModule.queryAppUsage).not.toHaveBeenCalled();
});

test('rejects device usage ranges longer than 31 days', async () => {
  const nativeModule = {
    getUsageAccessStatus: jest.fn(async () => 'granted' as const),
    openUsageAccessSettings: jest.fn(async () => undefined),
    queryAppUsage: jest.fn(async () => nativeResult),
  };
  const usage = createDeviceUsage(nativeModule);

  await expect(usage.queryAppUsage(0, 32 * 24 * 60 * 60_000)).rejects.toThrow('31 days');
  expect(nativeModule.queryAppUsage).not.toHaveBeenCalled();
});

test('summarizes app usage and foreground interruptions during focus sessions', () => {
  const focusRecord: FocusSessionRecord = {
    id: 'focus-1', taskId: 'task-1', mode: 'focus', timerMode: 'countdown', phase: 'focus',
    startedAt: 500, plannedEndAt: 6_000, restEndsAt: null, endedAt: 6_000,
    outcome: 'completed', failureReason: null, durationSeconds: 5, completedAmount: null,
  };

  expect(summarizeDeviceUsage(nativeResult, [focusRecord])).toEqual({
    totalSeconds: 120,
    apps: [{ packageName: 'com.example.reader', label: '阅读器', durationSeconds: 120 }],
    interruptionCount: 1,
    interruptionApps: [{ packageName: 'com.example.reader', label: '阅读器', count: 1 }],
  });
});
