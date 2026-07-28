import type { FocusRestrictionOptions, FocusRestrictionResult, InstalledApp, LockCapabilities, NativeFocusRestrictionEvent, NativeLockSession } from './lock-engine.types';

export interface LockEngine {
  checkCapabilities(): Promise<LockCapabilities>;
  confirmRisk(): Promise<void>;
  getActiveSession(): Promise<NativeLockSession | null>;
  startLockSession(input: NativeLockSession): Promise<void>;
  endLockSession(id: string): Promise<void>;
  emergencyExit(id: string, reason: string): Promise<void>;
  applyFocusRestrictions(options: FocusRestrictionOptions): Promise<FocusRestrictionResult | void>;
  clearFocusRestrictions(): Promise<void>;
  drainFocusRestrictionEvents(): Promise<NativeFocusRestrictionEvent[]>;
  listLaunchableApps(): Promise<InstalledApp[]>;
  scheduleForcedRule(input: { id: string; sourceId: string; title: string; durationMinutes: number; dailyMinute: number; recurring: boolean }): Promise<void>;
  cancelForcedRule(id: string): Promise<void>;
  markForcedRuleSatisfied(id: string): Promise<void>;
  openPermissionSettings(kind: 'notifications' | 'notificationListener' | 'usageAccess' | 'overlay' | 'backgroundLaunch' | 'service' | 'battery' | 'exactAlarm' | 'vendorBackground'): Promise<void>;
}
