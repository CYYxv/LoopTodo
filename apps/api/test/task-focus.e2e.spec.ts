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

class MemoryTaskFocusRepository implements TaskFocusRepository {
  categories: Array<CategoryView & { userId: string }> = [];
  tasks: Array<TaskView & { userId: string }> = [];
  sessions: Array<SessionView & { userId: string; startKey: string; finishKey: string | null }> = [];

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
    const session: SessionView & { userId: string; startKey: string; finishKey: string | null } = {
      id: randomUUID(), userId: input.userId, taskId: task.id, mode: input.mode,
      timerMode: task.timerMode, trustLevel: input.trustLevel, startedAt: new Date(), endedAt: null,
      plannedMinutes: task.estimatedMinutes, actualMinutes: null, outcome: null, completionNote: null,
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
    Object.assign(session, { endedAt: new Date(), actualMinutes: 1, outcome: input.outcome,
      completionNote: input.completionNote, failureReasonType: input.failureReasonType,
      failureReasonText: input.failureReasonText, finishKey: input.idempotencyKey, updatedAt: new Date() });
    const task = this.tasks.find((item) => item.id === session.taskId && item.userId === input.userId);
    if (task) Object.assign(task, { activeSessionId: null, status: input.outcome === 'completed' ? 'completed' : 'failed', version: task.version + 1, updatedAt: new Date() });
    return { status: 'ok', value: session };
  }
  async listSessions(userId: string) { return this.sessions.filter((item) => item.userId === userId); }
  async sync(userId: string, since: Date) {
    const cursor = new Date();
    return {
      categories: this.categories.filter((item) => item.userId === userId && item.updatedAt > since),
      tasks: this.tasks.filter((item) => item.userId === userId && item.updatedAt > since),
      sessions: this.sessions.filter((item) => item.userId === userId && item.updatedAt > since),
      cursor,
    };
  }
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
});
