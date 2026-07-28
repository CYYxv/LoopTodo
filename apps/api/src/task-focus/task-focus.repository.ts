import type { CategoryView, SessionView, TaskCreate, TaskPatch, TaskView, WhitelistListView } from './task-focus.types';

export const TASK_FOCUS_REPOSITORY = Symbol('TASK_FOCUS_REPOSITORY');

export class DuplicateCategoryError extends Error {}
export class DuplicateWhitelistListError extends Error {}
export class TaskIdentityConflictError extends Error {}
export class WhitelistListReferenceError extends Error {}
export class InvalidRestrictionSnapshotError extends Error {}

export type MutationResult<T> =
  | { status: 'ok'; value: T; replayed?: boolean }
  | { status: 'not-found' }
  | { status: 'conflict' }
  | { status: 'idempotency-conflict' }
  | { status: 'already-active' }
  | { status: 'not-active' }
  | { status: 'invalid-session-time' }
  | { status: 'quota-exhausted' }
  | { status: 'replacement-required' }
  | { status: 'last-list' };

export interface TaskFocusRepository {
  listWhitelistLists(userId: string): Promise<WhitelistListView[]>;
  getWhitelistList(userId: string, id: string): Promise<WhitelistListView | null>;
  getDefaultWhitelistList(userId: string): Promise<WhitelistListView>;
  createWhitelistList(userId: string, input: { id?: string; name: string; packages: string[] }, idempotencyKey: string): Promise<MutationResult<WhitelistListView>>;
  updateWhitelistList(userId: string, id: string, version: number, patch: { name?: string; packages?: string[] }, idempotencyKey: string): Promise<MutationResult<WhitelistListView>>;
  setDefaultWhitelistList(userId: string, id: string, version: number, idempotencyKey: string): Promise<MutationResult<WhitelistListView>>;
  archiveWhitelistList(userId: string, id: string, version: number, replacementId: string | 'default' | undefined, idempotencyKey: string): Promise<MutationResult<WhitelistListView>>;
  listCategories(userId: string): Promise<CategoryView[]>;
  getCategory(userId: string, id: string): Promise<CategoryView | null>;
  createCategory(userId: string, id: string | undefined, name: string, color: string | null): Promise<CategoryView>;
  updateCategory(userId: string, id: string, version: number, name: string, color: string | null): Promise<MutationResult<CategoryView>>;
  archiveCategory(userId: string, id: string, version: number): Promise<MutationResult<CategoryView>>;
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
    sessionId?: string;
    startedAt?: Date;
    plannedMinutes?: number;
    restrictionMode?: SessionView['restrictionMode'];
    whitelistSource?: SessionView['whitelistSource'];
    restrictionEffective?: boolean;
    allowedPackagesSnapshot?: string[];
  }): Promise<MutationResult<SessionView>>;
  finishSession(input: {
    userId: string;
    sessionId: string;
    idempotencyKey: string;
    outcome: NonNullable<SessionView['outcome']>;
    completionNote: string | null;
    failureReasonType: string | null;
    failureReasonText: string | null;
    endedAt?: Date;
    actualMinutes?: number;
    whitelistPackageCount?: number;
    restrictionEffective?: boolean;
    effectiveMinutes?: number;
  }): Promise<MutationResult<SessionView>>;
  listSessions(userId: string): Promise<SessionView[]>;
  countEmergencyExits(userId: string, start: Date, end: Date): Promise<number>;
  getSession(userId: string, sessionId: string): Promise<SessionView | null>;
  sync(userId: string, since: Date): Promise<{
    categories: CategoryView[];
    whitelistLists: WhitelistListView[];
    tasks: TaskView[];
    sessions: SessionView[];
    cursor: Date;
  }>;
}
