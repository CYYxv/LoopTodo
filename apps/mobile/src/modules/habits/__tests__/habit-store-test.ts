import type { ForcedTriggerScheduler } from '@/modules/forced-trigger/forced-trigger.scheduler';

import { createHabitStore, selectHabitHistory } from '../habit.store';
import type { HabitRepository } from '../habit.repository';
import type { Habit } from '../habit.types';

function repository(seed: Habit[] = []) {
  let habits = seed.map((habit) => ({ ...habit }));
  const progressKeys = new Set<string>();
  const value: HabitRepository = {
    async hydrate() { return habits.map((habit) => ({ ...habit })); },
    async create(input) { const habit: Habit = { id: 'habit-created', ...input, todayMinutes: 0, status: 'active' }; habits.push(habit); return habit; },
    async addProgress(habitId, minutes, _day, key) { if (progressKeys.has(key)) return; progressKeys.add(key); habits = habits.map((habit) => habit.id === habitId ? { ...habit, todayMinutes: habit.todayMinutes + minutes } : habit); },
    async update(habitId, input) { const updated = { ...habits.find((habit) => habit.id === habitId)!, ...input }; habits = habits.map((habit) => habit.id === habitId ? updated : habit); return updated; },
    async history() { return [{ date: '2026-07-11', minutes: 30 }]; },
    async archive(habitId) { habits = habits.filter((habit) => habit.id !== habitId); },
  };
  return value;
}

describe('habit store', () => {
  test('schedules forced habits and advances them after completion', async () => {
    const scheduled: string[] = []; const satisfied: string[] = [];
    const scheduler: ForcedTriggerScheduler = { async schedule(rule) { scheduled.push(`${rule.id}:${rule.dailyMinute}`); },
      async cancel() { return undefined; }, async markSatisfied(id) { satisfied.push(id); } };
    const store = createHabitStore(repository(), () => Date.parse('2026-07-11T08:00:00Z'), scheduler);
    await store.getState().hydrate();
    await store.getState().createHabit({ name: '晨读', targetMinutes: 30, forceEnabled: true, triggerTime: '07:30' });
    await store.getState().addProgress('habit-created', 30);

    expect(store.getState().habits[0]).toMatchObject({ name: '晨读', todayMinutes: 30, triggerTime: '07:30' });
    expect(scheduled).toEqual(['habit:habit-created:450']);
    expect(satisfied).toEqual(['habit:habit-created']);
  });

  test('updates a habit and loads its progress history', async () => {
    const initial: Habit = { id: 'habit-1', name: '晨读', targetMinutes: 20, todayMinutes: 0, forceEnabled: false, triggerTime: null, status: 'active' };
    const store = createHabitStore(repository([initial]), () => Date.parse('2026-07-11T08:00:00Z'));
    await store.getState().hydrate();

    await store.getState().updateHabit('habit-1', { name: '英语晨读', targetMinutes: 30, forceEnabled: false, triggerTime: null });
    await store.getState().loadHistory('habit-1');

    expect(store.getState().habits[0]).toMatchObject({ name: '英语晨读', targetMinutes: 30 });
    expect(store.getState().historyByHabit['habit-1']).toEqual([{ date: '2026-07-11', minutes: 30 }]);
  });

  test('returns an explicit failure when a habit update cannot be saved', async () => {
    const initial: Habit = { id: 'habit-1', name: '晨读', targetMinutes: 20, todayMinutes: 0, forceEnabled: false, triggerTime: null, status: 'active' };
    const failingRepository = repository([initial]);
    failingRepository.update = async () => { throw new Error('保存失败'); };
    const store = createHabitStore(failingRepository);

    await store.getState().hydrate();
    const result = await store.getState().updateHabit('habit-1', { name: '英语晨读', targetMinutes: 30, forceEnabled: false, triggerTime: null });

    expect(result).toEqual({ ok: false, error: '保存失败' });
    expect(store.getState().habits[0].name).toBe('晨读');
  });

  test('keeps a saved habit update successful when forced scheduling reports a warning', async () => {
    const initial: Habit = { id: 'habit-1', name: '晨读', targetMinutes: 20, todayMinutes: 0, forceEnabled: false, triggerTime: null, status: 'active' };
    const scheduler: ForcedTriggerScheduler = {
      async schedule() { throw new Error('强制触发调度失败'); },
      async cancel() { return undefined; },
      async markSatisfied() { return undefined; },
    };
    const store = createHabitStore(repository([initial]), Date.now, scheduler);

    await store.getState().hydrate();
    const result = await store.getState().updateHabit('habit-1', { name: '英语晨读', targetMinutes: 30, forceEnabled: true, triggerTime: '20:00' });

    expect(result).toEqual({ ok: true });
    expect(store.getState().habits[0]).toMatchObject({ name: '英语晨读', forceEnabled: true, triggerTime: '20:00' });
    expect(store.getState().error).toBe('强制触发调度失败');
  });

  test('uses a stable empty history snapshot for an unloaded habit', () => {
    const state = createHabitStore(repository()).getState();

    expect(selectHabitHistory(state, 'missing')).toBe(selectHabitHistory(state, 'missing'));
  });

  test('returns an explicit failure when a habit cannot be archived', async () => {
    const initial: Habit = { id: 'habit-1', name: '晨读', targetMinutes: 20, todayMinutes: 0, forceEnabled: false, triggerTime: null, status: 'active' };
    const failingRepository = repository([initial]);
    failingRepository.archive = async () => { throw new Error('归档失败'); };
    const store = createHabitStore(failingRepository);

    await store.getState().hydrate();
    const result = await store.getState().archiveHabit('habit-1');

    expect(result).toEqual({ ok: false, error: '归档失败' });
    expect(store.getState().habits).toHaveLength(1);
  });

  test('keeps a persisted archive successful when trigger cancellation reports a warning', async () => {
    const initial: Habit = { id: 'habit-1', name: '晨读', targetMinutes: 20, todayMinutes: 0, forceEnabled: false, triggerTime: null, status: 'active' };
    const scheduler: ForcedTriggerScheduler = {
      async schedule() { return undefined; },
      async cancel() { throw new Error('取消触发失败'); },
      async markSatisfied() { return undefined; },
    };
    const store = createHabitStore(repository([initial]), Date.now, scheduler);

    await store.getState().hydrate();
    const result = await store.getState().archiveHabit('habit-1');

    expect(result).toEqual({ ok: true });
    expect(store.getState().habits).toHaveLength(0);
    expect(store.getState().error).toBe('取消触发失败');
  });
});
