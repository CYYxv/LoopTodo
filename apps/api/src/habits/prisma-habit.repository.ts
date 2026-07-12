import { Injectable } from '@nestjs/common';
import { Prisma, type Habit, type HabitProgressEntry } from '@prisma/client';

import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { HabitLimitExceededError, type HabitMutation, type HabitRepository } from './habit.repository';
import type { HabitProgressView, HabitView } from './habit.types';

@Injectable()
export class PrismaHabitRepository implements HabitRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, day: Date) {
    const end = new Date(day.getTime() + 86_400_000);
    const [habits, progress] = await Promise.all([
      this.prisma.habit.findMany({ where: { userId, status: 'active' }, orderBy: { createdAt: 'asc' } }),
      this.prisma.habitProgressEntry.groupBy({ by: ['habitId'], where: { userId, progressDate: { gte: day, lt: end } }, _sum: { minutes: true } }),
    ]);
    const totals = new Map(progress.map((item) => [item.habitId, item._sum.minutes ?? 0]));
    return habits.map((habit) => habitView(habit, totals.get(habit.id) ?? 0));
  }

  async create(userId: string, input: Parameters<HabitRepository['create']>[1]) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const activeSubscription = await transaction.subscription.findFirst({ where: { userId, expiresAt: { gt: new Date() } }, select: { id: true } });
      if (!activeSubscription && await transaction.habit.count({ where: { userId, status: 'active' } }) >= 3) throw new HabitLimitExceededError();
      const habit = await transaction.habit.create({ data: { userId, ...input } });
      if (input.forceEnabled && input.triggerTime) {
        await transaction.forcedLockRule.create({ data: { userId, habitId: habit.id, triggerTime: input.triggerTime } });
      }
      return habitView(habit, 0);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async update(userId: string, id: string, version: number, patch: Parameters<HabitRepository['update']>[3]): Promise<HabitMutation<HabitView>> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.habit.findFirst({ where: { id, userId, status: 'active' } });
      if (!current) return { status: 'not-found' } as const;
      const result = await transaction.habit.updateMany({ where: { id, userId, version, status: 'active' },
        data: { ...patch, triggerTime: patch.forceEnabled === false ? null : patch.triggerTime, version: { increment: 1 } } });
      if (result.count !== 1) return { status: 'conflict' } as const;
      const next = await transaction.habit.findUniqueOrThrow({ where: { id } });
      if (next.forceEnabled && next.triggerTime) {
        await transaction.forcedLockRule.upsert({ where: { habitId: id }, create: { userId, habitId: id, triggerTime: next.triggerTime },
          update: { triggerTime: next.triggerTime, enabled: true } });
      } else {
        await transaction.forcedLockRule.deleteMany({ where: { userId, habitId: id } });
      }
      return { status: 'ok', value: habitView(next, 0) } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async archive(userId: string, id: string, version: number): Promise<HabitMutation<HabitView>> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.habit.findFirst({ where: { id, userId, status: 'active' } });
      if (!current) return { status: 'not-found' } as const;
      const result = await transaction.habit.updateMany({ where: { id, userId, version, status: 'active' },
        data: { status: 'archived', forceEnabled: false, triggerTime: null, version: { increment: 1 } } });
      if (result.count !== 1) return { status: 'conflict' } as const;
      await transaction.forcedLockRule.deleteMany({ where: { userId, habitId: id } });
      return { status: 'ok', value: habitView(await transaction.habit.findUniqueOrThrow({ where: { id } }), 0) } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async addProgress(input: Parameters<HabitRepository['addProgress']>[0]): Promise<HabitMutation<HabitProgressView>> {
    const replay = await this.prisma.habitProgressEntry.findFirst({ where: { userId: input.userId, idempotencyKey: input.idempotencyKey } });
    if (replay) return replay.habitId === input.habitId && replay.minutes === input.minutes && replay.progressDate.getTime() === input.date.getTime()
      ? { status: 'ok', value: progressView(replay), replayed: true }
      : { status: 'idempotency-conflict' };
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const habit = await transaction.habit.findFirst({ where: { id: input.habitId, userId: input.userId, status: 'active' } });
        if (!habit) return { status: 'not-found' } as const;
        const entry = await transaction.habitProgressEntry.create({ data: {
          userId: input.userId, habitId: input.habitId, minutes: input.minutes,
          progressDate: input.date, idempotencyKey: input.idempotencyKey,
        } });
        await transaction.habit.update({ where: { id: habit.id }, data: { progressUpdatedAt: new Date() } });
        return { status: 'ok', value: progressView(entry) } as const;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isUnique(error)) {
        const existing = await this.prisma.habitProgressEntry.findFirst({ where: { userId: input.userId, idempotencyKey: input.idempotencyKey } });
        if (existing) return existing.habitId === input.habitId && existing.minutes === input.minutes && existing.progressDate.getTime() === input.date.getTime()
          ? { status: 'ok', value: progressView(existing), replayed: true }
          : { status: 'idempotency-conflict' };
      }
      throw error;
    }
  }

  async listProgress(userId: string, habitId: string): Promise<HabitMutation<HabitProgressView[]>> {
    if (!(await this.prisma.habit.findFirst({ where: { id: habitId, userId } }))) return { status: 'not-found' };
    const entries = await this.prisma.habitProgressEntry.findMany({ where: { userId, habitId }, orderBy: { createdAt: 'desc' }, take: 200 });
    return { status: 'ok', value: entries.map(progressView) };
  }
}

function habitView(habit: Habit, todayMinutes: number): HabitView {
  return { id: habit.id, name: habit.name, targetMinutes: habit.targetMinutes, forceEnabled: habit.forceEnabled,
    triggerTime: habit.triggerTime, status: habit.status, version: habit.version, todayMinutes, updatedAt: habit.updatedAt };
}
function progressView(entry: HabitProgressEntry): HabitProgressView {
  return { id: entry.id, habitId: entry.habitId, minutes: entry.minutes, progressDate: entry.progressDate, createdAt: entry.createdAt };
}
function isUnique(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'; }
