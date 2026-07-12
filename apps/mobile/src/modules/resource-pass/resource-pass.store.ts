import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { createSQLiteResourcePassRepository } from './sqlite-resource-pass.repository';
import type { ResourcePassRepository } from './resource-pass.repository';
import type { CreateResourcePass, ResourcePass } from './resource-pass.types';

export type ResourceLoadState = 'idle' | 'loading' | 'loaded' | 'error';
type ResourcePassStore = { byTask: Record<string, ResourcePass[]>; loadStateByTask: Record<string, ResourceLoadState>; error: string | null; load(taskId: string, force?: boolean): Promise<void>; add(input: CreateResourcePass): Promise<void>; remove(taskId: string, id: string): Promise<void>; clearError(): void };
export function createResourcePassStore(repository: ResourcePassRepository) {
  return createStore<ResourcePassStore>((set, get) => ({ byTask: {}, loadStateByTask: {}, error: null,
    async load(taskId, force = false) {
      const loadState = get().loadStateByTask[taskId] ?? 'idle';
      if (!force && (loadState === 'loading' || loadState === 'loaded')) return;
      set((state) => ({ loadStateByTask: { ...state.loadStateByTask, [taskId]: 'loading' }, error: null }));
      try {
        const resources = await repository.list(taskId);
        set((state) => ({ byTask: { ...state.byTask, [taskId]: resources }, loadStateByTask: { ...state.loadStateByTask, [taskId]: 'loaded' }, error: null }));
      } catch (error) {
        set((state) => ({ loadStateByTask: { ...state.loadStateByTask, [taskId]: 'error' }, error: message(error) }));
      }
    },
    async add(input) { try { const resource = await repository.create(input); set((state) => ({ byTask: { ...state.byTask, [input.taskId]: [...(state.byTask[input.taskId] ?? []), resource] }, error: null })); } catch (error) { set({ error: message(error) }); } },
    async remove(taskId, id) { try { await repository.remove(id); set((state) => ({ byTask: { ...state.byTask, [taskId]: (state.byTask[taskId] ?? []).filter((item) => item.id !== id) }, error: null })); } catch (error) { set({ error: message(error) }); } },
    clearError() { set({ error: null }); },
  }));
}
export const resourcePassStore = createResourcePassStore(createSQLiteResourcePassRepository());
export function useResourcePassStore<T>(selector: (state: ResourcePassStore) => T) { return useStore(resourcePassStore, selector); }
function message(error: unknown) { return error instanceof Error ? error.message : '资源通行证操作失败'; }
