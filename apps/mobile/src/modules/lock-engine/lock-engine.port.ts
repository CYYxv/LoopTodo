import type { LockCapabilities, NativeLockSession } from './lock-engine.types';

export interface LockEngine {
  checkCapabilities(): Promise<LockCapabilities>;
  confirmRisk(): Promise<void>;
  getActiveSession(): Promise<NativeLockSession | null>;
  startLockSession(input: NativeLockSession): Promise<void>;
  endLockSession(id: string): Promise<void>;
  emergencyExit(id: string, reason: string): Promise<void>;
  scheduleForcedRule(input: { id: string; sourceId: string; title: string; durationMinutes: number; dailyMinute: number; recurring: boolean }): Promise<void>;
  cancelForcedRule(id: string): Promise<void>;
  markForcedRuleSatisfied(id: string): Promise<void>;
  openPermissionSettings(kind: 'notifications' | 'notificationListener' | 'accessibility' | 'battery' | 'exactAlarm'): Promise<void>;
}
