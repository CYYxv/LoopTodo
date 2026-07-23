import type { DailyScoreView, ScoreEventView, ScoringSession } from './scoring.types';

export const SCORING_REPOSITORY = Symbol('SCORING_REPOSITORY');

export interface ScoringRepository {
  getSession(userId: string, sessionId: string): Promise<ScoringSession | null>;
  listCompletedDates(userId: string, through: Date): Promise<Date[]>;
  sumCompletedMinutesOnDate(userId: string, date: Date, excludeSessionId?: string): Promise<number>;
  lastPositiveStarDate(userId: string, before: Date): Promise<Date | null>;
  hasIdlePenaltyOnDate(userId: string, date: Date): Promise<boolean>;
  createIdlePenaltyEvent(userId: string, date: Date, stars: number): Promise<ScoreEventView | null>;
  createEvent(input: Omit<ScoreEventView, 'id'> & { userId: string }): Promise<ScoreEventView>;
  getToday(userId: string, date: Date): Promise<DailyScoreView>;
  getHistory(userId: string, page: number, pageSize: number): Promise<{ items: DailyScoreView[]; total: number }>;
  listRecentEvents(userId: string, limit: number): Promise<ScoreEventView[]>;
}
