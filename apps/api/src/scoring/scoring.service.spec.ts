import { ConfigService } from '@nestjs/config';

import type { ScoringRepository } from './scoring.repository';
import { calculateScores, calculateStreak, ScoringService } from './scoring.service';
import type { ScoreEventView, ScoringSession } from './scoring.types';
import { EventBusService } from '../common/event-bus.module';

const completed: ScoringSession = { id: 'session', userId: 'user', timerMode: 'countup', trustLevel: 'high',
  endedAt: new Date('2026-07-12T10:00:00Z'), actualMinutes: 240, outcome: 'completed' };

describe('scoring', () => {
  test('diminishes duration points after three hours and applies trust and streak points', () => {
    const score = calculateScores(completed, 4, { version: 'v1', durationWeight: 0.6, streakPointsPerDay: 3,
      highTrustPoints: 10, normalTrustPoints: 7, untimedPoints: 5, emergencyPenalty: -30 });
    expect(score).toEqual({ durationScore: 117, streakScore: 12, trustScore: 10, penaltyScore: 0, totalScore: 139 });
  });

  test('calculates consecutive unique days without allowing recovery gaps', () => {
    expect(calculateStreak([new Date('2026-07-12'), new Date('2026-07-12'), new Date('2026-07-11'), new Date('2026-07-09')], new Date('2026-07-12'))).toBe(2);
  });

  test('settles an ended session into an append-only event', async () => {
    const events: ScoreEventView[] = [];
    const repository: ScoringRepository = {
      async getSession() { return completed; }, async listCompletedDates() { return [new Date('2026-07-12')]; },
      async createEvent(input) { const event = { ...input, id: 'event' }; events.push(event); return event; },
      async getToday() { throw new Error('unused'); }, async getHistory() { throw new Error('unused'); },
    };
    const service = new ScoringService(repository, { get() { return undefined; } } as unknown as ConfigService, new EventBusService());
    await service.settleSession('user', 'session');
    expect(events[0]).toMatchObject({ sessionId: 'session', streakDays: 1, totalScore: 130, formulaVersion: 'v1' });
  });
});
