import type { ActiveSession, FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

import type { CreateTaskInput, Task } from './task.types';

export interface TaskRepository {
  hydrate(): Promise<{
    tasks: Task[];
    sessionRecords: FocusSessionRecord[];
    activeSession: ActiveSession | null;
  }>;
  create(input: CreateTaskInput): Promise<Task>;
  update(task: Task, previousVersion: number): Promise<void>;
  startSession(task: Task, session: ActiveSession): Promise<void>;
  updateActiveSession(session: ActiveSession): Promise<void>;
  finishSession(task: Task, record: FocusSessionRecord, restSession: ActiveSession | null): Promise<void>;
  finishRest(): Promise<void>;
  addGoalProgress(task: Task, amount: number, idempotencyKey: string): Promise<void>;
}
