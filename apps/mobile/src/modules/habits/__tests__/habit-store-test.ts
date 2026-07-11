import { createHabitStore } from '../habit.store';
import type { HabitRepository } from '../habit.repository';
import type { Habit } from '../habit.types';

function repository(seed: Habit[] = []) {
  let habits = seed.map((habit) => ({ ...habit }));
  const progressKeys = new Set<string>();
  const value: HabitRepository = {
    async hydrate() { return habits.map((habit) => ({ ...habit })); },
    async create(input) {
      const habit: Habit = { id: 'habit-created', ...input, todayMinutes: 0, status: 'active' };
      habits.push(habit);
      return habit;
    },
    async addProgress(habitId, minutes, _day, key) {
      if (progressKeys.has(key)) return;
      progressKeys.add(key);
      habits = habits.map((habit) => habit.id === habitId ? { ...habit, todayMinutes: habit.todayMinutes + minutes } : habit);
    },
    async archive(habitId) { habits = habits.filter((habit) => habit.id !== habitId); },
  };
  return value;
}

describe('habit store', () => {
  test('hydrates, creates and records progress', async () => {
    const store = createHabitStore(repository(), () => Date.parse('2026-07-11T08:00:00Z'));
    await store.getState().hydrate();
    await store.getState().createHabit({ name: '晨读', targetMinutes: 30, forceEnabled: true, triggerTime: '07:30' });
    await store.getState().addProgress('habit-created', 20);

    expect(store.getState().habits[0]).toMatchObject({ name: '晨读', todayMinutes: 20, triggerTime: '07:30' });
  });
});
