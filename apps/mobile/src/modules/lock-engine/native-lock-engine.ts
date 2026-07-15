import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

import type { LockEngine } from './lock-engine.port';
import type { FocusRestrictionOptions, InstalledApp, LockCapabilities, NativeLockSession } from './lock-engine.types';

type NativeModule = {
  checkCapabilities(): Promise<Omit<LockCapabilities, 'restrictions'> & { restrictions?: LockCapabilities['restrictions'] }>; confirmRisk(): Promise<void>; getActiveSession(): Promise<NativeLockSession | null>;
  startLockSession(id: string, taskId: string, taskTitle: string, endsAt: number, enhanced: boolean): Promise<void>;
  endLockSession(id: string): Promise<void>; emergencyExit(id: string, reason: string): Promise<void>;
  applyFocusRestrictions?(hideRecents: boolean, blockLeaving: boolean, blockNotifications: boolean, hideLauncherIcon: boolean, allowedPackages: string[], expiresAt: number): Promise<void>;
  clearFocusRestrictions?(): Promise<void>;
  listLaunchableApps?(): Promise<InstalledApp[]>;
  scheduleForcedRule(id: string, sourceId: string, title: string, durationMinutes: number, dailyMinute: number, recurring: boolean): Promise<void>;
  cancelForcedRule(id: string): Promise<void>; markForcedRuleSatisfied(id: string): Promise<void>;
  openPermissionSettings(kind: string): Promise<void>;
};

export function createNativeLockEngine(): LockEngine {
  return {
    async checkCapabilities() { return Platform.OS === 'android' ? normalizeCapabilities(await native().checkCapabilities()) : unsupported(); },
    async confirmRisk() { if (Platform.OS === 'android') await native().confirmRisk(); },
    async getActiveSession() { return Platform.OS === 'android' ? native().getActiveSession() : null; },
    async startLockSession(input) { if (Platform.OS !== 'android') throw new Error('锁机模式仅支持 Android'); await native().startLockSession(input.id, input.taskId, input.taskTitle, input.endsAt, input.enhanced); },
    async endLockSession(id) { if (Platform.OS === 'android') await native().endLockSession(id); },
    async emergencyExit(id, reason) { if (Platform.OS === 'android') await native().emergencyExit(id, reason); },
    async applyFocusRestrictions(options: FocusRestrictionOptions) { if (Platform.OS !== 'android') return; const module = native(); if (module.applyFocusRestrictions) await module.applyFocusRestrictions(options.hideRecents, options.blockLeaving, options.blockNotifications, options.hideLauncherIcon, options.allowedPackages ?? [], options.expiresAt ?? 0); },
    async clearFocusRestrictions() { if (Platform.OS !== 'android') return; const module = native(); if (module.clearFocusRestrictions) await module.clearFocusRestrictions(); },
    async listLaunchableApps() { if (Platform.OS !== 'android') return []; const module = native(); return module.listLaunchableApps ? module.listLaunchableApps() : []; },
    async scheduleForcedRule(input) { if (Platform.OS !== 'android') throw new Error('强制规则仅支持 Android'); await native().scheduleForcedRule(input.id, input.sourceId, input.title, input.durationMinutes, input.dailyMinute, input.recurring); },
    async cancelForcedRule(id) { if (Platform.OS === 'android') await native().cancelForcedRule(id); },
    async markForcedRuleSatisfied(id) { if (Platform.OS === 'android') await native().markForcedRuleSatisfied(id); },
    async openPermissionSettings(kind) { if (Platform.OS === 'android') await native().openPermissionSettings(kind); },
  };
}

function native() { return requireNativeModule<NativeModule>('AndroidLockEngine'); }
function normalizeCapabilities(capabilities: Awaited<ReturnType<NativeModule['checkCapabilities']>>): LockCapabilities {
  if (capabilities.restrictions) return capabilities as LockCapabilities;
  const unavailable = { supported: false, effective: false, reason: '需更新 Development Build 后启用' };
  return { ...capabilities, restrictions: { hideRecents: unavailable, blockLeaving: unavailable, blockNotifications: unavailable, whitelist: unavailable, hideLauncherIcon: { ...unavailable, experimental: true } } };
}
function unsupported(): LockCapabilities { const unavailable = { supported: false, effective: false, reason: '仅支持 Android' }; return { supported: false, manufacturer: 'unsupported', sdkInt: 0, vendorBackgroundSettingsAvailable: false, notificationGranted: false, notificationListenerEnabled: false, accessibilityEnabled: false, batteryOptimizationIgnored: false, riskConfirmed: false, emergencyExitsRemaining: 0, exactAlarmAllowed: false, restrictions: { hideRecents: unavailable, blockLeaving: unavailable, blockNotifications: unavailable, whitelist: unavailable, hideLauncherIcon: { ...unavailable, experimental: true } } }; }
