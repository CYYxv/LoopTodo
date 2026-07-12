import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { createSQLiteResourcePassRepository } from './sqlite-resource-pass.repository';
import type { ResourcePassRepository } from './resource-pass.repository';
import type { CreateResourcePass, ResourcePass } from './resource-pass.types';

type ResourcePassStore = { byTask: Record<string, ResourcePass[]>; error: string | null; load(taskId: string): Promise<void>; add(input: CreateResourcePass): Promise<void>; remove(taskId: string, id: string): Promise<void>; clearError(): void };
export function createResourcePassStore(repository: ResourcePassRepository) {
  return createStore<ResourcePassStore>((set) => ({ byTask: {}, error: null,
    async load(taskId) { try { const resources = await repository.list(taskId); set((state) => ({ byTask: { ...state.byTask, [taskId]: resources }, error: null })); } catch (error) { set({ error: message(error) }); } },
    async add(input) { try { const resource = await repository.create(input); set((state) => ({ byTask: { ...state.byTask, [input.taskId]: [...(state.byTask[input.taskId] ?? []), resource] }, error: null })); } catch (error) { set({ error: message(error) }); } },
    async remove(taskId, id) { try { await repository.remove(id); set((state) => ({ byTask: { ...state.byTask, [taskId]: (state.byTask[taskId] ?? []).filter((item) => item.id !== id) }, error: null })); } catch (error) { set({ error: message(error) }); } },
    clearError() { set({ error: null }); },
  }));
}
export const resourcePassStore = createResourcePassStore(createSQLiteResourcePassRepository());
export function useResourcePassStore<T>(selector: (state: ResourcePassStore) => T) { return useStore(resourcePassStore, selector); }
function message(error: unknown) { return error instanceof Error ? error.message : '资源通行证操作失败'; }
