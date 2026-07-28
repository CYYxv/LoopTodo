import { calculateSessionStars, demoteTier, rankFromStars } from '../star-rank';

test('mobile star rank mirrors server policy', () => {
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 24, mode: 'lock' })).toBe(0);
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 50, mode: 'lock' })).toBe(3);
  expect(rankFromStars(81).displayName).toBe('闭环 · 0 星');
  expect(demoteTier('closed_loop')).toBe('platinum');
});

test('settles whitelist stars from current-session whole 25-minute blocks only', () => {
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 24, mode: 'whitelist' })).toBe(0);
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 25, mode: 'whitelist' })).toBe(1);
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 49, mode: 'whitelist' })).toBe(1);
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 50, mode: 'whitelist' })).toBe(2);
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 100, mode: 'whitelist' })).toBe(4);
  expect(calculateSessionStars({
    outcome: 'completed', effectiveMinutes: 25, mode: 'whitelist', priorEffectiveMinutesToday: 180,
  })).toBe(1);
});
