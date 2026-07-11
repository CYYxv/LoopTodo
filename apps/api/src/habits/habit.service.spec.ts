import { randomUUID } from 'node:crypto';

import type { HabitMutation, HabitRepository } from './habit.repository';
import { HabitService } from './habit.service';
import type { HabitProgressView, HabitView } from './habit.types';

class MemoryHabitRepository implements HabitRepository {
  habits: Array<HabitView & { userId: string }> = [];
  progress: Array<HabitProgressView & { userId: string; key: string }> = [];
  async list(userId: string) { return this.habits.filter((habit) => habit.userId === userId && habit.status === 'active'); }
  async create(userId: string, input: Parameters<HabitRepository['create']>[1]) {
    const habit = { ...input, id: randomUUID(), userId, status: 'active' as const, version: 1, todayMinutes: 0, updatedAt: new Date() };
    this.habits.push(habit);
    return habit;
  }
  async update(userId: string, id: string, version: number, patch: Parameters<HabitRepository['update']>[3]): Promise<HabitMutation<HabitView>> {
    const habit = this.habits.find((item) => item.userId === userId && item.id === id && item.status === 'active');
    if (!habit) return { status: 'not-found' };
    if (habit.version !== version) return { status: 'conflict' };
    Object.assign(habit, patch, { version: version + 1, updatedAt: new Date() });
    return { status: 'ok', value: habit };
  }
  async archive(userId: string, id: string, version: number): Promise<HabitMutation<HabitView>> {
    return this.update(userId, id, version, { forceEnabled: false, triggerTime: null }).then((result) => {
      if (result.status === 'ok') result.value.status = 'archived';
      return result;
    });
  }
  async addProgress(input: Parameters<HabitRepository['addProgress']>[0]): Promise<HabitMutation<HabitProgressView>> {
    const replay = this.progress.find((item) => item.userId === input.userId && item.key === input.idempotencyKey);
    if (replay) return replay.habitId === input.habitId && replay.minutes === input.minutes
      ? { status: 'ok', value: replay, replayed: true } : { status: 'idempotency-conflict' };
    const habit = this.habits.find((item) => item.userId === input.userId && item.id === input.habitId && item.status === 'active');
    if (!habit) return { status: 'not-found' };
    const entry = { id: randomUUID(), habitId: habit.id, minutes: input.minutes, progressDate: input.date,
      createdAt: new Date(), userId: input.userId, key: input.idempotencyKey };
    this.progress.push(entry);
    habit.todayMinutes += input.minutes;
    return { status: 'ok', value: entry };
  }
  async listProgress(userId: string, habitId: string): Promise<HabitMutation<HabitProgressView[]>> {
    if (!this.habits.some((item) => item.userId === userId && item.id === habitId)) return { status: 'not-found' };
    return { status: 'ok', value: this.progress.filter((item) => item.userId === userId && item.habitId === habitId) };
  }
}

describe('HabitService', () => {
  test('requires trigger time when force constraint is enabled', async () => {
    const service = new HabitService(new MemoryHabitRepository());
    expect(() => service.create('user-one', { name: '晨读', targetMinutes: 30, forceEnabled: true })).toThrow('开启强制约束时必须设置触发时间');
  });

  test('isolates progress, enforces version and keeps progress idempotent', async () => {
    const repository = new MemoryHabitRepository();
    const service = new HabitService(repository);
    const habit = await service.create('user-one', { name: '晨读', targetMinutes: 30, forceEnabled: true, triggerTime: '07:30' });

    await service.update('user-one', habit.id, { version: 1, targetMinutes: 45 });
    await expect(service.update('user-one', habit.id, { version: 1, targetMinutes: 60 })).rejects.toMatchObject({ status: 409 });
    const first = await service.addProgress('user-one', habit.id, 'habit-progress-001', { minutes: 20 });
    const replay = await service.addProgress('user-one', habit.id, 'habit-progress-001', { minutes: 20 });
    expect(replay.id).toBe(first.id);
    await expect(service.addProgress('user-two', habit.id, 'habit-progress-002', { minutes: 10 })).rejects.toMatchObject({ status: 404 });
  });
});
