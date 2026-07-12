import { demoteTier, teamScore, tierForScore } from './ranking.policy';

test('uses fixed thresholds and demotes three major tiers', () => { expect(tierForScore(3200, [0, 500, 1500, 3000, 5000, 8000])).toBe('platinum'); expect(demoteTier('diamond')).toBe('silver'); });
test('team score combines average and total bonus without active-rate input', () => { expect(teamScore(10000, 100, 0.7, 0.3)).toBe(370); });
test('aggregates ten thousand members in bounded time', () => { const started = Date.now(); const points = Array.from({ length: 10_000 }, () => 500); const score = teamScore(points.reduce((sum, value) => sum + value, 0), points.length, 0.7, 0.3); expect(score).toBeGreaterThan(0); expect(Date.now() - started).toBeLessThan(100); });
