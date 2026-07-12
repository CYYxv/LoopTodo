import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { createHttpScoringClient, type ScoringClient } from './scoring.client';
import type { DailyScore } from './scoring.types';

type ScoringStore = { configured: boolean; client: ScoringClient | null; today: DailyScore | null; history: DailyScore[]; loading: boolean; error: string | null;
  configure(baseUrl: string, accessToken: string): void; load(): Promise<void> };
export function createScoringStore(initialClient: ScoringClient | null = null) {
  return createStore<ScoringStore>((set, get) => ({ configured: Boolean(initialClient), client: initialClient, today: null, history: [], loading: false, error: null,
    configure(baseUrl, accessToken) { set({ client: createHttpScoringClient(baseUrl, accessToken), configured: true, error: null }); },
    async load() { const client = get().client; if (!client) return; set({ loading: true, error: null });
      try { const [today, history] = await Promise.all([client.today(), client.history()]); set({ today, history: history.items, loading: false }); }
      catch (error) { set({ loading: false, error: error instanceof Error ? error.message : '积分统计加载失败' }); } },
  }));
}
export const scoringStore = createScoringStore();
export function configureScoring(baseUrl: string, accessToken: string) { scoringStore.getState().configure(baseUrl, accessToken); }
export function useScoringStore<T>(selector: (state: ScoringStore) => T) { return useStore(scoringStore, selector); }
