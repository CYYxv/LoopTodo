export type TaskKind = 'pomodoro' | 'goal';
export type TimerMode = 'countdown' | 'countup' | 'untimed';
export type TrustLevel = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'active' | 'completed' | 'failed' | 'archived';
export type SyncStatus = 'pending' | 'synced' | 'conflict';

export type Task = {
  id: string;
  title: string;
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
  trustLevel: TrustLevel;
  status: TaskStatus;
  version: number;
  syncStatus: SyncStatus;
  remoteActive: boolean;
};

export type CreateTaskInput = Omit<Task, 'id' | 'status' | 'completedAmount' | 'progressLabel' | 'version' | 'syncStatus' | 'remoteActive'>;
