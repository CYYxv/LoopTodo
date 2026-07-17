import { nativeDeviceUsageModule } from './native-device-usage';
import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

export type UsageAccessStatus = 'granted' | 'denied' | 'unsupported';

export type AppUsageEvent = {
  packageName: string;
  timestamp: number;
  eventType: 'foreground' | 'background';
};

export type AppUsageResult = {
  apps: { packageName: string; label?: string; foregroundDurationMs: number }[];
  events: AppUsageEvent[];
};

export type NativeDeviceUsageModule = {
  getUsageAccessStatus(): Promise<UsageAccessStatus>;
  openUsageAccessSettings(): Promise<void>;
  queryAppUsage(startAt: number, endAt: number): Promise<AppUsageResult>;
};

export type DeviceUsageSummary = {
  totalSeconds: number;
  apps: { packageName: string; label?: string; durationSeconds: number }[];
  interruptionCount: number;
  interruptionApps: { packageName: string; label?: string; count: number }[];
};

const excludedPackages = new Set([
  'android',
  'com.android.systemui',
  'com.looptodo.app',
  'com.google.android.apps.nexuslauncher',
  'com.sec.android.app.launcher',
  'com.miui.home',
]);

export function createDeviceUsage(nativeModule: NativeDeviceUsageModule = nativeDeviceUsageModule) {
  return {
    getUsageAccessStatus: () => nativeModule.getUsageAccessStatus(),
    openUsageAccessSettings: () => nativeModule.openUsageAccessSettings(),
    async queryAppUsage(startAt: number, endAt: number) {
      validateRange(startAt, endAt);
      if (await nativeModule.getUsageAccessStatus() !== 'granted') return { apps: [], events: [] };
      const result = await nativeModule.queryAppUsage(startAt, endAt);
      return {
        apps: result.apps.filter((app) => !isExcludedPackage(app.packageName)),
        events: result.events.filter((event) => !isExcludedPackage(event.packageName)),
      };
    },
  };
}

const defaultDeviceUsage = createDeviceUsage();

export const getUsageAccessStatus = defaultDeviceUsage.getUsageAccessStatus;
export const openUsageAccessSettings = defaultDeviceUsage.openUsageAccessSettings;
export const queryAppUsage = defaultDeviceUsage.queryAppUsage;

export function summarizeDeviceUsage(result: AppUsageResult, records: FocusSessionRecord[]): DeviceUsageSummary {
  const apps = result.apps
    .filter((app) => !isExcludedPackage(app.packageName))
    .map((app) => ({ ...app, durationSeconds: Math.max(0, Math.round(app.foregroundDurationMs / 1000)) }))
    .sort((left, right) => right.durationSeconds - left.durationSeconds);
  const appByPackage = new Map(apps.map((app) => [app.packageName, app]));
  const focusIntervals = records.map((record) => ({ startAt: record.startedAt, endAt: record.endedAt }));
  const interruptions = new Map<string, number>();
  let interruptionCount = 0;
  for (const event of result.events) {
    if (event.eventType !== 'foreground' || isExcludedPackage(event.packageName)) continue;
    if (!focusIntervals.some((interval) => event.timestamp >= interval.startAt && event.timestamp <= interval.endAt)) continue;
    interruptionCount += 1;
    interruptions.set(event.packageName, (interruptions.get(event.packageName) ?? 0) + 1);
  }
  return {
    totalSeconds: apps.reduce((sum, app) => sum + app.durationSeconds, 0),
    apps: apps.map(({ foregroundDurationMs: _foregroundDurationMs, ...app }) => app),
    interruptionCount,
    interruptionApps: [...interruptions.entries()].map(([packageName, count]) => ({
      packageName,
      label: appByPackage.get(packageName)?.label,
      count,
    })).sort((left, right) => right.count - left.count),
  };
}

function validateRange(startAt: number, endAt: number) {
  if (!Number.isFinite(startAt) || startAt < 0) throw new RangeError('startAt must be a non-negative timestamp');
  if (!Number.isFinite(endAt) || endAt <= startAt) throw new RangeError('endAt must be greater than startAt');
  if (endAt - startAt > 31 * 24 * 60 * 60_000) throw new RangeError('App usage range cannot exceed 31 days');
}

function isExcludedPackage(packageName: string) {
  const normalized = packageName.trim();
  return !normalized || excludedPackages.has(normalized) || normalized.startsWith('com.android.launcher');
}
