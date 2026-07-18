import * as SecureStore from 'expo-secure-store';

import { settingsStore } from '../settings.store';

const cachedSettings = {
  multiDeviceFocusSync: false,
  bottomTabs: ['social', 'habits'],
  shareCurrentTask: false,
  shareCompletedTasks: false,
  networkPolicy: 'offline_first',
  taskRemindersEnabled: true,
  familyAlertsEnabled: true,
  rewardNotificationsEnabled: true,
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  settingsStore.setState({ configured: false, baseUrl: '', token: '', value: null, loading: false, error: null });
  jest.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('keeps cached navigation settings when the API is offline', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(cachedSettings));
  globalThis.fetch = jest.fn(async () => { throw new TypeError('Network request failed'); });
  settingsStore.getState().configure('https://api.example.com', 'token');

  await settingsStore.getState().load();

  expect(settingsStore.getState().value?.bottomTabs).toEqual(['social', 'habits']);
  expect(settingsStore.getState().error).toContain('Network request failed');
});

test('defaults old cached settings to the system theme', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(cachedSettings));

  await settingsStore.getState().load();

  expect(settingsStore.getState().value?.themePreference).toBe('system');
});

test('persists normalized settings returned by the API', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ data: cachedSettings }),
  })) as unknown as typeof fetch;
  settingsStore.getState().configure('https://api.example.com', 'token');

  await settingsStore.getState().load();

  expect(JSON.parse(jest.mocked(SecureStore.setItemAsync).mock.calls[0][1])).toEqual({
    ...cachedSettings,
    themePreference: 'system',
  });
});

test('syncs and caches an updated theme preference', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
  globalThis.fetch = jest.fn(async (_url, init) => ({
    ok: true,
    json: async () => ({ data: { ...cachedSettings, themePreference: 'dark' } }),
  })) as unknown as typeof fetch;
  settingsStore.getState().configure('https://api.example.com', 'token');

  await settingsStore.getState().update({ themePreference: 'dark' });

  expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example.com/me/settings', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({ themePreference: 'dark' }),
  }));
  expect(settingsStore.getState().value?.themePreference).toBe('dark');
  expect(JSON.parse(jest.mocked(SecureStore.setItemAsync).mock.calls[0][1])).toEqual({
    ...cachedSettings,
    themePreference: 'dark',
  });
});
