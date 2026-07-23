export const notificationEventTypes = [
  'forced_lock_buffer',
  'family_anomaly',
  'family_change_request',
  'family_change_result',
  'family_task_assigned',
  'friend_invite',
  'pk_started',
  'reward_available',
  'focus_complete',
] as const;
export type NotificationEventType = (typeof notificationEventTypes)[number];
export type PushProviderName = 'fcm' | 'vendor' | 'test';
export type NotificationEventInput = { userId: string; type: NotificationEventType; title: string; body: string;
  data: Record<string, string>; dedupeKey: string; scheduledAt: Date };
export type DeliveryJob = { id: string; eventId: string; deviceId: string; attempts: number; provider: PushProviderName;
  pushToken: string; title: string; body: string; data: Record<string, string> };
export type PushResult = { providerId: string } | { invalidToken: true };
