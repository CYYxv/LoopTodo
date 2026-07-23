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
export type LeaderboardUser = { id: string; nickname: string; avatarUrl: string | null };
export type LeaderboardEntry = { position: number; user: LeaderboardUser; score: number; focusMinutes: number; userId?: string };
export type LeaderboardSelf = {
  position: number;
  score: number;
  focusMinutes: number;
  userId: string;
  positionDelta: number | null;
  user?: LeaderboardUser;
};
export type LeaderboardResponse = {
  period: 'today' | 'week' | 'month' | 'season' | string;
  items: LeaderboardEntry[];
  self: LeaderboardSelf | null;
};
export type TeamMembership = { role: 'leader' | 'member'; team: { id: string; name: string; joinCode: string; memberCount: number } } | null;
export type TeamLeaderboardEntry = { id: string; name: string; memberCount: number; totalScore: number; score: number; position: number };
