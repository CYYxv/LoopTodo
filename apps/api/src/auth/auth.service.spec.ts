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

test('partial privacySettings merge keeps existing themePreference', async () => {
  const existing = { ...oldUser, privacySettings: { themePreference: 'dark', legacyFlag: true } };
  const updateSettings = jest.fn(async (_userId, input) => ({ ...existing, ...input, privacySettings: input.privacySettings }));
  const repository = {
    findUserById: jest.fn(async () => existing),
    updateSettings,
  } as unknown as AuthRepository;
  const service = new AuthService(repository, {} as never, {} as never, {} as never);

  await service.updateSettings('user-1', { privacySettings: { isMinor: true } } as never);

  expect(updateSettings).toHaveBeenCalledWith('user-1', expect.objectContaining({
    shareCurrentTask: false,
    shareCompletedTasks: false,
    privacySettings: expect.objectContaining({
      themePreference: 'dark',
      legacyFlag: true,
      isMinor: true,
    }),
  }));
});

test('birthYear under 18 forces isMinor', async () => {
  const year = new Date().getUTCFullYear() - 15;
  const updateSettings = jest.fn(async (_userId, input) => ({ ...oldUser, ...input, privacySettings: input.privacySettings }));
  const repository = {
    findUserById: jest.fn(async () => oldUser),
    updateSettings,
  } as unknown as AuthRepository;
  const service = new AuthService(repository, {} as never, {} as never, {} as never);

  const result = await service.updateSettings('user-1', { privacySettings: { birthYear: year } } as never);
  expect(result.isMinor).toBe(true);
  expect(updateSettings.mock.calls[0][1].privacySettings.isMinor).toBe(true);
});

test('minor users cannot keep public social visibility', async () => {
  const updateSettings = jest.fn(async (_userId, input) => ({ ...oldUser, ...input, privacySettings: input.privacySettings }));
  const repository = {
    findUserById: jest.fn(async () => oldUser),
    updateSettings,
  } as unknown as AuthRepository;
  const service = new AuthService(repository, {} as never, {} as never, {} as never);

  await service.updateSettings('user-1', {
    privacySettings: { isMinor: true, socialVisibility: 'public' },
  } as never);

  expect(updateSettings.mock.calls[0][1].privacySettings.socialVisibility).toBe('friends');
});

