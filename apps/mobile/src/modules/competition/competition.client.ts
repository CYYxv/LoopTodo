import type { LeaderboardEntry, LeaderboardResponse, SeasonRank, TeamLeaderboardEntry, TeamMembership } from './competition.types';
import { apiErrorMessage } from '@/shared/api-error';

export type ScoreEventItem = {
  id: string;
  sessionId: string;
  scoreDate: string;
  outcome: string;
  trustLevel: string;
  durationMinutes: number;
  totalScore: number;
  formulaVersion: string;
  createdAt?: string;
};

export interface CompetitionClient {
  rank(): Promise<SeasonRank>;
  leaderboard(period: string): Promise<LeaderboardResponse>;
  myTeam(): Promise<TeamMembership>;
  teamLeaderboard(): Promise<TeamLeaderboardEntry[]>;
  recentScoreEvents(limit?: number): Promise<ScoreEventItem[]>;
  createTeam(name: string): Promise<void>;
  joinTeam(code: string): Promise<void>;
}

export function createCompetitionClient(baseUrl: string, token: string): CompetitionClient {
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...init?.headers },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(apiErrorMessage(body, '竞技数据请求失败'));
    return body.data as T;
  };

  return {
    rank: () => request('/seasons/current/rank'),
    leaderboard: async (period) => {
      const raw = await request<LeaderboardResponse | LeaderboardEntry[]>(`/leaderboards?period=${period}&limit=100`);
      return normalizeLeaderboard(raw, period);
    },
    myTeam: () => request('/teams/mine'),
    teamLeaderboard: () => request('/teams/leaderboard?limit=100'),
    recentScoreEvents: (limit = 12) => request(`/score/events?limit=${limit}`),
    createTeam: (name) => request('/teams', { method: 'POST', body: JSON.stringify({ name }) }),
    joinTeam: (joinCode) => request('/teams/join', { method: 'POST', body: JSON.stringify({ joinCode }) }),
  };
}


function normalizeLeaderboard(raw: LeaderboardResponse | LeaderboardEntry[] | null | undefined, period: string): LeaderboardResponse {
  if (Array.isArray(raw)) {
    return { period, items: raw, self: null };
  }
  if (raw && typeof raw === 'object' && Array.isArray(raw.items)) {
    return {
      period: raw.period ?? period,
      items: raw.items,
      self: raw.self ?? null,
    };
  }
  return { period, items: [], self: null };
}
