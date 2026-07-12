import type { HabitProgressView, HabitView } from './habit.types';

export const HABIT_REPOSITORY = Symbol('HABIT_REPOSITORY');
export class HabitLimitExceededError extends Error {}

export type HabitMutation<T> =
  | { status: 'ok'; value: T; replayed?: boolean }
  | { status: 'not-found' }
  | { status: 'conflict' }
  | { status: 'idempotency-conflict' };

export interface HabitRepository {
  list(userId: string, day: Date): Promise<HabitView[]>;
  create(userId: string, input: { name: string; targetMinutes: number; forceEnabled: boolean; triggerTime: string | null }): Promise<HabitView>;
  update(userId: string, id: string, version: number, patch: { name?: string; targetMinutes?: number; forceEnabled?: boolean; triggerTime?: string | null }): Promise<HabitMutation<HabitView>>;
  archive(userId: string, id: string, version: number): Promise<HabitMutation<HabitView>>;
  addProgress(input: { userId: string; habitId: string; minutes: number; date: Date; idempotencyKey: string }): Promise<HabitMutation<HabitProgressView>>;
  listProgress(userId: string, habitId: string): Promise<HabitMutation<HabitProgressView[]>>;
}
