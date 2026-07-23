import * as SecureStore from 'expo-secure-store';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type {
  ActiveSession,
  FocusSessionRecord,
  SessionMode,
  SessionOutcome,
  StrictOption,
} from '@/modules/focus-session/focus-session.types';
import { calculateRecordedDurationSeconds, sessionElapsedMilliseconds } from '@/modules/focus-session/focus-session.utils';

import { prototypeStrictOptions } from './prototype.data';
import { selectedWhitelistPackages, whitelistStore } from '@/modules/focus-session/whitelist.store';
import { track } from '@/modules/analytics/analytics';
import { resolveTaskWhitelistPackages } from './task.whitelist';
import { createSQLiteTaskRepository } from './sqlite-task.repository';
import { taskProgressLabel } from './task.presentation';
import { createUuid } from '@/shared/uuid';
import type { TaskRepository } from './task.repository';
import type { CreateTaskInput, Task, TaskCategory, UpdateTaskInput } from './task.types';
import { taskInputError } from './task.validation';
import { getTaskExecutionState } from './task.execution';
import { lockEngine } from '@/modules/lock-engine/lock-engine.store';
import type { LockEngine } from '@/modules/lock-engine/lock-engine.port';
import type { FocusRestrictionOptions, LockCapabilities } from '@/modules/lock-engine/lock-engine.types';
import { createNativeForcedTriggerScheduler } from '@/modules/forced-trigger/native-forced-trigger.scheduler';
import type { ForcedTriggerScheduler } from '@/modules/forced-trigger/forced-trigger.scheduler';
import { calculateSessionStars, mapTrustToMode } from '../competition/star-rank';
import { familyStore } from '@/modules/family/family.store';
import { collectFamilyAnomalies, isPermissionAnomaly, overdueMustDoTasks } from '@/modules/family/family-anomaly';

export type TaskStore = {
  tasks: Task[];
  categories: TaskCategory[];
  activeSession: ActiveSession | null;
  sessionRecords: FocusSessionRecord[];
  selectedTaskId: string | null;
  selectedMode: SessionMode;
  strictOptions: StrictOption[];
  isHydrating: boolean;
  isStartingSession: boolean;
  isFinishingSession: boolean;
  isTogglingPause: boolean;
  error: string | null;
  lastStarDelta: number | null;
  hydrate(): Promise<void>;
  createTask(input: CreateTaskInput): Promise<CreateTaskResult>;
  updateTask(taskId: string, expectedVersion: number, input: UpdateTaskInput): Promise<UpdateTaskResult>;
  deleteTask(taskId: string, expectedVersion: number): Promise<UpdateTaskResult>;
  createCategory(name: string): Promise<CategoryMutationResult>;
  updateCategory(categoryId: string, expectedVersion: number, name: string): Promise<UpdateTaskResult>;
  deleteCategory(categoryId: string, expectedVersion: number): Promise<UpdateTaskResult>;
  startSession(taskId: string, mode: SessionMode): Promise<void>;
  toggleSessionPause(): Promise<void>;
  completeExpiredCountdown(source: CountdownCompletionSource): Promise<CountdownCompletionResult>;
  finishSession(outcome: SessionOutcome, completedAmount?: number, exitReason?: string, completionNote?: string): Promise<void>;
  finishRest(): Promise<void>;
  addGoalProgress(taskId: string, amount: number): Promise<void>;
  selectTask(taskId: string): void;
  selectMode(mode: SessionMode): void;
  toggleStrictOption(optionId: string): void;
  clearError(): void;
};

export type CreateTaskResult = { ok: true; taskId: string } | { ok: false; error: string };
export type UpdateTaskResult = { ok: true } | { ok: false; error: string };
export type CategoryMutationResult = { ok: true; categoryId: string } | { ok: false; error: string };
export type CountdownCompletionSource = 'foreground' | 'resume' | 'recovery';
export type CountdownCompletionResult = 'completed' | 'goal-confirmation-required' | 'failed' | 'ignored';

const strictOptionsKey = 'looptodo.strict-options';

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
    categories: [],
    activeSession: null,
    sessionRecords: [],
    selectedTaskId: initialTasks[0]?.id ?? null,
    selectedMode: 'focus',
    strictOptions: prototypeStrictOptions,
    isHydrating: false,
    isStartingSession: false,
    isFinishingSession: false,
    isTogglingPause: false,
    error: null,
    lastStarDelta: null,
    async hydrate() {
      if (get().isHydrating) return;
      const existingSessionId = get().activeSession?.id ?? null;
      set({ isHydrating: true, error: null });
      try {
        const [snapshot, nativeSession, savedStrictOptions] = await Promise.all([
          repository.hydrate(),
          nativeLockEngine.getActiveSession(),
          loadStrictOptions().catch(() => prototypeStrictOptions),
          whitelistStore.getState().hydrate().catch(() => undefined),
        ]);
        let recoveredTasks = snapshot.tasks;
        let recoveredSession = snapshot.activeSession;
        let recoveredRecords = snapshot.sessionRecords;
        if (!nativeSession && recoveredSession?.mode === 'lock') {
          const task = recoveredTasks.find((candidate) => candidate.id === recoveredSession?.taskId);
          if (task) {
            const endedAt = now();
            const recoveredTask: Task = {
              ...task,
              status: 'pending',
              version: task.version + 1,
              syncStatus: 'pending',
              progressLabel: '',
            };
            recoveredTask.progressLabel = taskProgressLabel(recoveredTask);
            const record: FocusSessionRecord = {
              ...recoveredSession,
              endedAt,
              outcome: 'exited',
              failureReason: '锁机会话已在系统侧结束',
              durationSeconds: Math.floor(sessionElapsedMilliseconds(recoveredSession, endedAt) / 1000),
              completedAmount: null,
            };
            await repository.finishSession(recoveredTask, record, null);
            recoveredTasks = recoveredTasks.map((candidate) => candidate.id === recoveredTask.id ? recoveredTask : candidate);
            recoveredRecords = [record, ...recoveredRecords];
          } else {
            await repository.finishRest();
          }
          recoveredSession = null;
        }
        if (nativeSession && !recoveredSession) {
          void familyStore.getState().reportAnomaly('reboot_detected', nativeSession.taskId);
          const task = recoveredTasks.find((candidate) => candidate.id === nativeSession.taskId);
          if (task) {
            recoveredSession = { id: nativeSession.id, taskId: nativeSession.taskId, mode: 'lock', timerMode: task.timerMode,
              phase: 'focus', startedAt: nativeSession.startedAt, plannedEndAt: nativeSession.endsAt, restEndsAt: null,
              plannedFocusSeconds: Math.max(0, Math.round((nativeSession.endsAt - nativeSession.startedAt) / 1000)),
              pausedAt: null, accumulatedPausedMs: 0 };
            const activeTask = { ...task, status: 'active' as const, version: task.version + 1, syncStatus: 'pending' as const };
            await repository.startSession(activeTask, recoveredSession);
            recoveredTasks = recoveredTasks.map((candidate) => candidate.id === activeTask.id ? activeTask : candidate);
          }
        }
        set((state) => ({
          ...snapshot, tasks: recoveredTasks, categories: snapshot.categories ?? [], sessionRecords: recoveredRecords, activeSession: recoveredSession, strictOptions: savedStrictOptions,
          selectedTaskId: recoveredTasks.some((task) => task.id === state.selectedTaskId)
            ? state.selectedTaskId
            : recoveredTasks.find((task) => task.status !== 'completed')?.id ?? null,
          isHydrating: false,
        }));
        // 仅「锁机」会话在进程重启后重新施加限制（PRD：锁机杀不掉、可重启恢复）。
        // 「专注」会话可自由退出，进程死亡后不得重新困人——否则残留的 active 会话会让无障碍持续拉回，用户退不出。
        if (recoveredSession?.phase === 'focus' && recoveredSession.mode === 'lock') {
          const capabilities = await nativeLockEngine.checkCapabilities();
          const recoveredTask = recoveredTasks.find((candidate) => candidate.id === recoveredSession.taskId);
          await nativeLockEngine.applyFocusRestrictions(restrictionsFor(
            recoveredSession.mode,
            savedStrictOptions,
            capabilities,
            recoveredTask ? packagesForTask(recoveredTask) : selectedWhitelistPackages(),
            recoveredSession.plannedEndAt ?? 0,
          ));
          if (isPermissionAnomaly(capabilities)) {
            void familyStore.getState().reportAnomaly('permission_disabled', recoveredSession.taskId);
          }
        } else if (recoveredSession?.phase !== 'focus' || recoveredSession.id !== existingSessionId) {
          await nativeLockEngine.clearFocusRestrictions();
        }
        try { await Promise.all(recoveredTasks.filter((task) => task.mustDo && task.forcedTriggerTime && task.status === 'pending').map((task) => scheduleTask(forcedScheduler, task))); }
        catch (error) { set({ error: errorMessage(error) }); }
        try {
          const caps = await nativeLockEngine.checkCapabilities().catch(() => null);
          for (const item of collectFamilyAnomalies(recoveredTasks, caps, now())) {
            void familyStore.getState().reportAnomaly(item.type, item.taskId);
          }
        } catch {
          for (const overdue of overdueMustDoTasks(recoveredTasks, now())) {
            void familyStore.getState().reportAnomaly('task_overdue', overdue.id);
          }
        }
        if (
          recoveredSession?.phase === 'rest' &&
          recoveredSession.restEndsAt &&
          recoveredSession.restEndsAt <= now()
        ) {
          await get().finishRest();
        } else if (recoveredSession?.phase === 'focus') {
          await get().completeExpiredCountdown('recovery');
        }
      } catch (error) {
        try {
          const nativeSession = await nativeLockEngine.getActiveSession();
          if (!nativeSession) await nativeLockEngine.clearFocusRestrictions();
          set({ isHydrating: false, error: errorMessage(error) });
        } catch (recoveryError) {
          const primaryError = errorMessage(error);
          const restrictionError = errorMessage(recoveryError);
          set({ isHydrating: false, error: primaryError === restrictionError
            ? primaryError
            : `${primaryError}；限制状态检查失败：${restrictionError}` });
        }
      }
    },
    async createTask(input) {
      if (get().isHydrating) return { ok: false, error: '任务数据仍在恢复，请稍后重试' };
      const validationError = taskInputError(input.kind, input);
      if (validationError) return { ok: false, error: validationError };
      set({ error: null });
      try {
        const task = await repository.create(input);
        set((state) => ({ tasks: [task, ...state.tasks], selectedTaskId: task.id }));
        if (task.mustDo && task.forcedTriggerTime) try { await scheduleTask(forcedScheduler, task); } catch (error) { set({ error: errorMessage(error) }); }
        track('task_create', { taskId: task.id, kind: task.kind, whitelistMode: task.whitelistMode ?? 'inherit' });
        return { ok: true, taskId: task.id };
      } catch (error) {
        const nextError = errorMessage(error);
        set({ error: nextError });
        return { ok: false, error: nextError };
      }
    },
    async createCategory(name) {
      const normalized = name.trim();
      if (!normalized) return { ok: false, error: '请输入分类名称' };
      if (get().categories.some((category) => category.name === normalized)) return { ok: false, error: '分类名称已存在' };
      const category: TaskCategory = { id: createUuid(), name: normalized, color: null, version: 1, syncStatus: 'pending' };
      try {
        await repository.createCategory(category);
        set((state) => ({ categories: [...state.categories, category], error: null }));
        return { ok: true, categoryId: category.id };
      } catch (error) {
        const nextError = errorMessage(error); set({ error: nextError }); return { ok: false, error: nextError };
      }
    },
    async updateCategory(categoryId, expectedVersion, name) {
      const category = get().categories.find((candidate) => candidate.id === categoryId);
      const normalized = name.trim();
      if (!category) return { ok: false, error: '分类不存在' };
      if (category.version !== expectedVersion) return { ok: false, error: '分类已更新，请重试' };
      if (!normalized) return { ok: false, error: '请输入分类名称' };
      if (get().categories.some((candidate) => candidate.id !== categoryId && candidate.name === normalized)) return { ok: false, error: '分类名称已存在' };
      const next = { ...category, name: normalized, version: category.version + 1, syncStatus: 'pending' as const };
      try {
        await repository.updateCategory(next, category.version);
        set((state) => ({ categories: state.categories.map((candidate) => candidate.id === categoryId ? next : candidate), tasks: state.tasks.map((task) => task.categoryId === categoryId ? { ...task, category: normalized } : task), error: null }));
        return { ok: true };
      } catch (error) {
        const nextError = errorMessage(error); set({ error: nextError }); return { ok: false, error: nextError };
      }
    },
    async deleteCategory(categoryId, expectedVersion) {
      const category = get().categories.find((candidate) => candidate.id === categoryId);
      if (!category) return { ok: false, error: '分类不存在' };
      if (category.version !== expectedVersion) return { ok: false, error: '分类已更新，请重试' };
      const archived = { ...category, version: category.version + 1, syncStatus: 'pending' as const };
      try {
        await repository.archiveCategory(archived, category.version);
        set((state) => ({ categories: state.categories.filter((candidate) => candidate.id !== categoryId), tasks: state.tasks.map((task) => task.categoryId === categoryId ? { ...task, categoryId: null, category: '未分类', version: task.version + 1, syncStatus: 'pending' as const } : task), error: null }));
        return { ok: true };
      } catch (error) {
        const nextError = errorMessage(error); set({ error: nextError }); return { ok: false, error: nextError };
      }
    },
    async updateTask(taskId, expectedVersion, input) {
      const task = get().tasks.find((candidate) => candidate.id === taskId);
      if (!task) return { ok: false, error: '任务不存在' };
      if (task.version !== expectedVersion) return { ok: false, error: '任务已更新，请关闭编辑窗口后重试' };
      if (get().activeSession?.taskId === taskId || task.status === 'active' || task.remoteActive) {
        return { ok: false, error: '任务正在执行，结束专注后才能编辑' };
      }
      if (task.syncStatus === 'conflict') return { ok: false, error: '任务存在同步冲突，请先处理' };
      const validationError = taskInputError(task.kind, input);
      if (validationError) return { ok: false, error: validationError };
      if (task.kind === 'goal' && (input.targetAmount == null || input.targetAmount < task.completedAmount)) {
        return { ok: false, error: '目标量不能小于已完成量' };
      }
      const status = task.kind === 'goal'
        ? task.completedAmount >= (input.targetAmount ?? Number.POSITIVE_INFINITY) ? 'completed' : 'pending'
        : task.status;
      const nextTask: Task = { ...task, ...input, categoryId: input.categoryId === undefined ? task.categoryId ?? null : input.categoryId,
        category: input.category ?? task.category, title: input.title.trim(), targetUnit: input.targetUnit?.trim() || null,
        status, version: task.version + 1, syncStatus: 'pending', progressLabel: '' };
      nextTask.progressLabel = taskProgressLabel(nextTask);
      try {
        await repository.update(nextTask, task.version);
        set((state) => ({ tasks: state.tasks.map((candidate) => candidate.id === taskId ? nextTask : candidate), error: null }));
      } catch (error) {
        const nextError = errorMessage(error);
        set({ error: nextError });
        return { ok: false, error: nextError };
      }
      try {
        if (nextTask.mustDo && nextTask.forcedTriggerTime && nextTask.status === 'pending') await scheduleTask(forcedScheduler, nextTask);
        else await forcedScheduler.cancel(taskRuleId(taskId));
      } catch (error) {
        set({ error: errorMessage(error) });
      }
      return { ok: true };
    },
    async deleteTask(taskId, expectedVersion) {
      const task = get().tasks.find((candidate) => candidate.id === taskId);
      if (!task) return { ok: false, error: '任务不存在' };
      if (task.version !== expectedVersion) return { ok: false, error: '任务已更新，请重试' };
      if (get().activeSession?.taskId === taskId || task.status === 'active' || task.remoteActive) return { ok: false, error: '任务执行中，暂时不能删除' };
      if (task.syncStatus === 'conflict') return { ok: false, error: '任务存在同步冲突，请先处理' };
      const archived = { ...task, status: 'archived' as const, version: task.version + 1, syncStatus: 'pending' as const };
      try {
        await repository.archive(archived, task.version);
        await forcedScheduler.cancel(taskRuleId(taskId)).catch(() => undefined);
        set((state) => ({ tasks: state.tasks.filter((candidate) => candidate.id !== taskId), selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId, error: null }));
        return { ok: true };
      } catch (error) {
        const nextError = errorMessage(error);
        set({ error: nextError });
        return { ok: false, error: nextError };
      }
    },
    async startSession(taskId, mode) {
      const state = get();
      const task = state.tasks.find((candidate) => candidate.id === taskId);
      if (!task || !['available', 'local_active'].includes(getTaskExecutionState(task, state.activeSession)) || state.isHydrating ||
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
        plannedFocusSeconds: mode === 'lock' || task.timerMode === 'countdown'
          ? Math.round(Math.min(180, task.estimateMinutes) * 60)
          : null,
        restEndsAt: null,
        pausedAt: null,
        accumulatedPausedMs: 0,
      };
      const activeTask: Task = { ...task, status: 'active', version: task.version + 1, syncStatus: 'pending' };
      set({ error: null, isStartingSession: true, lastStarDelta: null });
      try {
        const capabilities = await nativeLockEngine.checkCapabilities();
        if (mode === 'lock') {
          if (!capabilities.supported || !capabilities.notificationGranted || !capabilities.notificationListenerEnabled || !capabilities.riskConfirmed) {
            throw new Error('请先完成锁机风险确认并开启通知与通知读取权限');
          }
        }
        const whitelistPackages = packagesForTask(task);
        await nativeLockEngine.applyFocusRestrictions(restrictionsFor(mode, state.strictOptions, capabilities, whitelistPackages, session.plannedEndAt ?? startedAt + 4 * 60 * 60 * 1000));
        if (mode === 'lock') {
          await nativeLockEngine.startLockSession({ id: session.id, taskId, taskTitle: task.title,
            startedAt, endsAt: session.plannedEndAt!, enhanced: capabilities.accessibilityEnabled });
          if (isPermissionAnomaly(capabilities)) {
            void familyStore.getState().reportAnomaly('permission_disabled', taskId);
          }
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
        track(mode === 'lock' ? 'lock_start' : 'focus_start', {
          taskId,
          mode,
          whitelistMode: task.whitelistMode ?? 'inherit',
          packageCount: whitelistPackages.length,
        });
      } catch (error) {
        if (mode === 'lock') await nativeLockEngine.endLockSession(session.id).catch(() => undefined);
        await nativeLockEngine.clearFocusRestrictions().catch(() => undefined);
        set({ error: errorMessage(error), isStartingSession: false });
      }
    },
    async toggleSessionPause() {
      const state = get();
      const session = state.activeSession;
      if (!session || session.phase !== 'focus' || state.isFinishingSession || state.isTogglingPause) return;
      if (session.mode === 'lock') return set({ error: '锁机模式不可暂停' });
      if (strictEnabled(state.strictOptions, 'no-pause')) return set({ error: '当前专注禁止暂停' });
      const timestamp = now();
      const pausedDuration = session.pausedAt == null ? 0 : Math.max(0, timestamp - session.pausedAt);
      const nextSession: ActiveSession = session.pausedAt == null
        ? { ...session, pausedAt: timestamp, accumulatedPausedMs: session.accumulatedPausedMs ?? 0 }
        : { ...session, pausedAt: null, accumulatedPausedMs: (session.accumulatedPausedMs ?? 0) + pausedDuration,
            plannedEndAt: session.plannedEndAt == null ? null : session.plannedEndAt + pausedDuration };
      set({ isTogglingPause: true, error: null });
      try {
        await repository.updateActiveSession(nextSession);
        set({ activeSession: nextSession });
        let restrictionError: string | null = null;
        try {
          const capabilities = await nativeLockEngine.checkCapabilities();
          const pauseTask = state.tasks.find((candidate) => candidate.id === session.taskId);
          await nativeLockEngine.applyFocusRestrictions(restrictionsFor(
            session.mode,
            state.strictOptions,
            capabilities,
            pauseTask ? packagesForTask(pauseTask) : selectedWhitelistPackages(),
            nextSession.pausedAt == null
              ? nextSession.plannedEndAt ?? timestamp + 4 * 60 * 60 * 1000
              : timestamp + 24 * 60 * 60 * 1000,
          ));
        } catch (error) {
          restrictionError = errorMessage(error);
        }
        set({ isTogglingPause: false, error: restrictionError });
      } catch (error) {
        set({ isTogglingPause: false, error: errorMessage(error) });
      }
    },
    async completeExpiredCountdown(source) {
      void source;
      const state = get();
      const session = state.activeSession;
      if (
        !session ||
        session.phase !== 'focus' ||
        session.timerMode !== 'countdown' ||
        session.pausedAt != null ||
        session.plannedEndAt == null ||
        now() < session.plannedEndAt ||
        state.isFinishingSession ||
        state.isTogglingPause
      ) return 'ignored';
      const task = state.tasks.find((candidate) => candidate.id === session.taskId);
      if (!task) return 'ignored';
      if (task.kind === 'goal') return 'goal-confirmation-required';
      await get().finishSession('completed');
      if (get().sessionRecords.some((record) => record.id === session.id)) return 'completed';
      return get().activeSession?.id === session.id && get().error ? 'failed' : 'ignored';
    },
    async finishSession(outcome, completedAmount, exitReason, completionNote) {
      const { activeSession, isFinishingSession, isTogglingPause, tasks } = get();
      if (!activeSession || activeSession.phase !== 'focus' || isFinishingSession || isTogglingPause) return;
      const task = tasks.find((candidate) => candidate.id === activeSession.taskId);
      if (!task) return set({ error: '当前专注任务不存在' });
      if (activeSession.mode === 'focus' && outcome === 'exited' && strictEnabled(get().strictOptions, 'no-cancel')) return set({ error: '当前专注禁止取消' });
      if (outcome === 'completed' && activeSession.plannedEndAt && now() < activeSession.plannedEndAt && strictEnabled(get().strictOptions, 'no-early-complete')) return set({ error: '当前专注禁止提前完成' });
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
        durationSeconds: calculateRecordedDurationSeconds(activeSession, task, endedAt, outcome),
        completedAmount: task.kind === 'goal' && outcome === 'completed' ? completedAmount ?? null : null,
        completionNote: outcome === 'completed' ? completionNote?.trim() || null : null,
      };
      const restSession = outcome === 'completed' && task.timerMode === 'countdown' && task.restMinutes > 0
        ? { ...activeSession, phase: 'rest' as const, startedAt: endedAt, plannedEndAt: null,
            restEndsAt: endedAt + task.restMinutes * 60_000, pausedAt: null, accumulatedPausedMs: 0 }
        : null;

      try {
        if (activeSession.mode === 'lock') {
          if (outcome === 'exited') await nativeLockEngine.emergencyExit(activeSession.id, exitReason!.trim());
          else await nativeLockEngine.endLockSession(activeSession.id);
        }
        await repository.finishSession(nextTask, record, restSession);
        if (activeSession.mode === 'lock' && outcome === 'exited') {
          track('lock_emergency_exit', { taskId: task.id, sessionId: activeSession.id });
        } else if (outcome === 'completed') {
          track('focus_complete', { taskId: task.id, mode: activeSession.mode, sessionId: activeSession.id });
        } else {
          track('focus_fail', { taskId: task.id, mode: activeSession.mode, sessionId: activeSession.id, outcome });
        }
        const restrictionError = await nativeLockEngine.clearFocusRestrictions()
          .then(() => null)
          .catch((error) => errorMessage(error));
        // Preview uses same trust→mode mapping as server; server remains source of truth after sync.
        const hasWhitelist = packagesForTask(task).length > 0;
        const trustLevel = activeSession.mode === 'lock' ? 'high' : hasWhitelist ? 'open' : 'normal';
        const starMode = mapTrustToMode(trustLevel, task.timerMode);
        const starOutcome = outcome === 'completed'
          ? 'completed'
          : outcome === 'exited' && activeSession.mode === 'lock'
            ? 'emergency_exit'
            : 'failed';
        const priorMinutes = Math.floor(
          statePriorMinutes(get().sessionRecords, endedAt),
        );
        const lastStarDelta = calculateSessionStars({
          outcome: starOutcome,
          effectiveMinutes: Math.floor(record.durationSeconds / 60),
          mode: starMode,
          priorEffectiveMinutesToday: priorMinutes,
        });
        track('star_settle', {
          taskId: task.id,
          sessionId: activeSession.id,
          delta: lastStarDelta,
          mode: starMode,
          outcome: starOutcome,
        });
        set((state) => ({
          tasks: state.tasks.map((candidate) => candidate.id === nextTask.id ? nextTask : candidate),
          sessionRecords: [record, ...state.sessionRecords],
          activeSession: restSession,
          isFinishingSession: false,
          error: restrictionError,
          lastStarDelta,
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
    
    async scanFamilyAnomalies() {
      try {
        const tasks = get().tasks;
        const caps = await nativeLockEngine.checkCapabilities().catch(() => null);
        for (const item of collectFamilyAnomalies(tasks, caps, now())) {
          void familyStore.getState().reportAnomaly(item.type, item.taskId);
        }
      } catch {
        // best-effort
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
    selectTask(taskId) {
      const state = get();
      if (state.tasks.some((task) => task.id === taskId && ['available', 'local_active'].includes(getTaskExecutionState(task, state.activeSession)))) {
        set({ selectedTaskId: taskId });
      }
    },
    selectMode(mode) { set({ selectedMode: mode }); },
    toggleStrictOption(optionId) {
      const option = get().strictOptions.find((candidate) => candidate.id === optionId);
      if (!option || option.available === false) return;
      const strictOptions = get().strictOptions.map((candidate) =>
        candidate.id === optionId ? { ...candidate, enabled: !candidate.enabled } : candidate);
      set({ strictOptions });
      void SecureStore.setItemAsync(strictOptionsKey, JSON.stringify(
        Object.fromEntries(strictOptions.map((candidate) => [candidate.id, candidate.enabled]))
      )).catch((error) => set({ error: errorMessage(error) }));
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
  track('forced_trigger_schedule', { taskId: task.id, time: task.forcedTriggerTime });
  const [hour, minute] = task.forcedTriggerTime!.split(':').map(Number);
  return scheduler.schedule({ id: taskRuleId(task.id), sourceId: task.id, title: task.title,
    durationMinutes: task.estimateMinutes, dailyMinute: hour * 60 + minute, recurring: false });
}

async function loadStrictOptions() {
  const raw = await SecureStore.getItemAsync(strictOptionsKey);
  if (!raw) return prototypeStrictOptions;
  const saved = JSON.parse(raw) as Record<string, unknown>;
  return prototypeStrictOptions.map((option) => {
    const enabled = saved[option.id];
    return { ...option, enabled: typeof enabled === 'boolean' ? enabled : option.enabled };
  });
}

function packagesForTask(task: Pick<Task, 'whitelistMode' | 'whitelistPackages'>) {
  return resolveTaskWhitelistPackages(task, selectedWhitelistPackages());
}

function restrictionsFor(
  mode: SessionMode,
  options: StrictOption[],
  capabilities: LockCapabilities,
  whitelistPackages: string[] = [],
  expiresAt = 0,
): FocusRestrictionOptions {
  const restrictions: FocusRestrictionOptions = {
    hideRecents: false,
    blockLeaving: false,
    blockNotifications: false,
    hideLauncherIcon: false,
    allowedPackages: [],
    expiresAt,
  };
  // 锁机模式忽略白名单（PRD 3.4）：只在专注模式启用「仅允许白名单」时注入放行包名。
  let whitelistEnabled = false;
  for (const option of options) {
    const key = option.capabilityKey;
    if (!key) continue;
    const capability = capabilities.restrictions[key];
    const active = capability.supported && (mode === 'lock' || option.enabled);
    if (key === 'whitelist') {
      // 白名单是「阻止离开」的细化：开启后 blockLeaving 生效，并把选中的应用注入放行集合。
      if (active && mode === 'focus') {
        whitelistEnabled = true;
        restrictions.blockLeaving = true;
      }
      continue;
    }
    restrictions[key] = active;
  }
  restrictions.allowedPackages = whitelistEnabled ? whitelistPackages.filter((pkg) => pkg.trim().length > 0) : [];
  return restrictions;
}

function strictEnabled(options: StrictOption[], id: string) {
  return options.some((option) => option.id === id && option.enabled);
}


function statePriorMinutes(records: FocusSessionRecord[], endedAt: number) {
  const day = new Date(endedAt);
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();
  return records.reduce((sum, item) => {
    if (item.outcome !== 'completed' || !item.endedAt || item.id === undefined) return sum;
    const at = new Date(item.endedAt);
    if (at.getFullYear() !== y || at.getMonth() !== m || at.getDate() !== d) return sum;
    // exclude current session which is not yet in records
    return sum + Math.floor((item.durationSeconds ?? 0) / 60);
  }, 0);
}
