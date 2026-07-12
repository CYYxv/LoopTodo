import type { DailyScore, ScoreHistory } from './scoring.types';

export interface ScoringClient { today(): Promise<DailyScore>; history(): Promise<ScoreHistory>; }

export function createHttpScoringClient(baseUrl: string, accessToken: string): ScoringClient {
  const request = async <T>(path: string): Promise<T> => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, { headers: { authorization: `Bearer ${accessToken}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? body.error?.code ?? '积分统计请求失败');
    return body.data as T;
  };
  return { today: () => request('/score/today'), history: () => request('/score/history?page=1&pageSize=30') };
}
