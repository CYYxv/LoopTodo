import type { SQLiteDatabase } from 'expo-sqlite';

import { getLoopTodoDatabase } from '@/modules/tasks/database';

import type { NotificationRepository } from './notification.repository';
import type { NotificationSchedule } from './notification.types';

type ScheduleRow = {
  id: string; event_type: NotificationSchedule['type']; title: string; body: string; data: string;
  scheduled_at: number; platform_notification_id: string | null; status: NotificationSchedule['status'];
};

export function createSQLiteNotificationRepository(
  getDatabase: () => Promise<SQLiteDatabase> = getLoopTodoDatabase,
  now: () => number = Date.now
): NotificationRepository {
  return {
    async list() {
      const database = await getDatabase();
      const rows = await database.getAllAsync<ScheduleRow>(
        'SELECT id, event_type, title, body, data, scheduled_at, platform_notification_id, status FROM notification_schedules ORDER BY scheduled_at ASC'
      );
      return rows.map((row) => ({ id: row.id, type: row.event_type, title: row.title, body: row.body,
        data: JSON.parse(row.data) as Record<string, string>, scheduledAt: row.scheduled_at,
        platformNotificationId: row.platform_notification_id, status: row.status }));
    },
    async save(schedule) {
      const database = await getDatabase();
      await database.runAsync(`INSERT INTO notification_schedules
        (id, event_type, title, body, data, scheduled_at, platform_notification_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, schedule.id, schedule.type, schedule.title, schedule.body,
        JSON.stringify(schedule.data), schedule.scheduledAt, schedule.platformNotificationId, schedule.status, now(), now());
    },
    async markScheduled(id, platformNotificationId) {
      const database = await getDatabase();
      await database.runAsync("UPDATE notification_schedules SET platform_notification_id = ?, status = 'scheduled', updated_at = ? WHERE id = ?", platformNotificationId, now(), id);
    },
    async markCancelled(id) {
      const database = await getDatabase();
      await database.runAsync("UPDATE notification_schedules SET status = 'cancelled', updated_at = ? WHERE id = ?", now(), id);
    },
    async getTaskRemindersEnabled() {
      const database = await getDatabase();
      const row = await database.getFirstAsync<{ task_reminders_enabled: number }>('SELECT task_reminders_enabled FROM notification_preferences WHERE singleton_id = 1');
      return row ? Boolean(row.task_reminders_enabled) : true;
    },
    async setTaskRemindersEnabled(enabled) {
      const database = await getDatabase();
      await database.runAsync('UPDATE notification_preferences SET task_reminders_enabled = ?, updated_at = ? WHERE singleton_id = 1', enabled ? 1 : 0, now());
    },
  };
}
