import { taskStore } from '@/modules/tasks/task.store';
import { whitelistStore } from '@/modules/whitelist/whitelist.store';
import { SyncEngine } from '../sync.engine';
import { configureSync, syncStore } from '../sync.store';

test('ignores a second synchronization request while one is running', async () => {
  syncStore.setState({ isSyncing: true, error: null });

  await syncStore.getState().syncNow();

  expect(syncStore.getState().isSyncing).toBe(true);
  expect(syncStore.getState().error).toBeNull();
});

test('force refreshes in-memory whitelists after applying a sync snapshot', async () => {
  const taskHydrate = jest.fn(async () => undefined);
  const whitelistHydrate = jest.fn(async () => undefined);
  const run = jest.spyOn(SyncEngine.prototype, 'run').mockResolvedValue({ pending: 0, conflicts: [], lastError: null });
  taskStore.setState({ hydrate: taskHydrate });
  whitelistStore.setState({ hydrate: whitelistHydrate });
  syncStore.setState({ isSyncing: false, error: null });
  configureSync('https://example.com', 'token');

  await syncStore.getState().syncNow();

  expect(taskHydrate).toHaveBeenCalledTimes(1);
  expect(whitelistHydrate).toHaveBeenCalledWith(true);
  run.mockRestore();
});
