import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import type { CreateTaskDto } from './dto/create-task.dto';
import type { CreateWhitelistListDto } from './dto/create-whitelist-list.dto';
import { emergencyYearMonth, monthRangeUtc, MONTHLY_EMERGENCY_EXIT_LIMIT, remainingEmergencyExits } from './emergency-quota.policy';
import type { FinishSessionDto } from './dto/finish-session.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';
import type { UpdateWhitelistListDto } from './dto/update-whitelist-list.dto';
import { DuplicateCategoryError, DuplicateWhitelistListError, InvalidRestrictionSnapshotError, TASK_FOCUS_REPOSITORY, TaskIdentityConflictError, WhitelistListReferenceError, type MutationResult, type TaskFocusRepository } from './task-focus.repository';
import type { SessionView, TaskPatch, TaskView } from './task-focus.types';
import { ScoringService } from '../scoring/scoring.service';
import { FamilyService } from '../family/family.service';

@Injectable()
export class TaskFocusService {
  constructor(@Inject(TASK_FOCUS_REPOSITORY) private readonly repository: TaskFocusRepository, private readonly scoring: ScoringService, private readonly family: FamilyService) {}

  listWhitelistLists(userId: string) { return this.repository.listWhitelistLists(userId); }

  async getWhitelistList(userId: string, id: string) {
    const list = await this.repository.getWhitelistList(userId, id);
    if (!list) throw whitelistListNotFound();
    return list;
  }

  async createWhitelistList(userId: string, input: CreateWhitelistListDto, key: string) {
    validateKey(key);
    try {
      return unwrap(await this.repository.createWhitelistList(userId, { id: input.id, name: input.name.trim(), packages: normalizePackages(input.packages) }, key));
    } catch (error) {
      if (error instanceof DuplicateWhitelistListError) throw new ConflictException({ code: 'WHITELIST_LIST_EXISTS', message: '白名单名称已存在' });
      throw error;
    }
  }

  async updateWhitelistList(userId: string, id: string, input: UpdateWhitelistListDto, key: string) {
    validateKey(key);
    try {
      return unwrap(await this.repository.updateWhitelistList(userId, id, input.version, {
        name: input.name?.trim(), packages: input.packages === undefined ? undefined : normalizePackages(input.packages),
      }, key));
    } catch (error) {
      if (error instanceof DuplicateWhitelistListError) throw new ConflictException({ code: 'WHITELIST_LIST_EXISTS', message: '白名单名称已存在' });
      throw error;
    }
  }

  setDefaultWhitelistList(userId: string, id: string, version: number, key: string) {
    validateKey(key);
    return this.repository.setDefaultWhitelistList(userId, id, version, key).then(unwrapWhitelistMutation);
  }

  archiveWhitelistList(userId: string, id: string, version: number, replacementId: string | undefined, key: string) {
    validateKey(key);
    return this.repository.archiveWhitelistList(userId, id, version, replacementId as string | 'default' | undefined, key).then(unwrapWhitelistMutation);
  }

  listCategories(userId: string) { return this.repository.listCategories(userId); }
  async createCategory(userId: string, id: string | undefined, name: string, color?: string) {
    try {
      return await this.repository.createCategory(userId, id, name.trim(), color?.trim() || null);
    } catch (error) {
      if (error instanceof DuplicateCategoryError) throw new ConflictException({ code: 'CATEGORY_EXISTS', message: '分类名称已存在' });
      throw error;
    }
  }
  async updateCategory(userId: string, id: string, version: number, name: string, color?: string | null) {
    try {
      return unwrap(await this.repository.updateCategory(userId, id, version, name.trim(), color?.trim() || null));
    } catch (error) {
      if (error instanceof DuplicateCategoryError) throw new ConflictException({ code: 'CATEGORY_EXISTS', message: '分类名称已存在' });
      throw error;
    }
  }
  archiveCategory(userId: string, id: string, version: number) {
    return this.repository.archiveCategory(userId, id, version).then(unwrap);
  }
  listTasks(userId: string) { return this.repository.listTasks(userId); }

  async getTask(userId: string, id: string) {
    const task = await this.repository.getTask(userId, id);
    if (!task) throw notFound();
    return task;
  }

  async createTask(userId: string, input: CreateTaskDto) {
    if (input.taskType === 'goal' && (input.timerMode !== 'countdown' || !input.deadlineAt || !input.targetAmount || !input.targetUnit?.trim())) {
      throw new BadRequestException({ code: 'GOAL_FIELDS_REQUIRED', message: '定目标任务需要截止日期、目标量和单位' });
    }
    if (input.categoryId && !(await this.repository.getCategory(userId, input.categoryId))) throw notFound();
    if (input.isTodayRequired && !input.forcedTriggerTime) {
      throw new BadRequestException({ code: 'FORCED_TRIGGER_TIME_REQUIRED', message: '今日必须任务需要触发时间' });
    }
    const restriction = await resolveTaskRestriction(this.repository, userId, input);
    try {
      return await this.repository.createTask(userId, {
        id: input.id,
        categoryId: input.categoryId ?? null,
        title: input.title.trim(),
        taskType: input.taskType,
        timerMode: input.timerMode,
        estimatedMinutes: input.estimatedMinutes,
        restMinutes: input.restMinutes,
        deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : null,
        targetAmount: input.targetAmount ?? null,
        targetUnit: input.targetUnit?.trim() || null,
        isTodayRequired: input.isTodayRequired,
        forcedTriggerTime: input.isTodayRequired ? input.forcedTriggerTime ?? null : null,
        ...restriction,
      });
    } catch (error) {
      if (error instanceof TaskIdentityConflictError) throw new ConflictException({ code: 'TASK_IDENTITY_CONFLICT', message: '客户端任务 ID 已用于其他内容' });
      if (error instanceof WhitelistListReferenceError) throw whitelistListNotFound();
      throw error;
    }
  }

  async updateTask(userId: string, id: string, input: UpdateTaskDto) {
    const current = await this.getTask(userId, id);
    if (current.createdByFamilyMemberId) throw new ConflictException({ code: 'FAMILY_TASK_CHANGE_REQUEST_REQUIRED', message: '家长下发任务只能提交修改申请' });
    const { version, restrictionMode, whitelistMode, whitelistListId, whitelistPackages, ...patch } = input;
    if (patch.categoryId && !(await this.repository.getCategory(userId, patch.categoryId))) throw notFound();
    const nextRequired = patch.isTodayRequired ?? current.isTodayRequired;
    const nextTriggerTime = nextRequired
      ? patch.forcedTriggerTime === undefined ? current.forcedTriggerTime : patch.forcedTriggerTime
      : null;
    const restrictionTouched = restrictionMode !== undefined || whitelistMode !== undefined || whitelistListId !== undefined || whitelistPackages !== undefined;
    const restriction = restrictionTouched
      ? await resolveTaskRestriction(this.repository, userId, { restrictionMode, whitelistMode, whitelistListId, whitelistPackages }, current)
      : {};
    const normalized = definedTaskPatch({
      ...patch,
      title: patch.title?.trim(),
      targetUnit: patch.targetUnit === undefined ? undefined : patch.targetUnit?.trim() || null,
      forcedTriggerTime: nextTriggerTime,
      deadlineAt: patch.deadlineAt === undefined ? undefined : patch.deadlineAt ? new Date(patch.deadlineAt) : null,
      ...restriction,
    });
    if (nextRequired && !nextTriggerTime) {
      throw new BadRequestException({ code: 'FORCED_TRIGGER_TIME_REQUIRED', message: '今日必须任务需要触发时间' });
    }
    if (current.taskType === 'goal') {
      const timerMode = normalized.timerMode ?? current.timerMode;
      const deadlineAt = normalized.deadlineAt === undefined ? current.deadlineAt : normalized.deadlineAt;
      const targetAmount = normalized.targetAmount === undefined ? current.targetAmount : normalized.targetAmount;
      const targetUnit = normalized.targetUnit === undefined ? current.targetUnit : normalized.targetUnit;
      if (timerMode !== 'countdown' || !deadlineAt || !targetAmount || !targetUnit) {
        throw new BadRequestException({ code: 'GOAL_FIELDS_REQUIRED', message: '定目标任务需要倒计时、截止日期、目标量和单位' });
      }
      if (targetAmount < current.completedAmount) {
        throw new BadRequestException({ code: 'GOAL_TARGET_BELOW_PROGRESS', message: '目标量不能小于已完成量' });
      }
      normalized.status = current.completedAmount >= targetAmount ? 'completed' : 'pending';
    }
    if (current.version === version + 1 && taskMatchesPatch(current, normalized)) return current;
    try {
      return unwrap(await this.repository.updateTask(userId, id, version, normalized));
    } catch (error) {
      if (error instanceof WhitelistListReferenceError) throw whitelistListNotFound();
      throw error;
    }
  }

  async archiveTask(userId: string, id: string, version: number) {
    if ((await this.getTask(userId, id)).createdByFamilyMemberId) throw new ConflictException({ code: 'FAMILY_TASK_CHANGE_REQUEST_REQUIRED', message: '家长下发任务只能提交删除申请' });
    return unwrap(await this.repository.archiveTask(userId, id, version));
  }

  async completeTask(userId: string, id: string, version: number) {
    const task = await this.getTask(userId, id);
    if (task.taskType === 'goal' && task.completedAmount < (task.targetAmount ?? Number.POSITIVE_INFINITY)) {
      throw new BadRequestException({ code: 'GOAL_NOT_REACHED', message: '目标完成量尚未达到' });
    }
    return unwrap(await this.repository.updateTask(userId, id, version, { status: 'completed' }));
  }

  async addGoalProgress(userId: string, id: string, version: number, amount: number, key: string) {
    validateKey(key);
    return unwrap(await this.repository.addGoalProgress({ userId, taskId: id, version, amount, idempotencyKey: key }));
  }

  async startSession(userId: string, taskId: string, mode: 'focus' | 'lock', key: string, trustLevel: SessionView['trustLevel'],
    sessionId?: string, startedAt?: string, plannedMinutes?: number, restrictionMode?: SessionView['restrictionMode'],
    whitelistSource?: SessionView['whitelistSource'], restrictionEffective?: boolean, allowedPackagesSnapshot?: string[]) {
    validateKey(key);
    try {
      return unwrap(await this.repository.startSession({ userId, taskId, mode, idempotencyKey: key, trustLevel,
        sessionId, startedAt: startedAt ? new Date(startedAt) : undefined, plannedMinutes, restrictionMode,
        whitelistSource, restrictionEffective, allowedPackagesSnapshot: normalizePackages(allowedPackagesSnapshot ?? []) }));
    } catch (error) {
      if (error instanceof InvalidRestrictionSnapshotError) {
        throw new BadRequestException({ code: 'INVALID_RESTRICTION_SNAPSHOT', message: '软件白名单快照与任务配置不一致' });
      }
      throw error;
    }
  }

  async emergencyQuota(userId: string) {
    const { start, end } = monthRangeUtc();
    const used = await this.repository.countEmergencyExits(userId, start, end);
    const remaining = remainingEmergencyExits(used);
    return {
      yearMonth: emergencyYearMonth(),
      limit: MONTHLY_EMERGENCY_EXIT_LIMIT,
      used,
      remaining,
    };
  }

  async finishSession(userId: string, sessionId: string, key: string, input: FinishSessionDto) {
    validateKey(key);
    // Quota is enforced inside the serializable finish transaction to avoid concurrent over-use.
    const session = unwrap(await this.repository.finishSession({
      userId,
      sessionId,
      idempotencyKey: key,
      outcome: input.outcome,
      completionNote: input.completionNote?.trim() || null,
      failureReasonType: input.failureReasonType?.trim() || null,
      failureReasonText: input.failureReasonText?.trim() || null,
      endedAt: input.endedAt ? new Date(input.endedAt) : undefined,
      actualMinutes: input.actualMinutes,
      whitelistPackageCount: input.whitelistPackageCount,
      restrictionEffective: input.restrictionEffective,
      effectiveMinutes: input.effectiveMinutes,
    }));
    await this.scoring.settleSession(userId, session.id);
    await this.family.handleSessionFinished(userId, session);
    return session;
  }

  listSessions(userId: string) { return this.repository.listSessions(userId); }

  sync(userId: string, since?: string) {
    const parsed = since ? new Date(since) : new Date(0);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException({ code: 'INVALID_SYNC_CURSOR', message: '同步游标无效' });
    return this.repository.sync(userId, parsed);
  }
}

function unwrap<T>(result: MutationResult<T>): T {
  if (result.status === 'ok') return result.value;
  if (result.status === 'not-found') throw notFound();
  if (result.status === 'conflict') throw new ConflictException({ code: 'VERSION_CONFLICT', message: '数据已更新，请刷新后重试' });
  if (result.status === 'idempotency-conflict') throw new ConflictException({ code: 'IDEMPOTENCY_KEY_CONFLICT', message: 'Idempotency-Key 已用于其他操作' });
  if (result.status === 'already-active') throw new ConflictException({ code: 'TASK_ALREADY_ACTIVE', message: '任务已有进行中的会话' });
  if (result.status === 'invalid-session-time') throw new BadRequestException({ code: 'INVALID_SESSION_TIME', message: '会话结束时间无效' });
  if (result.status === 'quota-exhausted') throw new ForbiddenException({ code: 'EMERGENCY_QUOTA_EXHAUSTED', message: '本月紧急退出次数已用完' });
  if (result.status === 'replacement-required') throw new ConflictException({ code: 'WHITELIST_REPLACEMENT_REQUIRED', message: '被任务引用或默认白名单归档时必须指定替代名单' });
  if (result.status === 'last-list') throw new ConflictException({ code: 'LAST_WHITELIST_LIST_REQUIRED', message: '每个用户至少需要一个白名单' });
  throw new ConflictException({ code: 'SESSION_NOT_ACTIVE', message: '会话已结束或不可结束' });
}

function unwrapWhitelistMutation<T>(result: MutationResult<T>) {
  if (result.status === 'not-found') throw whitelistListNotFound();
  return unwrap(result);
}

function notFound() { return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: '资源不存在' }); }
function whitelistListNotFound() { return new NotFoundException({ code: 'WHITELIST_LIST_NOT_FOUND', message: '白名单不存在' }); }
function validateKey(key: string) {
  if (!key || key.length < 8 || key.length > 160) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: '请提供有效的 Idempotency-Key' });
}

function definedTaskPatch(patch: TaskPatch): TaskPatch {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as TaskPatch;
}

function taskMatchesPatch(task: TaskView, patch: Parameters<TaskFocusRepository['updateTask']>[3]) {
  if (patch.title !== undefined && task.title !== patch.title) return false;
  if (patch.categoryId !== undefined && task.categoryId !== patch.categoryId) return false;
  if (patch.timerMode !== undefined && task.timerMode !== patch.timerMode) return false;
  if (patch.estimatedMinutes !== undefined && task.estimatedMinutes !== patch.estimatedMinutes) return false;
  if (patch.restMinutes !== undefined && task.restMinutes !== patch.restMinutes) return false;
  if (patch.deadlineAt !== undefined && (task.deadlineAt?.getTime() ?? null) !== (patch.deadlineAt?.getTime() ?? null)) return false;
  if (patch.targetAmount !== undefined && task.targetAmount !== patch.targetAmount) return false;
  if (patch.targetUnit !== undefined && task.targetUnit !== patch.targetUnit) return false;
  if (patch.isTodayRequired !== undefined && task.isTodayRequired !== patch.isTodayRequired) return false;
  if (patch.forcedTriggerTime !== undefined && task.forcedTriggerTime !== patch.forcedTriggerTime) return false;
  if (patch.status !== undefined && task.status !== patch.status) return false;
  if (patch.restrictionMode !== undefined && task.restrictionMode !== patch.restrictionMode) return false;
  if (patch.whitelistMode !== undefined && task.whitelistMode !== patch.whitelistMode) return false;
  if (patch.whitelistListId !== undefined && task.whitelistListId !== patch.whitelistListId) return false;
  if (patch.whitelistPackages !== undefined && JSON.stringify(task.whitelistPackages) !== JSON.stringify(patch.whitelistPackages)) return false;
  return true;
}

function normalizePackages(packages: string[]) {
  return [...new Set(packages.map((value) => value.trim()).filter(Boolean))];
}

async function resolveTaskRestriction(
  repository: TaskFocusRepository,
  userId: string,
  input: {
    restrictionMode?: CreateTaskDto['restrictionMode'];
    whitelistMode?: CreateTaskDto['whitelistMode'];
    whitelistListId?: string | null;
    whitelistPackages?: string[];
  },
  current?: TaskView,
): Promise<Pick<TaskView, 'restrictionMode' | 'whitelistMode' | 'whitelistListId' | 'whitelistPackages'>> {
  const legacyMode = input.restrictionMode === undefined
    && (input.whitelistMode === 'inherit' || input.whitelistMode === 'custom');
  const restrictionMode = legacyMode ? 'whitelist' : input.restrictionMode ?? current?.restrictionMode ?? 'whitelist';
  const whitelistMode = input.whitelistMode === 'inherit'
    ? 'list'
    : input.whitelistMode ?? current?.whitelistMode ?? 'list';

  if (restrictionMode !== 'whitelist') {
    return { restrictionMode, whitelistMode, whitelistListId: null, whitelistPackages: [] };
  }
  if (whitelistMode === 'custom') {
    return {
      restrictionMode,
      whitelistMode,
      whitelistListId: null,
      whitelistPackages: normalizePackages(input.whitelistPackages ?? (current?.whitelistMode === 'custom' ? current.whitelistPackages : [])),
    };
  }

  const requestedListId = input.whitelistMode === 'inherit'
    ? (await repository.getDefaultWhitelistList(userId)).id
    : input.whitelistListId === undefined ? current?.whitelistListId : input.whitelistListId;
  const list = requestedListId
    ? await repository.getWhitelistList(userId, requestedListId)
    : await repository.getDefaultWhitelistList(userId);
  if (!list) throw whitelistListNotFound();
  return { restrictionMode, whitelistMode: 'list', whitelistListId: list.id, whitelistPackages: [] };
}
