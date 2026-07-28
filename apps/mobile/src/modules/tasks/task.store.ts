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
import { track } from '@/modules/analytics/analytics';
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
import { calculateSessionStars, type FocusModeForStars } from '../competition/star-rank';
import { familyStore } from '@/modules/family/family.store';
import { collectFamilyAnomalies, isPermissionAnomaly, overdueMustDoTasks } from '@/modules/family/family-anomaly';
import { whitelistStore } from '@/modules/whitelist/whitelist.store';
import { resolveTaskRestriction } from '@/modules/whitelist/whitelist.resolution';
import type { RestrictionMode, SessionRestrictionSnapshot, WhitelistList } from '@/modules/whitelist/whitelist.types';
import { normalizeTaskRestriction } from './task.whitelist';

type WhitelistSource = {
  getState(): {
    lists: WhitelistList[];
    hydrated: boolean;
    error: string | null;
    hydrate(force?: boolean): Promise<void>;
  };
};
type RestrictedSession = ActiveSession & SessionRestrictionSnapshot;
const emptyWhitelistSource: WhitelistSource = {
  getState: () => ({ lists: [], hydrated: true, error: null, hydrate: async () => undefined }),
};

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
  isAuditingRestriction: boolean;
  restrictionCleanupPending: boolean;
  restrictionCleanupError: string | null;
  error: string | null;
  lastStarDelta: number | null;
  lastStarRestrictionMode: RestrictionMode | null;
  hydrate(restoreActiveSession?: boolean): Promise<void>;
  createTask(input: CreateTaskInput): Promise<CreateTaskResult>;
  updateTask(taskId: string, expectedVersion: number, input: UpdateTaskInput): Promise<UpdateTaskResult>;
  deleteTask(taskId: string, expectedVersion: number): Promise<UpdateTaskResult>;
  createCategory(name: string): Promise<CategoryMutationResult>;
  updateCategory(categoryId: string, expectedVersion: number, name: string): Promise<UpdateTaskResult>;
  deleteCategory(categoryId: string, expectedVersion: number): Promise<UpdateTaskResult>;
  startSession(taskId: string, mode: SessionMode): Promise<StartSessionResult>;
  auditActiveRestriction(source: RestrictionAuditSource): Promise<RestrictionAuditResult>;
  toggleSessionPause(): Promise<void>;
  completeExpiredCountdown(source: CountdownCompletionSource): Promise<CountdownCompletionResult>;
  finishSession(outcome: SessionOutcome, completedAmount?: number, exitReason?: string, completionNote?: string, forceAbnormalRestrictionExit?: boolean): Promise<void>;
  finishRest(): Promise<void>;
  clearSessionForSignOut(): Promise<void>;
  scanFamilyAnomalies(): Promise<void>;
  addGoalProgress(taskId: string, amount: number): Promise<void>;
  selectTask(taskId: string): void;
  selectMode(mode: SessionMode): void;
  toggleStrictOption(optionId: string): void;
  clearError(): void;
};

export type CreateTaskResult = { ok: true; taskId: string } | { ok: false; error: string };
export type UpdateTaskResult = { ok: true } | { ok: false; error: string };
export type CategoryMutationResult = { ok: true; categoryId: string } | { ok: false; error: string };
export type RestrictionPermissionKind = 'usageAccess' | 'overlay' | 'vendorBackground';
export type StartSessionResult = { ok: true } | { ok: false; error: string; missingCapabilities: readonly RestrictionPermissionKind[] };
export type RestrictionAuditSource = 'foreground' | 'recovery' | 'pause';
export type RestrictionAuditResult =
  | { status: 'skipped' }
  | { status: 'effective'; missingCapabilities: RestrictionPermissionKind[] }
  | { status: 'ended' | 'failed'; missingCapabilities: RestrictionPermissionKind[] };
export type CountdownCompletionSource = 'foreground' | 'resume' | 'recovery';
export type CountdownCompletionResult = 'completed' | 'goal-confirmation-required' | 'failed' | 'ignored';

const strictOptionsKey = 'looptodo.strict-options';
const noOpForcedScheduler: ForcedTriggerScheduler = {
  schedule: async () => undefined,
  cancel: async () => undefined,
  markSatisfied: async () => undefined,
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '发生未知错误';
}

export function createTaskStore(
  repository: TaskRepository,
  initialTasks: Task[] = [],
  now: () => number = Date.now,
  nativeLockEngine: LockEngine = lockEngine,
  forcedScheduler: ForcedTriggerScheduler = noOpForcedScheduler,
  whitelistSource: WhitelistSource = emptyWhitelistSource,
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
    isAuditingRestriction: false,
    restrictionCleanupPending: false,
    restrictionCleanupError: null,
    error: null,
    lastStarDelta: null,
    lastStarRestrictionMode: null,
    async hydrate(restoreActiveSession = true) {
      if (get().isHydrating) return;
      const existingSessionId = get().activeSession?.id ?? null;
      set({ isHydrating: true, error: null });
      try {
        const [snapshot, nativeSession, savedStrictOptions] = await Promise.all([
          repository.hydrate(),
          nativeLockEngine.getActiveSession(),
          loadStrictOptions().catch(() => prototypeStrictOptions),
          whitelistSource.getState().hydrate().catch(() => undefined),
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
        if (!restoreActiveSession) {
          await get().clearSessionForSignOut();
          return;
        }
        const recoveredFocusExpired = recoveredSession?.phase === 'focus' && recoveredSession.timerMode === 'countdown' &&
          recoveredSession.pausedAt == null && recoveredSession.plannedEndAt != null && recoveredSession.plannedEndAt <= now();
        if (recoveredSession?.phase === 'focus' && recoveredSession.id !== existingSessionId && !recoveredFocusExpired) {
          await get().auditActiveRestriction('recovery');
          recoveredSession = get().activeSession;
        } else if (recoveredSession?.phase !== 'focus' || recoveredFocusExpired) {
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
          state.isStartingSession || state.activeSession) {
        return { ok: false, error: '当前任务暂时无法开始', missingCapabilities: [] };
      }

      set({ error: null, isStartingSession: true, lastStarDelta: null, lastStarRestrictionMode: null });
      const startedAt = now();
      const normalizedTask = normalizeTaskRestriction(task);
      const requiresWhitelist = mode !== 'lock' && normalizedTask.restrictionMode === 'whitelist';
      let launchablePackages: string[] = [];
      let whitelistLists: WhitelistList[] = [];
      try {
        if (requiresWhitelist) {
          await whitelistSource.getState().hydrate();
          const whitelistState = whitelistSource.getState();
          if (whitelistState.error) throw new Error(`白名单读取失败：${whitelistState.error}`);
          if (!whitelistState.hydrated) throw new Error('白名单尚未完成加载');
          whitelistLists = whitelistState.lists;
          launchablePackages = (await nativeLockEngine.listLaunchableApps()).map((app) => app.packageName);
        }
      } catch (error) {
        const nextError = errorMessage(error);
        set({ error: nextError, isStartingSession: false });
        return { ok: false, error: nextError, missingCapabilities: [] };
      }
      const restriction = mode === 'lock'
        ? { restrictionMode: 'strict' as const, whitelistSource: 'strict' as const, restrictionEffective: false, allowedPackagesSnapshot: [] }
        : resolveTaskRestriction({ task: normalizedTask, lists: whitelistLists, launchablePackages });
      const session: RestrictedSession = {
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
        ...restriction,
      };
      const activeTask: Task = { ...task, status: 'active', version: task.version + 1, syncStatus: 'pending' };
      let missingCapabilities: RestrictionPermissionKind[] = [];
      let lockSessionStarted = false;
      try {
        const capabilities = await nativeLockEngine.checkCapabilities();
        if (mode !== 'lock' && restriction.restrictionMode !== 'none') {
          track('whitelist_permission_result', {
            usageAccessGranted: capabilities.usageAccess?.effective !== false,
            overlayGranted: capabilities.overlay?.effective !== false,
            backgroundPopupAllowed: capabilities.backgroundLaunch?.effective !== false,
            deviceBrand: capabilities.manufacturer,
          });
        }
        if (mode === 'lock') {
          if (!capabilities.supported || !capabilities.notificationGranted || !capabilities.notificationListenerEnabled || !capabilities.riskConfirmed) {
            throw new Error('请先完成锁机风险确认并开启通知与通知读取权限');
          }
          await nativeLockEngine.startLockSession({ id: session.id, taskId, taskTitle: task.title,
            startedAt, endsAt: session.plannedEndAt!, enhanced: capabilities.accessibilityEnabled });
          lockSessionStarted = true;
          session.restrictionEffective = true;
          if (isPermissionAnomaly(capabilities)) {
            void familyStore.getState().reportAnomaly('permission_disabled', taskId);
          }
        } else {
          missingCapabilities = restriction.restrictionMode === 'none' ? [] : restrictionMissingCapabilities(capabilities);
          if (missingCapabilities.length > 0) {
            throw new Error('需要恢复软件限制权限后才能开始专注');
          }
          const restrictionResult = await nativeLockEngine.applyFocusRestrictions({
            ...restrictionsFor(mode, state.strictOptions, capabilities, restriction, session.plannedEndAt ?? startedAt + 4 * 60 * 60 * 1000),
            sessionId: session.id,
            taskTitle: task.title,
          });
          if (restriction.restrictionMode !== 'none' && restrictionResult?.effective === false) {
            throw new Error(restrictionResult.reason ?? '软件限制未能生效，请检查系统权限');
          }
          session.restrictionEffective = restriction.restrictionMode === 'none' || restrictionResult?.effective !== false;
          if (restriction.restrictionMode !== 'none') {
            track('focus_restriction_start', {
              mode: restriction.restrictionMode,
              ...restrictionAnalyticsSource(restriction.whitelistSource),
              packageCount: restriction.allowedPackagesSnapshot.length,
              effective: session.restrictionEffective,
            });
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
          restrictionMode: restriction.restrictionMode,
          whitelistMode: task.whitelistMode === 'inherit' ? 'list' : task.whitelistMode,
          packageCount: restriction.allowedPackagesSnapshot.length,
        });
        return { ok: true };
      } catch (error) {
        if (lockSessionStarted) await nativeLockEngine.endLockSession(session.id).catch(() => undefined);
        const cleared = await nativeLockEngine.clearFocusRestrictions().then(() => true).catch(() => false);
        if (restriction.restrictionMode !== 'none') {
          track('focus_restriction_clear', { reason: 'start_failed', success: cleared });
        }
        const nextError = errorMessage(error);
        set({ error: nextError, isStartingSession: false });
        return { ok: false, error: nextError, missingCapabilities };
      }
    },
    async auditActiveRestriction(source) {
      await drainNativeRestrictionEvents(nativeLockEngine);
      const state = get();
      const session = state.activeSession;
      if (state.isFinishingSession || state.isAuditingRestriction) {
        return { status: 'skipped' };
      }
      if (!session || session.phase !== 'focus') {
        if (!state.restrictionCleanupPending) return { status: 'skipped' };
        set({ isAuditingRestriction: true });
        try {
          const cleanupError = await clearFocusRestrictionsWithRetry(nativeLockEngine);
          set((current) => ({
            restrictionCleanupPending: cleanupError != null,
            restrictionCleanupError: cleanupError,
            error: cleanupError ?? removeErrorDetail(current.error, current.restrictionCleanupError),
          }));
        } finally {
          set({ isAuditingRestriction: false });
        }
        return { status: 'skipped' };
      }
      const task = state.tasks.find((candidate) => candidate.id === session.taskId);
      const restriction = restrictionSnapshotForSession(session, task);
      if (restriction.restrictionMode === 'none') return { status: 'skipped' };

      set({ isAuditingRestriction: true });
      let missingCapabilities: RestrictionPermissionKind[] = [];
      try {
        let ineffectiveReason: string | null = null;
        try {
          const capabilities = await nativeLockEngine.checkCapabilities();
          missingCapabilities = restrictionMissingCapabilities(capabilities);
          if (missingCapabilities.length > 0) {
            void familyStore.getState().reportAnomaly('permission_disabled', session.taskId);
          }
          if (missingCapabilities.length > 0) {
            ineffectiveReason = '软件限制所需系统权限已关闭';
          } else {
            const restrictionResult = await nativeLockEngine.applyFocusRestrictions({
              ...restrictionsFor(
                session.mode,
                state.strictOptions,
                capabilities,
                restriction,
                session.pausedAt == null
                  ? session.plannedEndAt ?? now() + 4 * 60 * 60 * 1000
                  : Number.MAX_SAFE_INTEGER,
              ),
              sessionId: session.id,
            });
            if (restrictionResult?.effective === false) {
              ineffectiveReason = restrictionResult.reason ?? '软件限制未能继续生效';
            }
          }
        } catch (error) {
          ineffectiveReason = errorMessage(error);
        }

        if (!ineffectiveReason) {
          const effectiveSession = { ...session, ...restriction, restrictionEffective: true };
          await repository.updateActiveSession(effectiveSession);
          if (get().activeSession?.id === session.id) set({ activeSession: effectiveSession, error: null });
          if (source === 'recovery') {
            track('focus_restriction_recovered', {
              activeSessionFound: true,
              nativeStateFound: true,
              action: 'restored',
            });
          }
          return { status: 'effective', missingCapabilities };
        }

        const invalidSession = { ...session, ...restriction, restrictionEffective: false };
        let invalidationError: string | null = null;
        try {
          await repository.updateActiveSession(invalidSession);
        } catch (error) {
          invalidationError = errorMessage(error);
        }
        if (get().activeSession?.id === session.id) set({ activeSession: invalidSession });

        const cleanupError = await clearFocusRestrictionsWithRetry(nativeLockEngine);
        const failureReason = `${ineffectiveReason}；软件限制已失效，本次专注已异常结束`;
        if (source === 'recovery') {
          track('focus_restriction_recovered', {
            activeSessionFound: true,
            nativeStateFound: false,
            action: 'ended',
          });
        }
        await get().finishSession('exited', undefined, failureReason, undefined, true);
        const ended = get().activeSession?.id !== session.id;
        const finishError = ended ? null : get().error;
        const details = [
          failureReason,
          invalidationError ? `失效状态保存失败：${invalidationError}` : null,
          cleanupError ? `限制清理失败：${cleanupError}` : null,
          finishError ? `异常结束保存失败：${finishError}` : null,
        ].filter(Boolean).join('；');
        set({ error: details });
        return { status: ended ? 'ended' : 'failed', missingCapabilities };
      } finally {
        set({ isAuditingRestriction: false });
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
        set({ activeSession: nextSession, isTogglingPause: false });
        await get().auditActiveRestriction('pause');
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
    async finishSession(outcome, completedAmount, exitReason, completionNote, forceAbnormalRestrictionExit = false) {
      const { activeSession, isFinishingSession, isTogglingPause, tasks } = get();
      if (!activeSession || activeSession.phase !== 'focus' || isFinishingSession || isTogglingPause) return;
      const task = tasks.find((candidate) => candidate.id === activeSession.taskId);
      if (!task) return set({ error: '当前专注任务不存在' });
      if (!forceAbnormalRestrictionExit && activeSession.mode === 'focus' && outcome === 'exited' && strictEnabled(get().strictOptions, 'no-cancel')) return set({ error: '当前专注禁止取消' });
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
      const restrictionSnapshot = restrictionSnapshotForSession(activeSession, task);
      const durationSeconds = calculateRecordedDurationSeconds(activeSession, task, endedAt, outcome);
      const record: FocusSessionRecord = {
        ...activeSession,
        endedAt,
        outcome,
        failureReason: outcome === 'exited' ? (exitReason?.trim() || '用户主动退出专注') : null,
        durationSeconds,
        completedAmount: task.kind === 'goal' && outcome === 'completed' ? completedAmount ?? null : null,
        completionNote: outcome === 'completed' ? completionNote?.trim() || null : null,
        ...restrictionSnapshot,
        whitelistPackageCount: restrictionSnapshot.allowedPackagesSnapshot.length,
        effectiveMinutes: Math.floor(durationSeconds / 60),
      };
      const restSession = outcome === 'completed' && task.timerMode === 'countdown' && task.restMinutes > 0
        ? { ...activeSession, phase: 'rest' as const, startedAt: endedAt, plannedEndAt: null,
            restEndsAt: endedAt + task.restMinutes * 60_000, pausedAt: null, accumulatedPausedMs: 0 }
        : null;

      try {
        if (activeSession.mode === 'lock') {
          if (outcome === 'exited' && forceAbnormalRestrictionExit) await nativeLockEngine.endLockSession(activeSession.id).catch(() => undefined);
          else if (outcome === 'exited') await nativeLockEngine.emergencyExit(activeSession.id, exitReason!.trim());
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
        const starMode = sessionStarMode(activeSession, task, restrictionSnapshot);
        const starOutcome = outcome === 'completed'
          ? 'completed'
          : outcome === 'exited' && activeSession.mode === 'lock'
            ? 'emergency_exit'
            : 'failed';
        const priorMinutes = Math.floor(statePriorMinutes(get().sessionRecords, endedAt));
        const lastStarDelta = starMode || starOutcome === 'emergency_exit'
          ? calculateSessionStars({
              outcome: starOutcome,
              effectiveMinutes: Math.floor(record.durationSeconds / 60),
              mode: starMode ?? 'lock',
              priorEffectiveMinutesToday: priorMinutes,
            })
          : 0;
        track('star_settle', {
          taskId: task.id,
          sessionId: activeSession.id,
          delta: lastStarDelta,
          mode: starMode,
          outcome: starOutcome,
        });
        if (restrictionSnapshot.restrictionMode === 'whitelist') {
          track('whitelist_star_settled', {
            effectiveMinutes: Math.floor(record.durationSeconds / 60),
            stars: lastStarDelta,
          });
        }
        set((state) => ({
          tasks: state.tasks.map((candidate) => candidate.id === nextTask.id ? nextTask : candidate),
          sessionRecords: [record, ...state.sessionRecords],
          activeSession: restSession,
          isFinishingSession: false,
          error: null,
          lastStarDelta,
          lastStarRestrictionMode: restrictionSnapshot.restrictionMode,
        }));
      } catch (error) {
        set({ isFinishingSession: false, error: errorMessage(error) });
      } finally {
        const restrictionError = await clearFocusRestrictionsWithRetry(nativeLockEngine);
        if (restrictionSnapshotForSession(activeSession, task).restrictionMode !== 'none') {
          track('focus_restriction_clear', { reason: outcome, success: restrictionError == null });
        }
        set((state) => ({
          restrictionCleanupPending: restrictionError != null,
          restrictionCleanupError: restrictionError,
          error: restrictionError
            ? state.error ? `${state.error}；${restrictionError}` : restrictionError
            : state.error,
        }));
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
    async clearSessionForSignOut() {
      const session = get().activeSession;
      if (session?.phase === 'focus') {
        await get().finishSession('exited', undefined, '退出登录', undefined, true);
        if (get().activeSession?.id === session.id) {
          throw new Error(get().error ?? '退出登录前无法结束当前专注');
        }
        return;
      }
      if (session?.phase === 'rest') {
        try {
          await repository.finishRest();
          set({ activeSession: null, isFinishingSession: false });
        } catch (error) {
          const nextError = errorMessage(error);
          set({ isFinishingSession: false, error: nextError });
          throw error;
        } finally {
          const restrictionError = await clearFocusRestrictionsWithRetry(nativeLockEngine);
          set({ restrictionCleanupPending: restrictionError != null, restrictionCleanupError: restrictionError });
        }
        return;
      }
      const restrictionError = await clearFocusRestrictionsWithRetry(nativeLockEngine);
      set({ restrictionCleanupPending: restrictionError != null, restrictionCleanupError: restrictionError });
      if (restrictionError) throw new Error(restrictionError);
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

export const taskStore = createTaskStore(createSQLiteTaskRepository(), [], Date.now, lockEngine, createNativeForcedTriggerScheduler(), whitelistStore);

export function useTaskStore<T>(selector: (state: TaskStore) => T) {
  return useStore(taskStore, selector);
}
function taskRuleId(taskId: string) { return `task:${taskId}`; }

async function clearFocusRestrictionsWithRetry(nativeLockEngine: LockEngine, attempts = 3) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await nativeLockEngine.clearFocusRestrictions();
      return null;
    } catch (error) {
      lastError = error;
    }
  }
  return errorMessage(lastError);
}

function removeErrorDetail(error: string | null, detail: string | null) {
  if (!error || !detail) return error;
  const remaining = error.split('；').filter((item) => item !== detail);
  return remaining.length ? remaining.join('；') : null;
}
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

function restrictionsFor(
  mode: SessionMode,
  options: StrictOption[],
  capabilities: LockCapabilities,
  snapshot: SessionRestrictionSnapshot,
  expiresAt = 0,
): FocusRestrictionOptions {
  const restrictions: FocusRestrictionOptions = {
    hideRecents: false,
    blockLeaving: false,
    blockNotifications: false,
    hideLauncherIcon: false,
    allowedPackages: [],
    expiresAt,
    restrictionMode: snapshot.restrictionMode,
  };
  for (const option of options) {
    const key = option.capabilityKey;
    if (!key) continue;
    const capability = capabilities.restrictions[key];
    if (key === 'whitelist') continue;
    const active = capability.supported && (mode === 'lock' || option.enabled);
    restrictions[key] = active;
  }
  if (snapshot.restrictionMode === 'whitelist') {
    restrictions.blockLeaving = capabilities.restrictions.whitelist.supported;
    restrictions.allowedPackages = snapshot.allowedPackagesSnapshot;
  } else if (snapshot.restrictionMode === 'strict') {
    restrictions.blockLeaving = capabilities.restrictions.blockLeaving.supported || capabilities.restrictions.whitelist.supported;
    restrictions.allowedPackages = [];
  }
  return restrictions;
}

function strictEnabled(options: StrictOption[], id: string) {
  return options.some((option) => option.id === id && option.enabled);
}

export function restrictionMissingCapabilities(capabilities: LockCapabilities): RestrictionPermissionKind[] {
  const missing: RestrictionPermissionKind[] = [];
  if (capabilities.usageAccess?.effective === false) missing.push('usageAccess');
  if (capabilities.overlay?.effective === false) missing.push('overlay');
  if (capabilities.backgroundLaunch?.effective === false) missing.push('vendorBackground');
  return missing;
}

function restrictionSnapshotForSession(session: ActiveSession, task?: Task): SessionRestrictionSnapshot {
  const restrictedSession = session as ActiveSession & Partial<SessionRestrictionSnapshot>;
  const normalizedTask = task ? normalizeTaskRestriction(task) : null;
  const restrictionMode = restrictedSession.restrictionMode ?? normalizedTask?.restrictionMode ?? 'none';
  const whitelistSource = restrictedSession.whitelistSource ?? (
    restrictionMode === 'whitelist'
      ? normalizedTask?.whitelistMode === 'custom'
        ? 'custom'
        : `list:${normalizedTask?.whitelistListId ?? 'missing'}`
      : restrictionMode === 'strict' ? 'strict' : 'none'
  );
  return {
    restrictionMode,
    whitelistSource,
    restrictionEffective: restrictedSession.restrictionEffective ?? restrictionMode === 'none',
    allowedPackagesSnapshot: restrictedSession.allowedPackagesSnapshot ?? [],
  };
}

function restrictionAnalyticsSource(source: SessionRestrictionSnapshot['whitelistSource']) {
  if (source.startsWith('list:')) return { source: 'list', listId: source.slice('list:'.length) };
  return { source };
}

async function drainNativeRestrictionEvents(nativeLockEngine: LockEngine) {
  try {
    const events = await nativeLockEngine.drainFocusRestrictionEvents();
    for (const event of events) track(event.event, event.props);
  } catch {
    // Diagnostics must not interrupt an active focus session.
  }
}

function sessionStarMode(session: ActiveSession, task: Task, restriction: SessionRestrictionSnapshot): FocusModeForStars | null {
  if (restriction.restrictionMode !== 'none' && !restriction.restrictionEffective) return null;
  if (task.timerMode === 'untimed') return 'untimed';
  if (session.mode === 'lock') return restriction.restrictionEffective ? 'lock' : null;
  if (restriction.restrictionMode === 'strict') return restriction.restrictionEffective ? 'strict' : null;
  if (restriction.restrictionMode === 'whitelist') return restriction.restrictionEffective ? 'whitelist' : null;
  return null;
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
