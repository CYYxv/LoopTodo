import type { FocusRestrictionOptions } from '@/modules/lock-engine/lock-engine.types';
import type { TimerMode } from '@/modules/tasks/task.types';

export type SessionMode = 'focus' | 'lock';
export type SessionOutcome = 'completed' | 'exited';

export type ActiveSession = {
  id: string;
  taskId: string;
  mode: SessionMode;
  timerMode: TimerMode;
  phase: 'focus' | 'rest';
  startedAt: number;
  plannedEndAt: number | null;
  restEndsAt: number | null;
};

export type FocusSessionRecord = ActiveSession & {
  id: string;
  endedAt: number;
  outcome: SessionOutcome;
  failureReason: string | null;
  durationSeconds: number;
  completedAmount: number | null;
};

export type StrictOption = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  capabilityKey: keyof FocusRestrictionOptions | null;
  unavailableReason?: string;
};
