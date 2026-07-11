import type { NotificationScheduler } from './notification.scheduler';
import type { NotificationPermission, NotificationSchedule } from './notification.types';

export function createExpoNotificationScheduler(): NotificationScheduler {
  return {
    async getPermission() {
      const notifications = await import('expo-notifications');
      return mapPermission((await notifications.getPermissionsAsync()).status);
    },
    async requestPermission() {
      const notifications = await import('expo-notifications');
      return mapPermission((await notifications.requestPermissionsAsync()).status);
    },
    async configureChannels() {
      const notifications = await import('expo-notifications');
      await Promise.all([
        notifications.setNotificationChannelAsync('reminders', {
          name: '任务提醒',
          importance: notifications.AndroidImportance.DEFAULT,
        }),
        notifications.setNotificationChannelAsync('important', {
          name: '重要提醒',
          importance: notifications.AndroidImportance.HIGH,
        }),
      ]);
    },
    async schedule(schedule) {
      const notifications = await import('expo-notifications');
      return notifications.scheduleNotificationAsync({
        content: {
          title: schedule.title,
          body: schedule.body,
          data: { ...schedule.data, eventType: schedule.type, scheduleId: schedule.id },
          sound: schedule.type === 'family_anomaly' ? 'default' : undefined,
        },
        trigger: {
          type: notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(schedule.scheduledAt),
          channelId: schedule.type === 'family_anomaly' ? 'important' : 'reminders',
        },
      });
    },
    async cancel(platformNotificationId) {
      const notifications = await import('expo-notifications');
      await notifications.cancelScheduledNotificationAsync(platformNotificationId);
    },
  };
}

function mapPermission(status: string): NotificationPermission {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}
