import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type {
  ActiveSession,
  FocusSessionRecord,
  SessionMode,
  SessionOutcome,
  StrictOption,
} from '@/modules/focus-session/focus-session.types';

import { prototypeStrictOptions } from './prototype.data';
import { createSQLiteTaskRepository } from './sqlite-task.repository';
import { taskProgressLabel } from './task.presentation';
import type { TaskRepository } from './task.repository';
import type { CreateTaskInput, Task } from './task.types';

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
  createTask(input: CreateTaskInput): Promise<void>;
  startSession(taskId: string, mode: SessionMode): Promise<void>;
  finishSession(outcome: SessionOutcome, completedAmount?: number): Promise<void>;
  finishRest(): Promise<void>;
  addGoalProgress(taskId: string, amount: number): Promise<void>;
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
        const snapshot = await repository.hydrate();
        set((state) => ({
          ...snapshot,
          selectedTaskId: snapshot.tasks.some((task) => task.id === state.selectedTaskId)
            ? state.selectedTaskId
            : snapshot.tasks.find((task) => task.status !== 'completed')?.id ?? null,
          isHydrating: false,
        }));
        if (
          snapshot.activeSession?.phase === 'rest' &&
          snapshot.activeSession.restEndsAt &&
          snapshot.activeSession.restEndsAt <= now()
        ) {
          await get().finishRest();
        }
      } catch (error) {
        set({ isHydrating: false, error: errorMessage(error) });
      }
    },
    async createTask(input) {
      if (get().isHydrating) return;
      set({ error: null });
      try {
        const task = await repository.create(input);
        set((state) => ({ tasks: [task, ...state.tasks], selectedTaskId: task.id }));
      } catch (error) {
        set({ error: errorMessage(error) });
      }
    },
    async startSession(taskId, mode) {
      const state = get();
      const task = state.tasks.find((candidate) => candidate.id === taskId);
      if (!task || task.status === 'completed' || mode === 'lock' || state.isHydrating ||
          state.isStartingSession || state.activeSession) return;

      const startedAt = now();
      const session: ActiveSession = {
        id: `session-${startedAt}-${++sessionSequence}`,
        taskId,
        mode,
        timerMode: task.timerMode,
        phase: 'focus',
        startedAt,
        plannedEndAt: task.timerMode === 'countdown' ? startedAt + task.estimateMinutes * 60_000 : null,
        restEndsAt: null,
      };
      const activeTask: Task = { ...task, status: 'active' };
      set({ error: null, isStartingSession: true });
      try {
        await repository.startSession(activeTask, session);
        set((current) => ({
          tasks: current.tasks.map((candidate) => candidate.id === taskId ? activeTask : candidate),
          selectedTaskId: taskId,
          selectedMode: mode,
          activeSession: session,
          isStartingSession: false,
          isFinishingSession: false,
        }));
      } catch (error) {
        set({ error: errorMessage(error), isStartingSession: false });
      }
    },
    async finishSession(outcome, completedAmount) {
      const { activeSession, isFinishingSession, tasks } = get();
      if (!activeSession || activeSession.phase !== 'focus' || isFinishingSession) return;
      const task = tasks.find((candidate) => candidate.id === activeSession.taskId);
      if (!task) return set({ error: '当前专注任务不存在' });
      if (outcome === 'completed' && task.kind === 'goal' && (!completedAmount || completedAmount <= 0)) {
        return set({ error: '请输入本次完成量' });
      }

      set({ isFinishingSession: true, error: null });
      const endedAt = now();
      const nextCompletedAmount = task.kind === 'goal'
        ? Math.min(task.targetAmount ?? 0, task.completedAmount + (outcome === 'completed' ? completedAmount ?? 0 : 0))
        : task.completedAmount;
      const completed = outcome === 'completed' &&
        (task.kind === 'pomodoro' || nextCompletedAmount >= (task.targetAmount ?? Number.POSITIVE_INFINITY));
      const nextTask: Task = {
        ...task,
        completedAmount: nextCompletedAmount,
        status: completed ? 'completed' : 'pending',
        progressLabel: '',
      };
      nextTask.progressLabel = taskProgressLabel(nextTask);
      const record: FocusSessionRecord = {
        ...activeSession,
        endedAt,
        outcome,
        failureReason: outcome === 'exited' ? '用户主动退出专注' : null,
        durationSeconds: Math.max(0, Math.floor((endedAt - activeSession.startedAt) / 1000)),
        completedAmount: task.kind === 'goal' && outcome === 'completed' ? completedAmount ?? null : null,
      };
      const restSession = outcome === 'completed' && task.timerMode === 'countdown' && task.restMinutes > 0
        ? { ...activeSession, phase: 'rest' as const, startedAt: endedAt, plannedEndAt: null,
            restEndsAt: endedAt + task.restMinutes * 60_000 }
        : null;

      try {
        await repository.finishSession(nextTask, record, restSession);
        set((state) => ({
          tasks: state.tasks.map((candidate) => candidate.id === nextTask.id ? nextTask : candidate),
          sessionRecords: [record, ...state.sessionRecords],
          activeSession: restSession,
          isFinishingSession: false,
        }));
      } catch (error) {
        set({ isFinishingSession: false, error: errorMessage(error) });
      }
    },
    async finishRest() {
      if (get().activeSession?.phase !== 'rest' || get().isFinishingSession) return;
      set({ isFinishingSession: true, error: null });
      try {
        await repository.finishRest();
        set({ activeSession: null, isFinishingSession: false });
      } catch (error) {
        set({ isFinishingSession: false, error: errorMessage(error) });
      }
    },
    async addGoalProgress(taskId, amount) {
      const task = get().tasks.find((candidate) => candidate.id === taskId);
      if (!task || task.kind !== 'goal' || !['pending', 'failed'].includes(task.status) || amount <= 0) {
        return set({ error: '目标进度无效或任务正在执行' });
      }
      const completedAmount = Math.min(task.targetAmount ?? 0, task.completedAmount + amount);
      const nextTask = { ...task, completedAmount,
        status: completedAmount >= (task.targetAmount ?? Number.POSITIVE_INFINITY) ? 'completed' as const : 'pending' as const,
        progressLabel: '' };
      nextTask.progressLabel = taskProgressLabel(nextTask);
      try {
        await repository.addGoalProgress(nextTask, amount, `task-progress-${taskId}-${now()}-${Math.random().toString(36).slice(2, 6)}`);
        set((state) => ({ tasks: state.tasks.map((candidate) => candidate.id === taskId ? nextTask : candidate), error: null }));
      } catch (error) { set({ error: errorMessage(error) }); }
    },
    selectMode(mode) { set({ selectedMode: mode }); },
    toggleStrictOption(optionId) {
      set((state) => ({ strictOptions: state.strictOptions.map((option) =>
        option.id === optionId ? { ...option, enabled: !option.enabled } : option) }));
    },
    clearError() { set({ error: null }); },
  }));
}

export const taskStore = createTaskStore(createSQLiteTaskRepository());

export function useTaskStore<T>(selector: (state: TaskStore) => T) {
  return useStore(taskStore, selector);
}
