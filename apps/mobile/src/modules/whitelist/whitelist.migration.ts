import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { WhitelistList } from './whitelist.types';

export const legacyWhitelistStorageKey = 'looptodo.focus-whitelist';
export const legacyWhitelistDefaultId = '00000000-0000-4000-8000-000000000001';
const migrationVersion = 8;

type SecureStoreReader = Pick<typeof SecureStore, 'getItemAsync' | 'deleteItemAsync'>;

export async function migrateLegacyWhitelist(database: SQLiteDatabase, storage: SecureStoreReader = SecureStore) {
  const migrated = await database.getFirstAsync<{ version: number }>('SELECT version FROM schema_migrations WHERE version = ?', migrationVersion);
  if (migrated) return;
  const raw = await storage.getItemAsync(legacyWhitelistStorageKey);
  const packages = normalizePackages(raw);
  const timestamp = Date.now();
  const list: WhitelistList = {
    id: legacyWhitelistDefaultId,
    name: '默认名单',
    packages,
    isDefault: true,
    version: 1,
    syncStatus: 'pending',
    archivedAt: null,
  };
  await database.withTransactionAsync(async () => {
    await database.runAsync(`INSERT OR IGNORE INTO whitelist_lists
      (id, name, packages, is_default, version, sync_status, archived_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', NULL, ?, ?)`, list.id, list.name, JSON.stringify(list.packages), 1, list.version, timestamp, timestamp);
    await database.runAsync(`UPDATE tasks SET whitelist_list_id = ?, updated_at = ?
      WHERE restriction_mode = 'whitelist' AND whitelist_mode = 'list' AND whitelist_list_id IS NULL`, list.id, timestamp);
    await database.runAsync('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)', migrationVersion, timestamp);
  });
  if (raw !== null) await storage.deleteItemAsync(legacyWhitelistStorageKey);
}

function normalizePackages(raw: string | null) {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value)
      ? [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
      : [];
  } catch {
    return [];
  }
}
