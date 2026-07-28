export type CategoryView = {
  id: string;
  name: string;
  color: string | null;
  archived: boolean;
  version: number;
  updatedAt: Date;
};

export type WhitelistListView = {
  id: string;
  userId: string;
  name: string;
  packages: string[];
  isDefault: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
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
  forcedTriggerTime: string | null;
  restrictionMode: 'none' | 'whitelist' | 'strict';
  whitelistMode: 'list' | 'custom';
  whitelistListId: string | null;
  whitelistPackages: string[];
  status: 'pending' | 'active' | 'completed' | 'failed' | 'archived';
  activeSessionId: string | null;
  createdByFamilyMemberId: string | null;
  version: number;
  updatedAt: Date;
};

export type WhitelistSource = 'none' | 'strict' | 'custom' | `list:${string}`;

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
  restrictionMode: TaskView['restrictionMode'];
  whitelistSource: WhitelistSource;
  whitelistPackageCount: number;
  allowedPackagesSnapshot: string[];
  restrictionEffective: boolean;
  effectiveMinutes: number;
  outcome: 'completed' | 'failed' | 'cancelled' | 'emergency_exit' | null;
  completionNote: string | null;
  failureReasonType: string | null;
  failureReasonText: string | null;
  updatedAt: Date;
};

export type TaskCreate = Omit<
  TaskView,
  'id' | 'completedAmount' | 'status' | 'activeSessionId' | 'createdByFamilyMemberId' | 'version' | 'updatedAt'
> & { id?: string };

export type TaskPatch = Partial<Pick<
  TaskView,
  'categoryId' | 'title' | 'timerMode' | 'estimatedMinutes' | 'restMinutes' | 'deadlineAt' |
  'targetAmount' | 'targetUnit' | 'completedAmount' | 'isTodayRequired' | 'status'
  | 'forcedTriggerTime' | 'restrictionMode' | 'whitelistMode' | 'whitelistListId' | 'whitelistPackages'
>>;
