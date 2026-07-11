export type TaskKind = 'pomodoro' | 'goal';
export type TrustLevel = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'active' | 'completed';

export type Task = {
  id: string;
  title: string;
  category: string;
  kind: TaskKind;
  estimateMinutes: number;
  progressLabel: string;
  mustDo: boolean;
  trustLevel: TrustLevel;
  status: TaskStatus;
};

export type CreateTaskInput = Omit<Task, 'id' | 'status'>;
