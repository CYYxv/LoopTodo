import {
  calculateSessionStars,
  DEFAULT_TEAM_AVERAGE_WEIGHT,
  DEFAULT_TEAM_TOTAL_BONUS_WEIGHT,
  demoteTier,
  formatStarBar,
  majorTierThresholds,
  mapTrustToMode,
  PK_MATCH_DATE_POLICY,
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

test('uses major star thresholds and demotes three major tiers for new season floor', () => {
  expect(tierForScore(36, [...majorTierThresholds])).toBe('platinum');
  expect(demoteTier('diamond')).toBe('silver');
  expect(demoteTier('closed_loop')).toBe('platinum');
  expect(demoteTier('starlight')).toBe('gold');
  expect(demoteTier('gold')).toBe('bronze');
  expect(demoteTier('bronze')).toBe('bronze');
  expect(demoteTier('silver', 1)).toBe('bronze');
  expect(demoteTier('closed_loop', 6)).toBe('bronze');
  expect(tierLabels.closed_loop).toBe('闭环');
  expect(tierNames).toContain('closed_loop');
  // floor stars for demoted major tier = threshold at that major
  const floorTier = demoteTier('closed_loop');
  const floorStars = majorTierThresholds[tierNames.indexOf(floorTier)];
  expect(floorTier).toBe('platinum');
  expect(floorStars).toBe(36);
  expect(rankFromStars(floorStars).tier).toBe('platinum');
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

test('team score defaults use 0.7 average and 0.3 total bonus', () => {
  expect(DEFAULT_TEAM_AVERAGE_WEIGHT).toBe(0.7);
  expect(DEFAULT_TEAM_TOTAL_BONUS_WEIGHT).toBe(0.3);
  expect(teamScore(10000, 100, DEFAULT_TEAM_AVERAGE_WEIGHT, DEFAULT_TEAM_TOTAL_BONUS_WEIGHT)).toBe(370);
  expect(PK_MATCH_DATE_POLICY).toBe('server_utc_day');
});

test('aggregates ten thousand members in bounded time', () => {
  const started = Date.now();
  const points = Array.from({ length: 10_000 }, () => 500);
  const score = teamScore(points.reduce((sum, value) => sum + value, 0), points.length, 0.7, 0.3);
  expect(score).toBeGreaterThan(0);
  expect(Date.now() - started).toBeLessThan(100);
});
