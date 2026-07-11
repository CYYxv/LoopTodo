export type CategoryView = {
  id: string;
  name: string;
  color: string | null;
  version: number;
  updatedAt: Date;
};

export type TaskView = {
  id: string;
  categoryId: string | null;
  title: string;
  taskType: 'pomodoro' | 'goal';
  timerMode: 'countdown' | 'countup' | 'untimed';
  estimatedMinutes: number;
  restMinutes: number;
  deadlineAt: Date | null;
  targetAmount: number | null;
  targetUnit: string | null;
  completedAmount: number;
  isTodayRequired: boolean;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'archived';
  activeSessionId: string | null;
  version: number;
  updatedAt: Date;
};

export type SessionView = {
  id: string;
  taskId: string;
  mode: 'focus' | 'lock';
  timerMode: TaskView['timerMode'];
  trustLevel: 'high' | 'normal' | 'open' | 'invalid';
  startedAt: Date;
  endedAt: Date | null;
  plannedMinutes: number;
  actualMinutes: number | null;
  outcome: 'completed' | 'failed' | 'cancelled' | 'emergency_exit' | null;
  completionNote: string | null;
  failureReasonType: string | null;
  failureReasonText: string | null;
  updatedAt: Date;
};

export type TaskCreate = Omit<
  TaskView,
  'id' | 'completedAmount' | 'status' | 'activeSessionId' | 'version' | 'updatedAt'
> & { id?: string };

export type TaskPatch = Partial<Pick<
  TaskView,
  'categoryId' | 'title' | 'timerMode' | 'estimatedMinutes' | 'restMinutes' | 'deadlineAt' |
  'targetAmount' | 'targetUnit' | 'completedAmount' | 'isTodayRequired' | 'status'
>>;
