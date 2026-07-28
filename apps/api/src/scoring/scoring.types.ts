export type ScoringSession = {
  id: string;
  userId: string;
  mode: 'focus' | 'lock';
  timerMode: 'countdown' | 'countup' | 'untimed';
  trustLevel: 'high' | 'normal' | 'open' | 'invalid';
  endedAt: Date | null;
  actualMinutes: number | null;
  restrictionMode: 'none' | 'whitelist' | 'strict';
  whitelistSource: string;
  whitelistPackageCount: number;
  restrictionEffective: boolean;
  effectiveMinutes: number;
  outcome: 'completed' | 'failed' | 'cancelled' | 'emergency_exit' | null;
};

export type ScoreEventView = {
  id: string;
  sessionId: string;
  scoreDate: Date;
  outcome: NonNullable<ScoringSession['outcome']>;
  trustLevel: ScoringSession['trustLevel'];
  durationMinutes: number;
  streakDays: number;
  durationScore: number;
  streakScore: number;
  trustScore: number;
  penaltyScore: number;
  totalScore: number;
  formulaVersion: string;
};

export type DailyScoreView = {
  date: Date;
  focusMinutes: number;
  completedSessions: number;
  failedSessions: number;
  streakDays: number;
  durationScore: number;
  streakScore: number;
  trustScore: number;
  penaltyScore: number;
  totalScore: number;
};
