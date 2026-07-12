import type { AiAnswer, AiMaterial } from './task-ai.types';

export interface TaskAiClient {
  listMaterials(taskId: string): Promise<AiMaterial[]>;
  createMaterial(taskId: string, title: string, content: string): Promise<AiMaterial>;
  ask(taskId: string, question: string, materialIds: string[]): Promise<AiAnswer>;
}

export function createHttpTaskAiClient(baseUrl: string, accessToken: string): TaskAiClient {
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, { ...init,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}`, ...init?.headers } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? body.error?.code ?? '任务型 AI 请求失败');
    return body.data as T;
  };
  return { listMaterials: (taskId) => request(`/tasks/${taskId}/ai/materials`),
    createMaterial: (taskId, title, content) => request(`/tasks/${taskId}/ai/materials`, { method: 'POST', body: JSON.stringify({ title, content }) }),
    ask: (taskId, question, materialIds) => request(`/tasks/${taskId}/ai/query`, { method: 'POST', body: JSON.stringify({ question, materialIds }) }) };
}
