import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type {
  ActiveSession,
  FocusSessionRecord,
  SessionMode,
  SessionOutcome,
  StrictOption,
} from '@/modules/focus-session/focus-session.types';

import { createMemoryTaskRepository } from './memory-task.repository';
import { prototypeStrictOptions, prototypeTasks } from './prototype.data';
import type { TaskRepository } from './task.repository';
import type { Task } from './task.types';

export type TaskStore = {
  tasks: Task[];
  activeSession: ActiveSession | null;
  sessionRecords: FocusSessionRecord[];
  selectedTaskId: string | null;
  selectedMode: SessionMode;
  strictOptions: StrictOption[];
  isHydrating: boolean;
  isStartingSession: boolean;
  isFinishingSession: boolean;
  error: string | null;
  hydrate(): Promise<void>;
  createTask(title: string): Promise<void>;
  startSession(taskId: string, mode: SessionMode): Promise<void>;
  finishSession(outcome: SessionOutcome): Promise<void>;
  selectMode(mode: SessionMode): void;
  toggleStrictOption(optionId: string): void;
  clearError(): void;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '发生未知错误';
}

export function createTaskStore(
  repository: TaskRepository,
  initialTasks: Task[] = [],
  now: () => number = Date.now
) {
  let sessionSequence = 0;

  return createStore<TaskStore>((set, get) => ({
    tasks: initialTasks,
    activeSession: null,
    sessionRecords: [],
    selectedTaskId: initialTasks[0]?.id ?? null,
    selectedMode: 'focus',
    strictOptions: prototypeStrictOptions,
    isHydrating: false,
    isStartingSession: false,
    isFinishingSession: false,
    error: null,
    async hydrate() {
      set({ isHydrating: true, error: null });
      try {
        const tasks = await repository.list();
        set((state) => ({
          tasks,
          selectedTaskId:
            tasks.some((task) => task.id === state.selectedTaskId) ? state.selectedTaskId : tasks[0]?.id ?? null,
          isHydrating: false,
        }));
      } catch (error) {
        set({ isHydrating: false, error: errorMessage(error) });
      }
    },
    async createTask(title) {
      const normalizedTitle = title.trim();
      if (!normalizedTitle || get().isHydrating) {
        return;
      }

      set({ error: null });
      try {
        const task = await repository.create({
          title: normalizedTitle,
          category: '收集箱',
          kind: 'pomodoro',
          estimateMinutes: 25,
          progressLabel: '普通番茄钟 · 默认 25 分钟',
          mustDo: false,
          trustLevel: 'medium',
        });
        set((state) => ({ tasks: [task, ...state.tasks], selectedTaskId: task.id }));
      } catch (error) {
        set({ error: errorMessage(error) });
      }
    },
    async startSession(taskId, mode) {
      const state = get();
      const task = state.tasks.find((candidate) => candidate.id === taskId);
      if (
        !task ||
        task.status === 'completed' ||
        mode === 'lock' ||
        state.isHydrating ||
        state.isStartingSession ||
        state.activeSession
      ) {
        return;
      }

      const activeTask: Task = { ...task, status: 'active' };
      set({ error: null, isStartingSession: true });
      try {
        await repository.save(activeTask);
        set((state) => ({
          tasks: state.tasks.map((candidate) => (candidate.id === taskId ? activeTask : candidate)),
          selectedTaskId: taskId,
          selectedMode: mode,
          activeSession: { taskId, mode, startedAt: now() },
          isStartingSession: false,
          isFinishingSession: false,
        }));
      } catch (error) {
        set({ error: errorMessage(error), isStartingSession: false });
      }
    },
    async finishSession(outcome) {
      const { activeSession, isFinishingSession, tasks } = get();
      if (!activeSession || isFinishingSession) {
        return;
      }

      const task = tasks.find((candidate) => candidate.id === activeSession.taskId);
      if (!task) {
        set({ error: '当前专注任务不存在' });
        return;
      }

      set({ isFinishingSession: true, error: null });
      const endedAt = now();
      const record: FocusSessionRecord = {
        ...activeSession,
        id: `session-${endedAt}-${++sessionSequence}`,
        endedAt,
        outcome,
        failureReason: outcome === 'exited' ? '用户主动退出专注' : null,
      };
      const nextTask: Task = {
        ...task,
        status: outcome === 'completed' ? 'completed' : 'pending',
      };

      try {
        await repository.finishSession(nextTask, record);
        set((state) => ({
          tasks: state.tasks.map((candidate) =>
            candidate.id === nextTask.id ? nextTask : candidate
          ),
          sessionRecords: [record, ...state.sessionRecords],
          activeSession: null,
          isFinishingSession: false,
        }));
      } catch (error) {
        set({ isFinishingSession: false, error: errorMessage(error) });
      }
    },
    selectMode(mode) {
      set({ selectedMode: mode });
    },
    toggleStrictOption(optionId) {
      set((state) => ({
        strictOptions: state.strictOptions.map((option) =>
          option.id === optionId ? { ...option, enabled: !option.enabled } : option
        ),
      }));
    },
    clearError() {
      set({ error: null });
    },
  }));
}

const memoryTaskRepository = createMemoryTaskRepository(prototypeTasks);
export const taskStore = createTaskStore(memoryTaskRepository, prototypeTasks);

export function useTaskStore<T>(selector: (state: TaskStore) => T) {
  return useStore(taskStore, selector);
}
