export type LockCapabilities = {
  supported: boolean;
  manufacturer: string;
  sdkInt: number;
  vendorBackgroundSettingsAvailable: boolean;
  notificationGranted: boolean;
  notificationListenerEnabled: boolean;
  accessibilityEnabled: boolean;
  batteryOptimizationIgnored: boolean;
  riskConfirmed: boolean;
  emergencyExitsRemaining: number;
  exactAlarmAllowed: boolean;
  restrictions: FocusRestrictionCapabilities;
};

export type NativeLockSession = { id: string; taskId: string; taskTitle: string; startedAt: number; endsAt: number; enhanced: boolean };
export type FocusRestrictionOptions = { hideRecents: boolean; blockLeaving: boolean; blockNotifications: boolean; hideLauncherIcon: boolean };
export type RestrictionCapability = { supported: boolean; effective: boolean; reason: string | null; experimental?: boolean };
export type FocusRestrictionCapabilities = {
  hideRecents: RestrictionCapability;
  blockLeaving: RestrictionCapability;
  blockNotifications: RestrictionCapability;
  hideLauncherIcon: RestrictionCapability;
};
