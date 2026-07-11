import type { NotificationSchedule } from './notification.types';

export interface NotificationRepository {
  list(): Promise<NotificationSchedule[]>;
  save(schedule: NotificationSchedule): Promise<void>;
  markScheduled(id: string, platformNotificationId: string): Promise<void>;
  markCancelled(id: string): Promise<void>;
  getTaskRemindersEnabled(): Promise<boolean>;
  setTaskRemindersEnabled(enabled: boolean): Promise<void>;
}
