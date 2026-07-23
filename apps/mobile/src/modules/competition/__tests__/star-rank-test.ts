import { calculateSessionStars, demoteTier, rankFromStars } from '../star-rank';

test('mobile star rank mirrors server policy', () => {
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 24, mode: 'lock' })).toBe(0);
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 50, mode: 'lock' })).toBe(3);
  expect(rankFromStars(81).displayName).toBe('闭环 · 0 星');
  expect(demoteTier('closed_loop')).toBe('platinum');
});
