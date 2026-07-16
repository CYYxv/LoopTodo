import { syncStore } from '../sync.store';

test('ignores a second synchronization request while one is running', async () => {
  syncStore.setState({ isSyncing: true, error: null });

  await syncStore.getState().syncNow();

  expect(syncStore.getState().isSyncing).toBe(true);
  expect(syncStore.getState().error).toBeNull();
});
