import type { NotificationPermission, NotificationSchedule } from './notification.types';

export interface NotificationScheduler {
  getPermission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  configureChannels(): Promise<void>;
  schedule(schedule: NotificationSchedule): Promise<string>;
  cancel(platformNotificationId: string): Promise<void>;
}
