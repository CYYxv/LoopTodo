import type { FocusSessionRecord, SessionMode, SessionOutcome } from '@/modules/focus-session/focus-session.types';
import type { Task, TaskCategory, UpdateTaskInput } from '@/modules/tasks/task.types';

export type SyncOperation =
  | { type: 'category.create'; category: TaskCategory }
  | { type: 'category.update'; categoryId: string; version: number; name: string; color: string | null }
  | { type: 'category.delete'; categoryId: string; version: number }
  | { type: 'task.create'; task: Task }
  | { type: 'task.update'; taskId: string; version: number; patch: UpdateTaskInput & { status: 'pending' | 'completed' | 'failed' } }
  | { type: 'task.delete'; taskId: string; version: number }
  | { type: 'session.start'; taskId: string; localSessionId: string; mode: SessionMode; startedAt: number; plannedMinutes: number }
  | { type: 'session.finish'; taskId: string; localSessionId: string; outcome: SessionOutcome; record: FocusSessionRecord }
  | { type: 'task.goal-progress'; taskId: string; version: number; amount: number };

export type OutboxItem = {
  id: string;
  operation: SyncOperation;
  entityId: string;
  idempotencyKey: string;
  attempts: number;
};

export type SyncConflict = {
  id: string;
  entityType: string;
  entityId: string;
  code: string;
  localSnapshot: string | null;
  serverSnapshot: string | null;
  createdAt: number;
};

export type RemoteTask = {
  id: string;
  categoryId: string | null;
  title: string;
  taskType: 'pomodoro' | 'goal';
  timerMode: Task['timerMode'];
  estimatedMinutes: number;
  restMinutes: number;
  deadlineAt: string | null;
  targetAmount: number | null;
  targetUnit: string | null;
  completedAmount: number;
  isTodayRequired: boolean;
  forcedTriggerTime: string | null;
  whitelistMode?: 'inherit' | 'custom';
  whitelistPackages?: string[];
  status: 'pending' | 'active' | 'completed' | 'failed' | 'archived';
  activeSessionId: string | null;
  version: number;
  updatedAt: string;
};

export type RemoteCategory = {
  id: string;
  name: string;
  color: string | null;
  archived: boolean;
  version: number;
  updatedAt: string;
};

export type RemoteSession = {
  id: string;
  taskId: string;
  mode: SessionMode;
  timerMode: Task['timerMode'];
  startedAt: string;
  endedAt: string | null;
  plannedMinutes: number;
  actualMinutes: number | null;
  outcome: 'completed' | 'failed' | 'cancelled' | 'emergency_exit' | null;
  failureReasonText: string | null;
  completionNote?: string | null;
  updatedAt: string;
};

export type SyncSnapshot = { categories?: RemoteCategory[]; tasks: RemoteTask[]; sessions: RemoteSession[]; cursor: string };
