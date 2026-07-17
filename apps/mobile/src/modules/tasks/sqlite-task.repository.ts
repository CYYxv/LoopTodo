import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import type { ActiveSession, FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

import { getLoopTodoDatabase } from './database';
import { enqueueSyncOperation } from '@/modules/sync/sqlite-sync.repository';
import { createUuid } from '@/shared/uuid';
import { taskFromInput, taskProgressLabel } from './task.presentation';
import type { TaskRepository } from './task.repository';
import type { CreateTaskInput, Task, TaskCategory } from './task.types';

type TaskRow = {
  id: string;
  title: string;
  category_id?: string | null;
  category: string;
  kind: Task['kind'];
  timer_mode: Task['timerMode'];
  estimate_minutes: number;
  rest_minutes: number;
  deadline_at: number | null;
  target_amount: number | null;
  target_unit: string | null;
  completed_amount: number;
  must_do: number;
  forced_trigger_time: string | null;
  trust_level: Task['trustLevel'];
  status: Task['status'];
  version: number;
  sync_status: Task['syncStatus'];
  remote_active: number;
};

type CategoryRow = { id: string; name: string; color: string | null; archived: number; version: number; sync_status: TaskCategory['syncStatus'] };

type SessionRow = {
  id: string;
  task_id: string;
  mode: ActiveSession['mode'];
  timer_mode: ActiveSession['timerMode'];
  phase?: ActiveSession['phase'];
  started_at: number;
  planned_end_at: number | null;
  planned_focus_seconds?: number | null;
  rest_ends_at?: number | null;
  paused_at?: number | null;
  accumulated_paused_ms?: number;
  ended_at?: number;
  outcome?: FocusSessionRecord['outcome'];
  failure_reason?: string | null;
  completion_note?: string | null;
  duration_seconds?: number;
  completed_amount?: number | null;
};

const taskColumns = `id, title, category_id, category, kind, timer_mode, estimate_minutes, rest_minutes,
  deadline_at, target_amount, target_unit, completed_amount, must_do, forced_trigger_time, trust_level, status,
  version, sync_status, remote_active`;

export function createSQLiteTaskRepository(
  getDatabase: () => Promise<SQLiteDatabase> = getLoopTodoDatabase,
  now: () => number = Date.now
): TaskRepository {
  return {
    async hydrate() {
      const database = await getDatabase();
      const [taskRows, categoryRows, recordRows, activeRow] = await Promise.all([
        database.getAllAsync<TaskRow>(`SELECT ${taskColumns} FROM tasks WHERE status != 'archived' ORDER BY created_at DESC`),
        database.getAllAsync<CategoryRow>("SELECT id, name, color, archived, version, sync_status FROM task_categories WHERE archived = 0 ORDER BY created_at ASC"),
        database.getAllAsync<SessionRow>('SELECT * FROM focus_sessions ORDER BY ended_at DESC'),
        database.getFirstAsync<SessionRow>('SELECT * FROM active_sessions WHERE singleton_id = 1'),
      ]);
      const staleTaskIds = taskRows
        .filter((task) => task.status === 'active' && !task.remote_active && task.id !== activeRow?.task_id)
        .map((task) => task.id);
      if (staleTaskIds.length > 0) {
        await database.withTransactionAsync(async () => {
          for (const taskId of staleTaskIds) {
            await database.runAsync("UPDATE tasks SET status = 'pending', sync_status = 'pending', updated_at = ? WHERE id = ? AND status = 'active' AND remote_active = 0", now(), taskId);
          }
        });
        for (const row of taskRows) {
          if (staleTaskIds.includes(row.id)) {
            row.status = 'pending';
            row.sync_status = 'pending';
          }
        }
      }
      return {
        tasks: taskRows.map(mapTask),
        categories: categoryRows.map((row) => ({ id: row.id, name: row.name, color: row.color, version: row.version, syncStatus: row.sync_status })),
        sessionRecords: recordRows.map(mapRecord),
        activeSession: activeRow ? mapActive(activeRow) : null,
      };
    },
    async create(input) {
      validateInput(input);
      const task = taskFromInput(createUuid(), input);
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        await database.runAsync(`INSERT INTO tasks (${taskColumns}, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ...taskValues(task), now(), now());
        await enqueueSyncOperation(database, { type: 'task.create', task }, task.id, `task-create-${task.id}`, now());
      });
      return task;
    },
    async createCategory(category) {
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        await database.runAsync(`INSERT INTO task_categories
          (id, name, color, archived, version, sync_status, created_at, updated_at) VALUES (?, ?, ?, 0, ?, 'pending', ?, ?)`,
          category.id, category.name, category.color, category.version, now(), now());
        await enqueueSyncOperation(database, { type: 'category.create', category }, category.id, `category-create-${category.id}`, now());
      });
    },
    async updateCategory(category, previousVersion) {
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        const result = await database.runAsync("UPDATE task_categories SET name = ?, color = ?, version = ?, sync_status = 'pending', updated_at = ? WHERE id = ? AND version = ? AND archived = 0",
          category.name, category.color, category.version, now(), category.id, previousVersion);
        if (result.changes !== 1) throw new Error('分类已被其他设备更新');
        await database.runAsync("UPDATE tasks SET category = ?, updated_at = ? WHERE category_id = ?", category.name, now(), category.id);
        await enqueueSyncOperation(database, { type: 'category.update', categoryId: category.id, version: previousVersion, name: category.name, color: category.color }, category.id,
          `category-update-${category.id}-${category.version}`, now());
      });
    },
    async archiveCategory(category, previousVersion) {
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        const result = await database.runAsync("UPDATE task_categories SET archived = 1, version = ?, sync_status = 'pending', updated_at = ? WHERE id = ? AND version = ? AND archived = 0",
          category.version, now(), category.id, previousVersion);
        if (result.changes !== 1) throw new Error('分类已被其他设备更新');
        await database.runAsync("UPDATE tasks SET category_id = NULL, category = '未分类', version = version + 1, sync_status = 'pending', updated_at = ? WHERE category_id = ?", now(), category.id);
        await enqueueSyncOperation(database, { type: 'category.delete', categoryId: category.id, version: previousVersion }, category.id,
          `category-delete-${category.id}-${category.version}`, now());
      });
    },
    async update(task, previousVersion) {
      validateInput(task);
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        const result = await database.runAsync(`UPDATE tasks SET
          title = ?, category_id = ?, category = ?, timer_mode = ?, estimate_minutes = ?, rest_minutes = ?, deadline_at = ?, target_amount = ?,
          target_unit = ?, must_do = ?, forced_trigger_time = ?, status = ?, version = ?, sync_status = 'pending', updated_at = ?
          WHERE id = ? AND status != 'active' AND remote_active = 0 AND version = ?`,
          task.title, task.categoryId ?? null, task.category, task.timerMode, task.estimateMinutes, task.restMinutes, task.deadlineAt, task.targetAmount,
          task.targetUnit, task.mustDo ? 1 : 0, task.forcedTriggerTime, task.status, task.version, now(), task.id, previousVersion);
        if (result.changes !== 1) throw new Error('任务正在执行或已被其他设备更新');
        await enqueueSyncOperation(database, { type: 'task.update', taskId: task.id, version: previousVersion,
          patch: { title: task.title, categoryId: task.categoryId ?? null, category: task.category, timerMode: task.timerMode, estimateMinutes: task.estimateMinutes,
            restMinutes: task.restMinutes, deadlineAt: task.deadlineAt, targetAmount: task.targetAmount,
            targetUnit: task.targetUnit, mustDo: task.mustDo, forcedTriggerTime: task.forcedTriggerTime,
            status: task.status as 'pending' | 'completed' | 'failed' } }, task.id,
          `task-update-${task.id}-${task.version}`, now());
      });
    },
    async archive(task, previousVersion) {
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        const result = await database.runAsync("UPDATE tasks SET status = 'archived', version = ?, sync_status = 'pending', updated_at = ? WHERE id = ? AND version = ? AND status != 'active' AND remote_active = 0",
          task.version, now(), task.id, previousVersion);
        if (result.changes !== 1) throw new Error('任务正在执行或已被其他设备更新');
        await enqueueSyncOperation(database, { type: 'task.delete', taskId: task.id, version: previousVersion }, task.id,
          `task-delete-${task.id}-${task.version}`, now());
      });
    },
    async startSession(task, session) {
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        await database.runAsync(
          "UPDATE tasks SET status = ?, version = ?, sync_status = 'pending', updated_at = ? WHERE id = ?",
          task.status,
          task.version,
          now(),
          task.id
        );
        await database.runAsync('DELETE FROM active_sessions');
        await insertActive(database, session);
        await enqueueSyncOperation(database, { type: 'session.start', taskId: task.id,
          localSessionId: session.id, mode: session.mode, startedAt: session.startedAt,
          plannedMinutes: Math.round((session.plannedFocusSeconds ?? task.estimateMinutes * 60) / 60) }, task.id, `session-start-${session.id}`, now());
      });
    },
    async updateActiveSession(session) {
      const database = await getDatabase();
      const result = await database.runAsync(`UPDATE active_sessions SET
        paused_at = ?, accumulated_paused_ms = ?, planned_end_at = ?, planned_focus_seconds = ?, rest_ends_at = ?
        WHERE singleton_id = 1 AND id = ?`,
        session.pausedAt ?? null, session.accumulatedPausedMs ?? 0, session.plannedEndAt,
        session.plannedFocusSeconds ?? null, session.restEndsAt, session.id);
      if (result.changes !== 1) throw new Error('当前专注状态已变化，请重新进入专注页');
    },
    async finishSession(task, record, restSession) {
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        await database.runAsync(
          "UPDATE tasks SET status = ?, completed_amount = ?, version = ?, sync_status = 'pending', updated_at = ? WHERE id = ?",
          task.status,
          task.completedAmount,
          task.version,
          now(),
          task.id
        );
        await database.runAsync(
          `INSERT INTO focus_sessions
           (id, task_id, mode, timer_mode, started_at, planned_end_at, planned_focus_seconds, ended_at, outcome,
            failure_reason, completion_note, duration_seconds, completed_amount, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          record.id,
          record.taskId,
          record.mode,
          record.timerMode,
          record.startedAt,
          record.plannedEndAt,
          record.plannedFocusSeconds ?? null,
          record.endedAt,
          record.outcome,
          record.failureReason,
          record.completionNote ?? null,
          record.durationSeconds,
          record.completedAmount
        );
        await enqueueSyncOperation(database, { type: 'session.finish', taskId: task.id,
          localSessionId: record.id, outcome: record.outcome, record }, task.id,
          `session-finish-${record.id}`, now());
        await database.runAsync('DELETE FROM active_sessions');
        if (restSession) await insertActive(database, restSession);
      });
    },
    async finishRest() {
      const database = await getDatabase();
      await database.runAsync('DELETE FROM active_sessions');
    },
    async addGoalProgress(task, amount, idempotencyKey) {
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        await database.runAsync("UPDATE tasks SET completed_amount = ?, status = ?, version = ?, sync_status = 'pending', updated_at = ? WHERE id = ?",
          task.completedAmount, task.status, task.version, now(), task.id);
        await database.runAsync(`INSERT INTO task_progress_entries
          (id, task_id, amount, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?)`,
          `task-progress-${now()}-${Math.random().toString(36).slice(2, 8)}`, task.id, amount, idempotencyKey, now());
        await enqueueSyncOperation(database, { type: 'task.goal-progress', taskId: task.id,
          version: task.version - 1, amount }, task.id, idempotencyKey, now());
      });
    },
  };
}

function mapTask(row: TaskRow): Task {
  const task: Task = {
    id: row.id,
    title: row.title,
    categoryId: row.category_id ?? null,
    category: row.category,
    kind: row.kind,
    timerMode: row.timer_mode,
    estimateMinutes: row.estimate_minutes,
    restMinutes: row.rest_minutes,
    deadlineAt: row.deadline_at,
    targetAmount: row.target_amount,
    targetUnit: row.target_unit,
    completedAmount: row.completed_amount,
    mustDo: Boolean(row.must_do),
    forcedTriggerTime: row.forced_trigger_time,
    trustLevel: row.trust_level,
    status: row.status,
    version: row.version,
    syncStatus: row.sync_status,
    remoteActive: Boolean(row.remote_active),
    progressLabel: '',
  };
  return { ...task, progressLabel: taskProgressLabel(task) };
}

function mapActive(row: SessionRow): ActiveSession {
  return {
    id: row.id,
    taskId: row.task_id,
    mode: row.mode,
    timerMode: row.timer_mode,
    phase: row.phase ?? 'focus',
    startedAt: row.started_at,
    plannedEndAt: row.planned_end_at,
    plannedFocusSeconds: row.planned_focus_seconds ?? null,
    restEndsAt: row.rest_ends_at ?? null,
    pausedAt: row.paused_at ?? null,
    accumulatedPausedMs: row.accumulated_paused_ms ?? 0,
  };
}

function mapRecord(row: SessionRow): FocusSessionRecord {
  return {
    ...mapActive(row),
    endedAt: row.ended_at ?? row.started_at,
    outcome: row.outcome ?? 'exited',
    failureReason: row.failure_reason ?? null,
    completionNote: row.completion_note ?? null,
    durationSeconds: row.duration_seconds ?? 0,
    completedAmount: row.completed_amount ?? null,
  };
}

function taskValues(task: Task): SQLiteBindValue[] {
  return [
    task.id,
    task.title,
    task.categoryId ?? null,
    task.category,
    task.kind,
    task.timerMode,
    task.estimateMinutes,
    task.restMinutes,
    task.deadlineAt,
    task.targetAmount,
    task.targetUnit,
    task.completedAmount,
    task.mustDo ? 1 : 0,
    task.forcedTriggerTime,
    task.trustLevel,
    task.status,
    task.version,
    task.syncStatus,
    task.remoteActive ? 1 : 0,
  ];
}

async function insertActive(database: SQLiteDatabase, session: ActiveSession) {
  await database.runAsync(
    `INSERT INTO active_sessions
     (singleton_id, id, task_id, mode, timer_mode, phase, started_at, planned_end_at, rest_ends_at,
      planned_focus_seconds, paused_at, accumulated_paused_ms)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    session.id,
    session.taskId,
    session.mode,
    session.timerMode,
    session.phase,
    session.startedAt,
    session.plannedEndAt,
    session.restEndsAt,
    session.plannedFocusSeconds ?? null,
    session.pausedAt ?? null,
    session.accumulatedPausedMs ?? 0
  );
}

function validateInput(input: CreateTaskInput) {
  if (!input.title.trim()) throw new Error('请输入任务名');
  if (input.estimateMinutes <= 0 || input.restMinutes < 0) throw new Error('时长设置无效');
  if (input.mustDo && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.forcedTriggerTime ?? '')) throw new Error('请输入今日必须任务的触发时间');
  if (
    input.kind === 'goal' &&
    (!input.deadlineAt || !input.targetAmount || !input.targetUnit?.trim())
  ) {
    throw new Error('请完整填写定目标字段');
  }
}
