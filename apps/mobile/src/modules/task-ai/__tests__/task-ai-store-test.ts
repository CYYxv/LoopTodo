import type { TaskAiClient } from '../task-ai.client';
import { createTaskAiStore } from '../task-ai.store';

describe('task AI store', () => {
  test('loads approved materials and sends only their ids', async () => {
    const calls: string[][] = [];
    const client: TaskAiClient = {
      async listMaterials(taskId) { return [{ id: 'material', taskId, title: '讲义', content: '内容', contentHash: 'hash', createdAt: '2026-07-12' }]; },
      async createMaterial() { throw new Error('unused'); },
      async ask(_taskId, _question, ids) { calls.push(ids); return { answer: '答案', externalDataUsed: false, provider: 'test', warning: null }; },
    };
    const store = createTaskAiStore(client);
    await store.getState().load('task'); await store.getState().ask('task', '解释材料');
    expect(calls).toEqual([['material']]);
    expect(store.getState().answer?.answer).toBe('答案');
  });
});
