import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SCORING_REPOSITORY, type ScoringRepository } from './scoring.repository';
import type { ScoringSession } from './scoring.types';
import { EventBusService } from '../common/event-bus.module';
import { calculateSessionStars, mapTrustToMode } from '../teams-seasons/ranking.policy';

@Injectable()
export class ScoringService {
  constructor(@Inject(SCORING_REPOSITORY) private readonly repository: ScoringRepository, private readonly config: ConfigService, private readonly events: EventBusService) {}

  async settleSession(userId: string, sessionId: string) {
    const session = await this.repository.getSession(userId, sessionId);
    if (!session?.endedAt || !session.outcome) return null;
    const scoreDate = dateOnly(session.endedAt);
    const streakDays = session.outcome === 'completed' ? calculateStreak(await this.repository.listCompletedDates(userId, scoreDate), scoreDate) : 0;
    const rules = this.rules();
    const scores = calculateScores(session, streakDays, rules);
    const event = await this.repository.createEvent({ userId, sessionId, scoreDate, outcome: session.outcome, trustLevel: session.trustLevel,
      durationMinutes: Math.max(0, session.actualMinutes ?? 0), streakDays, ...scores, formulaVersion: rules.version });
    this.events.emit('score.settled', userId);
    return event;
  }

  getToday(userId: string) { return this.repository.getToday(userId, dateOnly(new Date())); }
  getHistory(userId: string, page: number, pageSize: number) { return this.repository.getHistory(userId, page, pageSize); }

  private rules() {
    return {
      version: this.config.get<string>('SCORING_FORMULA_VERSION') ?? 'v2-stars',
      // legacy knobs kept for optional v1 mode
      durationWeight: number(this.config, 'SCORING_DURATION_WEIGHT', 0.6),
      streakPointsPerDay: number(this.config, 'SCORING_STREAK_POINTS_PER_DAY', 3),
      highTrustPoints: number(this.config, 'SCORING_HIGH_TRUST_POINTS', 10),
      normalTrustPoints: number(this.config, 'SCORING_NORMAL_TRUST_POINTS', 7),
      untimedPoints: number(this.config, 'SCORING_UNTIMED_POINTS', 5),
      emergencyPenalty: number(this.config, 'SCORING_EMERGENCY_EXIT_PENALTY', -1),
    };
  }
}

type Rules = ReturnType<ScoringService['rules']>;

export function calculateScores(session: ScoringSession, streakDays: number, rules: Rules) {
  if ((rules.version ?? 'v2-stars').startsWith('v2')) {
    return calculateStarScores(session, rules);
  }
  return calculateLegacyScores(session, streakDays, rules);
}

function calculateStarScores(session: ScoringSession, rules: Rules) {
  const minutes = Math.max(0, session.actualMinutes ?? 0);
  const mode = mapTrustToMode(session.trustLevel, session.timerMode);
  const stars = calculateSessionStars({
    outcome: session.outcome,
    effectiveMinutes: minutes,
    mode,
  });
  if (session.outcome === 'emergency_exit') {
    const penaltyScore = rules.emergencyPenalty;
    return { durationScore: 0, streakScore: 0, trustScore: 0, penaltyScore, totalScore: penaltyScore };
  }
  if (session.outcome !== 'completed') {
    return { durationScore: 0, streakScore: 0, trustScore: 0, penaltyScore: 0, totalScore: 0 };
  }
  // Store stars primarily in totalScore; durationScore mirrors positive stars for history breakdowns.
  return {
    durationScore: Math.max(0, stars),
    streakScore: 0,
    trustScore: 0,
    penaltyScore: 0,
    totalScore: stars,
  };
}

function calculateLegacyScores(session: ScoringSession, streakDays: number, rules: Rules) {
  if (session.outcome !== 'completed') {
    const penaltyScore = session.outcome === 'emergency_exit' ? rules.emergencyPenalty : 0;
    return { durationScore: 0, streakScore: 0, trustScore: 0, penaltyScore, totalScore: penaltyScore };
  }
  const minutes = Math.max(0, session.actualMinutes ?? 0);
  const effectiveMinutes = Math.min(minutes, 180) + Math.max(0, minutes - 180) * 0.25;
  const durationScore = session.timerMode === 'untimed' ? rules.untimedPoints : Math.round(effectiveMinutes * rules.durationWeight);
  const streakScore = Math.min(streakDays, 30) * rules.streakPointsPerDay;
  const trustScore = session.trustLevel === 'high' ? rules.highTrustPoints : session.trustLevel === 'normal' ? rules.normalTrustPoints : 0;
  return { durationScore, streakScore, trustScore, penaltyScore: 0, totalScore: durationScore + streakScore + trustScore };
}

export function calculateStreak(dates: Date[], through: Date) {
  const unique = new Set(dates.map((date) => dateOnly(date).getTime())); let cursor = dateOnly(through).getTime(); let streak = 0;
  while (unique.has(cursor)) { streak += 1; cursor -= 86_400_000; }
  return streak;
}
function dateOnly(value: Date) { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())); }
function number(config: ConfigService, key: string, fallback: number) { const value = Number(config.get<string>(key)); return Number.isFinite(value) ? value : fallback; }
