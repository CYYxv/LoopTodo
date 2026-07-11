export type SessionMode = 'focus' | 'lock';
export type SessionOutcome = 'completed' | 'exited';

export type ActiveSession = {
  taskId: string;
  mode: SessionMode;
  startedAt: number;
};

export type FocusSessionRecord = ActiveSession & {
  id: string;
  endedAt: number;
  outcome: SessionOutcome;
  failureReason: string | null;
};

export type StrictOption = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
};
