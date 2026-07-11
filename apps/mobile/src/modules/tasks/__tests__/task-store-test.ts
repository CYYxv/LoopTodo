import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

import { createTaskStore } from '../task.store';
import type { TaskRepository } from '../task.repository';
import type { CreateTaskInput, Task } from '../task.types';

const seedTasks: Task[] = [
  {
    id: 'task-one',
    title: '第一项任务',
    category: '测试',
    kind: 'pomodoro',
    estimateMinutes: 25,
    progressLabel: '倒计时',
    mustDo: true,
    trustLevel: 'high',
    status: 'pending',
  },
  {
    id: 'task-two',
    title: '第二项任务',
    category: '测试',
    kind: 'pomodoro',
    estimateMinutes: 35,
    progressLabel: '倒计时',
    mustDo: false,
    trustLevel: 'medium',
    status: 'pending',
  },
];

function createRepository(options?: {
  createError?: Error;
  finishError?: Error;
  saveGate?: Promise<void>;
}) {
  let tasks = seedTasks.map((task) => ({ ...task }));
  const sessions: FocusSessionRecord[] = [];
  let saveCalls = 0;
  const repository: TaskRepository = {
    async list() {
      return tasks.map((task) => ({ ...task }));
    },
    async create(input: CreateTaskInput) {
      if (options?.createError) {
        throw options.createError;
      }
      const task: Task = { ...input, id: 'task-created', status: 'pending' };
      tasks = [task, ...tasks];
      return task;
    },
    async save(task: Task) {
      saveCalls += 1;
      await options?.saveGate;
      tasks = tasks.map((candidate) => (candidate.id === task.id ? { ...task } : candidate));
    },
    async finishSession(task: Task, record: FocusSessionRecord) {
      if (options?.finishError) {
        throw options.finishError;
      }
      tasks = tasks.map((candidate) => (candidate.id === task.id ? { ...task } : candidate));
      sessions.push({ ...record });
    },
  };
  return { repository, sessions, getSaveCalls: () => saveCalls };
}

describe('task store', () => {
  test('ignores blank task titles', async () => {
    const { repository } = createRepository();
    const store = createTaskStore(repository, seedTasks);

    await store.getState().createTask('   ');

    expect(store.getState().tasks).toHaveLength(2);
  });

  test('starts the selected task instead of the first task', async () => {
    const { repository } = createRepository();
    const store = createTaskStore(repository, seedTasks, () => 1000);

    await store.getState().startSession('task-two', 'focus');

    expect(store.getState().activeSession).toEqual({
      taskId: 'task-two',
      mode: 'focus',
      startedAt: 1000,
    });
    expect(store.getState().tasks.find((task) => task.id === 'task-two')?.status).toBe('active');
  });

  test('rejects lock sessions until the native engine exists', async () => {
    const { repository } = createRepository();
    const store = createTaskStore(repository, seedTasks);

    await store.getState().startSession('task-one', 'lock');

    expect(store.getState().activeSession).toBeNull();
  });

  test('starts a task only once when the start action is tapped repeatedly', async () => {
    let releaseSave: () => void = () => undefined;
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = () => resolve();
    });
    const { repository, getSaveCalls } = createRepository({ saveGate });
    const store = createTaskStore(repository, seedTasks);

    const firstStart = store.getState().startSession('task-one', 'focus');
    const secondStart = store.getState().startSession('task-one', 'focus');
    expect(getSaveCalls()).toBe(1);

    releaseSave();
    await Promise.all([firstStart, secondStart]);
    expect(store.getState().activeSession?.taskId).toBe('task-one');
  });

  test('writes a session only once when completion and exit race', async () => {
    const { repository, sessions } = createRepository();
    let currentTime = 1000;
    const store = createTaskStore(repository, seedTasks, () => currentTime++);
    await store.getState().startSession('task-two', 'focus');

    await Promise.all([
      store.getState().finishSession('completed'),
      store.getState().finishSession('exited'),
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.outcome).toBe('completed');
    expect(store.getState().sessionRecords).toHaveLength(1);
    expect(store.getState().tasks.find((task) => task.id === 'task-two')?.status).toBe(
      'completed'
    );
  });

  test('exposes repository errors without replacing tasks', async () => {
    const { repository } = createRepository({ createError: new Error('写入失败') });
    const store = createTaskStore(repository, seedTasks);

    await store.getState().createTask('新任务');

    expect(store.getState().error).toBe('写入失败');
    expect(store.getState().tasks).toHaveLength(2);
  });

  test('keeps the active session retryable when atomic finish fails', async () => {
    const { repository, sessions } = createRepository({ finishError: new Error('事务失败') });
    const store = createTaskStore(repository, seedTasks);
    await store.getState().startSession('task-one', 'focus');

    await store.getState().finishSession('completed');

    expect(sessions).toHaveLength(0);
    expect(store.getState().activeSession?.taskId).toBe('task-one');
    expect(store.getState().isFinishingSession).toBe(false);
    expect(store.getState().error).toBe('事务失败');
  });
});
