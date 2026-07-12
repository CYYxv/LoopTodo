import type { SQLiteDatabase } from 'expo-sqlite';

import { createSQLiteResourcePassRepository } from '../sqlite-resource-pass.repository';

describe('resource pass repository', () => {
  test('rejects whitelist changes while the task is active', async () => {
    const database = { async getFirstAsync() { return { active: 1 }; } } as unknown as SQLiteDatabase;
    const repository = createSQLiteResourcePassRepository(async () => database);

    await expect(repository.create({ taskId: 'task', type: 'url', value: 'https://example.com/material', displayName: 'material' }))
      .rejects.toThrow('专注进行中不能修改资源通行证');
  });
});
