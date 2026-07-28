import { useEffect, type PropsWithChildren } from 'react';

import { authStore, useAuthStore } from '@/modules/auth/auth.store';
import { useHabitStore } from '@/modules/habits/habit.store';
import { useTaskStore } from '@/modules/tasks/task.store';
import { configureForegroundNotifications } from '@/modules/notifications/expo-notification.scheduler';
import { AutoSync } from '@/modules/sync/components/AutoSync';
import { syncStore } from '@/modules/sync/sync.store';

export function AppBootstrap({ children }: PropsWithChildren) {
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const hydrateHabits = useHabitStore((state) => state.hydrate);
  const hydrateTasks = useTaskStore((state) => state.hydrate);
  useEffect(() => {
    void configureForegroundNotifications();
    void hydrateApplicationData({
      hydrateAuth,
      getAuthStatus: () => authStore.getState().status,
      hydrateTasks,
      hydrateHabits,
      hydrateSync: () => syncStore.getState().hydrate(),
    });
  }, [hydrateAuth, hydrateHabits, hydrateTasks]);
  return <><AutoSync />{children}</>;
}

export async function hydrateApplicationData(input: {
  hydrateAuth(): Promise<void>;
  getAuthStatus(): 'hydrating' | 'signed_out' | 'signed_in';
  hydrateTasks(restoreActiveSession?: boolean): Promise<void>;
  hydrateHabits(): Promise<void>;
  hydrateSync(): Promise<void>;
}) {
  await input.hydrateAuth();
  await Promise.all([
    input.hydrateTasks(input.getAuthStatus() === 'signed_in'),
    input.hydrateHabits(),
    input.hydrateSync(),
  ]);
}
