jest.mock('../cloud-session', () => ({ configureCloudSession: jest.fn(), clearCloudSession: jest.fn() }));
const mockClearSessionForSignOut = jest.fn(async () => undefined);
jest.mock('../../tasks/task.store', () => ({ taskStore: {
  getState: () => ({ clearSessionForSignOut: mockClearSessionForSignOut }),
} }));
jest.mock('../../lock-engine/lock-engine.store', () => ({ lockEngine: {
  getActiveSession: jest.fn(async () => null),
  endLockSession: jest.fn(async () => undefined),
  clearFocusRestrictions: jest.fn(async () => undefined),
} }));

import * as SecureStore from 'expo-secure-store';

import { authStore } from '../auth.store';
import { configureCloudSession } from '../cloud-session';
import { lockEngine } from '../../lock-engine/lock-engine.store';

describe('authStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    authStore.setState({ status: 'signed_out', baseUrl: '', user: null, error: null });
  });

  afterEach(() => jest.useRealTimers());

  test('rejects insecure non-local API URLs', async () => {
    await expect(authStore.getState().setBaseUrl('http://example.com')).rejects.toThrow('HTTPS');
    expect(authStore.getState().error).toContain('HTTPS');
  });

  test('allows HTTP API URLs on a private local network', async () => {
    await expect(authStore.getState().setBaseUrl('http://192.168.0.105:3000')).resolves.toBeUndefined();
    expect(authStore.getState().baseUrl).toBe('http://192.168.0.105:3000');
  });

  test('clears native focus restrictions when logging out', async () => {
    authStore.setState({ status: 'signed_in', baseUrl: '', user: { id: 'user', email: 'u@example.com', nickname: 'User', vipStatus: 'free' }, error: null });

    await authStore.getState().logout();

    expect(mockClearSessionForSignOut).toHaveBeenCalledTimes(1);
    expect(lockEngine.clearFocusRestrictions).toHaveBeenCalledTimes(1);
    expect(authStore.getState().status).toBe('signed_out');
  });

  test('clears native focus restrictions when session refresh fails during hydration', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('https://api.example.com')
      .mockResolvedValueOnce('refresh-token');
    globalThis.fetch = jest.fn(async () => ({ ok: false, json: async () => ({ error: { message: '会话失效' } }) })) as never;

    await authStore.getState().hydrate();

    expect(lockEngine.clearFocusRestrictions).toHaveBeenCalledTimes(1);
    expect(authStore.getState()).toMatchObject({ status: 'signed_out', user: null, error: '会话失效' });
  });
  test('persists tokens and configures all cloud modules after login', async () => {
    await authStore.getState().setBaseUrl('https://api.example.com');
    globalThis.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data: { user: { id: 'user', email: 'u@example.com', nickname: 'User', vipStatus: 'free' }, tokens: { accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } } }) })) as never;
    await authStore.getState().login('u@example.com', 'password123');
    expect(authStore.getState().status).toBe('signed_in');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('looptodo.refresh-token', 'refresh');
    expect(configureCloudSession).toHaveBeenCalledWith('https://api.example.com', 'access');
  });
});
