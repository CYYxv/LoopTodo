import type { SQLiteDatabase } from 'expo-sqlite';

import { enqueueSyncOperation } from '@/modules/sync/sqlite-sync.repository';
import { getLoopTodoDatabase } from '@/modules/tasks/database';
import { createUuid } from '@/shared/uuid';

import type { WhitelistRepository } from './whitelist.repository';
import type { WhitelistList } from './whitelist.types';

type WhitelistRow = {
  id: string;
  name: string;
  packages: string;
  is_default: number;
  version: number;
  sync_status: WhitelistList['syncStatus'];
  archived_at: number | null;
};

export function createSQLiteWhitelistRepository(
  getDatabase: () => Promise<SQLiteDatabase> = getLoopTodoDatabase,
  now: () => number = Date.now,
  uuid: () => string = createUuid,
): WhitelistRepository {
  return {
    async hydrate() {
      const database = await getDatabase();
      const rows = await database.getAllAsync<WhitelistRow>(`SELECT id, name, packages, is_default, version, sync_status, archived_at
        FROM whitelist_lists WHERE archived_at IS NULL ORDER BY is_default DESC, created_at ASC`);
      return rows.map(mapList);
    },
    async create(name, packages) {
      const database = await getDatabase();
      const timestamp = now();
      const id = uuid();
      const normalized = normalizedName(name);
      const normalizedPackages = normalizePackages(packages);
      let list: WhitelistList | null = null;
      await database.withTransactionAsync(async () => {
        await database.runAsync(`INSERT INTO whitelist_lists
          (id, name, packages, is_default, version, sync_status, archived_at, created_at, updated_at)
          SELECT ?, ?, ?, CASE WHEN NOT EXISTS (
            SELECT 1 FROM whitelist_lists WHERE archived_at IS NULL
          ) THEN 1 ELSE 0 END, 1, 'pending', NULL, ?, ?`, id, normalized, JSON.stringify(normalizedPackages), timestamp, timestamp);
        const created = await database.getFirstAsync<WhitelistRow>(`SELECT id, name, packages, is_default, version, sync_status, archived_at
          FROM whitelist_lists WHERE id = ?`, id);
        if (!created) throw new Error('创建白名单失败');
        list = mapList(created);
        await enqueueSyncOperation(database, { type: 'whitelist.create', list }, list.id, `whitelist-create-${list.id}`, timestamp);
      });
      if (!list) throw new Error('创建白名单失败');
      return list;
    },
    async update(list, previousVersion) {
      const database = await getDatabase();
      const next = { ...list, name: normalizedName(list.name), packages: normalizePackages(list.packages) };
      await database.withTransactionAsync(async () => {
        const result = await database.runAsync(`UPDATE whitelist_lists SET name = ?, packages = ?, version = ?, sync_status = 'pending', updated_at = ?
          WHERE id = ? AND version = ? AND archived_at IS NULL`, next.name, JSON.stringify(next.packages), next.version, now(), next.id, previousVersion);
        if (result.changes !== 1) throw new Error('名单已被其他设备更新');
        await enqueueSyncOperation(database, { type: 'whitelist.update', listId: next.id, version: previousVersion,
          name: next.name, packages: next.packages }, next.id, `whitelist-update-${next.id}-${next.version}`, now());
      });
    },
    async setDefault(id, previousVersion) {
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        const exists = await database.getFirstAsync<{ id: string }>('SELECT id FROM whitelist_lists WHERE id = ? AND version = ? AND archived_at IS NULL', id, previousVersion);
        if (!exists) throw new Error('名单已被其他设备更新');
        await database.runAsync('UPDATE whitelist_lists SET is_default = 0 WHERE archived_at IS NULL');
        const result = await database.runAsync(`UPDATE whitelist_lists SET is_default = 1, version = version + 1,
          sync_status = 'pending', updated_at = ? WHERE id = ? AND version = ? AND archived_at IS NULL`, now(), id, previousVersion);
        if (result.changes !== 1) throw new Error('名单已被其他设备更新');
        await enqueueSyncOperation(database, { type: 'whitelist.set-default', listId: id, version: previousVersion }, id,
          `whitelist-default-${id}-${previousVersion}`, now());
      });
    },
    async countReferences(id) {
      const database = await getDatabase();
      const result = await database.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM tasks
        WHERE whitelist_list_id = ? AND restriction_mode = 'whitelist' AND whitelist_mode = 'list' AND status != 'archived'`, id);
      return result?.count ?? 0;
    },
    async archive(id, version, replacementId) {
      const database = await getDatabase();
      const activeLists = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM whitelist_lists WHERE archived_at IS NULL');
      if ((activeLists?.count ?? 0) <= 1) throw new Error('至少保留一份白名单');
      const target = await database.getFirstAsync<{ id: string; is_default: number }>(
        'SELECT id, is_default FROM whitelist_lists WHERE id = ? AND archived_at IS NULL', id,
      );
      if (!target) throw new Error('白名单不存在');
      if (Boolean(target.is_default)) throw new Error('请先设置新的默认白名单');
      const referenceCount = await this.countReferences(id);
      if (referenceCount > 0 && !replacementId) throw new Error('请选择替代名单');
      if (replacementId) {
        const replacement = await database.getFirstAsync<{ id: string }>(
          'SELECT id FROM whitelist_lists WHERE id = ? AND is_default = 1 AND archived_at IS NULL', replacementId,
        );
        if (!replacement) throw new Error('只能改用默认白名单');
      }
      const timestamp = now();
      await database.withTransactionAsync(async () => {
        if (replacementId) await database.runAsync(`UPDATE tasks SET whitelist_list_id = ?, version = version + 1,
          sync_status = 'pending', updated_at = ? WHERE whitelist_list_id = ?
          AND restriction_mode = 'whitelist' AND whitelist_mode = 'list' AND status != 'archived'`, replacementId, timestamp, id);
        const result = await database.runAsync(`UPDATE whitelist_lists SET archived_at = ?, is_default = 0, version = version + 1,
          sync_status = 'pending', updated_at = ? WHERE id = ? AND version = ? AND archived_at IS NULL`, timestamp, timestamp, id, version);
        if (result.changes !== 1) throw new Error('名单已被其他设备更新');
        await enqueueSyncOperation(database, { type: 'whitelist.delete', listId: id, version, replacementId }, id,
          `whitelist-delete-${id}-${version}`, timestamp);
      });
    },
  };
}

function mapList(row: WhitelistRow): WhitelistList {
  return { id: row.id, name: row.name, packages: parsePackages(row.packages), isDefault: Boolean(row.is_default),
    version: row.version, syncStatus: row.sync_status, archivedAt: row.archived_at };
}

function normalizedName(name: string) {
  const value = name.trim();
  if (!value) throw new Error('请输入名单名称');
  return value;
}

function normalizePackages(packages: string[]) {
  return [...new Set(packages.map((item) => item.trim()).filter(Boolean))];
}

function parsePackages(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? normalizePackages(value.filter((item): item is string => typeof item === 'string')) : [];
  } catch {
    return [];
  }
}
