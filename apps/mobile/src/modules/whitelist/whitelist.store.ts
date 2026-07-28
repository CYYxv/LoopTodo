import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { track } from '@/modules/analytics/analytics';

import { createSQLiteWhitelistRepository } from './sqlite-whitelist.repository';
import type { WhitelistRepository } from './whitelist.repository';
import type { WhitelistList } from './whitelist.types';

export type WhitelistStore = {
  lists: WhitelistList[];
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  loadError: string | null;
  hydrate(force?: boolean): Promise<void>;
  create(name: string, packages: string[]): Promise<boolean>;
  update(list: WhitelistList): Promise<boolean>;
  setDefault(list: WhitelistList): Promise<void>;
  getReferenceCount(list: WhitelistList): Promise<number | null>;
  archive(list: WhitelistList, replacementId?: string | null, affectedTaskCount?: number): Promise<boolean>;
  clearError(): void;
};

export function createWhitelistStore(repository: WhitelistRepository = createSQLiteWhitelistRepository()) {
  return createStore<WhitelistStore>((set, get) => ({
    lists: [], hydrated: false, loading: false, error: null, loadError: null,
    async hydrate(force = false) {
      if ((get().hydrated && !force) || get().loading) return;
      set({ loading: true, error: null, loadError: null });
      try {
        set({ lists: await repository.hydrate(), hydrated: true, loading: false, loadError: null });
      } catch (error) {
        const nextError = message(error);
        set({ hydrated: true, loading: false, error: nextError, loadError: nextError });
      }
    },
    async create(name, packages) {
      set({ error: null });
      try {
        const list = await repository.create(name, packages);
        set((state) => ({ lists: [...state.lists, list] }));
        track('whitelist_list_created', listAnalytics(list));
        return true;
      } catch (error) {
        set({ error: message(error) });
        return false;
      }
    },
    async update(list) {
      set({ error: null });
      try {
        const next = { ...list, version: list.version + 1, syncStatus: 'pending' as const };
        await repository.update(next, list.version);
        set((state) => ({ lists: state.lists.map((item) => item.id === list.id ? next : item) }));
        track('whitelist_list_updated', listAnalytics(next));
        return true;
      } catch (error) {
        set({ error: message(error) });
        return false;
      }
    },
    async setDefault(list) {
      set({ error: null });
      try {
        await repository.setDefault(list.id, list.version);
        set((state) => ({ lists: state.lists.map((item) => ({ ...item, isDefault: item.id === list.id,
          version: item.id === list.id ? item.version + 1 : item.version, syncStatus: item.id === list.id ? 'pending' : item.syncStatus })) }));
      } catch (error) { set({ error: message(error) }); }
    },
    async getReferenceCount(list) {
      set({ error: null });
      try {
        return await repository.countReferences(list.id);
      } catch (error) {
        set({ error: message(error) });
        return null;
      }
    },
    async archive(list, replacementId = null, affectedTaskCount = 0) {
      set({ error: null });
      try {
        await repository.archive(list.id, list.version, replacementId);
        set((state) => ({ lists: state.lists.filter((item) => item.id !== list.id) }));
        track('whitelist_list_deleted', { ...listAnalytics(list), affectedTaskCount });
        return true;
      } catch (error) {
        set({ error: message(error) });
        return false;
      }
    },
    clearError() { set({ error: null, loadError: null }); },
  }));
}

export const whitelistStore = createWhitelistStore();

export function useWhitelistStore<T>(selector: (state: WhitelistStore) => T) {
  return useStore(whitelistStore, selector);
}

function message(error: unknown) {
  return error instanceof Error ? error.message : '白名单操作失败';
}

function listAnalytics(list: WhitelistList) {
  return { listId: list.id, source: 'settings', selectedCount: list.packages.length, isDefault: list.isDefault };
}
