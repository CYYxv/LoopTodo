import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { createHttpTaskAiClient, type TaskAiClient } from './task-ai.client';
import type { AiAnswer, AiMaterial } from './task-ai.types';

export type TaskAiLoadState = 'idle' | 'loading' | 'loaded' | 'error';
type TaskAiStore = { configured: boolean; client: TaskAiClient | null; materials: Record<string, AiMaterial[]>; loadStateByTask: Record<string, TaskAiLoadState>; answer: AiAnswer | null; loading: boolean; error: string | null;
  configure(baseUrl: string, accessToken: string): void; load(taskId: string): Promise<void>; addMaterial(taskId: string, title: string, content: string): Promise<void>;
  ask(taskId: string, question: string): Promise<void>; clearAnswer(): void };
export function createTaskAiStore(initialClient: TaskAiClient | null = null) {
  return createStore<TaskAiStore>((set, get) => ({ configured: Boolean(initialClient), client: initialClient, materials: {}, loadStateByTask: {}, answer: null, loading: false, error: null,
    configure(baseUrl, accessToken) { set({ client: createHttpTaskAiClient(baseUrl, accessToken), configured: true, error: null }); },
    async load(taskId) {
      const client = get().client;
      if (!client || ['loading', 'loaded'].includes(get().loadStateByTask[taskId] ?? 'idle')) return;
      set((state) => ({ loadStateByTask: { ...state.loadStateByTask, [taskId]: 'loading' }, error: null }));
      try {
        const materials = await client.listMaterials(taskId);
        set((state) => ({ materials: { ...state.materials, [taskId]: materials }, loadStateByTask: { ...state.loadStateByTask, [taskId]: 'loaded' }, error: null }));
      } catch (error) {
        set((state) => ({ loadStateByTask: { ...state.loadStateByTask, [taskId]: 'error' }, error: message(error) }));
      }
    },
    async addMaterial(taskId, title, content) { const client = get().client; if (!client) return set({ error: '登录并连接服务端后才能添加 AI 材料' });
      try { const material = await client.createMaterial(taskId, title, content); set((state) => ({ materials: { ...state.materials, [taskId]: [...(state.materials[taskId] ?? []), material] }, error: null })); } catch (error) { set({ error: message(error) }); } },
    async ask(taskId, question) { const client = get().client; const materials = get().materials[taskId] ?? [];
      if (!client) return set({ error: '登录并连接服务端后才能使用任务型 AI' }); if (!materials.length) return set({ error: '请先添加任务材料' });
      set({ loading: true, error: null }); try { set({ answer: await client.ask(taskId, question, materials.map((item) => item.id)), loading: false }); } catch (error) { set({ loading: false, error: message(error) }); } },
    clearAnswer() { set({ answer: null }); },
  }));
}
export const taskAiStore = createTaskAiStore();
export function configureTaskAi(baseUrl: string, accessToken: string) { taskAiStore.getState().configure(baseUrl, accessToken); }
export function useTaskAiStore<T>(selector: (state: TaskAiStore) => T) { return useStore(taskAiStore, selector); }
function message(error: unknown) { return error instanceof Error ? error.message : '任务型 AI 操作失败'; }
