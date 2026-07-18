import type { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.types';

const oldUser: AuthUser = {
  id: 'user-1',
  email: 'user@example.com',
  passwordHash: 'hash',
  nickname: 'User',
  vipStatus: 'free',
  privacySettings: { legacyFlag: true },
  multiDeviceFocusSync: false,
  bottomTabs: ['habits', 'statistics'],
  shareCurrentTask: false,
  shareCompletedTasks: false,
  networkPolicy: 'offline_first',
  taskRemindersEnabled: true,
  familyAlertsEnabled: true,
  rewardNotificationsEnabled: true,
};

test('stores theme preference without discarding old privacy settings', async () => {
  const updateSettings = jest.fn(async (_userId, input) => ({ ...oldUser, ...input }));
  const repository = {
    findUserById: jest.fn(async () => oldUser),
    updateSettings,
  } as unknown as AuthRepository;
  const service = new AuthService(repository, {} as never, {} as never, {} as never);

  const result = await service.updateSettings('user-1', { themePreference: 'light' });

  expect(updateSettings).toHaveBeenCalledWith('user-1', expect.objectContaining({
    privacySettings: { legacyFlag: true, themePreference: 'light' },
  }));
  expect(result.themePreference).toBe('light');
});
