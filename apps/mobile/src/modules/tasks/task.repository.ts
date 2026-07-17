import type { ActiveSession, FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

import type { CreateTaskInput, Task, TaskCategory } from './task.types';

export interface TaskRepository {
  hydrate(): Promise<{
    tasks: Task[];
    categories: TaskCategory[];
    sessionRecords: FocusSessionRecord[];
    activeSession: ActiveSession | null;
  }>;
  create(input: CreateTaskInput): Promise<Task>;
  createCategory(category: TaskCategory): Promise<void>;
  updateCategory(category: TaskCategory, previousVersion: number): Promise<void>;
  archiveCategory(category: TaskCategory, previousVersion: number): Promise<void>;
  update(task: Task, previousVersion: number): Promise<void>;
  archive(task: Task, previousVersion: number): Promise<void>;
  startSession(task: Task, session: ActiveSession): Promise<void>;
  updateActiveSession(session: ActiveSession): Promise<void>;
  finishSession(task: Task, record: FocusSessionRecord, restSession: ActiveSession | null): Promise<void>;
  finishRest(): Promise<void>;
  addGoalProgress(task: Task, amount: number, idempotencyKey: string): Promise<void>;
}
