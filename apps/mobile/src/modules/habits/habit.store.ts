import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { createSQLiteHabitRepository } from './sqlite-habit.repository';
import type { HabitRepository } from './habit.repository';
import type { CreateHabitInput, Habit } from './habit.types';
import { createNativeForcedTriggerScheduler } from '@/modules/forced-trigger/native-forced-trigger.scheduler';
import type { ForcedTriggerScheduler } from '@/modules/forced-trigger/forced-trigger.scheduler';

type HabitStore = {
  habits: Habit[];
  isHydrating: boolean;
  error: string | null;
  hydrate(): Promise<void>;
  createHabit(input: CreateHabitInput): Promise<void>;
  addProgress(habitId: string, minutes: number): Promise<void>;
  archiveHabit(habitId: string): Promise<void>;
  clearError(): void;
};

export function createHabitStore(repository: HabitRepository, now: () => number = Date.now,
  forcedScheduler: ForcedTriggerScheduler = createNativeForcedTriggerScheduler()) {
  return createStore<HabitStore>((set, get) => ({
    habits: [], isHydrating: false, error: null,
    async hydrate() {
      set({ isHydrating: true, error: null });
      try {
        const habits = await repository.hydrate(dayKey(now()));
        set({ habits, isHydrating: false });
        try { await Promise.all(habits.filter((habit) => habit.forceEnabled && habit.triggerTime).map((habit) => scheduleHabit(forcedScheduler, habit))); }
        catch (error) { set({ error: message(error) }); }
      }
      catch (error) { set({ isHydrating: false, error: message(error) }); }
    },
    async createHabit(input) {
      try {
        const habit = await repository.create(input); set((state) => ({ habits: [...state.habits, habit], error: null }));
        if (habit.forceEnabled && habit.triggerTime) try { await scheduleHabit(forcedScheduler, habit); } catch (error) { set({ error: message(error) }); }
      }
      catch (error) { set({ error: message(error) }); }
    },
    async addProgress(habitId, minutes) {
      const key = `habit-progress-${habitId}-${now()}-${Math.random().toString(36).slice(2, 6)}`;
      try {
        await repository.addProgress(habitId, minutes, dayKey(now()), key);
        const current = get().habits.find((habit) => habit.id === habitId);
        set((state) => ({ habits: state.habits.map((habit) => habit.id === habitId
          ? { ...habit, todayMinutes: habit.todayMinutes + minutes } : habit), error: null }));
        if (current?.forceEnabled && current.todayMinutes + minutes >= current.targetMinutes) try { await forcedScheduler.markSatisfied(ruleId(habitId)); } catch (error) { set({ error: message(error) }); }
      } catch (error) { set({ error: message(error) }); }
    },
    async archiveHabit(habitId) {
      try { await repository.archive(habitId); await forcedScheduler.cancel(ruleId(habitId)); set((state) => ({ habits: state.habits.filter((habit) => habit.id !== habitId), error: null })); }
      catch (error) { set({ error: message(error) }); }
    },
    clearError() { set({ error: null }); },
  }));
}

export const habitStore = createHabitStore(createSQLiteHabitRepository());
export function useHabitStore<T>(selector: (state: HabitStore) => T) { return useStore(habitStore, selector); }
function dayKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function message(error: unknown) { return error instanceof Error ? error.message : '习惯操作失败'; }
function ruleId(habitId: string) { return `habit:${habitId}`; }
function scheduleHabit(scheduler: ForcedTriggerScheduler, habit: Habit) {
  const [hour, minute] = habit.triggerTime!.split(':').map(Number);
  return scheduler.schedule({ id: ruleId(habit.id), sourceId: habit.id, title: habit.name,
    durationMinutes: habit.targetMinutes, dailyMinute: hour * 60 + minute, recurring: true });
}
