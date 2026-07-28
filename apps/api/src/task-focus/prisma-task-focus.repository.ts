import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Prisma, type FocusSession, type Task, type TaskCategory, type WhitelistList } from '@prisma/client';
import { monthRangeUtc, remainingEmergencyExits } from './emergency-quota.policy';

import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { DuplicateCategoryError, DuplicateWhitelistListError, InvalidRestrictionSnapshotError, TaskIdentityConflictError, WhitelistListReferenceError, type MutationResult, type TaskFocusRepository } from './task-focus.repository';
import type { CategoryView, SessionView, TaskCreate, TaskPatch, TaskView, WhitelistListView, WhitelistSource } from './task-focus.types';

@Injectable()
export class PrismaTaskFocusRepository implements TaskFocusRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listWhitelistLists(userId: string) {
    await this.getDefaultWhitelistList(userId);
    return (await this.prisma.whitelistList.findMany({ where: { userId, archivedAt: null }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] })).map(whitelistListView);
  }

  async getWhitelistList(userId: string, id: string) {
    const list = await this.prisma.whitelistList.findFirst({ where: { id, userId, archivedAt: null } });
    return list ? whitelistListView(list) : null;
  }

  async getDefaultWhitelistList(userId: string) {
    const existing = await this.prisma.whitelistList.findFirst({ where: { userId, isDefault: true, archivedAt: null } });
    if (existing) return whitelistListView(existing);
    try {
      return whitelistListView(await this.prisma.whitelistList.create({ data: { userId, name: '默认白名单', packages: [], isDefault: true } }));
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const concurrent = await this.prisma.whitelistList.findFirst({ where: { userId, isDefault: true, archivedAt: null } });
      if (!concurrent) throw error;
      return whitelistListView(concurrent);
    }
  }

  async createWhitelistList(userId: string, input: Parameters<TaskFocusRepository['createWhitelistList']>[1], idempotencyKey: string): Promise<MutationResult<WhitelistListView>> {
    const fingerprint = whitelistMutationFingerprint('create', input);
    await this.getDefaultWhitelistList(userId);
    try {
      return await this.runWhitelistMutation(userId, idempotencyKey, fingerprint, async (transaction) => ({
        status: 'ok',
        value: whitelistListView(await transaction.whitelistList.create({ data: {
          id: input.id, userId, name: input.name, packages: input.packages,
        } })),
      }));
    } catch (error) {
      if (isUniqueConflict(error)) throw new DuplicateWhitelistListError();
      throw error;
    }
  }

  async updateWhitelistList(userId: string, id: string, version: number, patch: { name?: string; packages?: string[] }, idempotencyKey: string): Promise<MutationResult<WhitelistListView>> {
    const fingerprint = whitelistMutationFingerprint('update', { id, version, ...patch });
    try {
      return await this.runWhitelistMutation(userId, idempotencyKey, fingerprint, async (transaction) => {
        const result = await transaction.whitelistList.updateMany({
          where: { id, userId, version, archivedAt: null },
          data: { name: patch.name, packages: patch.packages, version: { increment: 1 } },
        });
        if (result.count !== 1) {
          const current = await transaction.whitelistList.findFirst({ where: { id, userId, archivedAt: null } });
          return current ? { status: 'conflict' } as const : { status: 'not-found' } as const;
        }
        return { status: 'ok', value: whitelistListView(await transaction.whitelistList.findUniqueOrThrow({ where: { id } })) } as const;
      });
    } catch (error) {
      if (isUniqueConflict(error)) throw new DuplicateWhitelistListError();
      throw error;
    }
  }

  async setDefaultWhitelistList(userId: string, id: string, version: number, idempotencyKey: string): Promise<MutationResult<WhitelistListView>> {
    const fingerprint = whitelistMutationFingerprint('set-default', { id, version });
    return this.runWhitelistMutation(userId, idempotencyKey, fingerprint, async (transaction) => {
      const list = await transaction.whitelistList.findFirst({ where: { id, userId, archivedAt: null } });
      if (!list) return { status: 'not-found' } as const;
      if (list.version !== version) return { status: 'conflict' } as const;
      await transaction.whitelistList.updateMany({
        where: { userId, isDefault: true, archivedAt: null, id: { not: id } },
        data: { isDefault: false, version: { increment: 1 } },
      });
      const updated = await transaction.whitelistList.update({ where: { id }, data: { isDefault: true, version: { increment: 1 } } });
      return { status: 'ok', value: whitelistListView(updated) } as const;
    });
  }

  async archiveWhitelistList(userId: string, id: string, version: number, replacementId: string | 'default' | undefined, idempotencyKey: string): Promise<MutationResult<WhitelistListView>> {
    const fingerprint = whitelistMutationFingerprint('archive', { id, version, replacementId: replacementId ?? null });
    return this.runWhitelistMutation(userId, idempotencyKey, fingerprint, async (transaction) => {
      const source = await transaction.whitelistList.findFirst({ where: { id, userId, archivedAt: null } });
      if (!source) return { status: 'not-found' } as const;
      if (source.version !== version) return { status: 'conflict' } as const;
      if (await transaction.whitelistList.count({ where: { userId, archivedAt: null } }) <= 1) return { status: 'last-list' } as const;

      const referencedTasks = await transaction.task.count({ where: { userId, whitelistListId: id } });
      const replacement = replacementId === 'default'
        ? await transaction.whitelistList.findFirst({ where: { userId, isDefault: true, archivedAt: null, id: { not: id } } })
        : replacementId
          ? await transaction.whitelistList.findFirst({ where: { id: replacementId, userId, archivedAt: null, NOT: { id } } })
          : null;
      if (replacementId && !replacement) return { status: 'not-found' } as const;
      if ((referencedTasks > 0 || source.isDefault) && !replacement) return { status: 'replacement-required' } as const;

      if (replacement) {
        if (referencedTasks > 0) {
          await transaction.task.updateMany({
            where: { userId, whitelistListId: id },
            data: { whitelistListId: replacement.id, version: { increment: 1 } },
          });
        }
        if (source.isDefault) {
          await transaction.whitelistList.updateMany({
            where: { userId, isDefault: true, archivedAt: null },
            data: { isDefault: false },
          });
          await transaction.whitelistList.update({ where: { id: replacement.id }, data: { isDefault: true, version: { increment: 1 } } });
        }
      }

      const archived = await transaction.whitelistList.update({
        where: { id }, data: { isDefault: false, archivedAt: new Date(), version: { increment: 1 } },
      });
      return { status: 'ok', value: whitelistListView(archived) } as const;
    });
  }

  private async runWhitelistMutation(
    userId: string,
    idempotencyKey: string,
    fingerprint: string,
    mutate: (transaction: Prisma.TransactionClient) => Promise<MutationResult<WhitelistListView>>,
  ): Promise<MutationResult<WhitelistListView>> {
    const replay = await this.whitelistMutationReplay(this.prisma, userId, idempotencyKey, fingerprint);
    if (replay) return replay;
    try {
      return await this.withSerializableRetry(async (transaction) => {
        const concurrentReplay = await this.whitelistMutationReplay(transaction, userId, idempotencyKey, fingerprint);
        if (concurrentReplay) return concurrentReplay;
        const result = await mutate(transaction);
        if (result.status === 'ok' && !result.replayed) {
          await rememberWhitelistMutation(transaction, userId, idempotencyKey, fingerprint, result.value);
        }
        return result;
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const concurrentReplay = await this.whitelistMutationReplay(this.prisma, userId, idempotencyKey, fingerprint);
        if (concurrentReplay) return concurrentReplay;
      }
      throw error;
    }
  }

  private async withSerializableRetry<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= SERIALIZABLE_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!isSerializationFailure(error) || attempt === SERIALIZABLE_TRANSACTION_ATTEMPTS) throw error;
      }
    }
    throw new Error('unreachable');
  }

  private async whitelistMutationReplay(client: unknown, userId: string, idempotencyKey: string, fingerprint: string): Promise<MutationResult<WhitelistListView> | null> {
    const delegate = whitelistMutationDelegate(client);
    if (!delegate) return null;
    const existing = await delegate.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
    if (!existing) return null;
    return existing.fingerprint === fingerprint
      ? { status: 'ok', value: whitelistMutationView(existing.response), replayed: true }
      : { status: 'idempotency-conflict' };
  }

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
      if (input.whitelistListId && !(await this.prisma.whitelistList.findFirst({ where: { id: input.whitelistListId, userId, archivedAt: null } }))) {
        throw new WhitelistListReferenceError();
      }
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
          restrictionMode: input.restrictionMode,
          whitelistMode: input.whitelistMode,
          whitelistListId: input.whitelistListId,
          whitelistPackages: input.whitelistPackages,
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
    if (patch.whitelistListId && !(await this.prisma.whitelistList.findFirst({ where: { id: patch.whitelistListId, userId, archivedAt: null } }))) {
      throw new WhitelistListReferenceError();
    }
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
    if (replay) return sameSessionStart(replay, input)
      ? { status: 'ok', value: sessionView(replay), replayed: true }
      : { status: 'idempotency-conflict' };
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const task = await transaction.task.findFirst({ where: { id: input.taskId, userId: input.userId, status: { notIn: ['archived', 'completed'] } } });
        if (!task) return { status: 'not-found' } as const;
        if (task.activeSessionId) return { status: 'already-active' } as const;
        const sessionId = input.sessionId ?? randomUUID();
        const restrictionMode = input.restrictionMode ?? (input.mode === 'lock' ? 'strict' : task.restrictionMode);
        const whitelistSource = input.whitelistSource?.trim() || restrictionSource(task, restrictionMode);
        const allowedPackagesSnapshot = input.allowedPackagesSnapshot ?? [];
        if (restrictionMode === 'whitelist') {
          if (whitelistSource === 'custom') {
            if (task.whitelistMode !== 'custom' || !isSubset(allowedPackagesSnapshot, task.whitelistPackages)) {
              throw new InvalidRestrictionSnapshotError();
            }
          } else if (whitelistSource.startsWith('list:')) {
            const listId = whitelistSource.slice('list:'.length);
            const list = await transaction.whitelistList.findFirst({ where: { id: listId, userId: input.userId, archivedAt: null } });
            if (!list || task.whitelistMode !== 'list' || task.whitelistListId !== list.id || !isSubset(allowedPackagesSnapshot, list.packages)) {
              throw new InvalidRestrictionSnapshotError();
            }
          } else {
            throw new InvalidRestrictionSnapshotError();
          }
        } else if (allowedPackagesSnapshot.length > 0 || whitelistSource !== restrictionMode) {
          throw new InvalidRestrictionSnapshotError();
        }
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
            restrictionMode,
            whitelistSource,
            whitelistPackageCount: allowedPackagesSnapshot.length,
            allowedPackagesSnapshot,
            restrictionEffective: input.restrictionEffective ?? restrictionMode === 'none',
            startIdempotencyKey: input.idempotencyKey,
          },
        });
        return { status: 'ok', value: sessionView(session) } as const;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const existing = await this.prisma.focusSession.findFirst({ where: { userId: input.userId, startIdempotencyKey: input.idempotencyKey } });
        if (existing) return sameSessionStart(existing, input)
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
        if (input.outcome === 'emergency_exit') {
          const { start, end } = monthRangeUtc();
          const used = await transaction.focusSession.count({
            where: { userId: input.userId, outcome: 'emergency_exit', endedAt: { gte: start, lt: end } },
          });
          if (remainingEmergencyExits(used) <= 0) return { status: 'quota-exhausted' } as const;
        }
        const now = new Date();
        const endedAt = input.endedAt ?? now;
        const endedAtMs = endedAt.getTime();
        const startedAtMs = session.startedAt.getTime();
        if (!Number.isFinite(endedAtMs) || endedAtMs < startedAtMs || endedAtMs > now.getTime() + MAX_END_CLOCK_SKEW_MS) {
          return { status: 'invalid-session-time' } as const;
        }
        const elapsedMinutes = Math.max(0, Math.floor((Math.min(endedAtMs, now.getTime()) - startedAtMs) / 60_000));
        const maximumMinutes = session.timerMode === 'countdown'
          ? Math.min(elapsedMinutes, session.plannedMinutes)
          : elapsedMinutes;
        const actualMinutes = boundedMinutes(input.actualMinutes, maximumMinutes);
        const effectiveMinutes = boundedMinutes(input.effectiveMinutes, actualMinutes);
        const restrictionEffective = session.restrictionEffective && input.restrictionEffective !== false;
        const updated = await transaction.focusSession.updateMany({
          where: { id: session.id, userId: input.userId, endedAt: null },
          data: { endedAt, actualMinutes, outcome: input.outcome, completionNote: input.completionNote,
            failureReasonType: input.failureReasonType, failureReasonText: input.failureReasonText,
            whitelistPackageCount: input.whitelistPackageCount ?? session.whitelistPackageCount,
            restrictionEffective,
            effectiveMinutes,
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

  async countEmergencyExits(userId: string, start: Date, end: Date) {
    return this.prisma.focusSession.count({
      where: { userId, outcome: 'emergency_exit', endedAt: { gte: start, lt: end } },
    });
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.focusSession.findFirst({ where: { id: sessionId, userId } });
    return session ? sessionView(session) : null;
  }

  async sync(userId: string, since: Date) {
    await this.getDefaultWhitelistList(userId);
    const cursor = new Date();
    const [categories, whitelistLists, tasks, sessions] = await Promise.all([
      this.prisma.taskCategory.findMany({ where: { userId, updatedAt: { gt: since, lte: cursor } }, orderBy: { updatedAt: 'asc' } }),
      this.prisma.whitelistList.findMany({ where: { userId, OR: [
        { updatedAt: { gt: since, lte: cursor } },
        { isDefault: true, archivedAt: null },
      ] }, orderBy: { updatedAt: 'asc' } }),
      this.prisma.task.findMany({ where: { userId, updatedAt: { gt: since, lte: cursor } }, orderBy: { updatedAt: 'asc' } }),
      this.prisma.focusSession.findMany({ where: { userId, updatedAt: { gt: since, lte: cursor } }, orderBy: { updatedAt: 'asc' } }),
    ]);
    return { categories: categories.map(categoryView), whitelistLists: whitelistLists.map(whitelistListView), tasks: tasks.map(taskView), sessions: sessions.map(sessionView), cursor };
  }
}

class ConcurrentSessionStateError extends Error {}

function categoryView(category: TaskCategory): CategoryView {
  return { id: category.id, name: category.name, color: category.color, archived: category.archived, version: category.version, updatedAt: category.updatedAt };
}

const MAX_END_CLOCK_SKEW_MS = 5 * 60_000;
const SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;

type WhitelistMutationRow = { fingerprint: string; response: Prisma.JsonValue };
type WhitelistMutationDelegate = {
  findUnique(args: { where: { userId_idempotencyKey: { userId: string; idempotencyKey: string } } }): Promise<WhitelistMutationRow | null>;
  create(args: { data: { userId: string; idempotencyKey: string; fingerprint: string; response: Prisma.InputJsonValue } }): Promise<unknown>;
};

function boundedMinutes(value: number | undefined, maximum: number) {
  if (value === undefined) return maximum;
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, Math.floor(value)), maximum);
}

function whitelistListView(list: WhitelistList): WhitelistListView {
  return {
    id: list.id,
    userId: list.userId,
    name: list.name,
    packages: list.packages,
    isDefault: list.isDefault,
    version: list.version,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    archivedAt: list.archivedAt,
  };
}

function whitelistMutationDelegate(client: unknown): WhitelistMutationDelegate | null {
  return (client as { whitelistMutation?: WhitelistMutationDelegate }).whitelistMutation ?? null;
}

async function rememberWhitelistMutation(client: unknown, userId: string, idempotencyKey: string, fingerprint: string, value: WhitelistListView) {
  const delegate = whitelistMutationDelegate(client);
  if (!delegate) return;
  await delegate.create({ data: { userId, idempotencyKey, fingerprint, response: whitelistMutationSnapshot(value) } });
}

function whitelistMutationSnapshot(value: WhitelistListView): Prisma.InputJsonObject {
  return {
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
    archivedAt: value.archivedAt?.toISOString() ?? null,
  };
}

function whitelistMutationView(value: Prisma.JsonValue): WhitelistListView {
  const snapshot = value as Record<string, unknown>;
  return {
    id: String(snapshot.id),
    userId: String(snapshot.userId),
    name: String(snapshot.name),
    packages: Array.isArray(snapshot.packages) ? snapshot.packages.map(String) : [],
    isDefault: Boolean(snapshot.isDefault),
    version: Number(snapshot.version),
    createdAt: new Date(String(snapshot.createdAt)),
    updatedAt: new Date(String(snapshot.updatedAt)),
    archivedAt: snapshot.archivedAt ? new Date(String(snapshot.archivedAt)) : null,
  };
}

function whitelistMutationFingerprint(operation: string, payload: object) {
  return createHash('sha256').update(JSON.stringify({ operation, payload })).digest('hex');
}

function taskView(task: Task): TaskView {
  return {
    ...task,
    targetAmount: task.targetAmount?.toNumber() ?? null,
    completedAmount: task.completedAmount.toNumber(),
  };
}

function sessionView(session: FocusSession): SessionView {
  return { id: session.id, taskId: session.taskId, mode: session.mode, timerMode: session.timerMode,
    trustLevel: session.trustLevel, startedAt: session.startedAt, endedAt: session.endedAt,
    plannedMinutes: session.plannedMinutes, actualMinutes: session.actualMinutes, outcome: session.outcome,
    restrictionMode: session.restrictionMode, whitelistSource: whitelistSourceView(session.whitelistSource),
    whitelistPackageCount: session.whitelistPackageCount, allowedPackagesSnapshot: session.allowedPackagesSnapshot,
    restrictionEffective: session.restrictionEffective,
    effectiveMinutes: session.effectiveMinutes,
    completionNote: session.completionNote, failureReasonType: session.failureReasonType,
    failureReasonText: session.failureReasonText, updatedAt: session.updatedAt };
}

function restrictionSource(task: Task, restrictionMode: SessionView['restrictionMode']) {
  if (restrictionMode !== 'whitelist') return restrictionMode;
  if (task.whitelistMode === 'custom') return 'custom';
  return task.whitelistListId ? `list:${task.whitelistListId}` : 'list:default';
}

function whitelistSourceView(value: string): WhitelistSource {
  if (value === 'none' || value === 'strict' || value === 'custom') return value;
  return value.startsWith('list:') && value.length > 5 ? value as `list:${string}` : 'none';
}

function taskStatus(outcome: NonNullable<SessionView['outcome']>) {
  if (outcome === 'completed') return 'completed' as const;
  if (outcome === 'cancelled') return 'pending' as const;
  return 'failed' as const;
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isSerializationFailure(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

function sameTask(task: Task, input: TaskCreate) {
  return task.title === input.title && task.taskType === input.taskType && task.timerMode === input.timerMode &&
    task.estimatedMinutes === input.estimatedMinutes && task.restMinutes === input.restMinutes &&
    task.categoryId === input.categoryId && (task.deadlineAt?.getTime() ?? null) === (input.deadlineAt?.getTime() ?? null) &&
    (task.targetAmount?.toNumber() ?? null) === input.targetAmount && task.targetUnit === input.targetUnit &&
    task.isTodayRequired === input.isTodayRequired && task.forcedTriggerTime === input.forcedTriggerTime &&
    task.restrictionMode === input.restrictionMode && task.whitelistMode === input.whitelistMode &&
    task.whitelistListId === input.whitelistListId &&
    JSON.stringify(task.whitelistPackages) === JSON.stringify(input.whitelistPackages);
}

function isSubset(values: string[], allowed: string[]) {
  const allowedSet = new Set(allowed);
  return values.every((value) => allowedSet.has(value));
}

function sameSessionStart(session: FocusSession, input: Parameters<TaskFocusRepository['startSession']>[0]) {
  return session.taskId === input.taskId && session.mode === input.mode &&
    (input.sessionId === undefined || session.id === input.sessionId) &&
    (input.restrictionMode === undefined || session.restrictionMode === input.restrictionMode) &&
    (input.whitelistSource === undefined || session.whitelistSource === input.whitelistSource) &&
    JSON.stringify(session.allowedPackagesSnapshot) === JSON.stringify(input.allowedPackagesSnapshot ?? []);
}
