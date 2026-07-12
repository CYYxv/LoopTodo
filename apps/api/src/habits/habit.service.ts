import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { AddHabitProgressDto } from './dto/add-habit-progress.dto';
import type { CreateHabitDto } from './dto/create-habit.dto';
import type { UpdateHabitDto } from './dto/update-habit.dto';
import { HABIT_REPOSITORY, HabitLimitExceededError, type HabitMutation, type HabitRepository } from './habit.repository';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class HabitService {
  constructor(@Inject(HABIT_REPOSITORY) private readonly repository: HabitRepository, private readonly subscriptions: SubscriptionService) {}

  list(userId: string, date?: string) {
    const day = date ? new Date(`${date}T00:00:00.000Z`) : utcDay(new Date());
    if (Number.isNaN(day.getTime())) throw new BadRequestException({ code: 'INVALID_PROGRESS_DATE', message: '进度日期无效' });
    return this.repository.list(userId, day);
  }

  async create(userId: string, input: CreateHabitDto) {
    validateForce(input.forceEnabled, input.triggerTime ?? null);
    await this.subscriptions.assertCanCreateHabit(userId);
    try { return await this.repository.create(userId, { name: input.name.trim(), targetMinutes: input.targetMinutes,
      forceEnabled: input.forceEnabled, triggerTime: input.forceEnabled ? input.triggerTime ?? null : null }); }
    catch (error) { if (error instanceof HabitLimitExceededError) throw new ForbiddenException({ code: 'HABIT_LIMIT_REACHED', message: '免费版最多创建 3 个习惯' }); throw error; }
  }

  async update(userId: string, id: string, input: UpdateHabitDto) {
    if (input.forceEnabled === true) validateForce(true, input.triggerTime ?? null);
    const { version, ...patch } = input;
    return unwrap(await this.repository.update(userId, id, version, patch));
  }

  async archive(userId: string, id: string, version: number) {
    return unwrap(await this.repository.archive(userId, id, version));
  }

  async addProgress(userId: string, habitId: string, key: string, input: AddHabitProgressDto) {
    validateKey(key);
    return unwrap(await this.repository.addProgress({ userId, habitId, minutes: input.minutes,
      date: utcDay(input.date ? new Date(input.date) : new Date()), idempotencyKey: key }));
  }

  async listProgress(userId: string, habitId: string) {
    return unwrap(await this.repository.listProgress(userId, habitId));
  }
}

function unwrap<T>(result: HabitMutation<T>) {
  if (result.status === 'ok') return result.value;
  if (result.status === 'not-found') throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: '资源不存在' });
  if (result.status === 'conflict') throw new ConflictException({ code: 'VERSION_CONFLICT', message: '数据已更新，请刷新后重试' });
  throw new ConflictException({ code: 'IDEMPOTENCY_KEY_CONFLICT', message: 'Idempotency-Key 已用于其他进度' });
}

function validateForce(enabled: boolean, time: string | null) {
  if (enabled && !time) throw new BadRequestException({ code: 'TRIGGER_TIME_REQUIRED', message: '开启强制约束时必须设置触发时间' });
}
function validateKey(key: string) {
  if (!key || key.length < 8 || key.length > 160) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: '请提供有效的 Idempotency-Key' });
}
function utcDay(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); }
