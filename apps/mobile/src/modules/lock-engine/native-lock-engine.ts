import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

import type { LockEngine } from './lock-engine.port';
import type { FocusRestrictionOptions, LockCapabilities, NativeLockSession } from './lock-engine.types';

type NativeModule = {
  checkCapabilities(): Promise<LockCapabilities>; confirmRisk(): Promise<void>; getActiveSession(): Promise<NativeLockSession | null>;
  startLockSession(id: string, taskId: string, taskTitle: string, endsAt: number, enhanced: boolean): Promise<void>;
  endLockSession(id: string): Promise<void>; emergencyExit(id: string, reason: string): Promise<void>;
  applyFocusRestrictions(hideRecents: boolean, blockLeaving: boolean, blockNotifications: boolean, hideLauncherIcon: boolean): Promise<void>;
  clearFocusRestrictions(): Promise<void>;
  scheduleForcedRule(id: string, sourceId: string, title: string, durationMinutes: number, dailyMinute: number, recurring: boolean): Promise<void>;
  cancelForcedRule(id: string): Promise<void>; markForcedRuleSatisfied(id: string): Promise<void>;
  openPermissionSettings(kind: string): Promise<void>;
};

export function createNativeLockEngine(): LockEngine {
  return {
    async checkCapabilities() { return Platform.OS === 'android' ? native().checkCapabilities() : unsupported(); },
    async confirmRisk() { if (Platform.OS === 'android') await native().confirmRisk(); },
    async getActiveSession() { return Platform.OS === 'android' ? native().getActiveSession() : null; },
    async startLockSession(input) { if (Platform.OS !== 'android') throw new Error('锁机模式仅支持 Android'); await native().startLockSession(input.id, input.taskId, input.taskTitle, input.endsAt, input.enhanced); },
    async endLockSession(id) { if (Platform.OS === 'android') await native().endLockSession(id); },
    async emergencyExit(id, reason) { if (Platform.OS === 'android') await native().emergencyExit(id, reason); },
    async applyFocusRestrictions(options: FocusRestrictionOptions) { if (Platform.OS === 'android') await native().applyFocusRestrictions(options.hideRecents, options.blockLeaving, options.blockNotifications, options.hideLauncherIcon); },
    async clearFocusRestrictions() { if (Platform.OS === 'android') await native().clearFocusRestrictions(); },
    async scheduleForcedRule(input) { if (Platform.OS !== 'android') throw new Error('强制规则仅支持 Android'); await native().scheduleForcedRule(input.id, input.sourceId, input.title, input.durationMinutes, input.dailyMinute, input.recurring); },
    async cancelForcedRule(id) { if (Platform.OS === 'android') await native().cancelForcedRule(id); },
    async markForcedRuleSatisfied(id) { if (Platform.OS === 'android') await native().markForcedRuleSatisfied(id); },
    async openPermissionSettings(kind) { if (Platform.OS === 'android') await native().openPermissionSettings(kind); },
  };
}

function native() { return requireNativeModule<NativeModule>('AndroidLockEngine'); }
function unsupported(): LockCapabilities { const unavailable = { supported: false, effective: false, reason: '仅支持 Android' }; return { supported: false, manufacturer: 'unsupported', sdkInt: 0, vendorBackgroundSettingsAvailable: false, notificationGranted: false, notificationListenerEnabled: false, accessibilityEnabled: false, batteryOptimizationIgnored: false, riskConfirmed: false, emergencyExitsRemaining: 0, exactAlarmAllowed: false, restrictions: { hideRecents: unavailable, blockLeaving: unavailable, blockNotifications: unavailable, hideLauncherIcon: { ...unavailable, experimental: true } } }; }
