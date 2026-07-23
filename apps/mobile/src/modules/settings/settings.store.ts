import * as SecureStore from 'expo-secure-store';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { apiErrorMessage } from '@/shared/api-error';
import { normalizeBottomTabs, type OptionalTabKey } from '@/ui/tab-navigation';

export type ThemePreference = 'system' | 'light' | 'dark';

export type Settings = {
  multiDeviceFocusSync: boolean;
  bottomTabs: [OptionalTabKey, OptionalTabKey];
  themePreference: ThemePreference;
  shareCurrentTask: boolean;
  shareCompletedTasks: boolean;
  networkPolicy: 'offline_first' | 'online_required';
  taskRemindersEnabled: boolean;
  familyAlertsEnabled: boolean;
  rewardNotificationsEnabled: boolean;
  isMinor: boolean;
  birthYear: number | null;
};

type Store = {
  configured: boolean;
  baseUrl: string;
  token: string;
  value: Settings | null;
  loading: boolean;
  error: string | null;
  configure(baseUrl: string, token: string): void;
  load(): Promise<void>;
  update(patch: Partial<Settings>): Promise<void>;
};

const settingsCacheKey = 'looptodo.settings-cache';

export const settingsStore = createStore<Store>((set, get) => ({
  configured: false,
  baseUrl: '',
  token: '',
  value: null,
  loading: false,
  error: null,
  configure(baseUrl, token) {
    set({ configured: true, baseUrl, token });
  },
  async load() {
    if (get().loading) return;
    set({ loading: true });
    const cached = await readCachedSettings();
    if (cached && !get().value) set({ value: cached });
    if (!get().configured) return set({ loading: false });
    try {
      const value = normalizeSettings(await request<unknown>(get(), '/me'));
      await persistSettings(value);
      set({ value, loading: false, error: null });
    } catch (error) {
      set({ loading: false, error: message(error) });
    }
  },
  async update(patch) {
    if (!get().configured) return set({ error: '登录后才能同步设置' });
    try {
      const body: Record<string, unknown> = { ...patch };
      const privacyPatch: Record<string, unknown> = {};
      if (typeof patch.isMinor === 'boolean') {
        privacyPatch.isMinor = patch.isMinor;
        if (patch.isMinor) {
          body.shareCurrentTask = false;
          body.shareCompletedTasks = false;
        }
        delete body.isMinor;
      }
      if (patch.birthYear !== undefined) {
        privacyPatch.birthYear = patch.birthYear;
        delete body.birthYear;
      }
      if (Object.keys(privacyPatch).length > 0) {
        body.privacySettings = privacyPatch;
      }
      const value = normalizeSettings(await request<unknown>(get(), '/me/settings', { method: 'PATCH', body: JSON.stringify(body) }));
      await persistSettings(value);
      set({ value, error: null });
    } catch (error) {
      set({ error: message(error) });
    }
  },
}));

async function request<T>(state: Store, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${state.baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${state.token}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(apiErrorMessage(body, '设置请求失败'));
  return body.data as T;
}

function normalizeSettings(value: unknown): Settings {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    multiDeviceFocusSync: input.multiDeviceFocusSync === true,
    bottomTabs: normalizeBottomTabs(input.bottomTabs),
    themePreference: normalizeThemePreference(input.themePreference),
    shareCurrentTask: input.shareCurrentTask === true,
    shareCompletedTasks: input.shareCompletedTasks === true,
    networkPolicy: input.networkPolicy === 'online_required' ? 'online_required' : 'offline_first',
    taskRemindersEnabled: input.taskRemindersEnabled !== false,
    familyAlertsEnabled: input.familyAlertsEnabled !== false,
    rewardNotificationsEnabled: input.rewardNotificationsEnabled !== false,
    isMinor: input.isMinor === true || privacyIsMinor(input.privacySettings),
    birthYear: privacyBirthYear(input.privacySettings) ?? (typeof input.birthYear === 'number' ? input.birthYear : null),
  };
}

function privacyIsMinor(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const privacy = value as Record<string, unknown>;
  const birthYear = Number(privacy.birthYear);
  if (Number.isInteger(birthYear) && birthYear >= 1900 && birthYear <= new Date().getFullYear()) {
    if (new Date().getFullYear() - birthYear < 18) return true;
  }
  return privacy.isMinor === true;
}

function privacyBirthYear(value: unknown): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const birthYear = Number((value as Record<string, unknown>).birthYear);
  return Number.isInteger(birthYear) && birthYear >= 1900 ? birthYear : null;
}

function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

async function readCachedSettings() {
  try {
    const raw = await SecureStore.getItemAsync(settingsCacheKey);
    return raw ? normalizeSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function persistSettings(value: Settings) {
  return SecureStore.setItemAsync(settingsCacheKey, JSON.stringify(value));
}

export function configureSettings(baseUrl: string, token: string) {
  settingsStore.getState().configure(baseUrl, token);
}

export function useSettingsStore<T>(selector: (state: Store) => T) {
  return useStore(settingsStore, selector);
}

function message(error: unknown) {
  return error instanceof Error ? error.message : '设置操作失败';
}
