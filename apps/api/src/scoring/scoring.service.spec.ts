import { ConfigService } from '@nestjs/config';

import type { ScoringRepository } from './scoring.repository';
import { calculateScores, calculateStreak, ScoringService } from './scoring.service';
import type { ScoreEventView, ScoringSession } from './scoring.types';
import { EventBusService } from '../common/event-bus.module';

const completed: ScoringSession = { id: 'session', userId: 'user', timerMode: 'countdown', trustLevel: 'high',
  endedAt: new Date('2026-07-12T10:00:00Z'), actualMinutes: 50, outcome: 'completed' };

const longCompleted: ScoringSession = { ...completed, timerMode: 'countup', actualMinutes: 240 };

describe('scoring', () => {
  test('settles whole stars with mode coefficients under v2-stars', () => {
    const rules = { version: 'v2-stars', durationWeight: 0.6, streakPointsPerDay: 3,
      highTrustPoints: 10, normalTrustPoints: 7, untimedPoints: 5, emergencyPenalty: -1 };
    expect(calculateScores({ ...completed, actualMinutes: 24 }, 4, rules)).toEqual({
      durationScore: 0, streakScore: 0, trustScore: 0, penaltyScore: 0, totalScore: 0,
    });
    expect(calculateScores({ ...completed, actualMinutes: 25, trustLevel: 'open' }, 4, rules).totalScore).toBe(1);
    expect(calculateScores({ ...completed, actualMinutes: 50, trustLevel: 'high' }, 4, rules).totalScore).toBe(3);
    expect(calculateScores({ ...completed, outcome: 'emergency_exit' }, 0, rules).totalScore).toBe(-1);
  });

  test('legacy v1 still diminishes duration points after three hours', () => {
    const score = calculateScores(longCompleted, 4, { version: 'v1', durationWeight: 0.6, streakPointsPerDay: 3,
      highTrustPoints: 10, normalTrustPoints: 7, untimedPoints: 5, emergencyPenalty: -30 });
    expect(score).toEqual({ durationScore: 117, streakScore: 12, trustScore: 10, penaltyScore: 0, totalScore: 139 });
  });

  test('calculates consecutive unique days without allowing recovery gaps', () => {
    expect(calculateStreak([new Date('2026-07-12'), new Date('2026-07-12'), new Date('2026-07-11'), new Date('2026-07-09')], new Date('2026-07-12'))).toBe(2);
  });

  test('settles an ended session into an append-only star event', async () => {
    const events: ScoreEventView[] = [];
    const repository: ScoringRepository = {
      async getSession() { return completed; }, async listCompletedDates() { return [new Date('2026-07-12')]; },
      async createEvent(input) { const event = { ...input, id: 'event' }; events.push(event); return event; },
      async getToday() { throw new Error('unused'); }, async getHistory() { throw new Error('unused'); },
    };
    const service = new ScoringService(repository, { get() { return undefined; } } as unknown as ConfigService, new EventBusService());
    await service.settleSession('user', 'session');
    expect(events[0]).toMatchObject({ sessionId: 'session', totalScore: 3, formulaVersion: 'v2-stars' });
  });
});
