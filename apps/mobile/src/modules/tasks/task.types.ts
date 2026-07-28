export type TaskKind = 'pomodoro' | 'goal';
export type TimerMode = 'countdown' | 'countup' | 'untimed';
export type TrustLevel = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'active' | 'completed' | 'failed' | 'archived';
export type SyncStatus = 'pending' | 'synced' | 'conflict';

export type TaskCategory = {
  id: string;
  name: string;
  color: string | null;
  version: number;
  syncStatus: SyncStatus;
};

export type Task = {
  id: string;
  title: string;
  categoryId?: string | null;
  category: string;
  kind: TaskKind;
  timerMode: TimerMode;
  estimateMinutes: number;
  restMinutes: number;
  deadlineAt: number | null;
  targetAmount: number | null;
  targetUnit: string | null;
  completedAmount: number;
  progressLabel: string;
  mustDo: boolean;
  forcedTriggerTime: string | null;
  trustLevel: TrustLevel;
  status: TaskStatus;
  version: number;
  syncStatus: SyncStatus;
  remoteActive: boolean;
  restrictionMode: RestrictionMode;
  whitelistMode: WhitelistMode | 'inherit';
  whitelistListId: string | null;
  whitelistPackages: string[];
};

export type CreateTaskInput = Omit<Task, 'id' | 'status' | 'completedAmount' | 'progressLabel' | 'version' | 'syncStatus' | 'remoteActive' | 'restrictionMode' | 'whitelistMode' | 'whitelistListId' | 'whitelistPackages'>
  & Partial<Pick<Task, 'restrictionMode' | 'whitelistMode' | 'whitelistListId' | 'whitelistPackages'>>;
export type UpdateTaskInput = Pick<Task,
  'title' | 'timerMode' | 'estimateMinutes' | 'restMinutes' | 'deadlineAt' | 'targetAmount' | 'targetUnit' | 'mustDo' | 'forcedTriggerTime'
> & Partial<Pick<Task, 'categoryId' | 'category' | 'restrictionMode' | 'whitelistMode' | 'whitelistListId' | 'whitelistPackages'>>;
import type { RestrictionMode, WhitelistMode } from '@/modules/whitelist/whitelist.types';
