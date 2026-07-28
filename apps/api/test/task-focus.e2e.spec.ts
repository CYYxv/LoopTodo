import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AUTH_RATE_LIMITER } from '../src/auth/auth-rate-limiter';
import { AUTH_REPOSITORY, type AuthRepository } from '../src/auth/auth.repository';
import { TokenService } from '../src/auth/token.service';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { ApiResponseInterceptor } from '../src/common/api-response.interceptor';
import { DuplicateCategoryError, TASK_FOCUS_REPOSITORY, TaskIdentityConflictError, type MutationResult, type TaskFocusRepository } from '../src/task-focus/task-focus.repository';
import { TaskFocusModule } from '../src/task-focus/task-focus.module';
import type { CategoryView, SessionView, TaskCreate, TaskPatch, TaskView } from '../src/task-focus/task-focus.types';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { ScoringService } from '../src/scoring/scoring.service';
import { FamilyService } from '../src/family/family.service';

type MemoryWhitelistList = {
  id: string;
  userId: string;
  name: string;
  packages: string[];
  isDefault: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

class MemoryTaskFocusRepository implements TaskFocusRepository {
  categories: Array<CategoryView & { userId: string }> = [];
  tasks: Array<TaskView & { userId: string }> = [];
  sessions: Array<SessionView & { userId: string; startKey: string; finishKey: string | null }> = [];
  whitelistLists: MemoryWhitelistList[] = [];
  private readonly whitelistMutations = new Map<string, { signature: string; response: MemoryWhitelistList }>();

  private whitelistReplay(userId: string, key: string, signature: string) {
    const mutation = this.whitelistMutations.get(`${userId}:${key}`);
    if (!mutation) return null;
    if (mutation.signature !== signature) return { status: 'idempotency-conflict' } as const;
    return { status: 'ok', value: cloneWhitelistList(mutation.response), replayed: true } as const;
  }

  private rememberWhitelistMutation(userId: string, key: string, signature: string, response: MemoryWhitelistList) {
    this.whitelistMutations.set(`${userId}:${key}`, { signature, response: cloneWhitelistList(response) });
  }

  private ensureDefaultWhitelistList(userId: string) {
    const existing = this.whitelistLists.find((item) => item.userId === userId && item.isDefault && !item.archivedAt);
    if (existing) return existing;
    const now = new Date();
    const value = { id: randomUUID(), userId, name: '默认白名单', packages: [], isDefault: true, version: 1, createdAt: now, updatedAt: now, archivedAt: null };
    this.whitelistLists.push(value);
    return value;
  }

  async listWhitelistLists(userId: string) {
    this.ensureDefaultWhitelistList(userId);
    return this.whitelistLists.filter((item) => item.userId === userId && !item.archivedAt);
  }
  async getWhitelistList(userId: string, id: string) {
    return this.whitelistLists.find((item) => item.userId === userId && item.id === id && !item.archivedAt) ?? null;
  }
  async getDefaultWhitelistList(userId: string) { return this.ensureDefaultWhitelistList(userId); }
  async createWhitelistList(userId: string, input: { id?: string; name: string; packages: string[] }, key: string) {
    const signature = JSON.stringify({ operation: 'create', input });
    const replay = this.whitelistReplay(userId, key, signature);
    if (replay) return replay;
    const now = new Date();
    const value = { id: input.id ?? randomUUID(), userId, name: input.name, packages: input.packages, isDefault: false, version: 1, createdAt: now, updatedAt: now, archivedAt: null };
    this.whitelistLists.push(value);
    this.rememberWhitelistMutation(userId, key, signature, value);
    return { status: 'ok', value } as const;
  }
  async updateWhitelistList(userId: string, id: string, version: number, patch: { name?: string; packages?: string[] }, key: string) {
    const signature = JSON.stringify({ operation: 'update', id, version, patch });
    const replay = this.whitelistReplay(userId, key, signature);
    if (replay) return replay;
    const list = await this.getWhitelistList(userId, id);
    if (!list) return { status: 'not-found' } as const;
    if (list.version !== version) return { status: 'conflict' } as const;
    Object.assign(list, patch, { version: list.version + 1, updatedAt: new Date() });
    this.rememberWhitelistMutation(userId, key, signature, list);
    return { status: 'ok', value: list } as const;
  }
  async setDefaultWhitelistList(userId: string, id: string, version: number, key: string) {
    const signature = JSON.stringify({ operation: 'set-default', id, version });
    const replay = this.whitelistReplay(userId, key, signature);
    if (replay) return replay;
    const list = await this.getWhitelistList(userId, id);
    if (!list) return { status: 'not-found' } as const;
    if (list.version !== version) return { status: 'conflict' } as const;
    this.whitelistLists.filter((item) => item.userId === userId && item.isDefault && !item.archivedAt).forEach((item) => {
      item.isDefault = false;
      item.version += 1;
      item.updatedAt = new Date();
    });
    list.isDefault = true;
    list.version += 1;
    list.updatedAt = new Date();
    this.rememberWhitelistMutation(userId, key, signature, list);
    return { status: 'ok', value: list } as const;
  }
  async archiveWhitelistList(userId: string, id: string, version: number, replacementId: string | 'default' | undefined, key: string) {
    const signature = JSON.stringify({ operation: 'archive', id, version, replacementId: replacementId ?? null });
    const replay = this.whitelistReplay(userId, key, signature);
    if (replay) return replay;
    const list = await this.getWhitelistList(userId, id);
    if (!list) return { status: 'not-found' } as const;
    if (list.version !== version) return { status: 'conflict' } as const;
    const referenced = this.tasks.filter((item) => item.userId === userId && (item as TaskView & { whitelistListId?: string | null }).whitelistListId === id);
    let replacement = replacementId === 'default' ? this.ensureDefaultWhitelistList(userId) : replacementId ? await this.getWhitelistList(userId, replacementId) : null;
    if (replacement?.id === id) replacement = null;
    if (referenced.length && !replacement) return { status: 'replacement-required' } as const;
    const remaining = this.whitelistLists.filter((item) => item.userId === userId && !item.archivedAt && item.id !== id);
    if (!remaining.length) return { status: 'last-list' } as const;
    if (list.isDefault && !replacement) return { status: 'replacement-required' } as const;
    if (replacement) {
      referenced.forEach((task) => Object.assign(task, { whitelistListId: replacement.id, version: task.version + 1, updatedAt: new Date() }));
      if (list.isDefault) {
        replacement.isDefault = true;
        replacement.version += 1;
        replacement.updatedAt = new Date();
      }
    }
    list.isDefault = false;
    list.archivedAt = new Date();
    list.version += 1;
    list.updatedAt = new Date();
    this.rememberWhitelistMutation(userId, key, signature, list);
    return { status: 'ok', value: list } as const;
  }

  async listCategories(userId: string) { return this.categories.filter((item) => item.userId === userId && !item.archived); }
  async getCategory(userId: string, id: string) { return this.categories.find((item) => item.userId === userId && item.id === id && !item.archived) ?? null; }
  async createCategory(userId: string, id: string | undefined, name: string, color: string | null) {
    if (this.categories.some((item) => item.userId === userId && item.name === name)) throw new DuplicateCategoryError();
    const value = { id: id ?? randomUUID(), userId, name, color, archived: false, version: 1, updatedAt: new Date() };
    this.categories.push(value);
    return value;
  }
  async updateCategory(userId: string, id: string, version: number, name: string, color: string | null): Promise<MutationResult<CategoryView>> {
    const category = this.categories.find((item) => item.userId === userId && item.id === id && !item.archived);
    if (!category) return { status: 'not-found' };
    if (category.version !== version) return { status: 'conflict' };
    if (this.categories.some((item) => item.userId === userId && item.id !== id && item.name === name && !item.archived)) throw new DuplicateCategoryError();
    Object.assign(category, { name, color, version: category.version + 1, updatedAt: new Date() });
    return { status: 'ok', value: category };
  }
  async archiveCategory(userId: string, id: string, version: number): Promise<MutationResult<CategoryView>> {
    const category = this.categories.find((item) => item.userId === userId && item.id === id && !item.archived);
    if (!category) return { status: 'not-found' };
    if (category.version !== version) return { status: 'conflict' };
    Object.assign(category, { name: `${category.name}#archived`, archived: true, version: category.version + 1, updatedAt: new Date() });
    this.tasks.filter((item) => item.userId === userId && item.categoryId === id).forEach((item) => { item.categoryId = null; item.version += 1; item.updatedAt = new Date(); });
    return { status: 'ok', value: category };
  }
  async listTasks(userId: string) { return this.tasks.filter((item) => item.userId === userId && item.status !== 'archived'); }
  async getTask(userId: string, id: string) { return this.tasks.find((item) => item.userId === userId && item.id === id && item.status !== 'archived') ?? null; }
  async createTask(userId: string, input: TaskCreate) {
    const existing = input.id ? this.tasks.find((item) => item.userId === userId && item.id === input.id) : null;
    if (existing) {
      if (existing.title === input.title) return existing;
      throw new TaskIdentityConflictError();
    }
    const value: TaskView & { userId: string } = { ...input, id: input.id ?? randomUUID(), userId, completedAmount: 0, status: 'pending', activeSessionId: null, createdByFamilyMemberId: null, version: 1, updatedAt: new Date() };
    this.tasks.push(value);
    return value;
  }
  async updateTask(userId: string, id: string, version: number, patch: TaskPatch): Promise<MutationResult<TaskView>> {
    const task = this.tasks.find((item) => item.userId === userId && item.id === id && item.status !== 'archived');
    if (!task) return { status: 'not-found' };
    if (task.activeSessionId) return { status: 'already-active' };
    if (task.version !== version) return { status: 'conflict' };
    Object.assign(task, patch, { version: task.version + 1, updatedAt: new Date() });
    return { status: 'ok', value: task };
  }
  async archiveTask(userId: string, id: string, version: number): Promise<MutationResult<TaskView>> {
    const task = this.tasks.find((item) => item.userId === userId && item.id === id && item.status !== 'archived');
    if (!task) return { status: 'not-found' };
    if (task.activeSessionId) return { status: 'already-active' };
    if (task.version !== version) return { status: 'conflict' };
    Object.assign(task, { status: 'archived', version: task.version + 1, updatedAt: new Date() });
    return { status: 'ok', value: task };
  }
  async addGoalProgress(input: Parameters<TaskFocusRepository['addGoalProgress']>[0]): Promise<MutationResult<TaskView>> {
    const task = this.tasks.find((item) => item.userId === input.userId && item.id === input.taskId && item.taskType === 'goal');
    if (!task) return { status: 'not-found' };
    if (task.activeSessionId) return { status: 'already-active' };
    if (task.version !== input.version) return { status: 'conflict' };
    task.completedAmount = Math.min(task.targetAmount ?? 0, task.completedAmount + input.amount);
    task.status = task.completedAmount >= (task.targetAmount ?? Number.POSITIVE_INFINITY) ? 'completed' : 'pending';
    task.version += 1;
    task.updatedAt = new Date();
    return { status: 'ok', value: task };
  }
  async startSession(input: Parameters<TaskFocusRepository['startSession']>[0]): Promise<MutationResult<SessionView>> {
    const replay = this.sessions.find((item) => item.userId === input.userId && item.startKey === input.idempotencyKey);
    if (replay) return replay.taskId === input.taskId && replay.mode === input.mode
      ? { status: 'ok', value: replay, replayed: true }
      : { status: 'idempotency-conflict' };
    const task = this.tasks.find((item) => item.userId === input.userId && item.id === input.taskId && item.status !== 'archived');
    if (!task) return { status: 'not-found' };
    if (task.activeSessionId) return { status: 'already-active' };
    const restrictionMode = input.restrictionMode ?? (input.mode === 'lock' ? 'strict' : task.restrictionMode);
    const whitelistSource = input.whitelistSource ?? (restrictionMode === 'whitelist'
      ? task.whitelistMode === 'custom' ? 'custom' : `list:${task.whitelistListId ?? 'default'}`
      : restrictionMode);
    const session: SessionView & { userId: string; startKey: string; finishKey: string | null } = {
      id: randomUUID(), userId: input.userId, taskId: task.id, mode: input.mode,
      timerMode: task.timerMode, trustLevel: input.trustLevel, startedAt: input.startedAt ?? new Date(), endedAt: null,
      plannedMinutes: input.plannedMinutes ?? task.estimatedMinutes, actualMinutes: null, outcome: null, completionNote: null,
      restrictionMode,
      whitelistSource,
      whitelistPackageCount: input.allowedPackagesSnapshot?.length ?? 0,
      allowedPackagesSnapshot: input.allowedPackagesSnapshot ?? [],
      restrictionEffective: input.restrictionEffective ?? restrictionMode === 'none',
      effectiveMinutes: 0,
      failureReasonType: null, failureReasonText: null, updatedAt: new Date(), startKey: input.idempotencyKey, finishKey: null,
    };
    this.sessions.push(session);
    Object.assign(task, { activeSessionId: session.id, status: 'active', version: task.version + 1, updatedAt: new Date() });
    return { status: 'ok', value: session };
  }
  async finishSession(input: Parameters<TaskFocusRepository['finishSession']>[0]): Promise<MutationResult<SessionView>> {
    const replay = this.sessions.find((item) => item.userId === input.userId && item.finishKey === input.idempotencyKey);
    if (replay) return replay.id === input.sessionId && replay.outcome === input.outcome
      ? { status: 'ok', value: replay, replayed: true }
      : { status: 'idempotency-conflict' };
    const session = this.sessions.find((item) => item.userId === input.userId && item.id === input.sessionId);
    if (!session) return { status: 'not-found' };
    if (session.endedAt) return { status: 'not-active' };
    const now = new Date();
    const endedAt = input.endedAt ?? now;
    if (endedAt < session.startedAt || endedAt.getTime() > now.getTime() + 5 * 60_000) return { status: 'invalid-session-time' };
    const elapsedMinutes = Math.max(0, Math.floor((Math.min(endedAt.getTime(), now.getTime()) - session.startedAt.getTime()) / 60_000));
    const maximumMinutes = session.timerMode === 'countdown' ? Math.min(elapsedMinutes, session.plannedMinutes) : elapsedMinutes;
    const actualMinutes = Math.min(Math.max(0, Math.floor(input.actualMinutes ?? maximumMinutes)), maximumMinutes);
    const effectiveMinutes = Math.min(Math.max(0, Math.floor(input.effectiveMinutes ?? actualMinutes)), actualMinutes);
    Object.assign(session, { endedAt, actualMinutes, outcome: input.outcome,
      completionNote: input.completionNote, failureReasonType: input.failureReasonType,
      failureReasonText: input.failureReasonText, whitelistPackageCount: input.whitelistPackageCount ?? session.whitelistPackageCount,
      restrictionEffective: session.restrictionEffective && input.restrictionEffective !== false,
      effectiveMinutes,
      finishKey: input.idempotencyKey, updatedAt: new Date() });
    const task = this.tasks.find((item) => item.id === session.taskId && item.userId === input.userId);
    if (task) Object.assign(task, { activeSessionId: null, status: input.outcome === 'completed' ? 'completed' : 'failed', version: task.version + 1, updatedAt: new Date() });
    return { status: 'ok', value: session };
  }
  async listSessions(userId: string) { return this.sessions.filter((item) => item.userId === userId); }
  async countEmergencyExits(userId: string, start: Date, end: Date) {
    return this.sessions.filter((item) => item.userId === userId && item.outcome === 'emergency_exit'
      && item.endedAt && item.endedAt >= start && item.endedAt < end).length;
  }
  async getSession(userId: string, sessionId: string) {
    return this.sessions.find((item) => item.userId === userId && item.id === sessionId) ?? null;
  }
  async sync(userId: string, since: Date) {
    const cursor = new Date();
    return {
      categories: this.categories.filter((item) => item.userId === userId && item.updatedAt > since),
      whitelistLists: this.whitelistLists.filter((item) => item.userId === userId && item.updatedAt > since),
      tasks: this.tasks.filter((item) => item.userId === userId && item.updatedAt > since),
      sessions: this.sessions.filter((item) => item.userId === userId && item.updatedAt > since),
      cursor,
    };
  }
}

function cloneWhitelistList(list: MemoryWhitelistList): MemoryWhitelistList {
  return {
    ...list,
    packages: [...list.packages],
    createdAt: new Date(list.createdAt),
    updatedAt: new Date(list.updatedAt),
    archivedAt: list.archivedAt ? new Date(list.archivedAt) : null,
  };
}

describe('task focus API', () => {
  let app: NestFastifyApplication;
  let tokens: TokenService;
  const repository = new MemoryTaskFocusRepository();
  const authRepository = {
    findUserByEmail: async () => null, findUserById: async () => null,
    createUserWithSession: async () => { throw new Error('unused'); }, createSession: async () => undefined,
    findSession: async () => null, rotateSession: async () => false, revokeSession: async () => undefined,
    updateSettings: async () => null,
  } satisfies AuthRepository;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [() => ({
        JWT_ACCESS_SECRET: 'access-secret-with-more-than-32-characters',
        JWT_REFRESH_SECRET: 'refresh-secret-with-more-than-32-characters',
        JWT_ACCESS_TTL_SECONDS: 900, JWT_REFRESH_TTL_SECONDS: 2592000,
      })] }), TaskFocusModule],
    }).overrideProvider(AUTH_REPOSITORY).useValue(authRepository)
      .overrideProvider(AUTH_RATE_LIMITER).useValue({ consume: async () => undefined })
      .overrideProvider(PrismaService).useValue({})
      .overrideProvider(RedisService).useValue({})
      .overrideProvider(ScoringService).useValue({ settleSession: async () => undefined })
      .overrideProvider(FamilyService).useValue({ handleSessionFinished: async () => undefined })
      .overrideProvider(TASK_FOCUS_REPOSITORY).useValue(repository).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    tokens = module.get(TokenService);
  });

  afterAll(async () => app.close());

  test('isolates users, enforces optimistic locking and keeps session writes idempotent', async () => {
    const userOne = await tokens.issue('user-one', 'device-one');
    const userTwo = await tokens.issue('user-two', 'device-two');
    const authOne = { authorization: `Bearer ${userOne.accessToken}` };
    const authTwo = { authorization: `Bearer ${userTwo.accessToken}` };
    const category = (await app.inject({ method: 'POST', url: '/task-categories', headers: authOne, payload: { name: '学习' } })).json().data;
    const duplicateCategory = await app.inject({ method: 'POST', url: '/task-categories', headers: authOne, payload: { name: '学习' } });
    expect(duplicateCategory.statusCode).toBe(409);
    const taskResponse = await app.inject({ method: 'POST', url: '/tasks', headers: authOne, payload: {
      id: '11111111-1111-4111-8111-111111111111', categoryId: category.id, title: '完成套卷', taskType: 'pomodoro', timerMode: 'countdown', estimatedMinutes: 25, restMinutes: 5,
    } });
    expect(taskResponse.statusCode).toBe(201);
    const task = taskResponse.json().data;
    const createReplay = await app.inject({ method: 'POST', url: '/tasks', headers: authOne, payload: {
      id: task.id, categoryId: category.id, title: '完成套卷', taskType: 'pomodoro', timerMode: 'countdown', estimatedMinutes: 25, restMinutes: 5,
    } });
    expect(createReplay.json().data.id).toBe(task.id);
    const identityConflict = await app.inject({ method: 'POST', url: '/tasks', headers: authOne, payload: {
      id: task.id, categoryId: category.id, title: '不同内容', taskType: 'pomodoro', timerMode: 'countdown', estimatedMinutes: 25, restMinutes: 5,
    } });
    expect(identityConflict.statusCode).toBe(409);
    const secondTask = (await app.inject({ method: 'POST', url: '/tasks', headers: authOne, payload: {
      title: '整理笔记', taskType: 'pomodoro', timerMode: 'untimed', estimatedMinutes: 25, restMinutes: 0,
    } })).json().data;
    const goalTask = (await app.inject({ method: 'POST', url: '/tasks', headers: authOne, payload: {
      title: '阅读目标', taskType: 'goal', timerMode: 'countdown', estimatedMinutes: 30, restMinutes: 5,
      deadlineAt: '2026-07-31T23:59:59.000Z', targetAmount: 5, targetUnit: '页',
    } })).json().data;
    expect((await app.inject({ method: 'GET', url: `/tasks/${task.id}`, headers: authTwo })).statusCode).toBe(404);

    const updated = await app.inject({ method: 'PATCH', url: `/tasks/${task.id}`, headers: authOne, payload: { version: 1, title: '完成两套卷', isTodayRequired: true, forcedTriggerTime: '20:00' } });
    expect(updated.statusCode).toBe(200);
    const updateReplay = await app.inject({ method: 'PATCH', url: `/tasks/${task.id}`, headers: authOne, payload: { version: 1, title: '完成两套卷', isTodayRequired: true, forcedTriggerTime: '20:00' } });
    expect(updateReplay.statusCode).toBe(200);
    expect(updateReplay.json().data.version).toBe(2);
    const clearedRequiredTime = await app.inject({ method: 'PATCH', url: `/tasks/${task.id}`, headers: authOne,
      payload: { version: 2, forcedTriggerTime: null } });
    expect(clearedRequiredTime.statusCode).toBe(400);
    expect(clearedRequiredTime.json().error.code).toBe('FORCED_TRIGGER_TIME_REQUIRED');
    expect((await app.inject({ method: 'PATCH', url: `/tasks/${task.id}`, headers: authOne, payload: { version: 1, title: '过期写入' } })).statusCode).toBe(409);

    const startHeaders = { ...authOne, 'idempotency-key': 'start-task-key-001' };
    const started = (await app.inject({ method: 'POST', url: `/tasks/${task.id}/start-focus`, headers: startHeaders, payload: {} })).json().data;
    const replayed = (await app.inject({ method: 'POST', url: `/tasks/${task.id}/start-focus`, headers: startHeaders, payload: {} })).json().data;
    expect(replayed.id).toBe(started.id);
    expect((await app.inject({ method: 'PATCH', url: `/tasks/${task.id}`, headers: authOne, payload: { version: 3, title: '专注中修改' } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url: `/tasks/${task.id}/start-focus`, headers: { ...authOne, 'idempotency-key': 'start-task-key-002' }, payload: {} })).statusCode).toBe(409);
    const reusedForOtherTask = await app.inject({ method: 'POST', url: `/tasks/${secondTask.id}/start-focus`, headers: startHeaders, payload: {} });
    expect(reusedForOtherTask.statusCode).toBe(409);
    expect(reusedForOtherTask.json().error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');

    const finishHeaders = { ...authOne, 'idempotency-key': 'finish-task-key-001' };
    const finished = (await app.inject({ method: 'POST', url: `/focus-sessions/${started.id}/finish`, headers: finishHeaders, payload: { outcome: 'completed', completionNote: '完成两套卷并订正错题' } })).json().data;
    const finishReplay = (await app.inject({ method: 'POST', url: `/focus-sessions/${started.id}/finish`, headers: finishHeaders, payload: { outcome: 'completed', completionNote: '完成两套卷并订正错题' } })).json().data;
    expect(finishReplay.id).toBe(finished.id);
    expect(finished.completionNote).toBe('完成两套卷并订正错题');
    expect(finished).toMatchObject({ whitelistPackageCount: 0, actualMinutes: 0, effectiveMinutes: 0 });
    expect((await app.inject({ method: 'POST', url: `/focus-sessions/${started.id}/finish`, headers: finishHeaders, payload: { outcome: 'failed' } })).statusCode).toBe(409);

    const completed = await app.inject({ method: 'POST', url: `/tasks/${secondTask.id}/complete`, headers: authOne, payload: { version: 1 } });
    expect(completed.json().data.status).toBe('completed');
    const archived = await app.inject({ method: 'DELETE', url: `/tasks/${secondTask.id}?version=2`, headers: authOne });
    expect(archived.json().data.status).toBe('archived');

    const renamedCategory = await app.inject({ method: 'PATCH', url: `/task-categories/${category.id}`, headers: authOne,
      payload: { version: 1, name: '课程' } });
    expect(renamedCategory.statusCode).toBe(200);
    expect(renamedCategory.json().data.name).toBe('课程');
    const deletedCategory = await app.inject({ method: 'DELETE', url: `/task-categories/${category.id}?version=2`, headers: authOne });
    expect(deletedCategory.statusCode).toBe(200);
    expect(deletedCategory.json().data.archived).toBe(true);
    expect((await app.inject({ method: 'GET', url: `/tasks/${task.id}`, headers: authOne })).json().data.categoryId).toBeNull();

    const goalProgress = await app.inject({ method: 'POST', url: `/tasks/${goalTask.id}/progress`,
      headers: { ...authOne, 'idempotency-key': 'goal-progress-key-001' }, payload: { version: 1, amount: 5 } });
    expect(goalProgress.json().data.completedAmount).toBe(5);
    expect(goalProgress.json().data.status).toBe('completed');
    const expandedGoal = await app.inject({ method: 'PATCH', url: `/tasks/${goalTask.id}`, headers: authOne,
      payload: { version: 2, targetAmount: 10 } });
    expect(expandedGoal.json().data.status).toBe('pending');
    expect((await app.inject({ method: 'PATCH', url: `/tasks/${goalTask.id}`, headers: authOne,
      payload: { version: 3, deadlineAt: null } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: `/tasks/${goalTask.id}`, headers: authOne,
      payload: { version: 3, targetUnit: null } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: `/tasks/${goalTask.id}`, headers: authOne,
      payload: { version: 3, timerMode: 'countup' } })).statusCode).toBe(400);
    const correctedGoalStatus = await app.inject({ method: 'PATCH', url: `/tasks/${goalTask.id}`, headers: authOne,
      payload: { version: 3, status: 'completed' } });
    expect(correctedGoalStatus.statusCode).toBe(200);
    expect(correctedGoalStatus.json().data.status).toBe('pending');
    expect((await app.inject({ method: 'PATCH', url: `/tasks/${goalTask.id}`, headers: authOne,
      payload: { version: 4, targetAmount: 4 } })).statusCode).toBe(400);

    const sync = await app.inject({ method: 'GET', url: '/sync/task-focus?since=1970-01-01T00:00:00.000Z', headers: authOne });
    expect(sync.json().data.tasks).toHaveLength(3);
    expect(sync.json().data.sessions).toHaveLength(1);
    expect(sync.json().data.categories).toEqual(expect.arrayContaining([expect.objectContaining({ id: category.id, archived: true })]));
  });

  test('manages whitelist lists, accepts legacy task payloads and syncs lists before tasks', async () => {
    const userOne = await tokens.issue('whitelist-user-one', 'whitelist-device-one');
    const userTwo = await tokens.issue('whitelist-user-two', 'whitelist-device-two');
    const authOne = { authorization: `Bearer ${userOne.accessToken}` };
    const authTwo = { authorization: `Bearer ${userTwo.accessToken}` };

    const initial = await app.inject({ method: 'GET', url: '/whitelist-lists', headers: authOne });
    expect(initial.statusCode).toBe(200);
    expect(initial.json().data).toEqual([expect.objectContaining({ name: '默认白名单', packages: [], isDefault: true, version: 1, archivedAt: null })]);
    const originalDefault = initial.json().data[0];

    const createHeaders = { ...authOne, 'idempotency-key': 'whitelist-create-study-001' };
    const createdResponse = await app.inject({ method: 'POST', url: '/whitelist-lists', headers: createHeaders, payload: {
      name: '学习', packages: [' com.reader.app ', 'com.notes.app', 'com.reader.app', ''],
    } });
    expect(createdResponse.statusCode).toBe(201);
    const studyList = createdResponse.json().data;
    expect(studyList).toMatchObject({ name: '学习', packages: ['com.reader.app', 'com.notes.app'], isDefault: false, version: 1 });
    const createReplay = await app.inject({ method: 'POST', url: '/whitelist-lists', headers: createHeaders, payload: {
      name: '学习', packages: [' com.reader.app ', 'com.notes.app', 'com.reader.app'],
    } });
    expect(createReplay.statusCode).toBe(201);
    expect(createReplay.json().data.id).toBe(studyList.id);
    const createConflict = await app.inject({ method: 'POST', url: '/whitelist-lists', headers: createHeaders, payload: {
      name: '工作', packages: ['com.notes.app'],
    } });
    expect(createConflict.statusCode).toBe(409);
    expect(createConflict.json().error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');

    const crossUserGet = await app.inject({ method: 'GET', url: `/whitelist-lists/${studyList.id}`, headers: authTwo });
    expect(crossUserGet.statusCode).toBe(404);

    const listTaskResponse = await app.inject({ method: 'POST', url: '/tasks', headers: authOne, payload: {
      title: '名单任务', taskType: 'pomodoro', timerMode: 'countdown', estimatedMinutes: 25, restMinutes: 5,
      restrictionMode: 'whitelist', whitelistMode: 'list', whitelistListId: studyList.id, whitelistPackages: ['ignored.package'],
    } });
    expect(listTaskResponse.statusCode).toBe(201);
    const listTask = listTaskResponse.json().data;
    expect(listTask).toMatchObject({ restrictionMode: 'whitelist', whitelistMode: 'list', whitelistListId: studyList.id, whitelistPackages: [] });

    const legacyInheritResponse = await app.inject({ method: 'POST', url: '/tasks', headers: authOne, payload: {
      title: '旧继承任务', taskType: 'pomodoro', timerMode: 'countdown', estimatedMinutes: 25, restMinutes: 5,
      whitelistMode: 'inherit', whitelistPackages: ['ignored.legacy'],
    } });
    expect(legacyInheritResponse.statusCode).toBe(201);
    const legacyInherit = legacyInheritResponse.json().data;
    expect(legacyInherit).toMatchObject({ restrictionMode: 'whitelist', whitelistMode: 'list', whitelistListId: originalDefault.id, whitelistPackages: [] });

    const legacyCustomResponse = await app.inject({ method: 'POST', url: '/tasks', headers: authOne, payload: {
      title: '旧自定义任务', taskType: 'pomodoro', timerMode: 'countdown', estimatedMinutes: 25, restMinutes: 5,
      whitelistMode: 'custom', whitelistPackages: [' custom.one ', 'custom.two', 'custom.one'],
    } });
    expect(legacyCustomResponse.statusCode).toBe(201);
    const legacyCustom = legacyCustomResponse.json().data;
    expect(legacyCustom).toMatchObject({ restrictionMode: 'whitelist', whitelistMode: 'custom', whitelistListId: null, whitelistPackages: ['custom.one', 'custom.two'] });

    const invalidSource = await app.inject({ method: 'POST', url: `/tasks/${legacyCustom.id}/start-focus`, headers: {
      ...authOne, 'idempotency-key': 'invalid-whitelist-session-source',
    }, payload: {
      restrictionMode: 'whitelist', whitelistSource: 'unknown-source', restrictionEffective: true,
    } });
    expect(invalidSource.statusCode).toBe(400);

    const sessionStart = await app.inject({ method: 'POST', url: `/tasks/${legacyCustom.id}/start-focus`, headers: {
      ...authOne, 'idempotency-key': 'whitelist-session-start',
    }, payload: {
      startedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      restrictionMode: 'whitelist', whitelistSource: 'custom', restrictionEffective: true,
      allowedPackagesSnapshot: [' custom.one ', 'custom.two', 'custom.one'],
    } });
    expect(sessionStart.statusCode).toBe(201);
    const restrictedSession = sessionStart.json().data;
    expect(restrictedSession).toMatchObject({
      restrictionMode: 'whitelist', whitelistSource: 'custom', whitelistPackageCount: 2,
      allowedPackagesSnapshot: ['custom.one', 'custom.two'], restrictionEffective: true, effectiveMinutes: 0,
    });
    const sessionFinish = await app.inject({ method: 'POST', url: `/focus-sessions/${restrictedSession.id}/finish`, headers: {
      ...authOne, 'idempotency-key': 'whitelist-session-finish',
    }, payload: {
      outcome: 'completed', actualMinutes: 1_440, whitelistPackageCount: 2,
      restrictionMode: 'strict', whitelistSource: 'strict',
      restrictionEffective: false, effectiveMinutes: 1_440,
    } });
    expect(sessionFinish.statusCode).toBe(201);
    expect(sessionFinish.json().data).toMatchObject({
      restrictionMode: 'whitelist', whitelistSource: 'custom', whitelistPackageCount: 2,
      actualMinutes: 25, restrictionEffective: false, effectiveMinutes: 25,
    });
    const finishReplay = await app.inject({ method: 'POST', url: `/focus-sessions/${restrictedSession.id}/finish`, headers: {
      ...authOne, 'idempotency-key': 'whitelist-session-finish',
    }, payload: {
      outcome: 'completed', endedAt: '2099-01-01T00:00:00.000Z', actualMinutes: 1_440,
      restrictionMode: 'none', whitelistSource: 'none', restrictionEffective: true, effectiveMinutes: 1_440,
    } });
    expect(finishReplay.statusCode).toBe(201);
    expect(finishReplay.json().data).toMatchObject({
      restrictionMode: 'whitelist', whitelistSource: 'custom', actualMinutes: 25,
      restrictionEffective: false, effectiveMinutes: 25,
    });

    const strictResponse = await app.inject({ method: 'POST', url: '/tasks', headers: authOne, payload: {
      title: '严格任务', taskType: 'pomodoro', timerMode: 'countdown', estimatedMinutes: 25, restMinutes: 5,
      restrictionMode: 'strict', whitelistMode: 'custom', whitelistListId: studyList.id, whitelistPackages: ['ignored.strict'],
    } });
    expect(strictResponse.statusCode).toBe(201);
    expect(strictResponse.json().data).toMatchObject({ restrictionMode: 'strict', whitelistMode: 'custom', whitelistListId: null, whitelistPackages: [] });

    const noneResponse = await app.inject({ method: 'POST', url: '/tasks', headers: authOne, payload: {
      title: '无限制任务', taskType: 'pomodoro', timerMode: 'countdown', estimatedMinutes: 25, restMinutes: 5,
      restrictionMode: 'none', whitelistMode: 'inherit', whitelistPackages: ['ignored.none'],
    } });
    expect(noneResponse.statusCode).toBe(201);
    expect(noneResponse.json().data).toMatchObject({ restrictionMode: 'none', whitelistMode: 'list', whitelistListId: null, whitelistPackages: [] });

    const foreignReference = await app.inject({ method: 'POST', url: '/tasks', headers: authTwo, payload: {
      title: '跨用户任务', taskType: 'pomodoro', timerMode: 'countdown', estimatedMinutes: 25, restMinutes: 5,
      restrictionMode: 'whitelist', whitelistMode: 'list', whitelistListId: studyList.id,
    } });
    expect(foreignReference.statusCode).toBe(404);
    expect(foreignReference.json().error.code).toBe('WHITELIST_LIST_NOT_FOUND');

    const updateHeaders = { ...authOne, 'idempotency-key': 'whitelist-update-study-001' };
    const replacedPackages = await app.inject({ method: 'PATCH', url: `/whitelist-lists/${studyList.id}`, headers: updateHeaders, payload: {
      version: 1, packages: ['com.video.app'],
    } });
    expect(replacedPackages.statusCode).toBe(200);
    expect(replacedPackages.json().data).toMatchObject({ packages: ['com.video.app'], version: 2 });
    const updateReplay = await app.inject({ method: 'PATCH', url: `/whitelist-lists/${studyList.id}`, headers: updateHeaders, payload: {
      version: 1, packages: [' com.video.app ', 'com.video.app'],
    } });
    expect(updateReplay.statusCode).toBe(200);
    expect(updateReplay.json().data).toMatchObject({ packages: ['com.video.app'], version: 2 });
    const updateConflict = await app.inject({ method: 'PATCH', url: `/whitelist-lists/${studyList.id}`, headers: updateHeaders, payload: {
      version: 1, packages: ['com.other.app'],
    } });
    expect(updateConflict.statusCode).toBe(409);
    expect(updateConflict.json().error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');

    const defaultHeaders = { ...authOne, 'idempotency-key': 'whitelist-default-study-001' };
    const madeDefault = await app.inject({ method: 'POST', url: `/whitelist-lists/${studyList.id}/default`, headers: defaultHeaders, payload: { version: 2 } });
    expect(madeDefault.statusCode).toBe(201);
    expect(madeDefault.json().data).toMatchObject({ isDefault: true, version: 3 });
    const defaultReplay = await app.inject({ method: 'POST', url: `/whitelist-lists/${studyList.id}/default`, headers: defaultHeaders, payload: { version: 2 } });
    expect(defaultReplay.statusCode).toBe(201);
    expect(defaultReplay.json().data).toMatchObject({ isDefault: true, version: 3 });
    const defaultConflict = await app.inject({ method: 'POST', url: `/whitelist-lists/${studyList.id}/default`, headers: defaultHeaders, payload: { version: 1 } });
    expect(defaultConflict.statusCode).toBe(409);
    expect(defaultConflict.json().error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');

    const missingReplacement = await app.inject({ method: 'DELETE', url: `/whitelist-lists/${studyList.id}?version=3`, headers: {
      ...authOne, 'idempotency-key': 'whitelist-delete-missing-replacement-001',
    } });
    expect(missingReplacement.statusCode).toBe(409);
    expect(missingReplacement.json().error.code).toBe('WHITELIST_REPLACEMENT_REQUIRED');

    const deleteHeaders = { ...authOne, 'idempotency-key': 'whitelist-delete-study-001' };
    const deleteUrl = `/whitelist-lists/${studyList.id}?version=3&replacementId=${originalDefault.id}`;
    const replacement = await app.inject({ method: 'DELETE', url: deleteUrl, headers: deleteHeaders });
    expect(replacement.statusCode).toBe(200);
    expect(replacement.json().data.archivedAt).not.toBeNull();
    const deleteReplay = await app.inject({ method: 'DELETE', url: deleteUrl, headers: deleteHeaders });
    expect(deleteReplay.statusCode).toBe(200);
    expect(deleteReplay.json().data).toMatchObject({ id: studyList.id, version: 4, archivedAt: replacement.json().data.archivedAt });
    const deleteConflict = await app.inject({ method: 'DELETE', url: `/whitelist-lists/${studyList.id}?version=4&replacementId=${originalDefault.id}`, headers: deleteHeaders });
    expect(deleteConflict.statusCode).toBe(409);
    expect(deleteConflict.json().error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
    const historicCreateReplay = await app.inject({ method: 'POST', url: '/whitelist-lists', headers: createHeaders, payload: {
      name: '学习', packages: ['com.reader.app', 'com.notes.app'],
    } });
    expect(historicCreateReplay.statusCode).toBe(201);
    expect(historicCreateReplay.json().data).toMatchObject({
      id: studyList.id, name: '学习', packages: ['com.reader.app', 'com.notes.app'],
      isDefault: false, version: 1, archivedAt: null,
    });
    const historicCreateConflict = await app.inject({ method: 'POST', url: '/whitelist-lists', headers: createHeaders, payload: {
      name: '工作', packages: ['com.notes.app'],
    } });
    expect(historicCreateConflict.statusCode).toBe(409);
    expect(historicCreateConflict.json().error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
    const reassigned = await app.inject({ method: 'GET', url: `/tasks/${listTask.id}`, headers: authOne });
    expect(reassigned.json().data).toMatchObject({ whitelistListId: originalDefault.id, version: 2 });

    const sync = await app.inject({ method: 'GET', url: '/sync/task-focus?since=1970-01-01T00:00:00.000Z', headers: authOne });
    expect(sync.statusCode).toBe(200);
    expect(sync.json().data.whitelistLists).toEqual(expect.arrayContaining([expect.objectContaining({ id: studyList.id, archivedAt: expect.any(String) })]));
    expect(sync.json().data.sessions).toEqual(expect.arrayContaining([expect.objectContaining({
      id: restrictedSession.id, restrictionMode: 'whitelist', whitelistSource: 'custom',
      whitelistPackageCount: 2, allowedPackagesSnapshot: ['custom.one', 'custom.two'], restrictionEffective: false, effectiveMinutes: 25,
    })]));
    expect(Object.keys(sync.json().data).indexOf('whitelistLists')).toBeLessThan(Object.keys(sync.json().data).indexOf('tasks'));
  });
});
