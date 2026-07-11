import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { createExpoNotificationScheduler } from './expo-notification.scheduler';
import type { NotificationRepository } from './notification.repository';
import type { NotificationScheduler } from './notification.scheduler';
import { createSQLiteNotificationRepository } from './sqlite-notification.repository';
import type { NotificationPermission, NotificationSchedule } from './notification.types';

type NotificationStore = {
  permission: NotificationPermission;
  taskRemindersEnabled: boolean;
  schedules: NotificationSchedule[];
  error: string | null;
  hydrate(): Promise<void>;
  enableNotifications(): Promise<void>;
  setTaskRemindersEnabled(enabled: boolean): Promise<void>;
  sendTestReminder(): Promise<void>;
  cancel(id: string): Promise<void>;
};

export function createNotificationStore(repository: NotificationRepository, scheduler: NotificationScheduler, now: () => number = Date.now) {
  return createStore<NotificationStore>((set, get) => ({
    permission: 'undetermined', taskRemindersEnabled: true, schedules: [], error: null,
    async hydrate() {
      try {
        const [permission, schedules, taskRemindersEnabled] = await Promise.all([
          scheduler.getPermission(), repository.list(), repository.getTaskRemindersEnabled(),
        ]);
        set({ permission, schedules, taskRemindersEnabled, error: null });
      } catch (error) { set({ error: message(error) }); }
    },
    async enableNotifications() {
      try {
        const permission = await scheduler.requestPermission();
        if (permission === 'granted') await scheduler.configureChannels();
        set({ permission, error: permission === 'denied' ? '通知权限已被拒绝，请在系统设置中开启' : null });
      } catch (error) { set({ error: message(error) }); }
    },
    async setTaskRemindersEnabled(taskRemindersEnabled) {
      try { await repository.setTaskRemindersEnabled(taskRemindersEnabled); set({ taskRemindersEnabled, error: null }); }
      catch (error) { set({ error: message(error) }); }
    },
    async sendTestReminder() {
      if (get().permission !== 'granted') { set({ error: '请先开启通知权限' }); return; }
      const schedule: NotificationSchedule = { id: `notification-${now()}`, type: 'focus_complete',
        title: 'LoopTodo 测试提醒', body: '通知功能工作正常', data: {}, scheduledAt: now() + 3000,
        platformNotificationId: null, status: 'scheduled' };
      try {
        await repository.save(schedule);
        const platformNotificationId = await scheduler.schedule(schedule);
        await repository.markScheduled(schedule.id, platformNotificationId);
        set((state) => ({ schedules: [...state.schedules, { ...schedule, platformNotificationId }], error: null }));
      } catch (error) { set({ error: message(error) }); }
    },
    async cancel(id) {
      const schedule = get().schedules.find((item) => item.id === id);
      if (!schedule) return;
      try {
        if (schedule.platformNotificationId) await scheduler.cancel(schedule.platformNotificationId);
        await repository.markCancelled(id);
        set((state) => ({ schedules: state.schedules.map((item) => item.id === id ? { ...item, status: 'cancelled' } : item), error: null }));
      } catch (error) { set({ error: message(error) }); }
    },
  }));
}

export const notificationStore = createNotificationStore(createSQLiteNotificationRepository(), createExpoNotificationScheduler());
export function useNotificationStore<T>(selector: (state: NotificationStore) => T) { return useStore(notificationStore, selector); }
function message(error: unknown) { return error instanceof Error ? error.message : '通知操作失败'; }
