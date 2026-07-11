import type { CategoryView, SessionView, TaskCreate, TaskPatch, TaskView } from './task-focus.types';

export const TASK_FOCUS_REPOSITORY = Symbol('TASK_FOCUS_REPOSITORY');

export class DuplicateCategoryError extends Error {}

export type MutationResult<T> =
  | { status: 'ok'; value: T; replayed?: boolean }
  | { status: 'not-found' }
  | { status: 'conflict' }
  | { status: 'idempotency-conflict' }
  | { status: 'already-active' }
  | { status: 'not-active' };

export interface TaskFocusRepository {
  listCategories(userId: string): Promise<CategoryView[]>;
  getCategory(userId: string, id: string): Promise<CategoryView | null>;
  createCategory(userId: string, name: string, color: string | null): Promise<CategoryView>;
  listTasks(userId: string): Promise<TaskView[]>;
  getTask(userId: string, id: string): Promise<TaskView | null>;
  createTask(userId: string, input: TaskCreate): Promise<TaskView>;
  updateTask(userId: string, id: string, version: number, patch: TaskPatch): Promise<MutationResult<TaskView>>;
  archiveTask(userId: string, id: string, version: number): Promise<MutationResult<TaskView>>;
  addGoalProgress(input: { userId: string; taskId: string; version: number; amount: number; idempotencyKey: string }): Promise<MutationResult<TaskView>>;
  startSession(input: {
    userId: string;
    taskId: string;
    mode: 'focus' | 'lock';
    idempotencyKey: string;
    trustLevel: SessionView['trustLevel'];
  }): Promise<MutationResult<SessionView>>;
  finishSession(input: {
    userId: string;
    sessionId: string;
    idempotencyKey: string;
    outcome: NonNullable<SessionView['outcome']>;
    completionNote: string | null;
    failureReasonType: string | null;
    failureReasonText: string | null;
  }): Promise<MutationResult<SessionView>>;
  listSessions(userId: string): Promise<SessionView[]>;
  sync(userId: string, since: Date): Promise<{
    categories: CategoryView[];
    tasks: TaskView[];
    sessions: SessionView[];
    cursor: Date;
  }>;
}
