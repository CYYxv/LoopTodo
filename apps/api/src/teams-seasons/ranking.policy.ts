export const tierNames = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'] as const;
export function tierForScore(score: number, thresholds: number[]) { let index = 0; thresholds.forEach((threshold, candidate) => { if (score >= threshold) index = candidate; }); return tierNames[Math.min(index, tierNames.length - 1)]!; }
export function demoteTier(tier: string, count = 3) { return tierNames[Math.max(0, tierNames.indexOf(tier as typeof tierNames[number]) - count)] ?? tierNames[0]; }
export function teamScore(total: number, members: number, averageWeight: number, totalBonusWeight: number) {
  if (members <= 0) return 0; return Math.round((total / members) * averageWeight + Math.sqrt(Math.max(0, total)) * 10 * totalBonusWeight);
}
