import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Surface } from 'heroui-native/surface';

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
  const completed = habits.filter((habit) => habit.todayMinutes >= habit.targetMinutes).length;
  return <Screen><PageHeader title="习惯" description="记录今天的习惯进度" action={<Button size="sm" onPress={() => setCreateOpen(true)}>创建习惯</Button>} /><View className="flex-row gap-3"><Surface variant="secondary" className="flex-1 rounded-3xl border border-border/60 p-4"><Text type="body-xs" color="muted">进行中</Text><Text type="h3" weight="bold" color="accent">{habits.length}</Text></Surface><Surface variant="secondary" className="flex-1 rounded-3xl border border-border/60 p-4"><Text type="body-xs" color="muted">今日达成</Text><Text type="h3" weight="bold" color="accent">{completed}</Text></Surface></View>{error ? <Text type="body-sm" color="danger">{error}</Text> : null}<HabitList habits={habits} onProgress={progress} onArchive={archive} onOpen={(habitId) => router.push({ pathname: '/habit/[id]', params: { id: habitId } })} /><BottomSheetModal visible={createOpen} title="创建习惯" onClose={() => setCreateOpen(false)}><HabitCreateForm onCreate={create} onCreated={() => setCreateOpen(false)} /></BottomSheetModal></Screen>;
}
