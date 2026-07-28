import { ConfigService } from '@nestjs/config';

import type { ScoringRepository } from './scoring.repository';
import { calculateScores, calculateStreak, ScoringService } from './scoring.service';
import type { ScoreEventView, ScoringSession } from './scoring.types';
import { EventBusService } from '../common/event-bus.module';

const completed: ScoringSession = {
  id: 'session', userId: 'user', mode: 'focus', timerMode: 'countdown', trustLevel: 'high',
  endedAt: new Date('2026-07-12T10:00:00Z'), actualMinutes: 50, outcome: 'completed',
  restrictionMode: 'strict', whitelistSource: 'strict', whitelistPackageCount: 0,
  restrictionEffective: true, effectiveMinutes: 50,
};

const longCompleted: ScoringSession = { ...completed, timerMode: 'countup', actualMinutes: 240, effectiveMinutes: 240 };

function scoringSession(patch: Partial<ScoringSession>): ScoringSession {
  return { ...completed, ...patch };
}

describe('scoring', () => {
  test('settles whole stars with mode coefficients under v2-stars', () => {
    const rules = {
      version: 'v2-stars', durationWeight: 0.6, streakPointsPerDay: 3,
      highTrustPoints: 10, normalTrustPoints: 7, untimedPoints: 5, emergencyPenalty: -1,
    };
    expect(calculateScores(scoringSession({ actualMinutes: 24, effectiveMinutes: 24 }), 4, rules)).toEqual({
      durationScore: 0, streakScore: 0, trustScore: 0, penaltyScore: 0, totalScore: 0,
    });
    expect(calculateScores(scoringSession({ actualMinutes: 25, effectiveMinutes: 25, restrictionMode: 'whitelist' }), 4, rules).totalScore).toBe(1);
    expect(calculateScores(scoringSession({ mode: 'lock', actualMinutes: 50, effectiveMinutes: 50 }), 4, rules).totalScore).toBe(3);
    expect(calculateScores({ ...completed, outcome: 'emergency_exit' }, 0, rules).totalScore).toBe(-1);
  });

  test('uses effective minutes at the 22 and 25 minute star boundary', () => {
    const rules = {
      version: 'v2-stars', durationWeight: 0.6, streakPointsPerDay: 3,
      highTrustPoints: 10, normalTrustPoints: 7, untimedPoints: 5, emergencyPenalty: -1,
    };
    expect(calculateScores(scoringSession({ actualMinutes: 50, effectiveMinutes: 22 }), 0, rules).totalScore).toBe(0);
    expect(calculateScores(scoringSession({ actualMinutes: 50, effectiveMinutes: 25 }), 0, rules).totalScore).toBe(1);
  });

  test.each([
    ['whitelist', { mode: 'focus', timerMode: 'countdown', restrictionMode: 'whitelist', effectiveMinutes: 40 }, 1],
    ['strict', { mode: 'focus', timerMode: 'countdown', restrictionMode: 'strict', effectiveMinutes: 40 }, 2],
    ['lock', { mode: 'lock', timerMode: 'countdown', restrictionMode: 'strict', effectiveMinutes: 50 }, 3],
    ['untimed', { mode: 'focus', timerMode: 'untimed', restrictionMode: 'none', effectiveMinutes: 50 }, 1],
  ] as const)('maps restriction snapshot to %s star mode', (_name, snapshot, expected) => {
    const rules = {
      version: 'v2-stars', durationWeight: 0.6, streakPointsPerDay: 3,
      highTrustPoints: 10, normalTrustPoints: 7, untimedPoints: 5, emergencyPenalty: -1,
    };
    expect(calculateScores(scoringSession(snapshot), 0, rules).totalScore).toBe(expected);
  });

  test('does not award whitelist stars when the restriction was ineffective', () => {
    const rules = {
      version: 'v2-stars', durationWeight: 0.6, streakPointsPerDay: 3,
      highTrustPoints: 10, normalTrustPoints: 7, untimedPoints: 5, emergencyPenalty: -1,
    };
    expect(calculateScores(scoringSession({
      restrictionMode: 'whitelist',
      whitelistSource: 'list:default',
      whitelistPackageCount: 8,
      restrictionEffective: false,
      effectiveMinutes: 50,
    }), 0, rules).totalScore).toBe(0);
  });

  test('does not let an untimed whitelist session bypass an ineffective restriction', () => {
    const rules = {
      version: 'v2-stars', durationWeight: 0.6, streakPointsPerDay: 3,
      highTrustPoints: 10, normalTrustPoints: 7, untimedPoints: 5, emergencyPenalty: -1,
    };
    expect(calculateScores(scoringSession({
      timerMode: 'untimed',
      restrictionMode: 'whitelist',
      restrictionEffective: false,
      effectiveMinutes: 25,
    }), 0, rules).totalScore).toBe(0);
  });

  test('does not award legacy points for a restriction that was ineffective', () => {
    const rules = {
      version: 'v1', durationWeight: 0.6, streakPointsPerDay: 3,
      highTrustPoints: 10, normalTrustPoints: 7, untimedPoints: 5, emergencyPenalty: -30,
    };
    expect(calculateScores(scoringSession({
      restrictionMode: 'whitelist',
      restrictionEffective: false,
      effectiveMinutes: 50,
    }), 3, rules).totalScore).toBe(0);
  });

  test('settles each whitelist session independently of prior daily focus', () => {
    const rules = {
      version: 'v2-stars', durationWeight: 0.6, streakPointsPerDay: 3,
      highTrustPoints: 10, normalTrustPoints: 7, untimedPoints: 5, emergencyPenalty: -1,
    };
    expect(calculateScores(scoringSession({ actualMinutes: 25, effectiveMinutes: 25, restrictionMode: 'whitelist' }), 0, rules, 180).totalScore).toBe(1);
    expect(calculateScores(scoringSession({ actualMinutes: 100, effectiveMinutes: 100, restrictionMode: 'whitelist' }), 0, rules, 100).totalScore).toBe(4);
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
    const settled = { ...completed, actualMinutes: 60, effectiveMinutes: 50 };
    const repository: ScoringRepository = {
      async getSession() { return settled; },
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
    expect(events[0]).toMatchObject({ sessionId: 'session', durationMinutes: 50, totalScore: 2, formulaVersion: 'v2-stars' });
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
