export type ForcedTriggerRule = { id: string; sourceId: string; title: string; durationMinutes: number; dailyMinute: number; recurring: boolean };
export interface ForcedTriggerScheduler {
  schedule(rule: ForcedTriggerRule): Promise<void>;
  cancel(id: string): Promise<void>;
  markSatisfied(id: string): Promise<void>;
}
