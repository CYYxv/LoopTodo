export type LockCapabilities = {
  supported: boolean;
  manufacturer: string;
  sdkInt: number;
  vendorBackgroundSettingsAvailable: boolean;
  notificationGranted: boolean;
  notificationListenerEnabled: boolean;
  accessibilityEnabled: boolean;
  usageAccess?: RestrictionCapability;
  overlay?: RestrictionCapability;
  backgroundLaunch?: RestrictionCapability;
  service?: RestrictionCapability;
  batteryOptimizationIgnored: boolean;
  riskConfirmed: boolean;
  emergencyExitsRemaining: number;
  exactAlarmAllowed: boolean;
  restrictions: FocusRestrictionCapabilities;
};

export type NativeLockSession = { id: string; taskId: string; taskTitle: string; startedAt: number; endsAt: number; enhanced: boolean };
export type FocusRestrictionMode = 'none' | 'whitelist' | 'strict';
export type FocusRestrictionOptions = {
  sessionId?: string;
  taskTitle?: string;
  restrictionMode?: FocusRestrictionMode;
  hideRecents: boolean;
  blockLeaving: boolean;
  blockNotifications: boolean;
  hideLauncherIcon: boolean;
  allowedPackages: string[];
  expiresAt: number;
};
export type FocusRestrictionResult = { supported: boolean; effective: boolean; reason: string | null };
export type RestrictionCapability = { supported: boolean; effective: boolean; reason: string | null; experimental?: boolean };
export type FocusRestrictionCapabilities = {
  hideRecents: RestrictionCapability;
  blockLeaving: RestrictionCapability;
  blockNotifications: RestrictionCapability;
  hideLauncherIcon: RestrictionCapability;
  whitelist: RestrictionCapability;
};

export type InstalledApp = { packageName: string; label: string; iconDataUrl?: string | null };

export type NativeFocusRestrictionEvent = {
  event: 'app_blocked' | 'whitelist_blocker_shown' | 'whitelist_blocker_refocused';
  props: Record<string, unknown>;
  at: number;
};
