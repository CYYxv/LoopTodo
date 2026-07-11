export const notificationEventTypes = [
  'forced_lock_buffer',
  'family_anomaly',
  'reward_available',
  'focus_complete',
] as const;

export type NotificationEventType = (typeof notificationEventTypes)[number];

export type NotificationSchedule = {
  id: string;
  type: NotificationEventType;
  title: string;
  body: string;
  data: Record<string, string>;
  scheduledAt: number;
  platformNotificationId: string | null;
  status: 'scheduled' | 'cancelled';
};

export type NotificationPermission = 'undetermined' | 'denied' | 'granted';
