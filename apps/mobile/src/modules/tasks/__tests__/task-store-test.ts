import type { ActiveSession, FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

import { createTaskStore } from '../task.store';
import type { TaskRepository } from '../task.repository';
import type { CreateTaskInput, Task } from '../task.types';
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
};

function createRepository(options?: {
  activeSession?: ActiveSession;
  createError?: Error;
  finishError?: Error;
}) {
  let tasks = [pomodoroTask, goalTask].map((task) => ({ ...task }));
  let activeSession = options?.activeSession ?? null;
  const sessions: FocusSessionRecord[] = [];
  const repository: TaskRepository = {
    async hydrate() {
      return { tasks, sessionRecords: sessions, activeSession };
    },
    async create(input: CreateTaskInput) {
      if (options?.createError) throw options.createError;
      const task: Task = { ...pomodoroTask, ...input, id: 'task-created', completedAmount: 0, progressLabel: '新任务' };
      tasks = [task, ...tasks];
      return task;
    },
    async startSession(task, session) {
      tasks = tasks.map((candidate) => candidate.id === task.id ? task : candidate);
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
  test('restores native lock state into SQLite after process restart', async () => {
    const { repository } = createRepository();
    const engine: LockEngine = {
      async checkCapabilities() { throw new Error('unused'); }, async confirmRisk() { return undefined; },
      async getActiveSession() { return { id: 'native-lock', taskId: 'task-one', taskTitle: '第一项任务', startedAt: 1000, endsAt: 61_000, enhanced: true }; },
      async startLockSession() { return undefined; }, async endLockSession() { return undefined; }, async emergencyExit() { return undefined; }, async openPermissionSettings() { return undefined; },
    };
    const store = createTaskStore(repository, [], () => 2000, engine);
    await store.getState().hydrate();
    expect(store.getState().activeSession).toMatchObject({ id: 'native-lock', mode: 'lock', plannedEndAt: 61_000 });
  });

  test('starts and emergency-exits a native lock session', async () => {
    const { repository, sessions } = createRepository();
    const calls: string[] = [];
    const engine: LockEngine = {
      async checkCapabilities() { return { supported: true, notificationGranted: true, notificationListenerEnabled: true, accessibilityEnabled: true, batteryOptimizationIgnored: true, riskConfirmed: true, emergencyExitsRemaining: 2 }; },
      async confirmRisk() { return undefined; }, async getActiveSession() { return null; },
      async startLockSession(input) { calls.push(`start:${input.taskId}`); }, async endLockSession(id) { calls.push(`end:${id}`); },
      async emergencyExit(_id, reason) { calls.push(`emergency:${reason}`); }, async openPermissionSettings() { return undefined; },
    };
    const store = createTaskStore(repository, [pomodoroTask], () => 1000, engine);

    await store.getState().startSession('task-one', 'lock');
    await store.getState().finishSession('exited', undefined, '临时就医');

    expect(calls).toEqual(['start:task-one', 'emergency:临时就医']);
    expect(sessions[0]).toMatchObject({ mode: 'lock', failureReason: '临时就医' });
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
      targetUnit: null, mustDo: false, trustLevel: 'medium',
    };

    await store.getState().createTask(input);

    expect(store.getState().error).toBe('写入失败');
    expect(store.getState().tasks).toHaveLength(1);
  });
});
