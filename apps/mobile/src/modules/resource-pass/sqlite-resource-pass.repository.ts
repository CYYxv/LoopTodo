import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import { getLoopTodoDatabase } from '@/modules/tasks/database';
import { createUuid } from '@/shared/uuid';

import { normalizeWebResource } from './resource-pass.policy';
import type { ResourcePassRepository } from './resource-pass.repository';
import type { ResourcePass } from './resource-pass.types';

type Row = { id: string; task_id: string; type: ResourcePass['type']; value: string; display_name: string; value_hash: string; created_at: number };

export function createSQLiteResourcePassRepository(getDatabase: () => Promise<SQLiteDatabase> = getLoopTodoDatabase,
  now: () => number = Date.now): ResourcePassRepository {
  return {
    async list(taskId) { const database = await getDatabase(); return (await database.getAllAsync<Row>('SELECT * FROM resource_passes WHERE task_id = ? ORDER BY created_at ASC', taskId)).map(map); },
    async create(input) {
      const database = await getDatabase(); await assertMutable(database, input.taskId);
      let value = input.type === 'url' || input.type === 'domain' ? normalizeWebResource(input.type, input.value) : input.value;
      if (!value.trim()) throw new Error('资源不能为空');
      let copiedFile: string | null = null;
      if (input.type === 'local_video' || input.type === 'local_file') {
        if (!FileSystem.documentDirectory) throw new Error('应用文件目录不可用');
        const directory = `${FileSystem.documentDirectory}resource-passes/`; await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        const safeName = input.displayName.replace(/[^a-zA-Z0-9._-]/g, '_'); copiedFile = `${directory}${createUuid()}-${safeName}`;
        await FileSystem.copyAsync({ from: value, to: copiedFile }); value = copiedFile;
      }
      const pass: ResourcePass = { id: createUuid(), ...input, value, displayName: input.displayName.trim() || value,
        valueHash: await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${input.type}:${value}`), createdAt: now() };
      try { await database.runAsync('INSERT INTO resource_passes (id, task_id, type, value, display_name, value_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        pass.id, pass.taskId, pass.type, pass.value, pass.displayName, pass.valueHash, pass.createdAt); }
      catch (error) { if (copiedFile) await FileSystem.deleteAsync(copiedFile, { idempotent: true }); throw error; }
      return pass;
    },
    async remove(id) {
      const database = await getDatabase(); const row = await database.getFirstAsync<{ task_id: string; type: ResourcePass['type']; value: string }>('SELECT task_id, type, value FROM resource_passes WHERE id = ?', id);
      if (!row) return; await assertMutable(database, row.task_id); await database.runAsync('DELETE FROM resource_passes WHERE id = ?', id);
      if (row.type === 'local_video' || row.type === 'local_file') await FileSystem.deleteAsync(row.value, { idempotent: true });
    },
  };
}

async function assertMutable(database: SQLiteDatabase, taskId: string) {
  if (await database.getFirstAsync('SELECT 1 FROM active_sessions WHERE task_id = ? LIMIT 1', taskId)) throw new Error('专注进行中不能修改资源通行证');
}
function map(row: Row): ResourcePass { return { id: row.id, taskId: row.task_id, type: row.type, value: row.value, displayName: row.display_name, valueHash: row.value_hash, createdAt: row.created_at }; }
