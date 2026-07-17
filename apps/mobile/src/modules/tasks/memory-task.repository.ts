import type { ActiveSession, FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

import { taskFromInput } from './task.presentation';
import type { TaskRepository } from './task.repository';
import type { Task } from './task.types';

export type MemoryTaskRepository = TaskRepository & {
  readSessions(): FocusSessionRecord[];
  readActiveSession(): ActiveSession | null;
};

export function createMemoryTaskRepository(
  seedTasks: Task[] = [],
  createId: () => string = () => `task-${Date.now()}`
): MemoryTaskRepository {
  let tasks = seedTasks.map((task) => ({ ...task }));
  let sessions: FocusSessionRecord[] = [];
  let activeSession: ActiveSession | null = null;

  return {
    async hydrate() {
      return {
        tasks: tasks.map((task) => ({ ...task })),
        sessionRecords: sessions.map((record) => ({ ...record })),
        activeSession: activeSession ? { ...activeSession } : null,
      };
    },
    async create(input) {
      const task = taskFromInput(createId(), input);
      tasks = [task, ...tasks];
      return { ...task };
    },
    async update(task) {
      tasks = tasks.map((current) => current.id === task.id ? { ...task } : current);
    },
    async startSession(task, session) {
      tasks = tasks.map((current) => (current.id === task.id ? { ...task } : current));
      activeSession = { ...session };
    },
    async finishSession(task, record, restSession) {
      tasks = tasks.map((current) => (current.id === task.id ? { ...task } : current));
      sessions = [{ ...record }, ...sessions];
      activeSession = restSession ? { ...restSession } : null;
    },
    async finishRest() {
      activeSession = null;
    },
    async addGoalProgress(task) {
      tasks = tasks.map((current) => current.id === task.id ? { ...task } : current);
    },
    readSessions() {
      return sessions.map((record) => ({ ...record }));
    },
    readActiveSession() {
      return activeSession ? { ...activeSession } : null;
    },
  };
}
