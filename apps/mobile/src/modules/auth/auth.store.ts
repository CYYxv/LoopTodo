import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { clearCloudSession, configureCloudSession } from './cloud-session';
import { lockEngine } from '../lock-engine/lock-engine.store';
import { taskStore } from '../tasks/task.store';

type User = { id: string; email: string; nickname: string; vipStatus: 'free' | 'active' | 'expired' };
type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number };
type AuthResult = { user: User; tokens: TokenPair };
type AuthState = {
  status: 'hydrating' | 'signed_out' | 'signed_in';
  baseUrl: string;
  user: User | null;
  error: string | null;
  setBaseUrl(value: string): Promise<void>;
  hydrate(): Promise<void>;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, nickname: string): Promise<void>;
  logout(): Promise<void>;
};

const refreshTokenKey = 'looptodo.refresh-token';
const baseUrlKey = 'looptodo.api-base-url';
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export const authStore = createStore<AuthState>((set, get) => ({
  status: 'hydrating',
  baseUrl: process.env.EXPO_PUBLIC_API_URL?.trim() ?? '',
  user: null,
  error: null,
  async setBaseUrl(value) {
    try {
      const baseUrl = normalizeBaseUrl(value);
      await SecureStore.setItemAsync(baseUrlKey, baseUrl);
      set({ baseUrl, error: null });
    } catch (error) {
      set({ error: message(error) });
      throw error;
    }
  },
  async hydrate() {
    const storedBaseUrl = await SecureStore.getItemAsync(baseUrlKey);
    const baseUrl = storedBaseUrl || get().baseUrl;
    const refreshToken = await SecureStore.getItemAsync(refreshTokenKey);
    if (!baseUrl || !refreshToken) { clearCloudSession(); return set({ baseUrl, status: 'signed_out' }); }
    try {
      await applySession(baseUrl, await request<AuthResult>(baseUrl, '/auth/refresh', { refreshToken }), set);
    } catch (error) {
      await clearSignedOutSession(set, message(error), baseUrl);
    }
  },
  async login(email, password) {
    await authenticate(get, set, '/auth/login', { email, password, deviceName: deviceName() });
  },
  async register(email, password, nickname) {
    await authenticate(get, set, '/auth/register', { email, password, nickname, deviceName: deviceName() });
  },
  async logout() {
    const state = get();
    let logoutError: string | null = null;
    try {
      const token = await SecureStore.getItemAsync('looptodo.access-token');
      if (token && state.baseUrl) await authorizedRequest(state.baseUrl, '/auth/logout', token);
    } catch (error) { logoutError = message(error); }
    await clearSignedOutSession(set, logoutError, state.baseUrl);
  },
}));

async function authenticate(get: () => AuthState, set: (value: Partial<AuthState>) => void, path: string, payload: Record<string, string>) {
  try {
    const baseUrl = normalizeBaseUrl(get().baseUrl);
    set({ status: 'hydrating', error: null });
    await applySession(baseUrl, await request<AuthResult>(baseUrl, path, payload), set);
  } catch (error) {
    set({ status: 'signed_out', error: message(error) });
  }
}

async function applySession(baseUrl: string, result: AuthResult, set: (value: Partial<AuthState>) => void) {
  await Promise.all([
    SecureStore.setItemAsync(baseUrlKey, baseUrl),
    SecureStore.setItemAsync(refreshTokenKey, result.tokens.refreshToken),
    SecureStore.setItemAsync('looptodo.access-token', result.tokens.accessToken),
  ]);
  configureCloudSession(baseUrl, result.tokens.accessToken);
  set({ baseUrl, user: result.user, status: 'signed_in', error: null });
  scheduleRefresh(baseUrl, result.tokens.expiresIn, set);
}

function scheduleRefresh(baseUrl: string, expiresIn: number, set: (value: Partial<AuthState>) => void) {
  clearRefreshTimer();
  refreshTimer = setTimeout(async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync(refreshTokenKey);
      if (!refreshToken) throw new Error('登录会话已失效');
      await applySession(baseUrl, await request<AuthResult>(baseUrl, '/auth/refresh', { refreshToken }), set);
    } catch (error) {
      await clearSignedOutSession(set, message(error), baseUrl);
    }
  }, Math.max(30, expiresIn - 60) * 1000);
}

function clearRefreshTimer() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
}

async function clearSignedOutSession(
  set: (value: Partial<AuthState>) => void,
  error: string | null,
  baseUrl: string,
) {
  let nextError = error;
  try {
    await taskStore.getState().clearSessionForSignOut();
  } catch (taskError) {
    nextError = mergeErrors(nextError, message(taskError));
  }
  try {
    const activeSession = await lockEngine.getActiveSession();
    if (activeSession) await lockEngine.endLockSession(activeSession.id);
  } catch (nativeError) {
    nextError = mergeErrors(nextError, message(nativeError));
  } finally {
    try {
      await lockEngine.clearFocusRestrictions();
    } catch (nativeError) {
      nextError = mergeErrors(nextError, message(nativeError));
    }
  }
  clearRefreshTimer();
  clearCloudSession();
  await Promise.all([SecureStore.deleteItemAsync(refreshTokenKey), SecureStore.deleteItemAsync('looptodo.access-token')]);
  set({ baseUrl, status: 'signed_out', user: null, error: nextError });
}

async function request<T>(baseUrl: string, path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? body.error?.code ?? '账号请求失败');
  return body.data as T;
}

async function authorizedRequest(baseUrl: string, path: string, token: string) {
  const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('退出登录失败，请检查网络后重试');
}

function normalizeBaseUrl(value: string) {
  const normalized = value.trim().replace(/\/$/, '');
  const url = new URL(normalized);
  const local = ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname) || isPrivateIpv4(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('API 地址必须使用 HTTPS，本机调试地址除外');
  return normalized;
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

function deviceName() {
  return `LoopTodo ${Platform.OS}`;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : '账号操作失败';
}

function mergeErrors(current: string | null, next: string) {
  return current ? `${current}；${next}` : next;
}

export function useAuthStore<T>(selector: (state: AuthState) => T) {
  return useStore(authStore, selector);
}
