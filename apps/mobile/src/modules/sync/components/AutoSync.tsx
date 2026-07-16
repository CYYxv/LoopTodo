import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuthStore } from '@/modules/auth/auth.store';
import { useTaskStore } from '@/modules/tasks/task.store';
import { syncStore, useSyncStore } from '../sync.store';

export function AutoSync() {
  const signedIn = useAuthStore((state) => state.status === 'signed_in');
  const configured = useSyncStore((state) => state.configured);
  const tasksHydrating = useTaskStore((state) => state.isHydrating);
  useEffect(() => {
    if (!signedIn || !configured || tasksHydrating) return;
    const sync = () => {
      const state = syncStore.getState();
      if (!state.isSyncing) void state.syncNow();
    };
    sync();
    const interval = setInterval(sync, 60_000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') sync(); });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [configured, signedIn, tasksHydrating]);
  return null;
}
