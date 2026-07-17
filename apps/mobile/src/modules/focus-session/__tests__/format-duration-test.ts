import { formatDuration, sessionElapsedMilliseconds, sessionTimerSeconds } from '../focus-session.utils';
import type { ActiveSession } from '../focus-session.types';

describe('formatDuration', () => {
  test.each([
    [0, '0:00'],
    [5, '0:05'],
    [60, '1:00'],
    [1500, '25:00'],
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

const session: ActiveSession = {
  id: 'session-1', taskId: 'task-1', mode: 'focus', timerMode: 'countdown', phase: 'focus',
  startedAt: 1_000, plannedEndAt: 61_000, restEndsAt: null, pausedAt: 11_000, accumulatedPausedMs: 0,
};

describe('session timer', () => {
  test('freezes a countdown while paused', () => {
    expect(sessionTimerSeconds(session, 41_000)).toBe(50);
  });

  test('excludes all paused time from elapsed duration', () => {
    expect(sessionElapsedMilliseconds({ ...session, pausedAt: 91_000, accumulatedPausedMs: 30_000 }, 121_000)).toBe(60_000);
  });
});
