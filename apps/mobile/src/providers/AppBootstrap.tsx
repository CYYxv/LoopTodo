import { useEffect, type PropsWithChildren } from 'react';

import { useAuthStore } from '@/modules/auth/auth.store';
import { useHabitStore } from '@/modules/habits/habit.store';
import { useTaskStore } from '@/modules/tasks/task.store';
import { configureForegroundNotifications } from '@/modules/notifications/expo-notification.scheduler';
import { AutoSync } from '@/modules/sync/components/AutoSync';
import { syncStore } from '@/modules/sync/sync.store';

export function AppBootstrap({ children }: PropsWithChildren) {
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const hydrateHabits = useHabitStore((state) => state.hydrate);
  const hydrateTasks = useTaskStore((state) => state.hydrate);
  useEffect(() => { void configureForegroundNotifications(); void hydrateAuth(); void hydrateTasks(); void hydrateHabits(); void syncStore.getState().hydrate(); }, [hydrateAuth, hydrateHabits, hydrateTasks]);
  return <><AutoSync />{children}</>;
}
