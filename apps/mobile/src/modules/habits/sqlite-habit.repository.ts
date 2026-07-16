import type { SQLiteDatabase } from 'expo-sqlite';

import { getLoopTodoDatabase } from '@/modules/tasks/database';

import type { HabitRepository } from './habit.repository';
import type { CreateHabitInput, Habit, HabitProgressDay, UpdateHabitInput } from './habit.types';

type HabitRow = {
  id: string; name: string; target_minutes: number; force_enabled: number;
  trigger_time: string | null; status: Habit['status']; today_minutes: number;
};

export function createSQLiteHabitRepository(
  getDatabase: () => Promise<SQLiteDatabase> = getLoopTodoDatabase,
  now: () => number = Date.now
): HabitRepository {
  return {
    async hydrate(day) {
      const database = await getDatabase();
      const rows = await database.getAllAsync<HabitRow>(`
        SELECT h.id, h.name, h.target_minutes, h.force_enabled, h.trigger_time, h.status,
          COALESCE(SUM(CASE WHEN p.progress_date = ? THEN p.minutes ELSE 0 END), 0) AS today_minutes
        FROM habits h LEFT JOIN habit_progress_entries p ON p.habit_id = h.id
        WHERE h.status = 'active' GROUP BY h.id ORDER BY h.created_at ASC
      `, day);
      return rows.map(mapHabit);
    },
    async create(input) {
      validateInput(input);
      const id = `habit-${now()}-${Math.random().toString(36).slice(2, 8)}`;
      const database = await getDatabase();
      await database.runAsync(`INSERT INTO habits
        (id, name, target_minutes, force_enabled, trigger_time, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`, id, input.name.trim(), input.targetMinutes,
        input.forceEnabled ? 1 : 0, input.forceEnabled ? input.triggerTime : null, now(), now());
      return { id, ...input, name: input.name.trim(), todayMinutes: 0, status: 'active' };
    },
    async update(habitId, input) {
      validateInput(input);
      const database = await getDatabase();
      const result = await database.runAsync(`UPDATE habits SET name = ?, target_minutes = ?, force_enabled = ?,
        trigger_time = ?, updated_at = ? WHERE id = ? AND status = 'active'`, input.name.trim(), input.targetMinutes,
        input.forceEnabled ? 1 : 0, input.forceEnabled ? input.triggerTime : null, now(), habitId);
      if (result.changes !== 1) throw new Error('习惯不存在或已归档');
      const row = await database.getFirstAsync<HabitRow>(`SELECT h.id, h.name, h.target_minutes, h.force_enabled,
        h.trigger_time, h.status, 0 AS today_minutes FROM habits h WHERE h.id = ?`, habitId);
      if (!row) throw new Error('习惯不存在或已归档');
      return mapHabit(row);
    },
    async history(habitId) {
      const database = await getDatabase();
      return database.getAllAsync<HabitProgressDay>(`SELECT progress_date AS date, SUM(minutes) AS minutes
        FROM habit_progress_entries WHERE habit_id = ? GROUP BY progress_date ORDER BY progress_date DESC LIMIT 30`, habitId);
    },
    async addProgress(habitId, minutes, day, idempotencyKey) {
      if (minutes <= 0) throw new Error('进度分钟数必须大于 0');
      const database = await getDatabase();
      const result = await database.runAsync(`INSERT INTO habit_progress_entries
        (id, habit_id, minutes, progress_date, idempotency_key, created_at)
        SELECT ?, id, ?, ?, ?, ? FROM habits WHERE id = ? AND status = 'active'`,
        `habit-progress-${now()}-${Math.random().toString(36).slice(2, 8)}`, minutes, day, idempotencyKey, now(), habitId);
      if (result.changes !== 1) throw new Error('习惯不存在或已归档');
    },
    async archive(habitId) {
      const database = await getDatabase();
      await database.runAsync("UPDATE habits SET status = 'archived', force_enabled = 0, trigger_time = NULL, updated_at = ? WHERE id = ?", now(), habitId);
    },
  };
}

function mapHabit(row: HabitRow): Habit {
  return { id: row.id, name: row.name, targetMinutes: row.target_minutes, todayMinutes: row.today_minutes,
    forceEnabled: Boolean(row.force_enabled), triggerTime: row.trigger_time, status: row.status };
}
function validateInput(input: CreateHabitInput) {
  if (!input.name.trim()) throw new Error('请输入习惯名称');
  if (input.targetMinutes <= 0) throw new Error('目标分钟数必须大于 0');
  if (input.forceEnabled && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.triggerTime ?? '')) throw new Error('请输入有效触发时间');
}
