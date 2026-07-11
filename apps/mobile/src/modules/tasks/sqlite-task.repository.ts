import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import type { ActiveSession, FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

import { getLoopTodoDatabase } from './database';
import { taskFromInput, taskProgressLabel } from './task.presentation';
import type { TaskRepository } from './task.repository';
import type { CreateTaskInput, Task } from './task.types';

type TaskRow = {
  id: string;
  title: string;
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
  trust_level: Task['trustLevel'];
  status: Task['status'];
};

type SessionRow = {
  id: string;
  task_id: string;
  mode: ActiveSession['mode'];
  timer_mode: ActiveSession['timerMode'];
  phase?: ActiveSession['phase'];
  started_at: number;
  planned_end_at: number | null;
  rest_ends_at?: number | null;
  ended_at?: number;
  outcome?: FocusSessionRecord['outcome'];
  failure_reason?: string | null;
  duration_seconds?: number;
  completed_amount?: number | null;
};

const taskColumns = `id, title, category, kind, timer_mode, estimate_minutes, rest_minutes,
  deadline_at, target_amount, target_unit, completed_amount, must_do, trust_level, status`;

export function createSQLiteTaskRepository(
  getDatabase: () => Promise<SQLiteDatabase> = getLoopTodoDatabase,
  now: () => number = Date.now
): TaskRepository {
  return {
    async hydrate() {
      const database = await getDatabase();
      const [taskRows, recordRows, activeRow] = await Promise.all([
        database.getAllAsync<TaskRow>(`SELECT ${taskColumns} FROM tasks ORDER BY created_at DESC`),
        database.getAllAsync<SessionRow>('SELECT * FROM focus_sessions ORDER BY ended_at DESC'),
        database.getFirstAsync<SessionRow>('SELECT * FROM active_sessions WHERE singleton_id = 1'),
      ]);
      return {
        tasks: taskRows.map(mapTask),
        sessionRecords: recordRows.map(mapRecord),
        activeSession: activeRow ? mapActive(activeRow) : null,
      };
    },
    async create(input) {
      validateInput(input);
      const task = taskFromInput(`task-${now()}-${Math.random().toString(36).slice(2, 8)}`, input);
      const database = await getDatabase();
      await database.runAsync(
        `INSERT INTO tasks (${taskColumns}, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ...taskValues(task),
        now(),
        now()
      );
      return task;
    },
    async startSession(task, session) {
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        await database.runAsync(
          'UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?',
          task.status,
          now(),
          task.id
        );
        await database.runAsync('DELETE FROM active_sessions');
        await insertActive(database, session);
      });
    },
    async finishSession(task, record, restSession) {
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        await database.runAsync(
          'UPDATE tasks SET status = ?, completed_amount = ?, updated_at = ? WHERE id = ?',
          task.status,
          task.completedAmount,
          now(),
          task.id
        );
        await database.runAsync(
          `INSERT INTO focus_sessions
           (id, task_id, mode, timer_mode, started_at, planned_end_at, ended_at, outcome,
            failure_reason, duration_seconds, completed_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          record.id,
          record.taskId,
          record.mode,
          record.timerMode,
          record.startedAt,
          record.plannedEndAt,
          record.endedAt,
          record.outcome,
          record.failureReason,
          record.durationSeconds,
          record.completedAmount
        );
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
        await database.runAsync('UPDATE tasks SET completed_amount = ?, status = ?, updated_at = ? WHERE id = ?',
          task.completedAmount, task.status, now(), task.id);
        await database.runAsync(`INSERT INTO task_progress_entries
          (id, task_id, amount, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?)`,
          `task-progress-${now()}-${Math.random().toString(36).slice(2, 8)}`, task.id, amount, idempotencyKey, now());
      });
    },
  };
}

function mapTask(row: TaskRow): Task {
  const task: Task = {
    id: row.id,
    title: row.title,
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
    trustLevel: row.trust_level,
    status: row.status,
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
    restEndsAt: row.rest_ends_at ?? null,
  };
}

function mapRecord(row: SessionRow): FocusSessionRecord {
  return {
    ...mapActive(row),
    endedAt: row.ended_at ?? row.started_at,
    outcome: row.outcome ?? 'exited',
    failureReason: row.failure_reason ?? null,
    durationSeconds: row.duration_seconds ?? 0,
    completedAmount: row.completed_amount ?? null,
  };
}

function taskValues(task: Task): SQLiteBindValue[] {
  return [
    task.id,
    task.title,
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
    task.trustLevel,
    task.status,
  ];
}

async function insertActive(database: SQLiteDatabase, session: ActiveSession) {
  await database.runAsync(
    `INSERT INTO active_sessions
     (singleton_id, id, task_id, mode, timer_mode, phase, started_at, planned_end_at, rest_ends_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
    session.id,
    session.taskId,
    session.mode,
    session.timerMode,
    session.phase,
    session.startedAt,
    session.plannedEndAt,
    session.restEndsAt
  );
}

function validateInput(input: CreateTaskInput) {
  if (!input.title.trim()) throw new Error('请输入任务名');
  if (input.estimateMinutes <= 0 || input.restMinutes < 0) throw new Error('时长设置无效');
  if (
    input.kind === 'goal' &&
    (!input.deadlineAt || !input.targetAmount || !input.targetUnit?.trim())
  ) {
    throw new Error('请完整填写定目标字段');
  }
}
