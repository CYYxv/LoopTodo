const mockScheduleNotificationAsync = jest.fn(async () => 'notification-1');
const mockSetNotificationChannelAsync = jest.fn(async (_channelId: string, _channel: Record<string, unknown>) => null);

const mockNotifications = {
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
};

import { createExpoNotificationScheduler } from '../expo-notification.scheduler';

describe('Expo notification scheduler', () => {
  test('lets Android channels use the system default sound', async () => {
    const scheduler = createExpoNotificationScheduler(async () => mockNotifications as never);

    await scheduler.configureChannels();

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledTimes(2);
    for (const [, channel] of mockSetNotificationChannelAsync.mock.calls) {
      expect(channel).not.toHaveProperty('sound');
    }
  });

  test('uses the platform default sound instead of a custom sound name', async () => {
    const scheduler = createExpoNotificationScheduler(async () => mockNotifications as never);

    await scheduler.schedule({
      id: 'test', type: 'focus_complete', title: 'LoopTodo', body: 'test', data: {},
      scheduledAt: 4000, platformNotificationId: null, status: 'scheduled',
    });

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.objectContaining({ sound: true }),
    }));
  });
});
