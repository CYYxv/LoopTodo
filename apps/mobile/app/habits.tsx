import { useRouter } from 'expo-router';

import { HabitsPanel } from '@/modules/habits/components/HabitsPanel';
import { useHabitStore } from '@/modules/habits/habit.store';
import { Button, Text } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

export default function HabitsRoute() {
  const router = useRouter();
  const habits = useHabitStore((state) => state.habits);
  const error = useHabitStore((state) => state.error);
  const create = useHabitStore((state) => state.createHabit);
  const progress = useHabitStore((state) => state.addProgress);
  const archive = useHabitStore((state) => state.archiveHabit);
  return <Screen><PageHeader title="习惯" description="习惯是今日任务的二级入口。" action={<Button size="sm" variant="secondary" onPress={() => router.back()}>返回</Button>} />{error ? <Text type="body-sm" color="danger">{error}</Text> : null}<HabitsPanel habits={habits} onCreate={create} onProgress={progress} onArchive={archive} /></Screen>;
}
