import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { createHttpSyncClient } from './sync-api.client';
import { SyncEngine } from './sync.engine';
import { createSQLiteSyncRepository } from './sqlite-sync.repository';
import type { SyncConflict } from './sync.types';
import { taskStore } from '@/modules/tasks/task.store';

type SyncStore = {
  configured: boolean;
  isSyncing: boolean;
  pending: number;
  conflicts: SyncConflict[];
  error: string | null;
  hydrate(): Promise<void>;
  syncNow(): Promise<void>;
  resolveConflict(id: string, strategy: 'cloud' | 'local'): Promise<void>;
};

const repository = createSQLiteSyncRepository();
let engine: SyncEngine | null = null;

export const syncStore = createStore<SyncStore>((set, get) => ({
  configured: false, isSyncing: false, pending: 0, conflicts: [], error: null,
  async hydrate() {
    const summary = await repository.summary();
    set({ pending: summary.pending, conflicts: summary.conflicts, error: summary.lastError });
  },
  async syncNow() {
    if (get().isSyncing) return;
    if (!engine) return set({ error: '登录后才能启用云同步' });
    set({ isSyncing: true, error: null });
    try {
      const summary = await engine.run();
      await taskStore.getState().hydrate();
      set({ isSyncing: false, pending: summary.pending, conflicts: summary.conflicts, error: summary.lastError });
    } catch (error) {
      set({ isSyncing: false, error: error instanceof Error ? error.message : '同步失败' });
    }
  },
  async resolveConflict(id, strategy) {
    await repository.resolveConflict(id, strategy);
    const summary = await repository.summary();
    await taskStore.getState().hydrate();
    set({ pending: summary.pending, conflicts: summary.conflicts, error: summary.lastError });
  },
}));

export function configureSync(baseUrl: string, accessToken: string) {
  engine = new SyncEngine(repository, createHttpSyncClient(baseUrl, accessToken));
  syncStore.setState({ configured: true, error: null });
}

export function useSyncStore<T>(selector: (state: SyncStore) => T) { return useStore(syncStore, selector); }
