import { useEffect, type PropsWithChildren } from 'react';

import { useAuthStore } from '@/modules/auth/auth.store';
import { useHabitStore } from '@/modules/habits/habit.store';
import { useTaskStore } from '@/modules/tasks/task.store';

export function AppBootstrap({ children }: PropsWithChildren) {
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const hydrateHabits = useHabitStore((state) => state.hydrate);
  const hydrateTasks = useTaskStore((state) => state.hydrate);
  useEffect(() => { void hydrateAuth(); void hydrateTasks(); void hydrateHabits(); }, [hydrateAuth, hydrateHabits, hydrateTasks]);
  return children;
}
