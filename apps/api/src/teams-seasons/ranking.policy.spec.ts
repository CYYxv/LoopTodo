import {
  calculateSessionStars,
  demoteTier,
  formatStarBar,
  majorTierThresholds,
  mapTrustToMode,
  rankFromStars,
  teamScore,
  tierForScore,
  tierLabels,
  tierNames,
} from './ranking.policy';

test('maps cumulative stars to major and sub tiers including closed_loop', () => {
  expect(rankFromStars(0).displayName).toBe('青铜 III');
  expect(rankFromStars(8).displayName).toBe('青铜 I');
  expect(rankFromStars(9).displayName).toBe('白银 III');
  expect(rankFromStars(25).displayName).toBe('黄金 III');
  expect(rankFromStars(25).starsInSub).toBe(4);
  expect(rankFromStars(26).displayName).toBe('黄金 II');
  expect(rankFromStars(81).displayName).toBe('闭环 · 0 星');
  expect(rankFromStars(93).displayName).toBe('闭环 · 12 星');
});

test('uses major star thresholds and demotes three major tiers', () => {
  expect(tierForScore(36, [...majorTierThresholds])).toBe('platinum');
  expect(demoteTier('diamond')).toBe('silver');
  expect(demoteTier('closed_loop')).toBe('platinum');
  expect(tierLabels.closed_loop).toBe('闭环');
  expect(tierNames).toContain('closed_loop');
});

test('settles whole stars per session without partial carry', () => {
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 24, mode: 'lock' })).toBe(0);
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 25, mode: 'whitelist' })).toBe(1);
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 25, mode: 'strict' })).toBe(1);
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 50, mode: 'lock' })).toBe(3);
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 100, mode: 'lock' })).toBe(4);
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 40, mode: 'untimed' })).toBe(1);
  expect(calculateSessionStars({ outcome: 'emergency_exit', effectiveMinutes: 50, mode: 'lock' })).toBe(-1);
  expect(calculateSessionStars({ outcome: 'failed', effectiveMinutes: 50, mode: 'strict' })).toBe(0);
});

test('decays star credit after three hours prior effective focus', () => {
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 25, mode: 'whitelist', priorEffectiveMinutesToday: 180 })).toBe(0);
  expect(calculateSessionStars({ outcome: 'completed', effectiveMinutes: 100, mode: 'whitelist', priorEffectiveMinutesToday: 100 })).toBe(3);
});

test('whitelist earns stars but fewer than lock at same duration', () => {
  const minutes = 75;
  const white = calculateSessionStars({ outcome: 'completed', effectiveMinutes: minutes, mode: 'whitelist' });
  const lock = calculateSessionStars({ outcome: 'completed', effectiveMinutes: minutes, mode: 'lock' });
  expect(white).toBeGreaterThan(0);
  expect(white).toBeLessThanOrEqual(lock);
});

test('maps trust levels to modes', () => {
  expect(mapTrustToMode('open', 'countdown')).toBe('whitelist');
  expect(mapTrustToMode('normal', 'countdown')).toBe('strict');
  expect(mapTrustToMode('high', 'countdown')).toBe('lock');
  expect(mapTrustToMode('high', 'untimed')).toBe('untimed');
});

test('formats star bars', () => {
  expect(formatStarBar(3, 5)).toBe('★★★☆☆  3/5');
});

test('team score combines average and total bonus without active-rate input', () => {
  expect(teamScore(10000, 100, 0.7, 0.3)).toBe(370);
});

test('aggregates ten thousand members in bounded time', () => {
  const started = Date.now();
  const points = Array.from({ length: 10_000 }, () => 500);
  const score = teamScore(points.reduce((sum, value) => sum + value, 0), points.length, 0.7, 0.3);
  expect(score).toBeGreaterThan(0);
  expect(Date.now() - started).toBeLessThan(100);
});
