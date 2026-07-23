export type NotificationPreferenceFlags = {
  taskRemindersEnabled?: boolean | null;
  familyAlertsEnabled?: boolean | null;
  rewardNotificationsEnabled?: boolean | null;
};

const familyTypes = new Set([
  'family_anomaly',
  'family_change_request',
  'family_change_result',
]);

export function isNotificationTypeEnabled(
  type: string,
  preferences: NotificationPreferenceFlags | null | undefined,
): boolean {
  if (familyTypes.has(type)) return preferences?.familyAlertsEnabled !== false;
  if (type === 'reward_available') return preferences?.rewardNotificationsEnabled !== false;
  return preferences?.taskRemindersEnabled !== false;
}
