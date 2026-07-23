export type SeasonRank = {
  season: { id: string; name: string; startsAt: string; endsAt: string };
  score: number;
  stars?: number;
  tier: string;
  startingTier: string;
  subTier?: 'III' | 'II' | 'I' | null;
  starsInSub?: number;
  starCapacity?: number | null;
  starsToNext?: number | null;
  displayName?: string;
  nextDisplayName?: string | null;
  starBar?: string;
  nextThreshold: number | null;
};
export type LeaderboardEntry = { position: number; user: { id: string; nickname: string; avatarUrl: string | null }; score: number; focusMinutes: number };
export type TeamMembership = { role: 'leader' | 'member'; team: { id: string; name: string; joinCode: string; memberCount: number } } | null;
export type TeamLeaderboardEntry = { id: string; name: string; memberCount: number; totalScore: number; score: number; position: number };
