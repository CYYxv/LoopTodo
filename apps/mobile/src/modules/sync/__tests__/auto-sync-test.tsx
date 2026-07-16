import { act, render, waitFor } from '@testing-library/react-native';

import { authStore } from '@/modules/auth/auth.store';
import { taskStore } from '@/modules/tasks/task.store';
import { syncStore } from '../sync.store';
import { AutoSync } from '../components/AutoSync';

test('starts synchronization automatically for a signed-in account', async () => {
  const syncNow = jest.fn(async () => undefined);
  authStore.setState({ status: 'signed_in', user: { id: 'user', email: 'u@example.com', nickname: 'User', vipStatus: 'free' } });
  syncStore.setState({ configured: true, isSyncing: false, syncNow });

  const screen = await render(<AutoSync />);

  await waitFor(() => expect(syncNow).toHaveBeenCalledTimes(1));
  screen.unmount();
});

test('waits for local tasks to finish hydrating before synchronization', async () => {
  const syncNow = jest.fn(async () => undefined);
  authStore.setState({ status: 'signed_in', user: { id: 'user', email: 'u@example.com', nickname: 'User', vipStatus: 'free' } });
  syncStore.setState({ configured: true, isSyncing: false, syncNow });
  taskStore.setState({ isHydrating: true });

  const screen = await render(<AutoSync />);
  expect(syncNow).not.toHaveBeenCalled();

  await act(async () => { taskStore.setState({ isHydrating: false }); });
  await waitFor(() => expect(syncNow).toHaveBeenCalledTimes(1));
  screen.unmount();
});
