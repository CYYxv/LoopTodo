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
import { createUuid } from '@/shared/uuid';
import type { TaskRepository } from './task.repository';
import type { CreateTaskInput, Task } from './task.types';
import { lockEngine } from '@/modules/lock-engine/lock-engine.store';
import type { LockEngine } from '@/modules/lock-engine/lock-engine.port';
import { createNativeForcedTriggerScheduler } from '@/modules/forced-trigger/native-forced-trigger.scheduler';
import type { ForcedTriggerScheduler } from '@/modules/forced-trigger/forced-trigger.scheduler';

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
  createTask(input: CreateTaskInput): Promise<CreateTaskResult>;
  startSession(taskId: string, mode: SessionMode): Promise<void>;
  finishSession(outcome: SessionOutcome, completedAmount?: number, exitReason?: string): Promise<void>;
  finishRest(): Promise<void>;
  addGoalProgress(taskId: string, amount: number): Promise<void>;
  selectMode(mode: SessionMode): void;
  toggleStrictOption(optionId: string): void;
  clearError(): void;
};

export type CreateTaskResult = { ok: true; taskId: string } | { ok: false; error: string };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '发生未知错误';
}

export function createTaskStore(
  repository: TaskRepository,
  initialTasks: Task[] = [],
  now: () => number = Date.now,
  nativeLockEngine: LockEngine = lockEngine,
  forcedScheduler: ForcedTriggerScheduler = createNativeForcedTriggerScheduler()
) {
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
        const [snapshot, nativeSession] = await Promise.all([repository.hydrate(), nativeLockEngine.getActiveSession().catch(() => null)]);
        let recoveredTasks = snapshot.tasks;
        let recoveredSession = snapshot.activeSession;
        if (nativeSession && !recoveredSession) {
          const task = recoveredTasks.find((candidate) => candidate.id === nativeSession.taskId);
          if (task) {
            recoveredSession = { id: nativeSession.id, taskId: nativeSession.taskId, mode: 'lock', timerMode: task.timerMode,
              phase: 'focus', startedAt: nativeSession.startedAt, plannedEndAt: nativeSession.endsAt, restEndsAt: null };
            const activeTask = { ...task, status: 'active' as const, version: task.version + 1, syncStatus: 'pending' as const };
            await repository.startSession(activeTask, recoveredSession);
            recoveredTasks = recoveredTasks.map((candidate) => candidate.id === activeTask.id ? activeTask : candidate);
          }
        }
        set((state) => ({
          ...snapshot, tasks: recoveredTasks, activeSession: recoveredSession,
          selectedTaskId: recoveredTasks.some((task) => task.id === state.selectedTaskId)
            ? state.selectedTaskId
            : recoveredTasks.find((task) => task.status !== 'completed')?.id ?? null,
          isHydrating: false,
        }));
        try { await Promise.all(recoveredTasks.filter((task) => task.mustDo && task.forcedTriggerTime && task.status === 'pending').map((task) => scheduleTask(forcedScheduler, task))); }
        catch (error) { set({ error: errorMessage(error) }); }
        if (
          recoveredSession?.phase === 'rest' &&
          recoveredSession.restEndsAt &&
          recoveredSession.restEndsAt <= now()
        ) {
          await get().finishRest();
        }
      } catch (error) {
        set({ isHydrating: false, error: errorMessage(error) });
      }
    },
    async createTask(input) {
      if (get().isHydrating) return { ok: false, error: '任务数据仍在恢复，请稍后重试' };
      set({ error: null });
      try {
        const task = await repository.create(input);
        set((state) => ({ tasks: [task, ...state.tasks], selectedTaskId: task.id }));
        if (task.mustDo && task.forcedTriggerTime) try { await scheduleTask(forcedScheduler, task); } catch (error) { set({ error: errorMessage(error) }); }
        return { ok: true, taskId: task.id };
      } catch (error) {
        const nextError = errorMessage(error);
        set({ error: nextError });
        return { ok: false, error: nextError };
      }
    },
    async startSession(taskId, mode) {
      const state = get();
      const task = state.tasks.find((candidate) => candidate.id === taskId);
      if (!task || task.status === 'completed' || task.remoteActive || state.isHydrating ||
          state.isStartingSession || state.activeSession) return;

      const startedAt = now();
      const session: ActiveSession = {
        id: createUuid(),
        taskId,
        mode,
        timerMode: task.timerMode,
        phase: 'focus',
        startedAt,
        plannedEndAt: mode === 'lock' || task.timerMode === 'countdown' ? startedAt + Math.min(180, task.estimateMinutes) * 60_000 : null,
        restEndsAt: null,
      };
      const activeTask: Task = { ...task, status: 'active', version: task.version + 1, syncStatus: 'pending' };
      set({ error: null, isStartingSession: true });
      try {
        if (mode === 'lock') {
          const capabilities = await nativeLockEngine.checkCapabilities();
          if (!capabilities.supported || !capabilities.notificationGranted || !capabilities.notificationListenerEnabled || !capabilities.riskConfirmed) {
            throw new Error('请先完成锁机风险确认并开启通知与通知读取权限');
          }
          await nativeLockEngine.startLockSession({ id: session.id, taskId, taskTitle: task.title,
            startedAt, endsAt: session.plannedEndAt!, enhanced: capabilities.accessibilityEnabled });
        }
        await repository.startSession(activeTask, session);
        let forcedRuleError: string | null = null;
        if (task.mustDo && task.forcedTriggerTime) try { await forcedScheduler.cancel(taskRuleId(task.id)); }
        catch (error) { forcedRuleError = errorMessage(error); }
        set((current) => ({
          tasks: current.tasks.map((candidate) => candidate.id === taskId ? activeTask : candidate),
          selectedTaskId: taskId,
          selectedMode: mode,
          activeSession: session,
          isStartingSession: false,
          isFinishingSession: false,
          error: forcedRuleError,
        }));
      } catch (error) {
        if (mode === 'lock') await nativeLockEngine.endLockSession(session.id).catch(() => undefined);
        set({ error: errorMessage(error), isStartingSession: false });
      }
    },
    async finishSession(outcome, completedAmount, exitReason) {
      const { activeSession, isFinishingSession, tasks } = get();
      if (!activeSession || activeSession.phase !== 'focus' || isFinishingSession) return;
      const task = tasks.find((candidate) => candidate.id === activeSession.taskId);
      if (!task) return set({ error: '当前专注任务不存在' });
      if (outcome === 'completed' && task.kind === 'goal' && (!completedAmount || completedAmount <= 0)) {
        return set({ error: '请输入本次完成量' });
      }
      if (outcome === 'exited' && activeSession.mode === 'lock' && !exitReason?.trim()) return set({ error: '请填写紧急退出原因' });

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
        version: task.version + 1,
        syncStatus: 'pending',
        progressLabel: '',
      };
      nextTask.progressLabel = taskProgressLabel(nextTask);
      const record: FocusSessionRecord = {
        ...activeSession,
        endedAt,
        outcome,
        failureReason: outcome === 'exited' ? (exitReason?.trim() || '用户主动退出专注') : null,
        durationSeconds: Math.max(0, Math.floor((endedAt - activeSession.startedAt) / 1000)),
        completedAmount: task.kind === 'goal' && outcome === 'completed' ? completedAmount ?? null : null,
      };
      const restSession = outcome === 'completed' && task.timerMode === 'countdown' && task.restMinutes > 0
        ? { ...activeSession, phase: 'rest' as const, startedAt: endedAt, plannedEndAt: null,
            restEndsAt: endedAt + task.restMinutes * 60_000 }
        : null;

      try {
        if (activeSession.mode === 'lock') {
          if (outcome === 'exited') await nativeLockEngine.emergencyExit(activeSession.id, exitReason!.trim());
          else await nativeLockEngine.endLockSession(activeSession.id);
        }
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
      if (!task || task.kind !== 'goal' || task.remoteActive || !['pending', 'failed'].includes(task.status) || amount <= 0) {
        return set({ error: '目标进度无效或任务正在执行' });
      }
      const completedAmount = Math.min(task.targetAmount ?? 0, task.completedAmount + amount);
      const nextTask = { ...task, completedAmount,
        status: completedAmount >= (task.targetAmount ?? Number.POSITIVE_INFINITY) ? 'completed' as const : 'pending' as const,
        version: task.version + 1,
        syncStatus: 'pending' as const,
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
function taskRuleId(taskId: string) { return `task:${taskId}`; }
function scheduleTask(scheduler: ForcedTriggerScheduler, task: Task) {
  const [hour, minute] = task.forcedTriggerTime!.split(':').map(Number);
  return scheduler.schedule({ id: taskRuleId(task.id), sourceId: task.id, title: task.title,
    durationMinutes: task.estimateMinutes, dailyMinute: hour * 60 + minute, recurring: false });
}
