import type { FocusRestrictionCapabilities } from '@/modules/lock-engine/lock-engine.types';
import type { TimerMode } from '@/modules/tasks/task.types';
import type { RestrictionMode, WhitelistSource } from '@/modules/whitelist/whitelist.types';

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
  plannedFocusSeconds?: number | null;
  restEndsAt: number | null;
  pausedAt?: number | null;
  accumulatedPausedMs?: number;
  restrictionMode?: RestrictionMode;
  whitelistSource?: WhitelistSource;
  restrictionEffective?: boolean;
  allowedPackagesSnapshot?: string[];
};

export type FocusSessionRecord = ActiveSession & {
  id: string;
  endedAt: number;
  outcome: SessionOutcome;
  failureReason: string | null;
  durationSeconds: number;
  completedAmount: number | null;
  completionNote?: string | null;
  restrictionMode?: RestrictionMode;
  whitelistSource?: WhitelistSource;
  whitelistPackageCount?: number;
  restrictionEffective?: boolean;
  effectiveMinutes?: number;
};

export type StrictOption = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  capabilityKey: keyof FocusRestrictionCapabilities | null;
  available?: boolean;
  unavailableReason?: string;
};
