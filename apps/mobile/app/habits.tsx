import { useRouter } from 'expo-router';
import { useState } from 'react';

import { HabitCreateForm, HabitList } from '@/modules/habits/components/HabitsPanel';
import { useHabitStore } from '@/modules/habits/habit.store';
import { BottomSheetModal } from '@/ui/bottom-sheet-modal';
import { Button, Text } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

export default function HabitsRoute() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const habits = useHabitStore((state) => state.habits);
  const error = useHabitStore((state) => state.error);
  const create = useHabitStore((state) => state.createHabit);
  const progress = useHabitStore((state) => state.addProgress);
  const archive = useHabitStore((state) => state.archiveHabit);
  return <Screen><PageHeader title="习惯" description="管理每日目标与强制约束。" action={<Button size="sm" variant="secondary" onPress={() => router.back()}>返回</Button>} /><Button onPress={() => setCreateOpen(true)}>创建习惯</Button>{error ? <Text type="body-sm" color="danger">{error}</Text> : null}<HabitList habits={habits} onProgress={progress} onArchive={archive} /><BottomSheetModal visible={createOpen} title="创建习惯" onClose={() => setCreateOpen(false)}><HabitCreateForm onCreate={create} onCreated={() => setCreateOpen(false)} /></BottomSheetModal></Screen>;
}
