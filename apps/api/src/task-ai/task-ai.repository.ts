import type { AiMaterialView } from './task-ai.types';

export const TASK_AI_REPOSITORY = Symbol('TASK_AI_REPOSITORY');
export interface TaskAiRepository {
  getTask(userId: string, taskId: string): Promise<{ id: string; title: string; activeSessionId: string | null } | null>;
  createMaterial(input: { userId: string; taskId: string; title: string; content: string; contentHash: string }): Promise<AiMaterialView>;
  listMaterials(userId: string, taskId: string, ids?: string[]): Promise<AiMaterialView[]>;
  recordAudit(input: { userId: string; taskId: string; questionHash: string; materialIds: string[]; provider: string;
    externalDataUsed: boolean; blocked: boolean; blockReason: string | null }): Promise<void>;
}
