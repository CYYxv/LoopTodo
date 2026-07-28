import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

import type { LockEngine } from './lock-engine.port';
import type {
  FocusRestrictionMode,
  FocusRestrictionOptions,
  FocusRestrictionResult,
  InstalledApp,
  LockCapabilities,
  NativeFocusRestrictionEvent,
  NativeLockSession,
} from './lock-engine.types';

type NativeFocusRestrictionSessionOptions = {
  sessionId: string;
  taskTitle: string;
  restrictionMode: FocusRestrictionMode;
  hideRecents: boolean;
  blockLeaving: boolean;
  blockNotifications: boolean;
  hideLauncherIcon: boolean;
  allowedPackages: string[];
  expiresAt: number;
};

type NativeModule = {
  checkCapabilities(): Promise<Omit<LockCapabilities, 'restrictions'> & { restrictions?: LockCapabilities['restrictions'] }>;
  confirmRisk(): Promise<void>;
  getActiveSession(): Promise<NativeLockSession | null>;
  startLockSession(id: string, taskId: string, taskTitle: string, endsAt: number, enhanced: boolean): Promise<void>;
  endLockSession(id: string): Promise<void>;
  emergencyExit(id: string, reason: string): Promise<void>;
  applyFocusRestrictionSession?(
    sessionId: string,
    restrictionMode: FocusRestrictionMode,
    hideRecents: boolean,
    blockLeaving: boolean,
    blockNotifications: boolean,
    hideLauncherIcon: boolean,
    allowedPackages: string[],
    expiresAt: number,
  ): Promise<FocusRestrictionResult>;
  applyFocusRestrictionSessionV2?(options: NativeFocusRestrictionSessionOptions): Promise<FocusRestrictionResult>;
  applyFocusRestrictions?(hideRecents: boolean, blockLeaving: boolean, blockNotifications: boolean, hideLauncherIcon: boolean, allowedPackages: string[], expiresAt: number): Promise<FocusRestrictionResult | void>;
  clearFocusRestrictions?(): Promise<void>;
  drainFocusRestrictionEvents?(): Promise<NativeFocusRestrictionEvent[]>;
  listLaunchableApps?(): Promise<InstalledApp[]>;
  scheduleForcedRule(id: string, sourceId: string, title: string, durationMinutes: number, dailyMinute: number, recurring: boolean): Promise<void>;
  cancelForcedRule(id: string): Promise<void>;
  markForcedRuleSatisfied(id: string): Promise<void>;
  openPermissionSettings(kind: string): Promise<void>;
};

type NativeLoader = () => Partial<NativeModule>;

export function createNativeLockEngine(loadNative: NativeLoader = native): LockEngine {
  return {
    async checkCapabilities() {
      const module = loadNative();
      if (!module.checkCapabilities) return unsupported('需更新 Development Build 后启用');
      return Platform.OS === 'android' ? normalizeCapabilities(await module.checkCapabilities()) : unsupported();
    },
    async confirmRisk() { if (Platform.OS === 'android') await loadNative().confirmRisk?.(); },
    async getActiveSession() { return Platform.OS === 'android' ? loadNative().getActiveSession?.() ?? null : null; },
    async startLockSession(input) {
      if (Platform.OS !== 'android') throw new Error('锁机模式仅支持 Android');
      const start = loadNative().startLockSession;
      if (!start) throw new Error('需更新 Development Build 后启用');
      await start(input.id, input.taskId, input.taskTitle, input.endsAt, input.enhanced);
    },
    async endLockSession(id) { if (Platform.OS === 'android') await loadNative().endLockSession?.(id); },
    async emergencyExit(id, reason) { if (Platform.OS === 'android') await loadNative().emergencyExit?.(id, reason); },
    async applyFocusRestrictions(options) {
      if (Platform.OS !== 'android') return { supported: false, effective: false, reason: '仅支持 Android' };
      const module = loadNative();
      const mode = resolveRestrictionMode(options);
      if (module.applyFocusRestrictionSessionV2) {
        return module.applyFocusRestrictionSessionV2({
          sessionId: options.sessionId ?? `legacy-focus-${options.expiresAt}`,
          taskTitle: options.taskTitle?.trim() || '当前专注',
          restrictionMode: mode,
          hideRecents: options.hideRecents,
          blockLeaving: options.blockLeaving,
          blockNotifications: options.blockNotifications,
          hideLauncherIcon: options.hideLauncherIcon,
          allowedPackages: mode === 'strict' ? [] : options.allowedPackages ?? [],
          expiresAt: options.expiresAt ?? 0,
        });
      }
      if (module.applyFocusRestrictionSession) {
        return module.applyFocusRestrictionSession(
          options.sessionId ?? `legacy-focus-${options.expiresAt}`,
          mode,
          options.hideRecents,
          options.blockLeaving,
          options.blockNotifications,
          options.hideLauncherIcon,
          mode === 'strict' ? [] : options.allowedPackages ?? [],
          options.expiresAt ?? 0,
        );
      }
      if (!module.applyFocusRestrictions) {
        return { supported: false, effective: false, reason: '需更新 Development Build 后启用' };
      }
      const result = await module.applyFocusRestrictions(
        options.hideRecents,
        options.blockLeaving,
        options.blockNotifications,
        options.hideLauncherIcon,
        mode === 'strict' ? [] : options.allowedPackages ?? [],
        options.expiresAt ?? 0,
      );
      return result ?? { supported: true, effective: mode !== 'none', reason: null };
    },
    async clearFocusRestrictions() {
      if (Platform.OS !== 'android') return;
      const module = loadNative();
      if (module.clearFocusRestrictions) await module.clearFocusRestrictions();
    },
    async drainFocusRestrictionEvents() {
      if (Platform.OS !== 'android') return [];
      return loadNative().drainFocusRestrictionEvents?.() ?? [];
    },
    async listLaunchableApps() {
      if (Platform.OS !== 'android') return [];
      const module = loadNative();
      return module.listLaunchableApps ? module.listLaunchableApps() : [];
    },
    async scheduleForcedRule(input) {
      if (Platform.OS !== 'android') throw new Error('强制规则仅支持 Android');
      const schedule = loadNative().scheduleForcedRule;
      if (!schedule) throw new Error('需更新 Development Build 后启用');
      await schedule(input.id, input.sourceId, input.title, input.durationMinutes, input.dailyMinute, input.recurring);
    },
    async cancelForcedRule(id) { if (Platform.OS === 'android') await loadNative().cancelForcedRule?.(id); },
    async markForcedRuleSatisfied(id) { if (Platform.OS === 'android') await loadNative().markForcedRuleSatisfied?.(id); },
    async openPermissionSettings(kind) { if (Platform.OS === 'android') await loadNative().openPermissionSettings?.(kind); },
};
}

function resolveRestrictionMode(options: FocusRestrictionOptions): FocusRestrictionMode {
  if (options.restrictionMode) return options.restrictionMode;
  if (!options.blockLeaving) return 'none';
  return options.allowedPackages?.length ? 'whitelist' : 'strict';
}

function native() { return requireNativeModule<NativeModule>('AndroidLockEngine'); }

function normalizeCapabilities(capabilities: Awaited<ReturnType<NonNullable<NativeModule['checkCapabilities']>>>): LockCapabilities {
  const unavailable = { supported: false, effective: false, reason: '需更新 Development Build 后启用' };
  return {
    ...capabilities,
    accessibilityEnabled: capabilities.accessibilityEnabled ?? false,
    usageAccess: capabilities.usageAccess ?? unavailable,
    overlay: capabilities.overlay ?? unavailable,
    backgroundLaunch: capabilities.backgroundLaunch ?? unavailable,
    service: capabilities.service ?? unavailable,
    restrictions: capabilities.restrictions ?? {
      hideRecents: unavailable,
      blockLeaving: unavailable,
      blockNotifications: unavailable,
      whitelist: unavailable,
      hideLauncherIcon: { ...unavailable, experimental: true },
    },
  } as LockCapabilities;
}

function unsupported(reason = '仅支持 Android'): LockCapabilities {
  const unavailable = { supported: false, effective: false, reason };
  return {
    supported: false,
    manufacturer: 'unsupported',
    sdkInt: 0,
    vendorBackgroundSettingsAvailable: false,
    notificationGranted: false,
    notificationListenerEnabled: false,
    accessibilityEnabled: false,
    usageAccess: unavailable,
    overlay: unavailable,
    backgroundLaunch: unavailable,
    service: unavailable,
    batteryOptimizationIgnored: false,
    riskConfirmed: false,
    emergencyExitsRemaining: 0,
    exactAlarmAllowed: false,
    restrictions: {
      hideRecents: unavailable,
      blockLeaving: unavailable,
      blockNotifications: unavailable,
      whitelist: unavailable,
      hideLauncherIcon: { ...unavailable, experimental: true },
    },
  };
}
