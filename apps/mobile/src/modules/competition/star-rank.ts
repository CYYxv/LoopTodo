export const tierNames = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'starlight', 'closed_loop'] as const;
export type MajorTier = (typeof tierNames)[number];
export type SubTier = 'III' | 'II' | 'I';

export const tierLabels: Record<MajorTier, string> = {
  bronze: '青铜',
  silver: '白银',
  gold: '黄金',
  platinum: '铂金',
  diamond: '钻石',
  starlight: '星耀',
  closed_loop: '闭环',
};

/** Stars required to fill each sub-tier within a major tier. */
export const subTierCapacity: Record<MajorTier, number> = {
  bronze: 3,
  silver: 4,
  gold: 5,
  platinum: 5,
  diamond: 5,
  starlight: 5,
  closed_loop: Number.POSITIVE_INFINITY,
};

/** Cumulative stars required to enter each major tier (at III / heap start). */
export const majorTierThresholds = [0, 9, 21, 36, 51, 66, 81] as const;

export type FocusModeForStars = 'whitelist' | 'strict' | 'lock' | 'untimed';

export const modeCoefficients: Record<Exclude<FocusModeForStars, 'untimed'>, number> = {
  whitelist: 1.0,
  strict: 1.25,
  lock: 1.5,
};

export const MIN_STAR_MINUTES = 25;
export const MAX_STARS_PER_SESSION = 4;

export type SessionStarInput = {
  outcome: 'completed' | 'failed' | 'cancelled' | 'emergency_exit' | null;
  effectiveMinutes: number;
  mode: FocusModeForStars;
  /** Minutes already counted toward star decay today before this session. */
  priorEffectiveMinutesToday?: number;
};

/**
 * Per-session whole-star settlement. Partial progress is discarded (no cross-session carry).
 */
export function calculateSessionStars(input: SessionStarInput): number {
  if (input.outcome === 'emergency_exit') return -1;
  if (input.outcome !== 'completed') return 0;

  const minutes = Math.max(0, Math.floor(input.effectiveMinutes));
  if (minutes < MIN_STAR_MINUTES) return 0;

  if (input.mode === 'untimed') {
    return 1;
  }

  const prior = Math.max(0, input.priorEffectiveMinutesToday ?? 0);
  const effectiveForStars = applyDailyDecay(minutes, prior);
  if (effectiveForStars < MIN_STAR_MINUTES) return 0;

  const coefficient = modeCoefficients[input.mode];
  const raw = Math.floor((effectiveForStars / MIN_STAR_MINUTES) * coefficient);
  if (raw < 1) return 1;
  return Math.min(MAX_STARS_PER_SESSION, raw);
}

/** After ~3h of effective focus in a day, further minutes count at 25%. */
function applyDailyDecay(sessionMinutes: number, priorMinutes: number): number {
  const softCap = 180;
  let remaining = sessionMinutes;
  let scored = 0;
  let cursor = priorMinutes;

  while (remaining > 0) {
    if (cursor >= softCap) {
      scored += remaining * 0.25;
      break;
    }
    const room = softCap - cursor;
    const take = Math.min(remaining, room);
    scored += take;
    remaining -= take;
    cursor += take;
  }
  return scored;
}

export function mapTrustToMode(trustLevel: 'high' | 'normal' | 'open' | 'invalid', timerMode: 'countdown' | 'countup' | 'untimed'): FocusModeForStars {
  if (timerMode === 'untimed') return 'untimed';
  if (trustLevel === 'high') return 'lock';
  if (trustLevel === 'normal') return 'strict';
  return 'whitelist';
}

export type RankProgress = {
  tier: MajorTier;
  subTier: SubTier | null;
  starsInSub: number;
  capacity: number;
  starsToNext: number | null;
  displayName: string;
  nextDisplayName: string | null;
  totalStars: number;
  /** Stars needed to reach next major tier threshold, or null at max heap. */
  nextMajorThreshold: number | null;
};

export function rankFromStars(totalStars: number): RankProgress {
  const stars = Math.max(0, Math.floor(totalStars));
  let majorIndex = 0;
  for (let i = 0; i < majorTierThresholds.length; i += 1) {
    if (stars >= majorTierThresholds[i]!) majorIndex = i;
  }

  const tier = tierNames[majorIndex]!;
  if (tier === 'closed_loop') {
    const base = majorTierThresholds[majorIndex]!;
    const heap = stars - base;
    return {
      tier,
      subTier: null,
      starsInSub: heap,
      capacity: Number.POSITIVE_INFINITY,
      starsToNext: null,
      displayName: `${tierLabels.closed_loop} · ${heap} 星`,
      nextDisplayName: null,
      totalStars: stars,
      nextMajorThreshold: null,
    };
  }

  const base = majorTierThresholds[majorIndex]!;
  const capacity = subTierCapacity[tier];
  const offset = stars - base;
  const subIndex = Math.min(2, Math.floor(offset / capacity));
  const subTier = (['III', 'II', 'I'] as const)[subIndex]!;
  const starsInSub = offset - subIndex * capacity;
  const nextSub = subIndex < 2 ? (['III', 'II', 'I'] as const)[subIndex + 1]! : null;
  const nextMajor = tierNames[majorIndex + 1];
  const nextDisplayName = nextSub
    ? `${tierLabels[tier]} ${nextSub}`
    : nextMajor
      ? nextMajor === 'closed_loop'
        ? tierLabels.closed_loop
        : `${tierLabels[nextMajor]} III`
      : null;
  const starsToNext = capacity - starsInSub;
  const nextMajorThreshold = majorTierThresholds[majorIndex + 1] ?? null;

  return {
    tier,
    subTier,
    starsInSub,
    capacity,
    starsToNext,
    displayName: `${tierLabels[tier]} ${subTier}`,
    nextDisplayName,
    totalStars: stars,
    nextMajorThreshold,
  };
}

/** Legacy score-threshold helper kept for callers that still pass custom thresholds. */
export function tierForScore(score: number, thresholds: number[] = [...majorTierThresholds]) {
  let index = 0;
  thresholds.forEach((threshold, candidate) => {
    if (score >= threshold) index = candidate;
  });
  return tierNames[Math.min(index, tierNames.length - 1)]!;
}

export function demoteTier(tier: string, count = 3): MajorTier {
  const index = tierNames.indexOf(tier as MajorTier);
  const from = index >= 0 ? index : 0;
  return tierNames[Math.max(0, from - count)]!;
}

export function teamScore(total: number, members: number, averageWeight: number, totalBonusWeight: number) {
  if (members <= 0) return 0;
  return Math.round((total / members) * averageWeight + Math.sqrt(Math.max(0, total)) * 10 * totalBonusWeight);
}

export function formatStarBar(filled: number, capacity: number, maxShow = 5): string {
  if (!Number.isFinite(capacity)) return `★ × ${filled}`;
  const total = Math.min(capacity, maxShow);
  const on = Math.min(filled, total);
  return `${'★'.repeat(on)}${'☆'.repeat(Math.max(0, total - on))}  ${filled}/${capacity}`;
}
