import type { NotificationRepository } from '../notification.repository';
import type { NotificationScheduler } from '../notification.scheduler';
import { createNotificationStore } from '../notification.store';
import type { NotificationSchedule } from '../notification.types';

function setup(permission: 'undetermined' | 'denied' | 'granted') {
  const schedules: NotificationSchedule[] = [];
  const cancelled: string[] = [];
  const repository: NotificationRepository = {
    async list() { return schedules; }, async save(schedule) { schedules.push(schedule); },
    async markScheduled(id, platformNotificationId) { const item = schedules.find((schedule) => schedule.id === id); if (item) item.platformNotificationId = platformNotificationId; },
    async markCancelled(id) { const item = schedules.find((schedule) => schedule.id === id); if (item) item.status = 'cancelled'; },
    async getTaskRemindersEnabled() { return true; }, async setTaskRemindersEnabled() { return undefined; },
  };
  const scheduler: NotificationScheduler = {
    async getPermission() { return permission; }, async requestPermission() { return permission; },
    async configureChannels() { return undefined; }, async schedule() { return 'platform-1'; },
    async cancel(id) { cancelled.push(id); },
  };
  return { store: createNotificationStore(repository, scheduler, () => 1000), schedules, cancelled };
}

describe('notification store', () => {
  test('does not schedule after permission is denied', async () => {
    const state = setup('denied');
    await state.store.getState().enableNotifications();
    await state.store.getState().sendTestReminder();
    expect(state.store.getState().permission).toBe('denied');
    expect(state.schedules).toHaveLength(0);
  });

  test('schedules and cancels after permission is granted', async () => {
    const state = setup('granted');
    await state.store.getState().enableNotifications();
    await state.store.getState().sendTestReminder();
    expect(state.schedules[0]?.platformNotificationId).toBe('platform-1');
    await state.store.getState().cancel(state.schedules[0]!.id);
    expect(state.cancelled).toEqual(['platform-1']);
    expect(state.schedules[0]?.status).toBe('cancelled');
  });
});
