import type { CreateHabitInput, Habit } from './habit.types';

export interface HabitRepository {
  hydrate(day: string): Promise<Habit[]>;
  create(input: CreateHabitInput): Promise<Habit>;
  addProgress(habitId: string, minutes: number, day: string, idempotencyKey: string): Promise<void>;
  archive(habitId: string): Promise<void>;
}
