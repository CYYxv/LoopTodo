import { ConfigService } from '@nestjs/config';

import type { ScoringRepository } from './scoring.repository';
import { calculateScores, calculateStreak, ScoringService } from './scoring.service';
import type { ScoreEventView, ScoringSession } from './scoring.types';
import { EventBusService } from '../common/event-bus.module';

const completed: ScoringSession = {
  id: 'session', userId: 'user', timerMode: 'countdown', trustLevel: 'high',
  endedAt: new Date('2026-07-12T10:00:00Z'), actualMinutes: 50, outcome: 'completed',
};

const longCompleted: ScoringSession = { ...completed, timerMode: 'countup', actualMinutes: 240 };

describe('scoring', () => {
  test('settles whole stars with mode coefficients under v2-stars', () => {
    const rules = {
      version: 'v2-stars', durationWeight: 0.6, streakPointsPerDay: 3,
      highTrustPoints: 10, normalTrustPoints: 7, untimedPoints: 5, emergencyPenalty: -1,
    };
    expect(calculateScores({ ...completed, actualMinutes: 24 }, 4, rules)).toEqual({
      durationScore: 0, streakScore: 0, trustScore: 0, penaltyScore: 0, totalScore: 0,
    });
    expect(calculateScores({ ...completed, actualMinutes: 25, trustLevel: 'open' }, 4, rules).totalScore).toBe(1);
    expect(calculateScores({ ...completed, actualMinutes: 50, trustLevel: 'high' }, 4, rules).totalScore).toBe(3);
    expect(calculateScores({ ...completed, outcome: 'emergency_exit' }, 0, rules).totalScore).toBe(-1);
  });

  test('applies daily soft-cap decay after three hours of prior focus', () => {
    const rules = {
      version: 'v2-stars', durationWeight: 0.6, streakPointsPerDay: 3,
      highTrustPoints: 10, normalTrustPoints: 7, untimedPoints: 5, emergencyPenalty: -1,
    };
    // 180 prior + 25 new => only 25*0.25 effective minutes after soft cap -> below 25 floor => 0
    expect(calculateScores({ ...completed, actualMinutes: 25, trustLevel: 'open' }, 0, rules, 180).totalScore).toBe(0);
    // 100 prior + 100 new: first 80 full + 20*0.25 = 85 effective => floor(85/25)=3 whitelist
    expect(calculateScores({ ...completed, actualMinutes: 100, trustLevel: 'open' }, 0, rules, 100).totalScore).toBe(3);
  });

  test('legacy v1 still diminishes duration points after three hours', () => {
    const score = calculateScores(longCompleted, 4, {
      version: 'v1', durationWeight: 0.6, streakPointsPerDay: 3,
      highTrustPoints: 10, normalTrustPoints: 7, untimedPoints: 5, emergencyPenalty: -30,
    });
    expect(score).toEqual({ durationScore: 117, streakScore: 12, trustScore: 10, penaltyScore: 0, totalScore: 139 });
  });

  test('calculates consecutive unique days without allowing recovery gaps', () => {
    expect(calculateStreak(
      [new Date('2026-07-12'), new Date('2026-07-12'), new Date('2026-07-11'), new Date('2026-07-09')],
      new Date('2026-07-12'),
    )).toBe(2);
  });

  test('settles an ended session into an append-only star event using prior minutes', async () => {
    const events: ScoreEventView[] = [];
    const repository: ScoringRepository = {
      async getSession() { return completed; },
      async listCompletedDates() { return [new Date('2026-07-12')]; },
      async sumCompletedMinutesOnDate() { return 0; },
      async lastPositiveStarDate() { return new Date('2026-07-12'); },
      async hasIdlePenaltyOnDate() { return false; },
      async createIdlePenaltyEvent() { return null; },
      async createEvent(input) { const event = { ...input, id: 'event' }; events.push(event); return event; },
      async getToday() { throw new Error('unused'); },
      async getHistory() { throw new Error('unused'); },
      async listRecentEvents() { return []; },
    };
    const service = new ScoringService(repository, { get() { return undefined; } } as unknown as ConfigService, new EventBusService());
    await service.settleSession('user', 'session');
    expect(events[0]).toMatchObject({ sessionId: 'session', totalScore: 3, formulaVersion: 'v2-stars' });
  });

  test('creates idle penalty when gap exceeds threshold', async () => {
    let idleCalls = 0;
    const repository: ScoringRepository = {
      async getSession() { return null; },
      async listCompletedDates() { return []; },
      async sumCompletedMinutesOnDate() { return 0; },
      async lastPositiveStarDate() { return new Date(Date.now() - 4 * 86_400_000); },
      async hasIdlePenaltyOnDate() { return false; },
      async createIdlePenaltyEvent() {
        idleCalls += 1;
        return {
          id: 'idle', sessionId: 's', scoreDate: new Date(), outcome: 'failed', trustLevel: 'normal',
          durationMinutes: 0, streakDays: 0, durationScore: 0, streakScore: 0, trustScore: 0,
          penaltyScore: -1, totalScore: -1, formulaVersion: 'v2-stars-idle',
        };
      },
      async createEvent() { throw new Error('unused'); },
      async getToday() { throw new Error('unused'); },
      async getHistory() { throw new Error('unused'); },
      async listRecentEvents() { return []; },
    };
    const service = new ScoringService(repository, { get() { return undefined; } } as unknown as ConfigService, new EventBusService());
    await service.applyIdleStarPenalty('user');
    expect(idleCalls).toBe(1);
  });
});
