import type { CreateHabitInput, Habit, HabitProgressDay, UpdateHabitInput } from './habit.types';

export interface HabitRepository {
  hydrate(day: string): Promise<Habit[]>;
  create(input: CreateHabitInput): Promise<Habit>;
  update(habitId: string, input: UpdateHabitInput): Promise<Habit>;
  history(habitId: string): Promise<HabitProgressDay[]>;
  addProgress(habitId: string, minutes: number, day: string, idempotencyKey: string): Promise<void>;
  archive(habitId: string): Promise<void>;
}
