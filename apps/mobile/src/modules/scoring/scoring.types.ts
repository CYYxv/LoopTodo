export type DailyScore = {
  date: string;
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

export type ScoreHistory = { items: DailyScore[]; total: number };
