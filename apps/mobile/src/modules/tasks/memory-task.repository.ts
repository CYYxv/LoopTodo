import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

import type { TaskRepository } from './task.repository';
import type { CreateTaskInput, Task } from './task.types';

export type MemoryTaskRepository = TaskRepository & {
  readSessions(): FocusSessionRecord[];
};

export function createMemoryTaskRepository(
  seedTasks: Task[],
  createId?: () => string
): MemoryTaskRepository {
  let tasks = seedTasks.map((task) => ({ ...task }));
  const sessions: FocusSessionRecord[] = [];
  let taskSequence = 0;
  const nextTaskId = createId ?? (() => `task-${Date.now()}-${++taskSequence}`);

  return {
    async list() {
      return tasks.map((task) => ({ ...task }));
    },
    async create(input: CreateTaskInput) {
      const task: Task = { ...input, id: nextTaskId(), status: 'pending' };
      tasks = [task, ...tasks];
      return { ...task };
    },
    async save(task: Task) {
      tasks = tasks.map((currentTask) => (currentTask.id === task.id ? { ...task } : currentTask));
    },
    async finishSession(task: Task, record: FocusSessionRecord) {
      tasks = tasks.map((currentTask) => (currentTask.id === task.id ? { ...task } : currentTask));
      sessions.unshift({ ...record });
    },
    readSessions() {
      return sessions.map((record) => ({ ...record }));
    },
  };
}
