import type { ActiveSession, FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

import { createTaskStore } from '../task.store';
import type { TaskRepository } from '../task.repository';
import type { CreateTaskInput, Task, TaskCategory } from '../task.types';
import type { LockEngine } from '@/modules/lock-engine/lock-engine.port';

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
  remoteActive: false,
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

    expect(sessions[0]).toMatchObject({ completionNote: '完成第一章练习' });
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
      async checkCapabilities() { return { supported: true, manufacturer: 'test', sdkInt: 36, vendorBackgroundSettingsAvailable: true, notificationGranted: true, notificationListenerEnabled: true, accessibilityEnabled: true, batteryOptimizationIgnored: true, riskConfirmed: true, emergencyExitsRemaining: 2, exactAlarmAllowed: true, restrictions: { hideRecents: supportedRestriction(), blockLeaving: supportedRestriction(), blockNotifications: supportedRestriction(), whitelist: supportedRestriction(), hideLauncherIcon: { supported: false, effective: false, reason: 'unsupported', experimental: true } } }; },
      async confirmRisk() { return undefined; }, async getActiveSession() { return null; },
      async startLockSession(input) { calls.push(`start:${input.taskId}`); }, async endLockSession(id) { calls.push(`end:${id}`); },
      async emergencyExit(_id, reason) { calls.push(`emergency:${reason}`); }, async scheduleForcedRule() { return undefined; }, async cancelForcedRule() { return undefined; }, async markForcedRuleSatisfied() { return undefined; }, async openPermissionSettings() { return undefined; }, async listLaunchableApps() { return []; },
      async applyFocusRestrictions(options) { calls.push(`restrict:${options.hideRecents}:${options.blockLeaving}:${options.blockNotifications}`); }, async clearFocusRestrictions() { calls.push('clear'); },
    };
    const store = createTaskStore(repository, [pomodoroTask], () => 1000, engine);

    await store.getState().startSession('task-one', 'lock');
    await store.getState().finishSession('exited', undefined, '临时就医');

    expect(calls).toEqual(['restrict:true:true:true', 'start:task-one', 'emergency:临时就医', 'clear']);
    expect(sessions[0]).toMatchObject({ mode: 'lock', failureReason: '临时就医' });
  });

  test('applies supported focus restrictions and clears them after completion', async () => {
    const { repository } = createRepository();
    const calls: string[] = [];
    const store = createTaskStore(repository, [pomodoroTask], () => 1000, testLockEngine(calls));

    await store.getState().startSession('task-one', 'focus');
    await store.getState().finishSession('completed');

    expect(calls).toEqual(['restrict:false:false:true', 'clear']);
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

  test('clears restrictions when session persistence fails to start', async () => {
    const { repository } = createRepository({ startError: new Error('start failed') });
    const calls: string[] = [];
    const store = createTaskStore(repository, [pomodoroTask], () => 1000, testLockEngine(calls));

    await store.getState().startSession('task-one', 'focus');

    expect(calls).toEqual(['restrict:false:false:true', 'clear']);
    expect(store.getState().activeSession).toBeNull();
  });

  test('keeps active focus restrictions during an automatic sync refresh', async () => {
    const { repository } = createRepository();
    const calls: string[] = [];
    const store = createTaskStore(repository, [pomodoroTask], () => 1000, testLockEngine(calls));

    await store.getState().startSession('task-one', 'focus');
    await store.getState().hydrate();

    expect(calls).toEqual(['restrict:false:false:true']);
    expect(store.getState().activeSession?.taskId).toBe('task-one');
  });

  test('hydrates the active session for restart recovery', async () => {
    const recovered: ActiveSession = {
      id: 'session-recovered', taskId: 'task-one', mode: 'focus', timerMode: 'countdown',
      phase: 'focus', startedAt: 1000, plannedEndAt: 2000, restEndsAt: null,
    };
    const { repository } = createRepository({ activeSession: recovered });
    const store = createTaskStore(repository);

    await store.getState().hydrate();

    expect(store.getState().activeSession).toEqual(recovered);
    expect(store.getState().tasks).toHaveLength(2);
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
    const store = createTaskStore(repository, [pomodoroTask], () => 1000);

    await store.getState().startSession('task-one', 'focus');

    expect(store.getState().activeSession).toMatchObject({
      taskId: 'task-one', timerMode: 'countdown', phase: 'focus', startedAt: 1000,
      plannedEndAt: 1_501_000,
    });
  });

  test('requires user-confirmed amount for goal completion', async () => {
    const { repository, sessions } = createRepository();
    let time = 1000;
    const store = createTaskStore(repository, [goalTask], () => time++);
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
    const store = createTaskStore(repository, [pomodoroTask], () => time++);
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
    const store = createTaskStore(repository, [pomodoroTask]);
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
    async clearFocusRestrictions() { calls.push('clear'); }, async scheduleForcedRule() { return undefined; }, async cancelForcedRule() { return undefined; }, async markForcedRuleSatisfied() { return undefined; }, async openPermissionSettings() { return undefined; }, async listLaunchableApps() { return []; },
  };
}

function testCapabilities() {
  return { supported: true, manufacturer: 'test', sdkInt: 36, vendorBackgroundSettingsAvailable: true, notificationGranted: true, notificationListenerEnabled: true, accessibilityEnabled: true, batteryOptimizationIgnored: true, riskConfirmed: true, emergencyExitsRemaining: 2, exactAlarmAllowed: true, restrictions: { hideRecents: supportedRestriction(), blockLeaving: supportedRestriction(), blockNotifications: supportedRestriction(), whitelist: supportedRestriction(), hideLauncherIcon: { supported: false, effective: false, reason: 'unsupported', experimental: true } } };
}
