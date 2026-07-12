import { ConflictException, Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import type { CreateTaskDto } from './dto/create-task.dto';
import type { FinishSessionDto } from './dto/finish-session.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';
import { DuplicateCategoryError, TASK_FOCUS_REPOSITORY, TaskIdentityConflictError, type MutationResult, type TaskFocusRepository } from './task-focus.repository';
import type { SessionView, TaskView } from './task-focus.types';
import { ScoringService } from '../scoring/scoring.service';
import { FamilyService } from '../family/family.service';

@Injectable()
export class TaskFocusService {
  constructor(@Inject(TASK_FOCUS_REPOSITORY) private readonly repository: TaskFocusRepository, private readonly scoring: ScoringService, private readonly family: FamilyService) {}

  listCategories(userId: string) { return this.repository.listCategories(userId); }
  async createCategory(userId: string, name: string, color?: string) {
    try {
      return await this.repository.createCategory(userId, name.trim(), color?.trim() || null);
    } catch (error) {
      if (error instanceof DuplicateCategoryError) throw new ConflictException({ code: 'CATEGORY_EXISTS', message: '分类名称已存在' });
      throw error;
    }
  }
  listTasks(userId: string) { return this.repository.listTasks(userId); }

  async getTask(userId: string, id: string) {
    const task = await this.repository.getTask(userId, id);
    if (!task) throw notFound();
    return task;
  }

  async createTask(userId: string, input: CreateTaskDto) {
    if (input.taskType === 'goal' && (!input.deadlineAt || !input.targetAmount || !input.targetUnit)) {
      throw new BadRequestException({ code: 'GOAL_FIELDS_REQUIRED', message: '定目标任务需要截止日期、目标量和单位' });
    }
    if (input.categoryId && !(await this.repository.getCategory(userId, input.categoryId))) throw notFound();
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
      });
    } catch (error) {
      if (error instanceof TaskIdentityConflictError) throw new ConflictException({ code: 'TASK_IDENTITY_CONFLICT', message: '客户端任务 ID 已用于其他内容' });
      throw error;
    }
  }

  async updateTask(userId: string, id: string, input: UpdateTaskDto) {
    if ((await this.getTask(userId, id)).createdByFamilyMemberId) throw new ConflictException({ code: 'FAMILY_TASK_CHANGE_REQUEST_REQUIRED', message: '家长下发任务只能提交修改申请' });
    const { version, ...patch } = input;
    if (patch.categoryId && !(await this.repository.getCategory(userId, patch.categoryId))) throw notFound();
    return unwrap(await this.repository.updateTask(userId, id, version, {
      ...patch,
      deadlineAt: patch.deadlineAt === undefined ? undefined : patch.deadlineAt ? new Date(patch.deadlineAt) : null,
    }));
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

  async startSession(userId: string, taskId: string, mode: 'focus' | 'lock', key: string, trustLevel: SessionView['trustLevel'], sessionId?: string, startedAt?: string, plannedMinutes?: number) {
    validateKey(key);
    return unwrap(await this.repository.startSession({ userId, taskId, mode, idempotencyKey: key, trustLevel,
      sessionId, startedAt: startedAt ? new Date(startedAt) : undefined, plannedMinutes }));
  }

  async finishSession(userId: string, sessionId: string, key: string, input: FinishSessionDto) {
    validateKey(key);
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
  throw new ConflictException({ code: 'SESSION_NOT_ACTIVE', message: '会话已结束或不可结束' });
}

function notFound() { return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: '资源不存在' }); }
function validateKey(key: string) {
  if (!key || key.length < 8 || key.length > 160) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: '请提供有效的 Idempotency-Key' });
}
