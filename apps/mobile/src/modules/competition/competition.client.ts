import type { LeaderboardEntry, SeasonRank, TeamLeaderboardEntry, TeamMembership } from './competition.types';
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
  leaderboard(period: string): Promise<LeaderboardEntry[]>;
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
    leaderboard: (period) => request(`/leaderboards?period=${period}&limit=100`),
    myTeam: () => request('/teams/mine'),
    teamLeaderboard: () => request('/teams/leaderboard?limit=100'),
    recentScoreEvents: (limit = 12) => request(`/score/events?limit=${limit}`),
    createTeam: (name) => request('/teams', { method: 'POST', body: JSON.stringify({ name }) }),
    joinTeam: (joinCode) => request('/teams/join', { method: 'POST', body: JSON.stringify({ joinCode }) }),
  };
}
