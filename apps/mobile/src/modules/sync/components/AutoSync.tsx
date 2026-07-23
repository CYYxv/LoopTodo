import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuthStore } from '@/modules/auth/auth.store';
import { useSettingsStore } from '@/modules/settings/settings.store';
import { useTaskStore } from '@/modules/tasks/task.store';
import { syncStore, useSyncStore } from '../sync.store';

export function AutoSync() {
  const signedIn = useAuthStore((state) => state.status === 'signed_in');
  const configured = useSyncStore((state) => state.configured);
  const tasksHydrating = useTaskStore((state) => state.isHydrating);
  const multiDeviceFocusSync = useSettingsStore((state) => state.value?.multiDeviceFocusSync === true);
  const hasRemoteActive = useTaskStore((state) => state.tasks.some((task) => task.remoteActive));

  useEffect(() => {
    if (!signedIn || !configured || tasksHydrating) return;
    const sync = () => {
      const state = syncStore.getState();
      if (!state.isSyncing) void state.syncNow();
    };
    sync();
    // PRD: multi-device focus sync is HTTP-based (not native lock on other devices).
    // Faster pull when multi-device enabled or a remote session is active.
    const intervalMs = multiDeviceFocusSync || hasRemoteActive ? 15_000 : 60_000;
    const interval = setInterval(sync, intervalMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [configured, signedIn, tasksHydrating, multiDeviceFocusSync, hasRemoteActive]);

  return null;
}
