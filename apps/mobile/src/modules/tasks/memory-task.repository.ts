import type { ActiveSession, FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

import { taskFromInput } from './task.presentation';
import type { TaskRepository } from './task.repository';
import type { Task, TaskCategory } from './task.types';

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
  let categories: TaskCategory[] = [];
  let activeSession: ActiveSession | null = null;

  return {
    async hydrate() {
      return {
        tasks: tasks.map((task) => ({ ...task })),
        categories: categories.map((category) => ({ ...category })),
        sessionRecords: sessions.map((record) => ({ ...record })),
        activeSession: activeSession ? { ...activeSession } : null,
      };
    },
    async create(input) {
      const task = taskFromInput(createId(), input);
      tasks = [task, ...tasks];
      return { ...task };
    },
    async createCategory(category) {
      categories = [category, ...categories];
    },
    async updateCategory(category) {
      categories = categories.map((current) => current.id === category.id ? category : current);
      tasks = tasks.map((task) => task.categoryId === category.id ? { ...task, category: category.name } : task);
    },
    async archiveCategory(category) {
      categories = categories.filter((current) => current.id !== category.id);
      tasks = tasks.map((task) => task.categoryId === category.id ? { ...task, categoryId: null, category: '未分类' } : task);
    },
    async update(task) {
      tasks = tasks.map((current) => current.id === task.id ? { ...task } : current);
    },
    async archive(task) {
      tasks = tasks.map((current) => current.id === task.id ? { ...task } : current);
    },
    async startSession(task, session) {
      tasks = tasks.map((current) => (current.id === task.id ? { ...task } : current));
      activeSession = { ...session };
    },
    async updateActiveSession(session) {
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
