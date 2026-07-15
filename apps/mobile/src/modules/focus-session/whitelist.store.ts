import * as SecureStore from 'expo-secure-store';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { lockEngine } from '@/modules/lock-engine/lock-engine.store';
import type { LockEngine } from '@/modules/lock-engine/lock-engine.port';
import type { InstalledApp } from '@/modules/lock-engine/lock-engine.types';

// 专注模式全局应用白名单（PRD 3.3）。锁机模式不使用白名单。
// 仅持久化被选中的包名；已安装应用清单每次按需从原生查询，不落盘。
const storageKey = 'looptodo.focus-whitelist';

type WhitelistStore = {
  selected: string[];
  apps: InstalledApp[];
  loadingApps: boolean;
  hydrated: boolean;
  error: string | null;
  hydrate(): Promise<void>;
  loadApps(): Promise<void>;
  toggle(packageName: string): Promise<void>;
  clear(): Promise<void>;
};

export function createWhitelistStore(engine: LockEngine = lockEngine) {
  return createStore<WhitelistStore>((set, get) => ({
    selected: [],
    apps: [],
    loadingApps: false,
    hydrated: false,
    error: null,
    async hydrate() {
      if (get().hydrated) return;
      try {
        const raw = await SecureStore.getItemAsync(storageKey);
        const selected = raw ? (JSON.parse(raw) as unknown) : [];
        set({ selected: Array.isArray(selected) ? selected.filter((item): item is string => typeof item === 'string') : [], hydrated: true });
      } catch (error) {
        set({ hydrated: true, error: message(error) });
      }
    },
    async loadApps() {
      if (get().loadingApps) return;
      set({ loadingApps: true, error: null });
      try {
        set({ apps: await engine.listLaunchableApps(), loadingApps: false });
      } catch (error) {
        set({ loadingApps: false, error: message(error) });
      }
    },
    async toggle(packageName) {
      const current = get().selected;
      const selected = current.includes(packageName)
        ? current.filter((item) => item !== packageName)
        : [...current, packageName];
      set({ selected });
      try {
        await SecureStore.setItemAsync(storageKey, JSON.stringify(selected));
      } catch (error) {
        set({ error: message(error) });
      }
    },
    async clear() {
      set({ selected: [] });
      try {
        await SecureStore.deleteItemAsync(storageKey);
      } catch (error) {
        set({ error: message(error) });
      }
    },
  }));
}

export const whitelistStore = createWhitelistStore();

export function useWhitelistStore<T>(selector: (state: WhitelistStore) => T) {
  return useStore(whitelistStore, selector);
}

export function selectedWhitelistPackages(): string[] {
  return whitelistStore.getState().selected;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : '白名单操作失败';
}
