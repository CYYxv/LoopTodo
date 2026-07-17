import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Prisma, type FocusSession, type Task, type TaskCategory } from '@prisma/client';

import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { DuplicateCategoryError, TaskIdentityConflictError, type MutationResult, type TaskFocusRepository } from './task-focus.repository';
import type { CategoryView, SessionView, TaskCreate, TaskPatch, TaskView } from './task-focus.types';

@Injectable()
export class PrismaTaskFocusRepository implements TaskFocusRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(userId: string) {
    return (await this.prisma.taskCategory.findMany({ where: { userId, archived: false }, orderBy: { createdAt: 'asc' } })).map(categoryView);
  }

  async getCategory(userId: string, id: string) {
    const category = await this.prisma.taskCategory.findFirst({ where: { id, userId, archived: false } });
    return category ? categoryView(category) : null;
  }

  async createCategory(userId: string, id: string | undefined, name: string, color: string | null) {
    try {
      const archived = await this.prisma.taskCategory.findFirst({ where: { userId, name, archived: true } });
      if (archived && (!id || archived.id === id)) return categoryView(await this.prisma.taskCategory.update({ where: { id: archived.id }, data: { archived: false, color, version: { increment: 1 } } }));
      return categoryView(await this.prisma.taskCategory.create({ data: { id, userId, name, color } }));
    } catch (error) {
      if (isUniqueConflict(error)) {
        const existing = id ? await this.prisma.taskCategory.findFirst({ where: { id, userId } }) : null;
        if (existing && existing.name === name && existing.color === color) return categoryView(existing);
        throw new DuplicateCategoryError();
      }
      throw error;
    }
  }

  async updateCategory(userId: string, id: string, version: number, name: string, color: string | null): Promise<MutationResult<CategoryView>> {
    try {
      const result = await this.prisma.taskCategory.updateMany({ where: { id, userId, version, archived: false }, data: { name, color, version: { increment: 1 } } });
      if (result.count !== 1) return (await this.prisma.taskCategory.findFirst({ where: { id, userId, archived: false } })) ? { status: 'conflict' } : { status: 'not-found' };
      return { status: 'ok', value: categoryView(await this.prisma.taskCategory.findUniqueOrThrow({ where: { id } })) };
    } catch (error) {
      if (isUniqueConflict(error)) throw new DuplicateCategoryError();
      throw error;
    }
  }

  async archiveCategory(userId: string, id: string, version: number): Promise<MutationResult<CategoryView>> {
    return this.prisma.$transaction(async (transaction) => {
      const category = await transaction.taskCategory.findFirst({ where: { id, userId, archived: false } });
      if (!category) return { status: 'not-found' } as const;
      if (category.version !== version) return { status: 'conflict' } as const;
      await transaction.task.updateMany({ where: { userId, categoryId: id }, data: { categoryId: null, version: { increment: 1 } } });
      const archivedName = `${category.name.slice(0, 65)}#${category.id.slice(0, 8)}`;
      const archived = await transaction.taskCategory.update({ where: { id }, data: { name: archivedName, archived: true, version: { increment: 1 } } });
      return { status: 'ok', value: categoryView(archived) } as const;
    });
  }

  async listTasks(userId: string) {
    return (await this.prisma.task.findMany({ where: { userId, status: { not: 'archived' } }, orderBy: { createdAt: 'desc' } })).map(taskView);
  }

  async getTask(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, userId, status: { not: 'archived' } } });
    return task ? taskView(task) : null;
  }

  async createTask(userId: string, input: TaskCreate) {
    try {
      return taskView(await this.prisma.task.create({
        data: {
          id: input.id,
          userId,
          categoryId: input.categoryId,
          title: input.title,
          taskType: input.taskType,
          timerMode: input.timerMode,
          estimatedMinutes: input.estimatedMinutes,
          restMinutes: input.restMinutes,
          deadlineAt: input.deadlineAt,
          targetAmount: input.targetAmount,
          targetUnit: input.targetUnit,
          isTodayRequired: input.isTodayRequired,
          forcedTriggerTime: input.forcedTriggerTime,
        },
      }));
    } catch (error) {
      if (input.id && isUniqueConflict(error)) {
        const existing = await this.prisma.task.findFirst({ where: { id: input.id, userId } });
        if (existing) {
          if (sameTask(existing, input)) return taskView(existing);
          throw new TaskIdentityConflictError();
        }
      }
      throw error;
    }
  }

  async updateTask(userId: string, id: string, version: number, patch: TaskPatch): Promise<MutationResult<TaskView>> {
    const current = await this.prisma.task.findFirst({ where: { id, userId, status: { not: 'archived' } } });
    if (!current) return { status: 'not-found' };
    if (current.activeSessionId) return { status: 'already-active' };
    const result = await this.prisma.task.updateMany({
      where: { id, userId, version, activeSessionId: null, status: { not: 'archived' } },
      data: { ...patch, version: { increment: 1 } },
    });
    if (result.count !== 1) return { status: 'conflict' };
    return { status: 'ok', value: taskView(await this.prisma.task.findUniqueOrThrow({ where: { id } })) };
  }

  async archiveTask(userId: string, id: string, version: number): Promise<MutationResult<TaskView>> {
    const current = await this.prisma.task.findFirst({ where: { id, userId, status: { not: 'archived' } } });
    if (!current) return { status: 'not-found' };
    if (current.activeSessionId) return { status: 'already-active' };
    const result = await this.prisma.task.updateMany({
      where: { id, userId, version, activeSessionId: null },
      data: { status: 'archived', version: { increment: 1 } },
    });
    if (result.count !== 1) return { status: 'conflict' };
    return { status: 'ok', value: taskView(await this.prisma.task.findUniqueOrThrow({ where: { id } })) };
  }

  async addGoalProgress(input: Parameters<TaskFocusRepository['addGoalProgress']>[0]): Promise<MutationResult<TaskView>> {
    const replay = await this.prisma.taskProgressEntry.findFirst({ where: { userId: input.userId, idempotencyKey: input.idempotencyKey } });
    if (replay) {
      if (replay.taskId !== input.taskId || replay.amount.toNumber() !== input.amount) return { status: 'idempotency-conflict' };
      const task = await this.prisma.task.findFirst({ where: { id: input.taskId, userId: input.userId } });
      return task ? { status: 'ok', value: taskView(task), replayed: true } : { status: 'not-found' };
    }
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const task = await transaction.task.findFirst({ where: { id: input.taskId, userId: input.userId, status: { in: ['pending', 'failed'] } } });
        if (!task) return { status: 'not-found' } as const;
        if (task.taskType !== 'goal' || !task.targetAmount) return { status: 'not-found' } as const;
        if (task.activeSessionId) return { status: 'already-active' } as const;
        const nextAmount = Math.min(task.targetAmount.toNumber(), task.completedAmount.toNumber() + input.amount);
        const updated = await transaction.task.updateMany({ where: { id: task.id, userId: input.userId, version: input.version, activeSessionId: null },
          data: { completedAmount: nextAmount, status: nextAmount >= task.targetAmount.toNumber() ? 'completed' : 'pending', version: { increment: 1 } } });
        if (updated.count !== 1) return { status: 'conflict' } as const;
        await transaction.taskProgressEntry.create({ data: { userId: input.userId, taskId: task.id, amount: input.amount, idempotencyKey: input.idempotencyKey } });
        return { status: 'ok', value: taskView(await transaction.task.findUniqueOrThrow({ where: { id: task.id } })) } as const;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const existing = await this.prisma.taskProgressEntry.findFirst({ where: { userId: input.userId, idempotencyKey: input.idempotencyKey } });
        if (existing && existing.taskId === input.taskId && existing.amount.toNumber() === input.amount) {
          const task = await this.prisma.task.findFirst({ where: { id: input.taskId, userId: input.userId } });
          if (task) return { status: 'ok', value: taskView(task), replayed: true };
        }
        return { status: 'idempotency-conflict' };
      }
      throw error;
    }
  }

  async startSession(input: Parameters<TaskFocusRepository['startSession']>[0]): Promise<MutationResult<SessionView>> {
    const replay = await this.prisma.focusSession.findFirst({ where: { userId: input.userId, startIdempotencyKey: input.idempotencyKey } });
    if (replay) return replay.taskId === input.taskId && replay.mode === input.mode
      ? { status: 'ok', value: sessionView(replay), replayed: true }
      : { status: 'idempotency-conflict' };
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const task = await transaction.task.findFirst({ where: { id: input.taskId, userId: input.userId, status: { notIn: ['archived', 'completed'] } } });
        if (!task) return { status: 'not-found' } as const;
        if (task.activeSessionId) return { status: 'already-active' } as const;
        const sessionId = input.sessionId ?? randomUUID();
        const claimed = await transaction.task.updateMany({
          where: { id: task.id, userId: input.userId, version: task.version, activeSessionId: null },
          data: { status: 'active', activeSessionId: sessionId, version: { increment: 1 } },
        });
        if (claimed.count !== 1) return { status: 'already-active' } as const;
        const session = await transaction.focusSession.create({
          data: {
            id: sessionId,
            userId: input.userId,
            taskId: task.id,
            mode: input.mode,
            timerMode: task.timerMode,
            trustLevel: input.trustLevel,
            startedAt: input.startedAt ?? new Date(),
            plannedMinutes: input.plannedMinutes ?? task.estimatedMinutes,
            startIdempotencyKey: input.idempotencyKey,
          },
        });
        return { status: 'ok', value: sessionView(session) } as const;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const existing = await this.prisma.focusSession.findFirst({ where: { userId: input.userId, startIdempotencyKey: input.idempotencyKey } });
        if (existing) return existing.taskId === input.taskId && existing.mode === input.mode
          ? { status: 'ok', value: sessionView(existing), replayed: true }
          : { status: 'idempotency-conflict' };
      }
      throw error;
    }
  }

  async finishSession(input: Parameters<TaskFocusRepository['finishSession']>[0]): Promise<MutationResult<SessionView>> {
    const replay = await this.prisma.focusSession.findFirst({ where: { userId: input.userId, finishIdempotencyKey: input.idempotencyKey } });
    if (replay) return replay.id === input.sessionId && replay.outcome === input.outcome
      ? { status: 'ok', value: sessionView(replay), replayed: true }
      : { status: 'idempotency-conflict' };
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const session = await transaction.focusSession.findFirst({ where: { id: input.sessionId, userId: input.userId } });
        if (!session) return { status: 'not-found' } as const;
        if (session.endedAt) return { status: 'not-active' } as const;
        const task = await transaction.task.findFirst({ where: { id: session.taskId, userId: input.userId, activeSessionId: session.id } });
        if (!task) return { status: 'not-active' } as const;
        const endedAt = input.endedAt ?? new Date();
        const actualMinutes = input.actualMinutes ?? Math.max(0, Math.ceil((endedAt.getTime() - session.startedAt.getTime()) / 60_000));
        const updated = await transaction.focusSession.updateMany({
          where: { id: session.id, userId: input.userId, endedAt: null },
          data: { endedAt, actualMinutes, outcome: input.outcome, completionNote: input.completionNote,
            failureReasonType: input.failureReasonType, failureReasonText: input.failureReasonText,
            finishIdempotencyKey: input.idempotencyKey },
        });
        if (updated.count !== 1) return { status: 'not-active' } as const;
        const released = await transaction.task.updateMany({
          where: { id: session.taskId, userId: input.userId, activeSessionId: session.id },
          data: { activeSessionId: null, status: taskStatus(input.outcome), version: { increment: 1 } },
        });
        if (released.count !== 1) throw new ConcurrentSessionStateError();
        return { status: 'ok', value: sessionView(await transaction.focusSession.findUniqueOrThrow({ where: { id: session.id } })) } as const;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const existing = await this.prisma.focusSession.findFirst({ where: { userId: input.userId, finishIdempotencyKey: input.idempotencyKey } });
        if (existing) return existing.id === input.sessionId && existing.outcome === input.outcome
          ? { status: 'ok', value: sessionView(existing), replayed: true }
          : { status: 'idempotency-conflict' };
      }
      if (error instanceof ConcurrentSessionStateError) return { status: 'not-active' };
      throw error;
    }
  }

  async listSessions(userId: string) {
    return (await this.prisma.focusSession.findMany({ where: { userId }, orderBy: { startedAt: 'desc' }, take: 200 })).map(sessionView);
  }

  async sync(userId: string, since: Date) {
    const cursor = new Date();
    const [categories, tasks, sessions] = await Promise.all([
      this.prisma.taskCategory.findMany({ where: { userId, updatedAt: { gt: since, lte: cursor } }, orderBy: { updatedAt: 'asc' } }),
      this.prisma.task.findMany({ where: { userId, updatedAt: { gt: since, lte: cursor } }, orderBy: { updatedAt: 'asc' } }),
      this.prisma.focusSession.findMany({ where: { userId, updatedAt: { gt: since, lte: cursor } }, orderBy: { updatedAt: 'asc' } }),
    ]);
    return { categories: categories.map(categoryView), tasks: tasks.map(taskView), sessions: sessions.map(sessionView), cursor };
  }
}

class ConcurrentSessionStateError extends Error {}

function categoryView(category: TaskCategory): CategoryView {
  return { id: category.id, name: category.name, color: category.color, archived: category.archived, version: category.version, updatedAt: category.updatedAt };
}

function taskView(task: Task): TaskView {
  return { ...task, targetAmount: task.targetAmount?.toNumber() ?? null, completedAmount: task.completedAmount.toNumber() };
}

function sessionView(session: FocusSession): SessionView {
  return { id: session.id, taskId: session.taskId, mode: session.mode, timerMode: session.timerMode,
    trustLevel: session.trustLevel, startedAt: session.startedAt, endedAt: session.endedAt,
    plannedMinutes: session.plannedMinutes, actualMinutes: session.actualMinutes, outcome: session.outcome,
    completionNote: session.completionNote, failureReasonType: session.failureReasonType,
    failureReasonText: session.failureReasonText, updatedAt: session.updatedAt };
}

function taskStatus(outcome: NonNullable<SessionView['outcome']>) {
  if (outcome === 'completed') return 'completed' as const;
  if (outcome === 'cancelled') return 'pending' as const;
  return 'failed' as const;
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function sameTask(task: Task, input: TaskCreate) {
  return task.title === input.title && task.taskType === input.taskType && task.timerMode === input.timerMode &&
    task.estimatedMinutes === input.estimatedMinutes && task.restMinutes === input.restMinutes &&
    task.categoryId === input.categoryId && (task.deadlineAt?.getTime() ?? null) === (input.deadlineAt?.getTime() ?? null) &&
    (task.targetAmount?.toNumber() ?? null) === input.targetAmount && task.targetUnit === input.targetUnit &&
    task.isTodayRequired === input.isTodayRequired && task.forcedTriggerTime === input.forcedTriggerTime;
}
