import type { DeliveryJob, NotificationEventInput, PushProviderName } from './notification.types';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');
export interface NotificationRepository {
  upsertDevice(input: { userId: string; platform: 'android' | 'ios'; deviceName: string; pushToken: string; provider: PushProviderName; appVersion?: string }): Promise<{ id: string }>;
  enqueue(input: NotificationEventInput): Promise<{ eventId: string; deliveries: number; replayed: boolean }>;
  claimDue(now: Date, limit: number): Promise<DeliveryJob[]>;
  markDelivered(id: string, providerId: string, now: Date): Promise<void>;
  scheduleRetry(id: string, attempts: number, nextAttemptAt: Date, error: string): Promise<void>;
  markFailed(id: string, attempts: number, error: string): Promise<void>;
  disableDevice(deviceId: string): Promise<void>;
}
