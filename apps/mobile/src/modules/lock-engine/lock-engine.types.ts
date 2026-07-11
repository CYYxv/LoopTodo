export type LockCapabilities = {
  supported: boolean;
  notificationGranted: boolean;
  notificationListenerEnabled: boolean;
  accessibilityEnabled: boolean;
  batteryOptimizationIgnored: boolean;
  riskConfirmed: boolean;
  emergencyExitsRemaining: number;
  exactAlarmAllowed: boolean;
};

export type NativeLockSession = { id: string; taskId: string; taskTitle: string; startedAt: number; endsAt: number; enhanced: boolean };
