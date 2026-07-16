import type { NotificationScheduler } from './notification.scheduler';
import type { NotificationPermission, NotificationSchedule } from './notification.types';

let foregroundConfigured = false;
type NotificationsModule = typeof import('expo-notifications');
type LoadNotifications = () => Promise<NotificationsModule>;
const loadExpoNotifications: LoadNotifications = () => import('expo-notifications');

export async function configureForegroundNotifications() {
  if (foregroundConfigured) return;
  const notifications = await import('expo-notifications');
  notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
  foregroundConfigured = true;
}

export function createExpoNotificationScheduler(loadNotifications: LoadNotifications = loadExpoNotifications): NotificationScheduler {
  return {
    async getPermission() {
      const notifications = await loadNotifications();
      return mapPermission((await notifications.getPermissionsAsync()).status);
    },
    async requestPermission() {
      const notifications = await loadNotifications();
      return mapPermission((await notifications.requestPermissionsAsync()).status);
    },
    async configureChannels() {
      const notifications = await loadNotifications();
      await Promise.all([
        notifications.setNotificationChannelAsync('reminders', {
          name: '任务提醒',
          importance: notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 150, 250],
        }),
        notifications.setNotificationChannelAsync('important', {
          name: '重要提醒',
          importance: notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 300, 150, 300],
        }),
      ]);
    },
    async schedule(schedule) {
      const notifications = await loadNotifications();
      return notifications.scheduleNotificationAsync({
        content: {
          title: schedule.title,
          body: schedule.body,
          data: { ...schedule.data, eventType: schedule.type, scheduleId: schedule.id },
          sound: true,
        },
        trigger: {
          type: notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(schedule.scheduledAt),
          channelId: schedule.type === 'family_anomaly' ? 'important' : 'reminders',
        },
      });
    },
    async cancel(platformNotificationId) {
      const notifications = await loadNotifications();
      await notifications.cancelScheduledNotificationAsync(platformNotificationId);
    },
  };
}

function mapPermission(status: string): NotificationPermission {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}
