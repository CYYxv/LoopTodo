import type { ActiveSession, FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

import { createTaskStore } from '../task.store';
import type { TaskRepository } from '../task.repository';
import type { CreateTaskInput, Task, TaskCategory } from '../task.types';
import type { LockEngine } from '@/modules/lock-engine/lock-engine.port';
import type { FocusRestrictionOptions } from '@/modules/lock-engine/lock-engine.types';
import { clearAnalyticsEvents, getAnalyticsEvents } from '@/modules/analytics/analytics';

const pomodoroTask: Task = {
  id: 'task-one',
  title: '第一项任务',
  category: '测试',
  kind: 'pomodoro',
  timerMode: 'countdown',
  estimateMinutes: 25,
  restMinutes: 5,
  deadlineAt: null,
  targetAmount: null,
  targetUnit: null,
  completedAmount: 0,
  progressLabel: '倒计时 25 分钟 · 休息 5 分钟',
  mustDo: true,
  forcedTriggerTime: '20:00',
  trustLevel: 'high',
  status: 'pending',
  version: 1,
  syncStatus: 'pending',
  remoteActive: false, restrictionMode: 'whitelist', whitelistMode: 'inherit', whitelistListId: null, whitelistPackages: [],
};

const goalTask: Task = {
  ...pomodoroTask,
  id: 'task-goal',
  title: '阅读目标',
  kind: 'goal',
  estimateMinutes: 30,
  deadlineAt: 2_000_000,
  targetAmount: 10,
  targetUnit: '页',
  progressLabel: '目标 0/10 页 · 单次 30 分钟',
  mustDo: false,
  forcedTriggerTime: null,
};

function createRepository(options?: {
  activeSession?: ActiveSession;
  hydrateError?: Error;
  createError?: Error;
  startError?: Error;
  finishError?: Error;
  updateError?: Error;
}) {
  let tasks = [pomodoroTask, goalTask].map((task) => ({ ...task }));
  let activeSession = options?.activeSession ?? null;
  if (activeSession) tasks = tasks.map((task) => task.id === activeSession?.taskId ? { ...task, status: 'active' } : task);
  const sessions: FocusSessionRecord[] = [];
  let categories: TaskCategory[] = [];
  const repository: TaskRepository = {
    async hydrate() {
      if (options?.hydrateError) throw options.hydrateError;
      return { tasks, categories, sessionRecords: sessions, activeSession };
    },
    async create(input: CreateTaskInput) {
      if (options?.createError) throw options.createError;
      const task: Task = { ...pomodoroTask, ...input, id: 'task-created', completedAmount: 0, progressLabel: '新任务' };
      tasks = [task, ...tasks];
      return task;
    },
    async createCategory(category) {
      categories = [...categories, category];
    },
    async updateCategory(category) {
      categories = categories.map((candidate) => candidate.id === category.id ? category : candidate);
    },
    async archiveCategory(category) {
      categories = categories.filter((candidate) => candidate.id !== category.id);
    },
    async update(task) {
      if (options?.updateError) throw options.updateError;
      tasks = tasks.map((candidate) => candidate.id === task.id ? task : candidate);
    },
    async archive(task) {
      if (options?.updateError) throw options.updateError;
      tasks = tasks.map((candidate) => candidate.id === task.id ? task : candidate);
    },
    async startSession(task, session) {
      if (options?.startError) throw options.startError;
      tasks = tasks.map((candidate) => candidate.id === task.id ? task : candidate);
      activeSession = session;
    },
    async updateActiveSession(session) {
      activeSession = session;
    },
    async finishSession(task, record, restSession) {
      if (options?.finishError) throw options.finishError;
      tasks = tasks.map((candidate) => candidate.id === task.id ? task : candidate);
      sessions.unshift(record);
      activeSession = restSession;
    },
    async finishRest() {
      activeSession = null;
    },
    async addGoalProgress(task) {
      tasks = tasks.map((candidate) => candidate.id === task.id ? task : candidate);
    },
  };
  return { repository, sessions };
}

describe('task store local loop', () => {
  test('records the whitelist permission, runtime and settlement lifecycle', async () => {
    clearAnalyticsEvents();
    let time = 1_000;
    const store = createTaskStore(createRepository().repository, [pomodoroTask], () => time, testLockEngine([]));

    await store.getState().startSession('task-one', 'focus');
    time += 25 * 60_000;
    await store.getState().finishSession('completed');

    const events = getAnalyticsEvents();
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'whitelist_permission_result', props: {
        usageAccessGranted: true,
        overlayGranted: true,
        backgroundPopupAllowed: true,
        deviceBrand: 'test',
      } }),
      expect.objectContaining({ event: 'focus_restriction_start', props: expect.objectContaining({
        mode: 'whitelist',
        source: 'list',
        listId: 'missing',
        packageCount: 0,
        effective: true,
      }) }),
      expect.objectContaining({ event: 'focus_restriction_clear', props: { reason: 'completed', success: true } }),
      expect.objectContaining({ event: 'whitelist_star_settled', props: { effectiveMinutes: 25, stars: 1 } }),
    ]));
  });

  test('drains native blocker events during the foreground restriction audit', async () => {
    clearAnalyticsEvents();
    const engine = {
      ...testLockEngine([]),
      drainFocusRestrictionEvents: jest.fn(async () => ([
        { event: 'app_blocked' as const, props: { sessionId: 'native-session', packageName: 'private.app' }, at: 2_000 },
      ])),
    } as LockEngine;
    const store = createTaskStore(createRepository().repository, [pomodoroTask], () => 1_000, engine);
    await store.getState().startSession('task-one', 'focus');

    await store.getState().auditActiveRestriction('foreground');

    expect(getAnalyticsEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'app_blocked', props: { sessionId: 'native-session' } }),
    ]));
  });

  test('freezes the resolved whitelist against launchable apps when focus starts', async () => {
    const { repository } = createRepository();
    const applied: Array<Record<string, unknown>> = [];
    const engine = {
      ...testLockEngine([]),
      async listLaunchableApps() { return [{ packageName: 'com.reader', label: '阅读器' }, { packageName: 'com.other', label: '其他' }]; },
      async applyFocusRestrictions(options: Record<string, unknown>) { applied.push(options); },
    } as LockEngine;
    const whitelistSource = { getState: () => ({
      lists: [{ id: 'study', name: '学习', packages: ['com.reader', 'com.missing'], isDefault: true, version: 1, syncStatus: 'synced' as const }],
      hydrated: true,
      error: null,
      hydrate: async () => undefined,
    }) };
    const scheduler = { schedule: async () => undefined, cancel: async () => undefined };
    const store = createTaskStore(repository, [{ ...pomodoroTask, restrictionMode: 'whitelist', whitelistMode: 'list', whitelistListId: 'study' }],
      () => 1_000, engine, scheduler as never, whitelistSource as never);

    await store.getState().startSession('task-one', 'focus');

    expect(store.getState().activeSession).toMatchObject({
      restrictionMode: 'whitelist',
      whitelistSource: 'list:study',
      restrictionEffective: true,
      allowedPackagesSnapshot: ['com.reader'],
    });
    expect(applied[0]).toMatchObject({ sessionId: store.getState().activeSession?.id, taskTitle: pomodoroTask.title, restrictionMode: 'whitelist', blockLeaving: true, allowedPackages: ['com.reader'] });
  });

  test.each([
    ['unrestricted focus', 'focus', 'none'],
    ['strict focus', 'focus', 'strict'],
    ['lock session', 'lock', 'whitelist'],
  ] as const)('does not read whitelist data for %s', async (_label, mode, restrictionMode) => {
    const hydrate = jest.fn(async () => { throw new Error('不应读取白名单'); });
    const listLaunchableApps = jest.fn(async () => { throw new Error('不应枚举应用'); });
    const engine = { ...testLockEngine([]), listLaunchableApps } as LockEngine;
    const whitelistSource = { getState: () => ({ lists: [], hydrated: false, error: '不可用', hydrate }) };
    const task = { ...pomodoroTask, restrictionMode };
    const store = createTaskStore(createRepository().repository, [task], () => 1_000, engine, undefined, whitelistSource as never);

    const result = await store.getState().startSession(task.id, mode);

    expect(result).toEqual({ ok: true });
    expect(hydrate).not.toHaveBeenCalled();
    expect(listLaunchableApps).not.toHaveBeenCalled();
  });

  test.each([
    ['hydrate failed', true, '白名单数据库不可用', '白名单读取失败：白名单数据库不可用'],
    ['hydrate incomplete', false, null, '白名单尚未完成加载'],
  ] as const)('aborts whitelist start when %s and preserves task settings', async (_label, hydrated, sourceError, expectedError) => {
    const listLaunchableApps = jest.fn(async () => []);
    const engine = { ...testLockEngine([]), listLaunchableApps } as LockEngine;
    const hydrate = jest.fn(async () => undefined);
    const whitelistSource = { getState: () => ({ lists: [], hydrated, error: sourceError, hydrate }) };
    const configuredTask = {
      ...pomodoroTask,
      restrictionMode: 'whitelist' as const,
      whitelistMode: 'custom' as const,
      whitelistListId: null,
      whitelistPackages: ['com.reader'],
    };
    const store = createTaskStore(createRepository().repository, [configuredTask], () => 1_000, engine, undefined, whitelistSource as never);

    const result = await store.getState().startSession(configuredTask.id, 'focus');

    expect(result).toEqual({ ok: false, error: expectedError, missingCapabilities: [] });
    expect(store.getState().activeSession).toBeNull();
    expect(store.getState().tasks[0]).toEqual(configuredTask);
    expect(listLaunchableApps).not.toHaveBeenCalled();
  });

  test('does not start a restricted session when native enforcement is ineffective', async () => {
    const { repository } = createRepository();
    const engine = {
      ...testLockEngine([]),
      async applyFocusRestrictions() { return { supported: true, effective: false, reason: '请开启使用情况访问权限' }; },
    } as LockEngine;
    const store = createTaskStore(repository, [pomodoroTask], () => 1_000, engine);

    await store.getState().startSession('task-one', 'focus');

    expect(store.getState().activeSession).toBeNull();
    expect(store.getState().error).toBe('请开启使用情况访问权限');
  });

  test('returns structured missing capabilities before starting a restricted session', async () => {
    const engine = {
      ...testLockEngine([]),
      async checkCapabilities() {
        return {
          ...testCapabilities(),
          usageAccess: { supported: true, effective: false, reason: '未授权' },
          overlay: { supported: true, effective: false, reason: '未授权' },
          backgroundLaunch: { supported: true, effective: false, reason: '未授权' },
        };
      },
    } as LockEngine;
    const store = createTaskStore(createRepository().repository, [pomodoroTask], () => 1_000, engine);

    const result = await store.getState().startSession('task-one', 'focus');

    expect(result).toEqual({
      ok: false,
      error: '需要恢复软件限制权限后才能开始专注',
      missingCapabilities: ['usageAccess', 'overlay', 'vendorBackground'],
    });
    expect(store.getState().activeSession).toBeNull();
  });

  test('serializes repeated start taps before whitelist hydration finishes', async () => {
    const { repository } = createRepository();
    let releaseHydration!: () => void;
    const hydration = new Promise<void>((resolve) => { releaseHydration = resolve; });
    const applyFocusRestrictions = jest.fn(async () => ({ supported: true, effective: true, reason: null }));
    const engine = { ...testLockEngine([]), applyFocusRestrictions } as LockEngine;
    const whitelistState = { lists: [], hydrated: false, error: null as string | null, hydrate: async () => {
      await hydration;
      whitelistState.hydrated = true;
    } };
    const whitelistSource = { getState: () => whitelistState };
    const store = createTaskStore(repository, [pomodoroTask], () => 1_000, engine, undefined, whitelistSource as never);

    const first = store.getState().startSession('task-one', 'focus');
    const second = store.getState().startSession('task-one', 'focus');
    releaseHydration();
    await Promise.all([first, second]);

    expect(applyFocusRestrictions).toHaveBeenCalledTimes(1);
    expect(store.getState().activeSession?.taskId).toBe('task-one');
  });

  test('ends the session after restrictions fail during pause', async () => {
    let applyCount = 0;
    const engine = {
      ...testLockEngine([]),
      async applyFocusRestrictions() {
        applyCount += 1;
        return applyCount === 1
          ? { supported: true, effective: true, reason: null }
          : { supported: true, effective: false, reason: '权限已关闭' };
      },
    } as LockEngine;
    const store = createTaskStore(createRepository().repository, [pomodoroTask], () => 1_000, engine);
    await store.getState().startSession('task-one', 'focus');

    await store.getState().toggleSessionPause();

    expect(store.getState().activeSession).toBeNull();
    expect(store.getState().sessionRecords[0]).toMatchObject({ outcome: 'exited', restrictionEffective: false });
    expect(store.getState().error).toContain('软件限制已失效，本次专注已异常结束');
  });

  test('audits foreground restrictions, persists invalidation and ends only once', async () => {
    let applyCount = 0;
    const clearFocusRestrictions = jest.fn(async () => undefined);
    const engine = {
      ...testLockEngine([]),
      async applyFocusRestrictions() {
        applyCount += 1;
        return applyCount === 1
          ? { supported: true, effective: true, reason: null }
          : { supported: true, effective: false, reason: '显示在其他应用上层已关闭' };
      },
      clearFocusRestrictions,
    } as LockEngine;
    const { repository, sessions } = createRepository();
    const updateActiveSession = jest.spyOn(repository, 'updateActiveSession');
    const store = createTaskStore(repository, [pomodoroTask], () => 1_000, engine);
    await store.getState().startSession('task-one', 'focus');

    const first = await store.getState().auditActiveRestriction('foreground');
    const second = await store.getState().auditActiveRestriction('foreground');

    expect(first).toMatchObject({ status: 'ended', missingCapabilities: [] });
    expect(second).toEqual({ status: 'skipped' });
    expect(updateActiveSession).toHaveBeenCalledWith(expect.objectContaining({ restrictionEffective: false }));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ outcome: 'exited', restrictionEffective: false });
    expect(clearFocusRestrictions).toHaveBeenCalled();
  });

  test('ends a recovered restricted session when permissions are no longer effective', async () => {
    const recovered: ActiveSession = {
      id: 'recovered', taskId: 'task-one', mode: 'focus', timerMode: 'countdown', phase: 'focus',
      startedAt: 1_000, plannedEndAt: 61_000, restEndsAt: null, pausedAt: null, accumulatedPausedMs: 0,
      restrictionMode: 'whitelist', whitelistSource: 'custom', restrictionEffective: true, allowedPackagesSnapshot: [],
    };
    const engine = {
      ...testLockEngine([]),
      async checkCapabilities() {
        return { ...testCapabilities(), usageAccess: { supported: true, effective: false, reason: '未授权' } };
      },
    } as LockEngine;
    const { repository, sessions } = createRepository({ activeSession: recovered });
    const store = createTaskStore(repository, [], () => 2_000, engine);

    await store.getState().hydrate();

    expect(store.getState().activeSession).toBeNull();
    expect(sessions[0]).toMatchObject({ id: 'recovered', outcome: 'exited', restrictionEffective: false });
    expect(store.getState().error).toContain('软件限制已失效，本次专注已异常结束');
  });

  test('does not preview stars after a whitelist restriction becomes ineffective', async () => {
    let time = 1_000;
    const store = createTaskStore(createRepository().repository, [pomodoroTask], () => time, testLockEngine([]));
    await store.getState().startSession('task-one', 'focus');
    store.setState((state) => ({ activeSession: state.activeSession ? { ...state.activeSession, restrictionEffective: false } : null }));
    time += 25 * 60_000;

    await store.getState().finishSession('completed');

    expect(store.getState().lastStarDelta).toBe(0);
  });

  test('retains the settled restriction mode with the star delta', async () => {
    let time = 1_000;
    const store = createTaskStore(createRepository().repository, [pomodoroTask], () => time, testLockEngine([]));
    await store.getState().startSession('task-one', 'focus');
    time += 25 * 60_000;

    await store.getState().finishSession('completed');

    expect(store.getState().lastStarDelta).toBe(1);
    expect(store.getState().lastStarRestrictionMode).toBe('whitelist');
  });

  test('clears native restrictions even when finishing persistence fails', async () => {
    const clearFocusRestrictions = jest.fn(async () => undefined);
    const engine = { ...testLockEngine([]), clearFocusRestrictions } as LockEngine;
    const store = createTaskStore(createRepository({ finishError: new Error('记录保存失败') }).repository, [pomodoroTask], () => 2_000, engine);
    await store.getState().startSession('task-one', 'focus');

    await store.getState().finishSession('completed');

    expect(clearFocusRestrictions).toHaveBeenCalled();
    expect(store.getState().error).toBe('记录保存失败');
  });

  test('retries transient native cleanup failures before entering rest', async () => {
    const clearFocusRestrictions = jest.fn()
      .mockRejectedValueOnce(new Error('原生清理暂时失败'))
      .mockResolvedValue(undefined);
    const engine = { ...testLockEngine([]), clearFocusRestrictions } as LockEngine;
    const store = createTaskStore(createRepository().repository, [pomodoroTask], () => 2_000, engine);
    await store.getState().startSession('task-one', 'focus');

    await store.getState().finishSession('completed');

    expect(clearFocusRestrictions).toHaveBeenCalledTimes(2);
    expect(store.getState().activeSession?.phase).toBe('rest');
    expect(store.getState().error).toBeNull();
  });

  test('repairs a persistent cleanup failure when the rest screen returns to foreground', async () => {
    const clearFocusRestrictions = jest.fn()
      .mockRejectedValueOnce(new Error('清理失败 1'))
      .mockRejectedValueOnce(new Error('清理失败 2'))
      .mockRejectedValueOnce(new Error('清理失败 3'))
      .mockResolvedValue(undefined);
    const engine = { ...testLockEngine([]), clearFocusRestrictions } as LockEngine;
    const store = createTaskStore(createRepository().repository, [pomodoroTask], () => 2_000, engine);
    await store.getState().startSession('task-one', 'focus');
    await store.getState().finishSession('completed');

    expect(clearFocusRestrictions).toHaveBeenCalledTimes(3);
    expect(store.getState().activeSession?.phase).toBe('rest');
    expect(store.getState().error).toContain('清理失败 3');

    expect(await store.getState().auditActiveRestriction('foreground')).toEqual({ status: 'skipped' });
    expect(clearFocusRestrictions).toHaveBeenCalledTimes(4);
    expect(store.getState().error).toBeNull();
  });
  test('archives a task and removes it from the visible list', async () => {
    const store = createTaskStore(createRepository().repository, [pomodoroTask]);
    const state = store.getState() as typeof store.getState extends () => infer Value ? Value & { deleteTask(taskId: string, version: number): Promise<{ ok: boolean; error?: string }> } : never;

    expect(typeof state.deleteTask).toBe('function');
    expect(await state.deleteTask('task-one', 1)).toEqual({ ok: true });
    expect(store.getState().tasks).toHaveLength(0);
  });

  test('stores the completion note with a completed focus record', async () => {
    const { repository, sessions } = createRepository();
    const store = createTaskStore(repository, [pomodoroTask], () => 2_000, testLockEngine([]));
    await store.getState().startSession('task-one', 'focus');

    await (store.getState().finishSession as unknown as (outcome: 'completed', amount?: number, reason?: string, note?: string) => Promise<void>)('completed', undefined, undefined, '完成第一章练习');

    expect(sessions[0]).toMatchObject({
      completionNote: '完成第一章练习',
      restrictionMode: 'whitelist',
      whitelistSource: 'list:missing',
      whitelistPackageCount: 0,
      restrictionEffective: true,
      effectiveMinutes: 0,
    });
  });

  test('creates, renames and archives a task category', async () => {
    const store = createTaskStore(createRepository().repository, [pomodoroTask]);
    const state = store.getState() as typeof store.getState extends () => infer Value ? Value & {
      createCategory(name: string): Promise<{ ok: boolean; categoryId?: string }>;
      updateCategory(id: string, version: number, name: string): Promise<{ ok: boolean }>;
      deleteCategory(id: string, version: number): Promise<{ ok: boolean }>;
    } : never;

    expect(typeof state.createCategory).toBe('function');
    const created = await state.createCategory('学习');
    expect(created).toMatchObject({ ok: true });
    if (!created.ok) throw new Error(created.error);
    const categoryId = created.categoryId!;
    expect(await store.getState().updateCategory(categoryId, 1, '课程')).toEqual({ ok: true });
    expect(await store.getState().deleteCategory(categoryId, 2)).toEqual({ ok: true });
    expect(store.getState().categories).toHaveLength(0);
  });

  test('updates a task explicitly and keeps the previous value when persistence fails', async () => {
    const input = {
      title: '修改后的任务', kind: 'pomodoro' as const, timerMode: 'countdown' as const,
      estimateMinutes: 40, restMinutes: 10, deadlineAt: null, targetAmount: null, targetUnit: null,
      mustDo: false, forcedTriggerTime: null,
    };
    const success = createTaskStore(createRepository().repository, [pomodoroTask]);
    const failure = createTaskStore(createRepository({ updateError: new Error('保存失败') }).repository, [pomodoroTask]);

    expect(await success.getState().updateTask('task-one', 1, input)).toEqual({ ok: true });
    expect(success.getState().tasks[0]).toMatchObject({ title: '修改后的任务', estimateMinutes: 40, version: 2 });
    expect(await failure.getState().updateTask('task-one', 1, input)).toEqual({ ok: false, error: '保存失败' });
    expect(failure.getState().tasks[0].title).toBe('第一项任务');
  });

  test('does not allow a goal target below its recorded progress', async () => {
    const store = createTaskStore(createRepository().repository, [{ ...goalTask, completedAmount: 6 }]);

    const result = await store.getState().updateTask('task-goal', 1, {
      title: goalTask.title, timerMode: 'countdown', estimateMinutes: 30, restMinutes: 5,
      deadlineAt: goalTask.deadlineAt, targetAmount: 5, targetUnit: '页', mustDo: false, forcedTriggerTime: null,
    });

    expect(result).toEqual({ ok: false, error: '目标量不能小于已完成量' });
    expect(store.getState().tasks[0].targetAmount).toBe(10);
  });

  test('rejects a stale edit snapshot after synchronization advances the task', async () => {
    const store = createTaskStore(createRepository().repository, [{ ...pomodoroTask, version: 2 }]);
    const result = await store.getState().updateTask('task-one', 1, {
      title: '旧表单覆盖', timerMode: 'countdown', estimateMinutes: 25, restMinutes: 5,
      deadlineAt: null, targetAmount: null, targetUnit: null, mustDo: false, forcedTriggerTime: null,
    });

    expect(result).toEqual({ ok: false, error: '任务已更新，请关闭编辑窗口后重试' });
    expect(store.getState().tasks[0].title).toBe('第一项任务');
  });

  test('recomputes goal completion status when the target changes', async () => {
    const completed = createTaskStore(createRepository().repository, [{ ...goalTask, completedAmount: 6, targetAmount: 6, status: 'completed' }]);
    const pending = createTaskStore(createRepository().repository, [{ ...goalTask, completedAmount: 6, targetAmount: 10, status: 'pending' }]);
    const base = { title: goalTask.title, timerMode: 'countdown' as const, estimateMinutes: 30, restMinutes: 5,
      deadlineAt: goalTask.deadlineAt, targetUnit: '页', mustDo: false, forcedTriggerTime: null };

    await completed.getState().updateTask('task-goal', 1, { ...base, targetAmount: 8 });
    await pending.getState().updateTask('task-goal', 1, { ...base, targetAmount: 6 });

    expect(completed.getState().tasks[0].status).toBe('pending');
    expect(pending.getState().tasks[0].status).toBe('completed');
  });

  test('rejects edits that the server would reject', async () => {
    const store = createTaskStore(createRepository().repository, [pomodoroTask]);
    const result = await store.getState().updateTask('task-one', 1, {
      title: pomodoroTask.title, timerMode: 'countdown', estimateMinutes: 181.5, restMinutes: 5,
      deadlineAt: null, targetAmount: null, targetUnit: null, mustDo: false, forcedTriggerTime: null,
    });

    expect(result).toEqual({ ok: false, error: '专注时长必须是 1–180 分钟的整数' });
  });

  test('restores native lock state into SQLite after process restart', async () => {
    const { repository } = createRepository();
    const engine: LockEngine = {
      async checkCapabilities() { return testCapabilities(); }, async confirmRisk() { return undefined; },
      async getActiveSession() { return { id: 'native-lock', taskId: 'task-one', taskTitle: '第一项任务', startedAt: 1000, endsAt: 61_000, enhanced: true }; },
      async startLockSession() { return undefined; }, async endLockSession() { return undefined; }, async emergencyExit() { return undefined; },
      async applyFocusRestrictions() { return undefined; }, async clearFocusRestrictions() { return undefined; },
      async drainFocusRestrictionEvents() { return []; },
      async scheduleForcedRule() { return undefined; }, async cancelForcedRule() { return undefined; }, async markForcedRuleSatisfied() { return undefined; }, async openPermissionSettings() { return undefined; }, async listLaunchableApps() { return []; },
    };
    const store = createTaskStore(repository, [], () => 2000, engine);
    await store.getState().hydrate();
    expect(store.getState().activeSession).toMatchObject({ id: 'native-lock', mode: 'lock', plannedEndAt: 61_000 });
  });

  test('starts and emergency-exits a native lock session', async () => {
    const { repository, sessions } = createRepository();
    const calls: string[] = [];
    const engine: LockEngine = {
      async checkCapabilities() { return { ...testCapabilities(), notificationGranted: true, notificationListenerEnabled: true, riskConfirmed: true,
        usageAccess: { supported: true, effective: false, reason: '未授权' }, overlay: { supported: true, effective: false, reason: '未授权' },
        backgroundLaunch: { supported: true, effective: false, reason: '未授权' } }; },
      async confirmRisk() { return undefined; }, async getActiveSession() { return null; },
      async startLockSession(input) { calls.push(`start:${input.taskId}`); }, async endLockSession(id) { calls.push(`end:${id}`); },
      async emergencyExit(_id, reason) { calls.push(`emergency:${reason}`); }, async scheduleForcedRule() { return undefined; }, async cancelForcedRule() { return undefined; }, async markForcedRuleSatisfied() { return undefined; }, async openPermissionSettings() { return undefined; }, async listLaunchableApps() { return []; },
      async drainFocusRestrictionEvents() { return []; },
      async applyFocusRestrictions() { throw new Error('锁机不应调用普通软件限制'); }, async clearFocusRestrictions() { calls.push('clear'); },
    };
    const store = createTaskStore(repository, [pomodoroTask], () => 1000, engine);

    await store.getState().startSession('task-one', 'lock');
    await store.getState().finishSession('exited', undefined, '临时就医');

    expect(calls).toEqual(['start:task-one', 'emergency:临时就医', 'clear']);
    expect(sessions[0]).toMatchObject({ mode: 'lock', failureReason: '临时就医' });
  });

  test('applies supported focus restrictions and clears them after completion', async () => {
    const { repository } = createRepository();
    const calls: string[] = [];
    const store = createTaskStore(repository, [pomodoroTask], () => 1000, testLockEngine(calls));

    await store.getState().startSession('task-one', 'focus');
    await store.getState().finishSession('completed');

    expect(calls).toEqual(['restrict:false:true:true', 'clear']);
  });

  test('enforces no-pause, no-early-complete and no-cancel strict options', async () => {
    let time = 1_000;
    const store = createTaskStore(createRepository().repository, [pomodoroTask], () => time, testLockEngine([]));
    store.getState().toggleStrictOption('no-pause');
    store.getState().toggleStrictOption('no-early-complete');
    store.getState().toggleStrictOption('no-cancel');
    await store.getState().startSession('task-one', 'focus');

    await store.getState().toggleSessionPause();
    expect(store.getState().activeSession?.pausedAt).toBeNull();
    expect(store.getState().error).toBe('当前专注禁止暂停');
    await store.getState().finishSession('completed');
    expect(store.getState().activeSession).not.toBeNull();
    expect(store.getState().error).toBe('当前专注禁止提前完成');
    await store.getState().finishSession('exited');
    expect(store.getState().activeSession).not.toBeNull();
    expect(store.getState().error).toBe('当前专注禁止取消');
    time += 25 * 60_000;
    await store.getState().finishSession('completed');
    expect(store.getState().activeSession?.phase).toBe('rest');
  });

  test('persists pause state, extends a countdown on resume and excludes paused time', async () => {
    const { repository, sessions } = createRepository();
    const calls: string[] = [];
    let time = 1_000;
    const store = createTaskStore(repository, [pomodoroTask], () => time, testLockEngine(calls));

    await store.getState().startSession('task-one', 'focus');
    const originalEnd = store.getState().activeSession!.plannedEndAt!;
    time = 61_000;
    await store.getState().toggleSessionPause();
    expect(store.getState().activeSession).toMatchObject({ pausedAt: 61_000, accumulatedPausedMs: 0 });
    time = 121_000;
    await store.getState().toggleSessionPause();
    expect(store.getState().activeSession).toMatchObject({
      pausedAt: null, accumulatedPausedMs: 60_000, plannedEndAt: originalEnd + 60_000,
    });
    time = 181_000;
    await store.getState().finishSession('completed');
    expect(sessions[0].durationSeconds).toBe(120);
  });

  test('keeps native restrictions active for an indefinitely paused session', async () => {
    const applied: FocusRestrictionOptions[] = [];
    const engine = {
      ...testLockEngine([]),
      async applyFocusRestrictions(options: FocusRestrictionOptions) {
        applied.push(options);
        return { supported: true, effective: true, reason: null };
      },
    } as LockEngine;
    const store = createTaskStore(createRepository().repository, [pomodoroTask], () => 1_000, engine);
    await store.getState().startSession('task-one', 'focus');

    await store.getState().toggleSessionPause();

    expect(applied.at(-1)?.expiresAt).toBe(Number.MAX_SAFE_INTEGER);
  });

  test('automatically completes an expired countdown once and enters rest', async () => {
    const { repository, sessions } = createRepository();
    let time = 1_000;
    const store = createTaskStore(repository, [pomodoroTask], () => time, testLockEngine([]));
    await store.getState().startSession('task-one', 'focus');
    time = 1_000 + 10 * 60 * 60_000;

    const [first, second] = await Promise.all([
      store.getState().completeExpiredCountdown('foreground'),
      store.getState().completeExpiredCountdown('foreground'),
    ]);

    expect([first, second].sort()).toEqual(['completed', 'ignored']);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].durationSeconds).toBe(25 * 60);
    expect(store.getState().activeSession?.phase).toBe('rest');
  });

  test('reports an automatic completion failure without immediately retrying it', async () => {
    const { repository, sessions } = createRepository({ finishError: new Error('事务失败') });
    let time = 1_000;
    const store = createTaskStore(repository, [pomodoroTask], () => time, testLockEngine([]));
    await store.getState().startSession('task-one', 'focus');
    time += 26 * 60_000;

    expect(await store.getState().completeExpiredCountdown('foreground')).toBe('failed');
    expect(sessions).toHaveLength(0);
    expect(store.getState().activeSession?.phase).toBe('focus');
    expect(store.getState().error).toBe('事务失败');
  });

  test('asks for goal progress instead of automatically completing an expired goal', async () => {
    const { repository, sessions } = createRepository();
    let time = 1_000;
    const store = createTaskStore(repository, [goalTask], () => time, testLockEngine([]));
    await store.getState().startSession('task-goal', 'focus');
    time += 31 * 60_000;

    expect(await store.getState().completeExpiredCountdown('foreground')).toBe('goal-confirmation-required');
    expect(sessions).toHaveLength(0);
    expect(store.getState().activeSession?.phase).toBe('focus');
  });

  test('does not automatically complete a paused countdown', async () => {
    const { repository, sessions } = createRepository();
    let time = 1_000;
    const store = createTaskStore(repository, [pomodoroTask], () => time, testLockEngine([]));
    await store.getState().startSession('task-one', 'focus');
    time += 60_000;
    await store.getState().toggleSessionPause();
    time += 30 * 60_000;

    expect(await store.getState().completeExpiredCountdown('foreground')).toBe('ignored');
    expect(sessions).toHaveLength(0);
    expect(store.getState().activeSession?.pausedAt).not.toBeNull();
  });

  test('clears restrictions when session persistence fails to start', async () => {
    const { repository } = createRepository({ startError: new Error('start failed') });
    const calls: string[] = [];
    const store = createTaskStore(repository, [pomodoroTask], () => 1000, testLockEngine(calls));

    await store.getState().startSession('task-one', 'focus');

    expect(calls).toEqual(['restrict:false:true:true', 'clear']);
    expect(store.getState().activeSession).toBeNull();
  });

  test('keeps active focus restrictions during an automatic sync refresh', async () => {
    const { repository } = createRepository();
    const calls: string[] = [];
    const store = createTaskStore(repository, [pomodoroTask], () => 1000, testLockEngine(calls));

    await store.getState().startSession('task-one', 'focus');
    await store.getState().hydrate();

    expect(calls).toEqual(['restrict:false:true:true']);
    expect(store.getState().activeSession?.taskId).toBe('task-one');
  });

  test('hydrates the active session for restart recovery', async () => {
    clearAnalyticsEvents();
    const recovered: ActiveSession = {
      id: 'session-recovered', taskId: 'task-one', mode: 'focus', timerMode: 'countdown',
      phase: 'focus', startedAt: 1000, plannedEndAt: 2000, restEndsAt: null,
    };
    const { repository } = createRepository({ activeSession: recovered });
    const calls: string[] = [];
    const store = createTaskStore(repository, [], () => 1_500, testLockEngine(calls));

    await store.getState().hydrate();

    expect(store.getState().activeSession).toMatchObject({ id: recovered.id, restrictionMode: 'whitelist', restrictionEffective: true });
    expect(calls).toEqual(['restrict:false:true:true']);
    expect(store.getState().tasks).toHaveLength(2);
    expect(getAnalyticsEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'focus_restriction_recovered', props: {
        activeSessionFound: true,
        nativeStateFound: true,
        action: 'restored',
      } }),
    ]));
  });

  test('closes a recovered session without reapplying restrictions when signed out', async () => {
    const recovered: ActiveSession = {
      id: 'session-signed-out', taskId: 'task-one', mode: 'focus', timerMode: 'countdown',
      phase: 'focus', startedAt: 1_000, plannedEndAt: 61_000, plannedFocusSeconds: 60,
      restEndsAt: null, pausedAt: null, accumulatedPausedMs: 0,
    };
    const { repository, sessions } = createRepository({ activeSession: recovered });
    const calls: string[] = [];
    const store = createTaskStore(repository, [], () => 10_000, testLockEngine(calls));

    await store.getState().hydrate(false);

    expect(calls).toEqual(['clear']);
    expect(store.getState().activeSession).toBeNull();
    expect(store.getState().tasks.find((task) => task.id === 'task-one')?.status).toBe('pending');
    expect(sessions[0]).toMatchObject({ id: recovered.id, outcome: 'exited', failureReason: '退出登录' });
  });

  test('completes an expired recovered countdown during hydration', async () => {
    const recovered: ActiveSession = {
      id: 'session-expired', taskId: 'task-one', mode: 'focus', timerMode: 'countdown',
      phase: 'focus', startedAt: 1_000, plannedEndAt: 61_000, plannedFocusSeconds: 60,
      restEndsAt: null, pausedAt: null, accumulatedPausedMs: 0,
    };
    const { repository, sessions } = createRepository({ activeSession: recovered });
    const store = createTaskStore(repository, [], () => 120_000, testLockEngine([]));

    await store.getState().hydrate();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].durationSeconds).toBe(60);
    expect(store.getState().activeSession?.phase).toBe('rest');
  });

  test('clears stale native restrictions when no session is recovered', async () => {
    const { repository } = createRepository();
    const calls: string[] = [];
    const store = createTaskStore(repository, [], () => 1000, testLockEngine(calls));

    await store.getState().hydrate();

    expect(calls).toEqual(['clear']);
  });

  test('clears stale native restrictions when local hydration fails without a native lock session', async () => {
    const { repository } = createRepository({ hydrateError: new Error('read failed') });
    const calls: string[] = [];
    const store = createTaskStore(repository, [], () => 1000, testLockEngine(calls));

    await store.getState().hydrate();

    expect(calls).toEqual(['clear']);
    expect(store.getState().error).toBe('read failed');
  });

  test('does not clear restrictions when native lock state cannot be queried', async () => {
    const { repository } = createRepository();
    const calls: string[] = [];
    const engine = testLockEngine(calls);
    engine.getActiveSession = async () => { throw new Error('native unavailable'); };
    const store = createTaskStore(repository, [], () => 1000, engine);

    await store.getState().hydrate();

    expect(calls).toEqual([]);
    expect(store.getState().error).toBe('native unavailable');
  });

  test('closes a stale local lock session when native lock state is gone', async () => {
    const staleLock: ActiveSession = {
      id: 'stale-lock', taskId: 'task-one', mode: 'lock', timerMode: 'countdown',
      phase: 'focus', startedAt: 1000, plannedEndAt: 61_000, restEndsAt: null,
    };
    const { repository, sessions } = createRepository({ activeSession: staleLock });
    const calls: string[] = [];
    const store = createTaskStore(repository, [], () => 70_000, testLockEngine(calls));

    await store.getState().hydrate();

    expect(calls).toEqual(['clear']);
    expect(store.getState().activeSession).toBeNull();
    expect(store.getState().tasks.find((task) => task.id === 'task-one')?.status).toBe('pending');
    expect(sessions[0]).toMatchObject({ id: 'stale-lock', outcome: 'exited' });
  });

  test('starts countdown with a recoverable planned end timestamp', async () => {
    const { repository } = createRepository();
    const store = createTaskStore(repository, [pomodoroTask], () => 1000, testLockEngine([]));

    await store.getState().startSession('task-one', 'focus');

    expect(store.getState().activeSession).toMatchObject({
      taskId: 'task-one', timerMode: 'countdown', phase: 'focus', startedAt: 1000,
      plannedEndAt: 1_501_000,
    });
  });

  test('requires user-confirmed amount for goal completion', async () => {
    const { repository, sessions } = createRepository();
    let time = 1000;
    const store = createTaskStore(repository, [goalTask], () => time++, testLockEngine([]));
    await store.getState().startSession('task-goal', 'focus');

    await store.getState().finishSession('completed');
    expect(store.getState().error).toBe('请输入本次完成量');
    expect(sessions).toHaveLength(0);

    await store.getState().finishSession('completed', 4);
    expect(sessions[0]?.completedAmount).toBe(4);
    expect(store.getState().tasks[0]?.completedAmount).toBe(4);
    expect(store.getState().tasks[0]?.status).toBe('pending');
  });

  test('adds manual goal progress and completes at the target', async () => {
    const { repository } = createRepository();
    const store = createTaskStore(repository, [goalTask], () => 1000);

    await store.getState().addGoalProgress('task-goal', 10);

    expect(store.getState().tasks[0]).toMatchObject({ completedAmount: 10, status: 'completed', version: 2, syncStatus: 'pending' });
  });

  test('blocks a task that is active on another device', async () => {
    const { repository } = createRepository();
    const store = createTaskStore(repository, [{ ...pomodoroTask, remoteActive: true }]);

    await store.getState().startSession('task-one', 'focus');

    expect(store.getState().activeSession).toBeNull();
  });

  test('selects only executable local tasks for focus', () => {
    const { repository } = createRepository();
    const store = createTaskStore(repository, [pomodoroTask, goalTask]);
    store.getState().selectTask('task-goal');
    expect(store.getState().selectedTaskId).toBe('task-goal');
    store.setState({ tasks: [{ ...pomodoroTask, remoteActive: true }, goalTask] });
    store.getState().selectTask('task-one');
    expect(store.getState().selectedTaskId).toBe('task-goal');
    store.setState({ tasks: [pomodoroTask, { ...goalTask, status: 'failed' }] });
    store.getState().selectTask('task-goal');
    expect(store.getState().selectedTaskId).toBe('task-goal');
  });

  test('enters rest and writes only one record when finish actions race', async () => {
    const { repository, sessions } = createRepository();
    let time = 1000;
    const store = createTaskStore(repository, [pomodoroTask], () => time++, testLockEngine([]));
    await store.getState().startSession('task-one', 'focus');

    await Promise.all([
      store.getState().finishSession('completed'),
      store.getState().finishSession('exited'),
    ]);

    expect(sessions).toHaveLength(1);
    expect(store.getState().activeSession?.phase).toBe('rest');
    await store.getState().finishRest();
    expect(store.getState().activeSession).toBeNull();
  });

  test('keeps the focus session retryable after transaction failure', async () => {
    const { repository, sessions } = createRepository({ finishError: new Error('事务失败') });
    const store = createTaskStore(repository, [pomodoroTask], Date.now, testLockEngine([]));
    await store.getState().startSession('task-one', 'focus');

    await store.getState().finishSession('completed');

    expect(sessions).toHaveLength(0);
    expect(store.getState().activeSession?.phase).toBe('focus');
    expect(store.getState().error).toBe('事务失败');
  });

  test('exposes create errors without replacing tasks', async () => {
    const { repository } = createRepository({ createError: new Error('写入失败') });
    const store = createTaskStore(repository, [pomodoroTask]);
    const input: CreateTaskInput = {
      title: '新任务', category: '测试', kind: 'pomodoro', timerMode: 'untimed',
      estimateMinutes: 25, restMinutes: 0, deadlineAt: null, targetAmount: null,
      targetUnit: null, mustDo: false, forcedTriggerTime: null, trustLevel: 'medium',
    };

    const result = await store.getState().createTask(input);

    expect(result).toEqual({ ok: false, error: '写入失败' });
    expect(store.getState().error).toBe('写入失败');
    expect(store.getState().tasks).toHaveLength(1);
  });

  test('returns the created task id after a successful write', async () => {
    const { repository } = createRepository();
    const store = createTaskStore(repository, []);
    const result = await store.getState().createTask({
      title: 'new task', category: 'inbox', kind: 'pomodoro', timerMode: 'untimed',
      estimateMinutes: 25, restMinutes: 5, deadlineAt: null, targetAmount: null,
      targetUnit: null, mustDo: false, forcedTriggerTime: null, trustLevel: 'medium',
    });

    expect(result).toEqual({ ok: true, taskId: 'task-created' });
    expect(store.getState().selectedTaskId).toBe('task-created');
  });
});

function supportedRestriction() { return { supported: true, effective: false, reason: null }; }

function testLockEngine(calls: string[]): LockEngine {
  return {
    async checkCapabilities() { return testCapabilities(); },
    async confirmRisk() { return undefined; }, async getActiveSession() { return null; },
    async startLockSession() { return undefined; }, async endLockSession() { return undefined; }, async emergencyExit() { return undefined; },
    async applyFocusRestrictions(options) { calls.push(`restrict:${options.hideRecents}:${options.blockLeaving}:${options.blockNotifications}`); },
    async drainFocusRestrictionEvents() { return []; },
    async clearFocusRestrictions() { calls.push('clear'); }, async scheduleForcedRule() { return undefined; }, async cancelForcedRule() { return undefined; }, async markForcedRuleSatisfied() { return undefined; }, async openPermissionSettings() { return undefined; }, async listLaunchableApps() { return []; },
  };
}

function testCapabilities() {
  return { supported: true, manufacturer: 'test', sdkInt: 36, vendorBackgroundSettingsAvailable: true, notificationGranted: true, notificationListenerEnabled: true, accessibilityEnabled: true, batteryOptimizationIgnored: true, riskConfirmed: true, emergencyExitsRemaining: 2, exactAlarmAllowed: true, restrictions: { hideRecents: supportedRestriction(), blockLeaving: supportedRestriction(), blockNotifications: supportedRestriction(), whitelist: supportedRestriction(), hideLauncherIcon: { supported: false, effective: false, reason: 'unsupported', experimental: true } } };
}
